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
import { JsonEditFailureReason, JsonEditorContext, JsonEditorRule } from '../jsonEditorRule';
import { JsonObject, JsonValue } from '../common';
import Mustache from 'mustache';
import { TemplateContext } from '../templateContext';

export class TemplatedJsonEditorRule<TC extends JsonEditorContext = JsonEditorContext> implements JsonEditorRule<TC> {
    protected _defaultContext?: TC;

    public constructor(context?: TC) {
        this._defaultContext = context;
    }

    public static create<TC extends JsonEditorContext = JsonEditorContext>(context?: TC): Result<TemplatedJsonEditorRule<TC>> {
        return captureResult(() => new TemplatedJsonEditorRule(context));
    }

    public editProperty(key: string, value: JsonValue, context?: TC): DetailedResult<JsonObject, JsonEditFailureReason> {
        return this._render(key, context?.vars).onSuccess((newKey) => {
            const rtrn: JsonObject = {};
            rtrn[newKey] = value;
            return succeedWithDetail(rtrn, 'edited');
        });
    }

    public editValue(value: JsonValue, context?: TC): DetailedResult<JsonValue, JsonEditFailureReason> {
        if ((typeof value === 'string') && value.includes('{{')) {
            return this._render(value, context?.vars).onSuccess((newValue) => {
                return succeedWithDetail(newValue, 'edited');
            });
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }


    protected _render(template: string, context?: TemplateContext): DetailedResult<string, JsonEditFailureReason> {
        if (template.includes('{{')) {
            return captureResult(() => Mustache.render(template, context)).withDetail('edited');
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }
}
