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

import { DetailedResult, Result, allSucceed, captureResult, failWithDetail, succeed, succeedWithDetail } from '@fgv/ts-utils';
import { JsonContext, VariableValue } from '../../jsonContext';
import { JsonEditFailureReason, JsonEditorOptions, JsonPropertyEditFailureReason } from '../common';
import { JsonObject, JsonValue } from '../../common';

import { JsonEditorRuleBase } from '../jsonEditorRule';
import { JsonEditorState } from '../jsonEditorState';

/**
 * Represents the parts of a multi-value property key.
 */
export interface MultiValuePropertyParts {
    /**
     * The original matched token
     */
    readonly token: string;

    /**
     * The name of the variable used to project each possible
     * property value into the child values or objects being
     * resolved.
     */
    readonly propertyVariable: string;

    /**
     * The set of property values to be expanded
     */
    readonly propertyValues: string[];

    /**
     * If true, the resolved values are added as an array
     * with the name of the propertyVariable. If false,
     * values are added as individual properties with names
     * that correspond the value.
     */
    readonly asArray: boolean;
}

/**
 * The Multi-Value JSON editor rule expands matching keys multiple
 * times, projecting the value into the template context for any
 * child objects rendered by the rule.
 *
 * The default syntax for a multi-value key is:
 *  "[[var]]=value1,value2,value3"
 * Where "var" is the name of the variable that will be passed to
 * child template resolution, and "value1,value2,value3" is a
 * comma-separated list of values to be expanded.
 */
export class MultiValueJsonEditorRule extends JsonEditorRuleBase {
    protected _options?: JsonEditorOptions;

    /**
     * Creates a new MultiValueJsonEditorRule.
     * @param options Optional configuration options
     */
    public constructor(options?: JsonEditorOptions) {
        super();
        this._options = options;
    }

    /**
     * Creates a new MultiValueJsonEditorRule.
     * @param options Optional configuration options
     */
    public static create(options?: JsonEditorOptions): Result<MultiValueJsonEditorRule> {
        return captureResult(() => new MultiValueJsonEditorRule(options));
    }

    /**
     * Evaluates a property for multi-value expansion.
     * @param key The key of the property to be considered
     * @param value The value of the property to be considered
     * @param state The editor state for the object being edited
     * @returns Returns Success with an object containing the fully-resolved child
     * values to be merged for matching multi-value property. Fails with
     * detail 'error' if an error occurs or with detail 'inapplicable' if
     * the property key is not a conditional property.
     */
    public editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonPropertyEditFailureReason> {
        const json: JsonObject = {};
        const result = this._tryParse(key, state).onSuccess((parts) => {
            return allSucceed(parts.propertyValues.map((pv) => {
                return this._deriveContext(state, [parts.propertyVariable, pv]).onSuccess((ctx) => {
                    return state.editor.clone(value, ctx).onSuccess((cloned) => {
                        json[pv] = cloned;
                        return succeedWithDetail(cloned);
                    });
                });
            }), json).onSuccess(() => {
                if (parts.asArray) {
                    const arrayRtrn: JsonObject = {};
                    arrayRtrn[parts.propertyVariable] = Array.from(Object.values(json));
                    return succeed(arrayRtrn);
                }
                return succeed(json);
            }).withFailureDetail('error');
        });

        if (result.isFailure() && (result.detail === 'error')) {
            return state.failValidation('invalidPropertyName', result.message);
        }
        return result;
    }

    protected _deriveContext(state: JsonEditorState, ...values: VariableValue[]): Result<JsonContext|undefined> {
        return state.extendContext(this._options?.context, { vars: values });
    }

    /**
     * Determines if a given property key is multi-value. Derived classes can override this
     * method to use a different format for multi-value properties.
     * @param key The key of the property to consider.
     * @param state The editor state of the object being edited.
     * @returns Success with detail 'deferred' and a @see MultiValuePropertyParts describing the
     * match for matching multi-value property.  Fails with detail 'error' if an error occurs
     * or with detail 'inapplicable' if the key does not represent a multi-value property.
     */
    protected _tryParse(token: string, state: JsonEditorState): DetailedResult<MultiValuePropertyParts, JsonEditFailureReason> {
        let parts: string[] = [];
        let asArray = false;

        if (token.startsWith('[[')) {
            parts = token.substring(2).split(']]=');
            asArray = true;
        }
        else if (token.startsWith('*')) {
            parts = token.substring(1).split('=');
            asArray = false;
        }
        else {
            return failWithDetail(token, 'inapplicable');
        }

        if (parts.length !== 2) {
            const message = `Malformed multi-value property: ${token}`;
            return state.failValidation('invalidPropertyName', message, this._options?.validation);
        }

        if (parts[1].includes('{{')) {
            return failWithDetail('unresolved template', 'inapplicable');
        }

        const propertyVariable = parts[0];
        const propertyValues = parts[1].split(',');
        return succeedWithDetail({ token, propertyVariable, propertyValues, asArray });
    }
}
