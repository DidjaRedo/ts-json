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

export class JsonObjectEditor<TC extends JsonEditorContext = JsonEditorContext> {
    protected _rules: JsonEditorRule<TC>[];
    protected _defaultContext: JsonEditorContext;

    protected constructor(context?: JsonEditorContext, rules?: JsonEditorRule<TC>[]) {
        this._rules = rules || [];
        this._defaultContext = context || {};
    }

    public static create<TC extends JsonEditorContext = JsonEditorContext>(
        context?: JsonEditorContext,
        rules?: JsonEditorRule<TC>[],
    ): Result<JsonObjectEditor<TC>> {
        return captureResult(() => new JsonObjectEditor(context, rules));
    }

    public mergeInPlace(target: JsonObject, src: JsonObject, context?: TC): Result<JsonObject> {
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                const propResult = this._editProperty(key, src[key], context);
                if (propResult.isSuccess()) {
                    const mergeResult = this.mergeInPlace(target, propResult.value, context);
                    if (mergeResult.isFailure()) {
                        return mergeResult;
                    }
                }
                else if (propResult.detail === 'inapplicable') {
                    const valueResult = this.cloneValue(src[key], context).onSuccess((cloned) => {
                        return this._mergeClonedProperty(target, key, cloned, context);
                    });

                    if (valueResult.isFailure() && (valueResult.detail === 'error')) {
                        return fail(`${key}: ${valueResult.message}`);
                    }
                }
            }
        }
        return succeed(target);
    }

    public cloneValue(src: JsonValue, context?: TC): DetailedResult<JsonValue, JsonEditFailureReason> {
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
            return this.mergeInPlace({}, value, context).withFailureDetail('error');
        }
        else if (isJsonArray(src)) {

        }
        return succeedWithDetail(value, 'edited');
    }

    protected _cloneArray(src: JsonArray, context?: TC): DetailedResult<JsonArray, JsonEditFailureReason> {
        const results = src.map((v) => {
            return this.cloneValue(v, context);
        });

        return mapDetailedResults<JsonValue, JsonEditFailureReason>(results, ['ignore']).onSuccess((converted) => {
            return succeed(converted);
        }).withFailureDetail('error');
    }

    protected _mergeClonedProperty(target: JsonObject, key: string, newValue: JsonValue, context?: TC): DetailedResult<JsonValue, JsonEditFailureReason> {
        const existing = target[key];

        if (newValue === undefined) {
            return failWithDetail('undefined ignored', 'ignore');
        }

        if ((existing === undefined) || (newValue === null) || isJsonPrimitive(newValue) || isJsonPrimitive(existing)) {
            target[key] = newValue;
            return succeedWithDetail(newValue, 'edited');
        }

        if (isJsonArray(existing) && isJsonArray(newValue)) {
            target[key] = existing.concat(...newValue);
            return succeedWithDetail(existing, 'edited');
        }

        if (isJsonObject(existing) && isJsonObject(newValue)) {
            return this.mergeInPlace(existing, newValue, context).withFailureDetail('error');
        }

        if (typeof newValue !== 'object') {
            return failWithDetail(`Invalid json: ${JSON.stringify(newValue)}`, 'error');
        }

        target[key] = newValue;
        return succeedWithDetail(newValue, 'edited');
    }

    protected _editProperty(key: string, value: JsonValue, context?: TC): DetailedResult<JsonObject, JsonEditFailureReason> {
        for (const rule of this._rules) {
            const ruleResult = rule.editProperty(key, value, context);
            if (ruleResult.isSuccess() || (ruleResult.detail === 'error')) {
                return ruleResult;
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    protected _editValue(value: JsonValue, context?: TC): DetailedResult<JsonValue, JsonEditFailureReason> {
        for (const rule of this._rules) {
            const ruleResult = rule.editValue(value, context);
            if (ruleResult.isSuccess() || (ruleResult.detail === 'error')) {
                return ruleResult;
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }
}

