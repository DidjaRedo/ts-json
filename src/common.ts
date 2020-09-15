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

/* eslint-disable no-use-before-define */

export type JsonPrimitive = boolean | number | string | null;
export interface JsonObject { [key: string]: JsonValue }

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface JsonArray extends Array<JsonValue> { }

/**
 * Test if an unknown is a JsonValue
 * @param from The unknown to be tested
 * @returns true if the supplied parameter is a valid JSON primitive,
 * false otherwise.
 */
export function isJsonPrimitive(from: unknown): from is JsonPrimitive {
    return ((typeof from === 'boolean') || (typeof from === 'number') || (typeof from === 'string') || (from === null));
}

/**
 * Test if an unknown is potentially a JsonObject
 * @param from The unknown to be tested
 * @returns true if the supplied parameter is a non-array object,
 * false otherwise.
 */
export function isJsonObject(from: unknown): from is JsonObject {
    return ((typeof from === 'object') && (!Array.isArray(from)));
}
