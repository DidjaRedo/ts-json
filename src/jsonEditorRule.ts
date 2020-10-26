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

import { JsonObject, JsonValue } from './common';

import { DetailedResult } from '@fgv/ts-utils';
import { JsonEditorState } from './jsonEditorState';

export type JsonEditFailureReason = 'ignore'|'inapplicable'|'edited'|'error';

export interface JsonEditorRule {
    /**
     * Called by a JSON editor to possibly edit one of the properties being merged into a target object.
     * @param key The key of the property to be edited
     * @param value The value of the property to be edited
     * @param state Editor state which applies to the edit
     * @returns If the property was edited, returns Success with a JSON object containing the edited results
     * and with detail 'edited'.  If the rule does not affect this property, fails with detail 'inapplicable'.
     * If an error occurred while processing the error, returns Failure with detail 'error'.
     */
    // eslint-disable-next-line no-use-before-define
    editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonEditFailureReason>;

    /**
     * Called by a JsonMerger to possibly edit a property value or array element
     * @param value The value to be edited
     * @param state Editor state which applies to the edit
     * @returns Returns success with the JsonValue to be inserted, with detail 'edited' if the value was
     * edited.  Returns failure with 'inapplicable' if the rule does not affect this value.  Fails with
     * detail 'ignore' if the value is to be ignored, or with 'error' if an error occurs.
     */
    editValue(value: JsonValue, state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason>;
}

