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

import * as JsonConverters from './converters';
import { JsonArray, JsonObject, JsonValue, isJsonPrimitive } from './common';
import { Result, fail, populateObject, succeed } from '@fgv/ts-utils';

type MergeType = 'clobber'|'object'|'array'|'none';

export class JsonMerger {
    public getPropertyMergeType(from: unknown): Result<MergeType> {
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

    public getMergeType(target: JsonValue, src: JsonValue): Result<MergeType> {
        const typesResult = populateObject({
            target: () => this.getPropertyMergeType(target),
            src: () => this.getPropertyMergeType(src),
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

    public mergeInPlace(target: JsonObject, src: JsonObject): Result<JsonObject> {
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                const mergeTypeResult = this.getMergeType(target[key], src[key]);
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

    public mergeAllInPlace(target: JsonObject, ...sources: JsonObject[]): Result<JsonObject> {
        for (const src of sources) {
            const mergeResult = this.mergeInPlace(target, src);
            if (mergeResult.isFailure()) {
                return mergeResult;
            }
        }
        return succeed(target);
    }

    public mergeNew(...sources: JsonObject[]): Result<JsonObject> {
        return this.mergeAllInPlace({}, ...sources);
    }

    protected _clone(src: JsonValue): Result<JsonValue> {
        return JsonConverters.json.convert(src);
    }

    protected _mergeArray(target: JsonArray, src: JsonArray): Result<JsonArray> {
        target.push(...src);
        return succeed(target);
    }
}
