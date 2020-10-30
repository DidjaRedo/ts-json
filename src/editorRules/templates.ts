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
import { JsonEditFailureReason, JsonEditorRule, JsonPropertyEditFailureReason } from '../jsonEditorRule';
import { JsonEditorContext, JsonEditorState } from '../jsonEditorState';
import { JsonObject, JsonValue } from '../common';

import Mustache from 'mustache';
import { TemplateVars } from '../templateContext';

export class TemplatedJsonEditorRule implements JsonEditorRule {
    protected _defaultContext?: JsonEditorContext;

    public constructor(context?: JsonEditorContext) {
        this._defaultContext = context;
    }

    public static create(context?: JsonEditorContext): Result<TemplatedJsonEditorRule> {
        return captureResult(() => new TemplatedJsonEditorRule(context));
    }

    public editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonPropertyEditFailureReason> {
        const context = state.getContext(this._defaultContext);
        const result = this._render(key, context?.vars).onSuccess((newKey) => {
            if (newKey.length < 1) {
                return state.failValidation('invalidPropertyName', `Template "${key}" renders empty name.`);
            }

            const rtrn: JsonObject = {};
            rtrn[newKey] = value;
            return succeedWithDetail<JsonObject, JsonEditFailureReason>(rtrn, 'edited');
        });

        if ((result.isFailure() && result.detail === 'error')) {
            return state.failValidation('invalidPropertyName', `Cannot render name ${key}: ${result.message}`);
        }
        return result;
    }

    public editValue(value: JsonValue, state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason> {
        if ((typeof value === 'string') && value.includes('{{')) {
            return this._render(value, state.getVars(this._defaultContext)).onSuccess((newValue) => {
                return succeedWithDetail(newValue, 'edited');
            });
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    public finalizeProperties(_deferred: JsonObject[], _state: JsonEditorState): DetailedResult<JsonObject[], JsonEditFailureReason> {
        return failWithDetail('inapplicable', 'inapplicable');
    }

    protected _render(template: string, context?: TemplateVars): DetailedResult<string, JsonEditFailureReason> {
        if (context && template.includes('{{')) {
            return captureResult(() => Mustache.render(template, context)).withDetail('error', 'edited');
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }
}
