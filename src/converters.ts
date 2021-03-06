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

import {
    ConditionalJsonConverter,
    ConditionalJsonConverterOptions,
    JsonConverter,
    RichJsonConverter,
    RichJsonConverterOptions,
    TemplatedJsonConverter,
    TemplatedJsonConverterOptions,
} from './jsonConverter';

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

let templatedJsonDefault: JsonConverter|undefined;
let conditionalJsonDefault: JsonConverter|undefined;
let richJsonDefault: JsonConverter|undefined;

/**
 * Converts the supplied unknown to JSON, rendering any property names
 * or string values using mustache with the supplied context.  See the
 * mustache documentation for details of mustache syntax and view.
 * @param options A @see TemplatedJsonConverterOptions with options and context for the conversion
 */
export function templatedJson(options?: Partial<TemplatedJsonConverterOptions>): JsonConverter {
    if (!options) {
        if (!templatedJsonDefault) {
            templatedJsonDefault = new TemplatedJsonConverter();
        }
        return templatedJsonDefault;
    }
    return new TemplatedJsonConverter(options);
}

/**
 * Converts the supplied unknown to strongly-typed JSON, by first rendering any property
 * names or string values using mustache with the supplied context, then applying
 * multi-value property expansion and conditional flattening based on property names.
 * @param options A @see ConditionalJsonConverterOptions with options and context for the conversion
 */
export function conditionalJson(options?: Partial<ConditionalJsonConverterOptions>): JsonConverter {
    if (!options) {
        if (!conditionalJsonDefault) {
            conditionalJsonDefault = new ConditionalJsonConverter();
        }
        return conditionalJsonDefault;
    }
    return new ConditionalJsonConverter(options);
}

/**
 * Converts the supplied unknown to strongly-typed JSON, by first rendering any property
 * names or string values using mustache with the supplied context, then applying
 * multi-value property expansion and conditional flattening based on property names.
 * @param options A @see RichJsonConverterOptions with options and context for the conversion
 */
export function richJson(options?: Partial<RichJsonConverterOptions>): JsonConverter {
    if (!options) {
        if (!richJsonDefault) {
            richJsonDefault = new RichJsonConverter();
        }
        return richJsonDefault;
    }
    return new RichJsonConverter(options);
}
