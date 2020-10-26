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
/*
import { DetailedResult, Result, captureResult, fail, failWithDetail, succeed } from '@fgv/ts-utils';
import { JsonEditFailureReason, JsonEditorContext, JsonEditorRule } from '../jsonEditorRule';
import { JsonObject, JsonValue } from '../common';
import { deriveTemplateContext, TemplateContext } from '../templateContext';

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

export class MultiValueJsonEditorRule<TC extends JsonEditorContext = JsonEditorContext> implements JsonEditorRule<TC> {
    protected _defaultContext?: TC;

    public constructor(context?: TC) {
        this._defaultContext = context;
    }

    public static create<TC extends JsonEditorContext = JsonEditorContext>(context?: TC): Result<MultiValueJsonEditorRule> {
        return captureResult(() => new MultiValueJsonEditorRule(context));
    }

    public editProperty(key: string, value: JsonValue, context?: TC): DetailedResult<JsonObject, JsonEditFailureReason> {
        return MultiValuePropertyParts.tryParse(key).onSuccess((parts) => {
            return parts.propertyValues.map((pv) => {
                return this._deriveVars(context, [parts.propertyVariable, pv]).onSuccess((vars) => {

                });
            });
        });
    }

    public editValue(_value: JsonValue, _context?: TC): DetailedResult<JsonValue, JsonEditFailureReason> {
        return failWithDetail('inapplicable', 'inapplicable');
    }

    protected _deriveVars(context: JsonEditorContext|undefined, ...values: [string, unknown][]): Result<TemplateContext> {
        const derive = context?.deriveVars ?? this._defaultContext?.deriveVars ?? deriveTemplateContext;
        const vars = context?.vars ?? this._defaultContext?.vars;
        return derive(vars, ...values);
    }
}

*/
