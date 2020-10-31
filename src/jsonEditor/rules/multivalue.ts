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

import { DetailedResult, Result, allSucceed, captureResult, failWithDetail, succeedWithDetail } from '@fgv/ts-utils';
import { JsonContext, VariableValue } from '../../jsonContext';
import { JsonEditFailureReason, JsonEditorRuleBase, JsonPropertyEditFailureReason } from '../jsonEditorRule';
import { JsonEditorOptions, JsonEditorState } from '../jsonEditorState';
import { JsonObject, JsonValue } from '../../common';

class MultiValuePropertyParts {
    public readonly token: string;
    public readonly propertyVariable: string;
    public readonly propertyValues: string[];

    public constructor(token: string, propertyVariable: string, values: string[]) {
        this.token = token;
        this.propertyVariable = propertyVariable;
        this.propertyValues = values;
    }

    public static tryParse(token: string): DetailedResult<MultiValuePropertyParts, JsonEditFailureReason> {
        if (!token.startsWith('[[')) {
            return failWithDetail(token, 'inapplicable');
        }

        const parts = token.substring(2).split(']]=');
        if (parts.length !== 2) {
            return failWithDetail(`Malformed multi-value property: ${token}`, 'error');
        }

        if (parts[1].includes('{{')) {
            return failWithDetail('unresolved template', 'inapplicable');
        }

        const valueParts = parts[1].split(',');
        return captureResult(() => new MultiValuePropertyParts(token, parts[0], valueParts)).withDetail('error');
    }
}

export class MultiValueJsonEditorRule extends JsonEditorRuleBase {
    protected _options?: JsonEditorOptions;

    public constructor(options?: JsonEditorOptions) {
        super();
        this._options = options;
    }

    public static create(options?: JsonEditorOptions): Result<MultiValueJsonEditorRule> {
        return captureResult(() => new MultiValueJsonEditorRule(options));
    }

    public editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonPropertyEditFailureReason> {
        const json: JsonObject = {};
        const result = MultiValuePropertyParts.tryParse(key).onSuccess((parts) => {
            return allSucceed(parts.propertyValues.map((pv) => {
                return this._deriveContext(state, [parts.propertyVariable, pv]).onSuccess((ctx) => {
                    return state.editor.clone(value, ctx).onSuccess((cloned) => {
                        json[pv] = cloned;
                        return succeedWithDetail(cloned);
                    });
                });
            }), json).withFailureDetail('error');
        });

        if (result.isFailure() && (result.detail === 'error')) {
            return state.failValidation('invalidPropertyName', result.message);
        }
        return result;
    }

    protected _deriveContext(state: JsonEditorState, ...values: VariableValue[]): Result<JsonContext|undefined> {
        return state.extendContext(this._options?.context, { vars: values });
    }
}
