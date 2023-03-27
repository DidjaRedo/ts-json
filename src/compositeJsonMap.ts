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
import { JsonContext, JsonReferenceMap, JsonReferenceMapFailureReason } from './jsonContext';
import { JsonObject, JsonValue, isJsonObject } from './common';

/**
 * A CompositeJsonMap presents a composed view of one or more other
 * JsonReferenceMaps.
 */
export class CompositeJsonMap implements JsonReferenceMap {
    protected _maps: JsonReferenceMap[];

    protected constructor(maps: JsonReferenceMap[]) {
        this._maps = maps;
    }

    /**
     * Creates a new @see CompositeJsonMap from the supplied maps
     * @param maps one or more object maps to be composed
     */
    public static create(maps: JsonReferenceMap[]): Result<CompositeJsonMap> {
        return captureResult(() => new CompositeJsonMap(maps));
    }

    /**
     * Determine if a key might be valid for this map but does not determine
     * if key actually exists. Allows key range to be constrained.
     * @param key key to be tested
     * @returns true if the key is in the valid range, false otherwise.
     */
    public keyIsInRange(key: string): boolean {
        return this._maps.find((map) => map.keyIsInRange(key)) !== undefined;
    }

    /**
     * Determines if an object with the specified key actually exists in the map.
     * @param key key to be tested
     * @returns true if an object with the specified key exists, false otherwise.
     */
    public has(key: string): boolean {
        return this._maps.find((map) => map.has(key)) !== undefined;
    }

    /**
     * Gets a JSON object specified by key.
     * @param key key of the object to be retrieved
     * @param context optional @see JsonContext used to format the object
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    public getJsonObject(key: string, context?: JsonContext): DetailedResult<JsonObject, JsonReferenceMapFailureReason> {
        return this.getJsonValue(key, context).onSuccess((jv) => {
            if (!isJsonObject(jv)) {
                return failWithDetail(`${key}: not an object`, 'error');
            }
            return succeedWithDetail(jv);
        });
    }

    /**
     * Gets a JSON value specified by key.
     * @param key key of the object to be retrieved
     * @param context Optional @see JsonContext used to format the value
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    // eslint-disable-next-line no-use-before-define
    public getJsonValue(key: string, context?: JsonContext): DetailedResult<JsonValue, JsonReferenceMapFailureReason> {
        for (const map of this._maps) {
            if (map.keyIsInRange(key)) {
                const result = map.getJsonValue(key, context);
                if (result.isSuccess() || (result.detail === 'error')) {
                    return result;
                }
            }
        }
        return failWithDetail(`${key}: value not found`, 'unknown');
    }
}
