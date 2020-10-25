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
import { JsonObject, JsonValue } from './common';
import { JsonObjectMap } from './objectMap';
import Mustache from 'mustache';
import { TemplateContext } from './templateContext';

export interface JsonEditorContext {
    vars?: TemplateContext;
    refs?: JsonObjectMap;
}

export type JsonEditFailureReason = 'ignore'|'inapplicable'|'edited'|'error';

export interface JsonEditorRule<TC extends JsonEditorContext = JsonEditorContext> {
    /**
     * Called by a JSON editor to possibly edit one of the properties being merged into a target object.
     * @param key The key of the property to be edited
     * @param value The value of the property to be edited
     * @param context The context used to format any referenced objects
     * @returns If the property was edited, returns Success with a JSON object containing the edited results
     * and with detail 'edited'.  If the rule does not affect this property, fails with detail 'inapplicable'.
     * If an error occurred while processing the error, returns Failure with detail 'error'.
     */
    // eslint-disable-next-line no-use-before-define
    editProperty(key: string, value: JsonValue, context?: TC): DetailedResult<JsonObject, JsonEditFailureReason>;

    /**
     * Called by a JsonMerger to possibly edit a property value or array element
     * @param value The value to be edited
     * @param context The context used to format any referenced objects
     * @returns Returns success with the JsonValue to be inserted, with detail 'edited' if the value was
     * edited.  Returns failure with 'inapplicable' if the rule does not affect this value.  Fails with
     * detail 'ignore' if the value is to be ignored, or with 'error' if an error occurs.
     */
    editValue(value: JsonValue, context?: TC): DetailedResult<JsonValue, JsonEditFailureReason>;
}

export class DefaultJsonEditorRule<TC extends JsonEditorContext = JsonEditorContext> implements JsonEditorRule<TC> {
    public editProperty(_key: string, _value: JsonValue, _context?: TC): DetailedResult<JsonObject, JsonEditFailureReason> {
        return failWithDetail('inapplicable', 'inapplicable');
    }

    public editValue(_value: JsonValue, _context?: TC): DetailedResult<JsonValue, JsonEditFailureReason> {
        return failWithDetail('inapplicable', 'inapplicable');
    }
}

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
