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

import { ConditionalJson } from './conditionalJson';
import { Converter } from '@fgv/ts-utils';
import { JsonConverter } from './jsonConverter';
import { JsonValue } from './common';

/**
 * Converts the supplied unknown to JSON, rendering any property names
 * or string values using mustache with the supplied context.  See the
 * mustache documentation for details of mustache syntax and view.
 * @param context The mustache view used to render property names and string values
 */
export function templatedJson(context: unknown): Converter<JsonValue> {
    return new JsonConverter({ templateContext: context });
}

/**
 * A simple validating JSON converter. Converts unknown to JSON or fails
 * if the unknown contains any invalid JSON values.
 */
export const json = new JsonConverter();

/**
 * A simple validating JSON converter. Converts unknown to a JSON object
 * or fails if the unknown contains invalid JSON or is not an object.
 */
export const jsonObject = json.object();

/**
 * A simple validating JSON converter. Converts unknown to a JSON array
 * or fails if the unknown contains invalid JSON or is not an array.
 */
export const jsonArray = json.array();

/**
 * Converts the supplied unknown to conditional JSON, by first rendering any property
 * names or string values using mustache with the supplied context and then applying
 * conditional flattening based on property names.
 * @param context The mustache view used to render property names and string values
 */
export function conditionalJson(context: unknown): Converter<JsonValue> {
    return new ConditionalJson({ templateContext: context });
}
