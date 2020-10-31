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

import { Result, fail, succeed } from '@fgv/ts-utils';

/* eslint-disable no-use-before-define */

export type JsonPrimitive = boolean | number | string | null;
export interface JsonObject { [key: string]: JsonValue }

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface JsonArray extends Array<JsonValue> { }

/**
 * Classes of JSON value
 */
export type JsonValueType = 'primitive'|'object'|'array';

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

/**
 * Test if an unknown is potentially a JsonArary
 * @param from The unknown to be tested
 * @returns true if the supplied parameter is an array object,
 * false otherwise
 */
export function isJsonArray(from: unknown): from is JsonArray {
    return (typeof from === 'object') && Array.isArray(from);
}

/**
 * Identifies whether some unknown value is a primitive,
 * object or array. Fails for any value that cannot be
 * converted to JSON (e.g. a function) _but_ this is a
 * shallow test - it does not test the properties of an
 * object or elements in an array.
 * @param from The unknown value to be tested
 */
export function classifyJsonValue(from: unknown): Result<JsonValueType> {
    if (isJsonPrimitive(from)) {
        return succeed('primitive');
    }
    else if (isJsonObject(from)) {
        return succeed('object');
    }
    else if (isJsonArray(from)) {
        return succeed('array');
    }
    return fail(`Invalid JSON: ${from}`);
}

/**
 * Picks a nested field from a supplied JsonObject
 * @param src The object from which the field is to be picked
 * @param path Dot-separated path of the member to be picked
 * @returns Success with the property if the path is valid, Failure
 * otherwise.
 */
export function pickJsonValue(src: JsonObject, path: string): Result<JsonValue> {
    let result: JsonValue = src;
    for (const part of path.split('.')) {
        if (result && isJsonObject(result)) {
            result = result[part];
            if (result === undefined) {
                return fail(`${path}: child '${part}' does not exist`);
            }
        }
        else {
            return fail(`${path}: child '${part}' does not exist`);
        }
    }
    return succeed(result);
}

/**
 * Picks a nested JsonObject from a supplied JsonObject
 * @param src The object from which the field is to be picked
 * @param path Dot-separated path of the member to be picked
 * @returns Success with the property if the path is valid and the value
 * is an object. Returns failure with details if an error occurs.
 */
export function pickJsonObject(src: JsonObject, path: string): Result<JsonObject> {
    return pickJsonValue(src, path).onSuccess((v) => {
        if (!isJsonObject(v)) {
            return fail(`${path}: not an object`);
        }
        return succeed(v);
    });
}
