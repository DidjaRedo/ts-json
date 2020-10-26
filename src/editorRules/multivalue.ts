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
import { JsonEditFailureReason, JsonEditorRule } from '../jsonEditorRule';
import { JsonEditorContext, JsonEditorState } from '../jsonEditorState';
import { JsonObject, JsonValue } from '../common';

export class MultiValuePropertyParts {
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

        const valueParts = parts[1].split(',');
        return captureResult(() => new MultiValuePropertyParts(token, parts[0], valueParts)).withDetail('error');
    }
}

export class MultiValueJsonEditorRule implements JsonEditorRule {
    protected _defaultContext?: JsonEditorContext;

    public constructor(context?: JsonEditorContext) {
        this._defaultContext = context;
    }

    public static create(context?: JsonEditorContext): Result<MultiValueJsonEditorRule> {
        return captureResult(() => new MultiValueJsonEditorRule(context));
    }

    public editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonEditFailureReason> {
        const json: JsonObject = {};
        return MultiValuePropertyParts.tryParse(key).onSuccess((parts) => {
            return allSucceed(parts.propertyValues.map((pv) => {
                return this._deriveContext(state, [parts.propertyVariable, pv]).onSuccess((ctx) => {
                    return state.editor.clone(value, ctx).onSuccess((cloned) => {
                        json[pv] = cloned;
                        return succeedWithDetail(cloned);
                    });
                });
            }), json).withFailureDetail('error');
        });
    }

    public editValue(_value: JsonValue, _state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason> {
        return failWithDetail('inapplicable', 'inapplicable');
    }

    protected _deriveContext(state: JsonEditorState, ...values: [string, unknown][]): Result<JsonEditorContext|undefined> {
        return state.extendContext(this._defaultContext, { vars: values });
    }
}
