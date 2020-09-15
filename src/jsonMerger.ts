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

import { JsonArray, JsonObject, JsonValue, isJsonPrimitive } from './common';
import { JsonConverter, JsonConverterOptions } from './jsonConverter';
import { Result, fail, mapResults, populateObject, succeed } from '@fgv/ts-utils';

type MergeType = 'clobber'|'object'|'array'|'none';

/**
 * Configuration options for a JsonMerger
 */
export interface JsonMergerOptions {
    /**
     * Options passed to a JsonConverter used to convert any
     * child objects to be merged.
     */
    converterOptions?: Partial<JsonConverterOptions>;
}

/**
 * A configurable JsonMerger which merges JSON objects either in place or into a new object,
 * optionally applying mustache template rendering to merged properties and values.
 */
export class JsonMerger {
    protected _converter: JsonConverter;

    /**
     * Constructs a new JsonMerger with supplied or default options
     * @param options Optional merger options
     */
    public constructor(options?: Partial<JsonMergerOptions>) {
        this._converter = new JsonConverter(options?.converterOptions);
    }

    /**
     * Merges a single supplied JSON object into a supplied target, optionally applying mustache
     * template rendering to merged properties and values. Modifies the supplied target object.
     *
     * NOTE: Template rendering is applied only on merge, which means that any properties
     * or fields in the original target object will not be rendered.
     *
     * @param target The object into which values should be merged
     * @param src The object to be merged
     */
    public mergeInPlace(target: JsonObject, src: JsonObject): Result<JsonObject> {
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                const mergeTypeResult = this._getMergeType(target[key], src[key]);
                if (mergeTypeResult.isFailure()) {
                    return fail(`${key}: ${mergeTypeResult.message}`);
                }
                else if (mergeTypeResult.value !== 'none') {
                    let result: Result<JsonValue> = fail(`${key}: Unexpected merge type ${mergeTypeResult.value}`);
                    switch (mergeTypeResult.value) {
                        case 'clobber':
                            result = this._clone(src[key]);
                            break;
                        case 'array':
                            result = this._mergeArray(target[key] as JsonArray, src[key] as JsonArray);
                            break;
                        case 'object':
                            result = this.mergeInPlace(target[key] as JsonObject, src[key] as JsonObject);
                    }

                    if (result.isFailure()) {
                        return fail(`${key}: ${result.message}`);
                    }
                    target[key] = result.value;
                }
            }
            else {
                return fail(`${key}: Cannot merge inherited properties`);
            }
        }
        return succeed(target);
    }

    /**
     * Merges one or more supplied JSON object into a supplied target, optionally
     * applying mustache template rendering to merged properties and values.
     * Modifies the supplied target object.
     *
     * NOTE: Template rendering is applied only on merge, which means that any properties
     * or fields in the original target object will not be rendered.
     *
     * @param target The object into which values should be merged
     * @param sources The objects to be merged into the target
     */
    public mergeAllInPlace(target: JsonObject, ...sources: JsonObject[]): Result<JsonObject> {
        for (const src of sources) {
            const mergeResult = this.mergeInPlace(target, src);
            if (mergeResult.isFailure()) {
                return mergeResult;
            }
        }
        return succeed(target);
    }

    /**
     * Merges one or more supplied JSON objects into a new object, optionally
     * applying mustache template rendering to merged properties and values.
     * Does not modify any of the supplied objects.
     *
     * @param sources The objects to be merged
     */
    public mergeNew(...sources: JsonObject[]): Result<JsonObject> {
        return this.mergeAllInPlace({}, ...sources);
    }

    protected _getPropertyMergeType(from: unknown): Result<MergeType> {
        if (from === undefined) {
            return succeed('none');
        }

        if (isJsonPrimitive(from)) {
            return succeed('clobber');
        }

        if ((typeof from !== 'object') || (from === null)) {
            return fail(`Invalid json: ${JSON.stringify(from)}`);
        }

        if (Array.isArray(from)) {
            return succeed('array');
        }
        return succeed('object');
    }

    protected _getMergeType(target: JsonValue, src: JsonValue): Result<MergeType> {
        const typesResult = populateObject({
            target: () => this._getPropertyMergeType(target),
            src: () => this._getPropertyMergeType(src),
        });

        if (typesResult.isFailure()) {
            return fail(typesResult.message);
        }

        const types = typesResult.value;
        if ((types.target === types.src) || (types.src === 'none')) {
            return succeed(types.src);
        }
        // should have option to fail here
        return succeed('clobber');
    }

    protected _clone(src: JsonValue): Result<JsonValue> {
        return this._converter.convert(src);
    }

    protected _mergeArray(target: JsonArray, src: JsonArray): Result<JsonArray> {
        return mapResults(src.map((s) => this._converter.convert(s))).onSuccess((converted) => {
            target.push(...converted);
            return succeed(target);
        });
    }
}
