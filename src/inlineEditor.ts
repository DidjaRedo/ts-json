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

import { DetailedResult, Result, succeed, succeedWithDetail } from '@fgv/ts-utils';
import { JsonObject, JsonValue } from './common';
import { JsonMerger } from './jsonMerger';
import { TemplateContext } from './templateContext';

export interface JsonEditor {
    mergeInPlace(target: JsonObject, src: JsonObject, context?: TemplateContext): Result<JsonObject>;
}

export type JsonMergeEditFailureReason = 'ignore'|'error';

export interface JsonMergeEditor {
    /**
     * Called by the JsonMerger to possibly edit one of the properties being merged into a target object.
     * @param key The key of the property to be edited
     * @param value The value of the property to be edited
     * @param target The target object into which the results should be merged
     * @param editor A JsonMerger to use for child objects and properties
     * @param context The context used to format any referenced objects
     * @returns Returns Success with true the property was edited. Returns Success with false if the object
     * was not edited.  Returns Failure and a detailed message if an error occured during merge.
     */
    // eslint-disable-next-line no-use-before-define
    editProperty(key: string, value: JsonValue, target: JsonObject, editor: JsonMerger, context?: TemplateContext): Result<boolean>;

    /**
     * Called by the JsonMerger to possibly edit a property value or array element
     * @param value The value to be edited
     * @param editor A JsonMerger to use for child objects and properties
     * @param context The context used to format any referenced objects
     * @returns Returns success with the JsonValue to be inserted, even if the object to be inserted
     * was not edited.  Returns failure with 'ignore' if the value is to be ignored, or failure
     * with 'error' if an error occurs.
     */
    // eslint-disable-next-line no-use-before-define
    editValue(value: JsonValue, editor: JsonMerger, context?: TemplateContext): DetailedResult<JsonValue, JsonMergeEditFailureReason>;
}

export class JsonMergeEditorBase {
    protected static _default?: JsonMergeEditorBase;

    // eslint-disable-next-line no-use-before-define
    public editProperty(_key: string, _value: JsonValue, _target: JsonObject, _editor: JsonMerger, _context?: TemplateContext): Result<boolean> {
        return succeed(false);
    }

    // eslint-disable-next-line no-use-before-define
    public editValue(value: JsonValue, _editor: JsonMerger, _context?: TemplateContext): DetailedResult<JsonValue, JsonMergeEditFailureReason> {
        return succeedWithDetail(value);
    }

    public static get default(): JsonMergeEditorBase {
        if (!JsonMergeEditorBase._default) {
            JsonMergeEditorBase._default = new JsonMergeEditorBase();
        }
        return JsonMergeEditorBase._default;
    }
}
