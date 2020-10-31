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

import { DetailedResult, Result, captureResult, fail, failWithDetail, succeed, succeedWithDetail } from '@fgv/ts-utils';
import { JsonEditFailureReason, JsonEditorRuleBase, JsonPropertyEditFailureReason } from '../jsonEditorRule';
import { JsonEditorOptions, JsonEditorState } from '../jsonEditorState';
import { JsonObject, JsonValue, isJsonObject, pickJsonObject } from '../../common';
import { TemplateVars } from '../../jsonContext';

export class ReferenceJsonEditorRule extends JsonEditorRuleBase {
    protected _defaultContext?: JsonEditorOptions;

    public constructor(context?: JsonEditorOptions) {
        super();
        this._defaultContext = context;
    }

    public static create(context?: JsonEditorOptions): Result<ReferenceJsonEditorRule> {
        return captureResult(() => new ReferenceJsonEditorRule(context));
    }

    public editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonPropertyEditFailureReason> {
        // istanbul ignore next
        const refs = state.getRefs(this._defaultContext);
        if (refs?.has(key)) {
            // istanbul ignore next
            const varsResult = this._deriveVars(state, value);
            if (varsResult.isSuccess()) {
                const objResult = refs.getJsonObject(key, varsResult.value, refs);
                // guarded by the has above so should never happen
                // istanbul ignore else
                if (objResult.isSuccess()) {
                    if ((typeof value !== 'string') || (value === 'default')) {
                        return succeedWithDetail<JsonObject, JsonEditFailureReason>(objResult.value, 'edited');
                    }
                    return pickJsonObject(objResult.value, value).withDetail('error');
                }
                else if (objResult.detail !== 'unknown') {
                    return failWithDetail(`${key}: ${objResult.message}`, 'error');
                }
            }
            else {
                return failWithDetail(`${key}: ${varsResult.message}`, 'error');
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    public editValue(value: JsonValue, state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason> {
        // istanbul ignore next
        const refs = state.getRefs(this._defaultContext);

        if (refs && (typeof value === 'string')) {
            // istanbul ignore next
            const vars = state.getVars(this._defaultContext);
            const result = refs.getJsonObject(value, vars);
            if (result.isSuccess()) {
                return succeedWithDetail(result.value, 'edited');
            }
            else if (result.detail === 'error') {
                return failWithDetail(result.message, 'error');
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    /**
     * Gets the template variables to use given the value of some property whose name matched a
     * resource plus the base template context.
     * @param supplied The string or object supplied in the source json
     * @param baseVars The context in effect at the point of resolution
     */
    protected _deriveVars(state: JsonEditorState, supplied: JsonValue): Result<TemplateVars|undefined> {
        // istanbul ignore next
        const context = state.getVars(this._defaultContext);
        if (isJsonObject(supplied)) {
            return state.extendVars(context, Object.entries(supplied));
        }
        else if (typeof supplied !== 'string') {
            return fail(`Invalid template path or context: "${JSON.stringify(supplied)}"`);
        }
        return succeed(context);
    }
}
