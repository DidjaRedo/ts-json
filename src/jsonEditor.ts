/*
 * Copyright (c) 2020 Erik Fortune
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
    DetailedResult,
    Result,
    captureResult,
    fail,
    failWithDetail,
    mapDetailedResults,
    succeed,
    succeedWithDetail,
} from '@fgv/ts-utils';

import { JsonArray, JsonObject, JsonValue, isJsonArray, isJsonObject, isJsonPrimitive } from './common';
import { JsonEditFailureReason, JsonEditorContext, JsonEditorRule } from './jsonEditorRules';

export class JsonEditor<TC extends JsonEditorContext = JsonEditorContext> {
    protected _rules: JsonEditorRule<TC>[];
    protected _defaultContext?: TC;

    protected constructor(context?: TC, rules?: JsonEditorRule<TC>[]) {
        this._rules = rules || [];
        this._defaultContext = context;
    }

    public static create<TC extends JsonEditorContext = JsonEditorContext>(
        context?: TC,
        rules?: JsonEditorRule<TC>[],
    ): Result<JsonEditor<TC>> {
        return captureResult(() => new JsonEditor(context, rules));
    }

    public mergeObjectInPlace(target: JsonObject, src: JsonObject, context?: TC): Result<JsonObject> {
        context = this._effectiveContext(context);
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                const propResult = this._editProperty(key, src[key], context);
                if (propResult.isSuccess()) {
                    const mergeResult = this.mergeObjectInPlace(target, propResult.value, context);
                    if (mergeResult.isFailure()) {
                        return mergeResult;
                    }
                }
                else if (propResult.detail === 'inapplicable') {
                    const valueResult = this.clone(src[key], context).onSuccess((cloned) => {
                        return this._mergeClonedProperty(target, key, cloned, context);
                    });

                    if (valueResult.isFailure() && (valueResult.detail === 'error')) {
                        return fail(`${key}: ${valueResult.message}`);
                    }
                }
                else if (propResult.detail === 'error') {
                    return fail(`${key}: ${propResult.message}`);
                }
            }
            else {
                return fail(`${key}: Cannot merge inherited properties`);
            }
        }
        return succeed(target);
    }

    public mergeObjectsInPlace(base: JsonObject, ...srcObjects: JsonObject[]): Result<JsonObject> {
        return this.mergeObjectsInPlaceWithContext(this._defaultContext, base, ...srcObjects);
    }

    public mergeObjectsInPlaceWithContext(context: TC|undefined, base: JsonObject, ...srcObjects: JsonObject[]): Result<JsonObject> {
        for (const src of srcObjects) {
            const mergeResult = this.mergeObjectInPlace(base, src, context);
            if (mergeResult.isFailure()) {
                return mergeResult.withFailureDetail('error');
            }
        }
        return succeedWithDetail(base);
    }

    public clone(src: JsonValue, context?: TC): DetailedResult<JsonValue, JsonEditFailureReason> {
        context = this._effectiveContext(context);
        let value = src;
        let valueResult = this._editValue(src, context);

        while (valueResult.isSuccess()) {
            value = valueResult.value;
            valueResult = this._editValue(value, context);
        }

        if ((valueResult.detail === 'error') || (valueResult.detail === 'ignore')) {
            return valueResult;
        }

        if (isJsonObject(value)) {
            return this.mergeObjectInPlace({}, value, context).withFailureDetail('error');
        }
        else if (isJsonArray(value)) {
            return this._cloneArray(value, context);
        }
        else if (isJsonPrimitive(value)) {
            return succeedWithDetail(value, 'edited');
        }
        else if (value === undefined) {
            return failWithDetail('Undefined is ignored', 'ignore');
        }
        return failWithDetail(`Invalid JSON: ${JSON.stringify(value)}`, 'error');
    }

    protected _cloneArray(src: JsonArray, context?: TC): DetailedResult<JsonArray, JsonEditFailureReason> {
        const results = src.map((v) => {
            return this.clone(v, context);
        });

        return mapDetailedResults<JsonValue, JsonEditFailureReason>(results, ['ignore']).onSuccess((converted) => {
            return succeed(converted);
        }).withFailureDetail('error');
    }

    protected _mergeClonedProperty(target: JsonObject, key: string, newValue: JsonValue, context?: TC): DetailedResult<JsonValue, JsonEditFailureReason> {
        const existing = target[key];

        // merge is called right after clone so this should never happen
        // since clone itself will have failed
        // istanbul ignore else
        if (isJsonPrimitive(newValue)) {
            target[key] = newValue;
            return succeedWithDetail(newValue, 'edited');
        }
        else if (isJsonObject(newValue)) {
            if (isJsonObject(existing)) {
                return this.mergeObjectInPlace(existing, newValue, context).withFailureDetail('error');
            }
            target[key] = newValue;
            return succeedWithDetail(newValue, 'edited');
        }
        else if (isJsonArray(newValue)) {
            if (isJsonArray(existing)) {
                target[key] = existing.concat(...newValue);
                return succeedWithDetail(target[key], 'edited');
            }
            target[key] = newValue;
            return succeedWithDetail(newValue, 'edited');
        }
        else {
            return failWithDetail(`Invalid JSON: ${JSON.stringify(newValue)}`, 'error');
        }
    }

    protected _effectiveContext(added?: TC): TC|undefined {
        const baseContext = this._defaultContext;
        if (baseContext) {
            if (!added) {
                return baseContext;
            }
            return { ...baseContext, ...added };
        }
        return added;
    }

    protected _editProperty(key: string, value: JsonValue, context?: TC): DetailedResult<JsonObject, JsonEditFailureReason> {
        for (const rule of this._rules) {
            const ruleResult = rule.editProperty(key, value, context);
            if (ruleResult.isSuccess() || (ruleResult.detail !== 'inapplicable')) {
                return ruleResult;
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    protected _editValue(value: JsonValue, context?: TC): DetailedResult<JsonValue, JsonEditFailureReason> {
        for (const rule of this._rules) {
            const ruleResult = rule.editValue(value, context);
            if (ruleResult.isSuccess() || (ruleResult.detail !== 'inapplicable')) {
                return ruleResult;
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }
}

