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
    ConditionalJsonEditorRule,
    MultiValueJsonEditorRule,
    ReferenceJsonEditorRule,
    TemplatedJsonEditorRule,
} from './rules';
import {
    DetailedResult,
    Result,
    captureResult,
    fail,
    failWithDetail,
    mapDetailedResults,
    mapResults,
    succeed,
    succeedWithDetail,
} from '@fgv/ts-utils';

import { JsonArray, JsonObject, JsonValue, isJsonArray, isJsonObject, isJsonPrimitive } from '../common';
import { JsonEditFailureReason, JsonEditorRule, JsonPropertyEditFailureReason } from './jsonEditorRule';
import { JsonEditorOptions, JsonEditorState } from './jsonEditorState';

import { JsonContext } from '../jsonContext';

export class JsonEditor {
    protected static _default?: JsonEditor;

    public options?: JsonEditorOptions;
    protected _rules: JsonEditorRule[];

    protected constructor(options?: JsonEditorOptions, rules?: JsonEditorRule[]) {
        this._rules = rules || JsonEditor.getDefaultRules(options).getValueOrThrow();
        this.options = options;
    }

    public static create(context?: JsonEditorOptions, rules?: JsonEditorRule[]): Result<JsonEditor> {
        return captureResult(() => new JsonEditor(context, rules));
    }

    public static getDefaultRules(context?: JsonEditorOptions): Result<JsonEditorRule[]> {
        return mapResults<JsonEditorRule>([
            TemplatedJsonEditorRule.create(context),
            ConditionalJsonEditorRule.create(context),
            MultiValueJsonEditorRule.create(context),
            ReferenceJsonEditorRule.create(context),
        ]);
    }

    public static get default(): JsonEditor {
        if (!JsonEditor._default) {
            const rules = this.getDefaultRules().getValueOrDefault();
            JsonEditor._default = new JsonEditor(undefined, rules);
        }
        return JsonEditor._default;
    }

    public mergeObjectInPlace(target: JsonObject, src: JsonObject, runtimeContext?: JsonContext): Result<JsonObject> {
        const state = new JsonEditorState(this, this.options, runtimeContext);
        return this._mergeObjectInPlace(target, src, state);
    }

    public mergeObjectsInPlace(base: JsonObject, ...srcObjects: JsonObject[]): Result<JsonObject> {
        return this.mergeObjectsInPlaceWithContext(this.options, base, ...srcObjects);
    }

    public mergeObjectsInPlaceWithContext(context: JsonContext|undefined, base: JsonObject, ...srcObjects: JsonObject[]): Result<JsonObject> {
        for (const src of srcObjects) {
            const mergeResult = this.mergeObjectInPlace(base, src, context);
            if (mergeResult.isFailure()) {
                return mergeResult.withFailureDetail('error');
            }
        }
        return succeedWithDetail(base);
    }

    public clone(src: JsonValue, runtimeContext?: JsonContext): DetailedResult<JsonValue, JsonEditFailureReason> {
        const state = new JsonEditorState(this, this.options, runtimeContext);
        let value = src;
        let valueResult = this._editValue(src, state);

        while (valueResult.isSuccess()) {
            value = valueResult.value;
            valueResult = this._editValue(value, state);
        }

        if ((valueResult.detail === 'error') || (valueResult.detail === 'ignore')) {
            return valueResult;
        }

        if (isJsonPrimitive(value) || (value === null)) {
            return succeedWithDetail(value, 'edited');
        }
        else if (isJsonObject(value)) {
            return this.mergeObjectInPlace({}, value, state.context).withFailureDetail('error');
        }
        else if (isJsonArray(value)) {
            return this._cloneArray(value, state.context);
        }
        else if (value === undefined) {
            return state.failValidation('undefinedPropertyValue');
        }
        return state.failValidation('invalidPropertyValue', `Cannot convert invalid JSON: "${JSON.stringify(value)}"`);
    }

    protected _mergeObjectInPlace(target: JsonObject, src: JsonObject, state: JsonEditorState): Result<JsonObject> {
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                const propResult = this._editProperty(key, src[key], state);
                if (propResult.isSuccess()) {
                    if (propResult.detail === 'deferred') {
                        state.defer(propResult.value);
                    }
                    else {
                        const mergeResult = this._mergeObjectInPlace(target, propResult.value, state);
                        if (mergeResult.isFailure()) {
                            return mergeResult;
                        }
                    }
                }
                else if (propResult.detail === 'inapplicable') {
                    const valueResult = this.clone(src[key], state.context).onSuccess((cloned) => {
                        return this._mergeClonedProperty(target, key, cloned, state);
                    });

                    if (valueResult.isFailure() && (valueResult.detail === 'error')) {
                        return fail(`${key}: ${valueResult.message}`);
                    }
                }
                else if (propResult.detail !== 'ignore') {
                    return fail(`${key}: ${propResult.message}`);
                }
            }
            else {
                return fail(`${key}: Cannot merge inherited properties`);
            }
        }

        const deferResult = this._finalizeProperties(state.deferred, state);
        if (deferResult.isSuccess() && deferResult.value.length > 0) {
            return this.mergeObjectsInPlaceWithContext(state.context, target, ...deferResult.value);
        }

        return succeed(target);
    }

    protected _cloneArray(src: JsonArray, context?: JsonContext): DetailedResult<JsonArray, JsonEditFailureReason> {
        const results = src.map((v) => {
            return this.clone(v, context);
        });

        return mapDetailedResults<JsonValue, JsonEditFailureReason>(results, ['ignore']).onSuccess((converted) => {
            return succeed(converted);
        }).withFailureDetail('error');
    }

    protected _mergeClonedProperty(target: JsonObject, key: string, newValue: JsonValue, state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason> {
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
                return this.mergeObjectInPlace(existing, newValue, state.context).withFailureDetail('error');
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

    protected _editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonPropertyEditFailureReason> {
        for (const rule of this._rules) {
            const ruleResult = rule.editProperty(key, value, state);
            if (ruleResult.isSuccess() || (ruleResult.detail !== 'inapplicable')) {
                return ruleResult;
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    protected _editValue(value: JsonValue, state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason> {
        for (const rule of this._rules) {
            const ruleResult = rule.editValue(value, state);
            if (ruleResult.isSuccess() || (ruleResult.detail !== 'inapplicable')) {
                return ruleResult;
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    protected _finalizeProperties(deferred: JsonObject[], state: JsonEditorState): DetailedResult<JsonObject[], JsonEditFailureReason> {
        for (const rule of this._rules) {
            const ruleResult = rule.finalizeProperties(deferred, state);
            if (ruleResult.isSuccess() || (ruleResult.detail !== 'inapplicable')) {
                return ruleResult;
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }
}

