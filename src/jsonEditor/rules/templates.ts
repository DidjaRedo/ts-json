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

import { DetailedResult, Result, captureResult, failWithDetail, succeedWithDetail } from '@fgv/ts-utils';
import { JsonEditFailureReason, JsonEditorRuleBase, JsonPropertyEditFailureReason } from '../jsonEditorRule';
import { JsonEditorOptions, JsonEditorState } from '../jsonEditorState';
import { JsonObject, JsonValue } from '../../common';

import Mustache from 'mustache';

/**
 * Configuration options for the Templated JSON editor rule
 */
export interface TemplatedJsonRuleOptions extends Partial<JsonEditorOptions> {
    /**
     * If true (default) then templates in property names are rendered
     */
    useNameTemplates?: boolean;
    /**
     * If true (default) then templates in property values are rendered
     */
    useValueTemplates?: boolean;
}

/**
 * The Templated JSON editor rule applies mustache rendering as appropriate
 * to any keys or values in the object being edited.
 */
export class TemplatedJsonEditorRule extends JsonEditorRuleBase {
    protected _options?: TemplatedJsonRuleOptions;

    /**
     * Creates a new @see TemplatedJsonEditorRule
     * @param options Optional configuration options for this rule
     */
    public constructor(options?: TemplatedJsonRuleOptions) {
        super();
        this._options = options;
    }

    /**
     * Creates a new @see TemplatedJsonEditorRule
     * @param options Optional configuration options for this rule
     */
    public static create(options?: TemplatedJsonRuleOptions): Result<TemplatedJsonEditorRule> {
        return captureResult(() => new TemplatedJsonEditorRule(options));
    }

    /**
     * Evaluates a property name for template rendering.
     * @param key The key of the property to be considered
     * @param value The value of the property to be considered
     * @param state The editor state for the object being edited
     * @returns Succeeds with detail 'edited' and an object to be flattened and merged
     * if the key contained a template. Fails with detail 'error' if an error occurred
     * or with detail 'inapplicable' if the property key does not contain a template
     * or if name rendering is disabled.
     */
    public editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonPropertyEditFailureReason> {
        // istanbul ignore next
        const validation = this._options?.validation;

        if (this._options?.useNameTemplates !== false) {
            const result = this._render(key, state).onSuccess((newKey) => {
                if (newKey.length < 1) {
                    return state.failValidation('invalidPropertyName', `Template "${key}" renders empty name.`);
                }

                const rtrn: JsonObject = {};
                rtrn[newKey] = value;
                return succeedWithDetail<JsonObject, JsonEditFailureReason>(rtrn, 'edited');
            });

            if ((result.isFailure() && result.detail === 'error')) {
                const message = `Cannot render name ${key}: ${result.message}`;
                return state.failValidation('invalidPropertyName', message, validation);
            }
            return result;
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    /**
     * Evaluates a property, array or literal value for template rendering
     * @param value The value to be edited
     * @param state The editor state for the object being edited
     * @returns Succeeds with detail 'edited' if the value contained a template and was edited.
     * Fails with 'ignore' if the rendered value should be ignored, with 'error' if an error occurs
     * or with 'inapplicable' if the value was not a string with a template.
     */
    public editValue(value: JsonValue, state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason> {
        if ((this._options?.useValueTemplates !== false) && (typeof value === 'string') && value.includes('{{')) {
            const renderResult = this._render(value, state).onSuccess((newValue) => {
                return succeedWithDetail(newValue, 'edited');
            });

            if (renderResult.isFailure() && (renderResult.detail === 'error')) {
                const message = `Cannot render value: ${renderResult.message}`;
                // istanbul ignore next
                return state.failValidation('invalidPropertyValue', message, this._options?.validation);
            }
            return renderResult;
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    protected _render(template: string, state: JsonEditorState): DetailedResult<string, JsonEditFailureReason> {
        const vars = state.getVars(this._options?.context);
        if (vars && template.includes('{{')) {
            return captureResult(() => Mustache.render(template, vars)).withDetail('error', 'edited');
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }
}
