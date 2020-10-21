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

import { Converter, DetailedResult, Result, captureResult, failWithDetail, propagateWithDetail } from '@fgv/ts-utils';

import { JsonObject } from './common';
import { TemplateContext } from './templateContext';

export type JsonObjectMapFailureReason = 'unknown'|'error';

/**
 * Interface for a simple map that returns named JSON blobs with templating
 * and conditional logic applied using an optionally supplied context.
 */
export interface JsonObjectMap {
    /**
     * Determine if a key might be valid for this map but does not determine if key actually
     * exists. Allows key range to be constrained.
     * @param key key to be tested
     * @returns true if the key is in the valid range, false otherwise.
     */
    keyIsInRange(key: string): boolean;

    /**
     * Determines if an object with the specified key actually exists in the map.
     * @param key key to be tested
     * @returns true if an object with the specified key exists, false otherwise.
     */
    has(key: string): boolean;

    /**
     * Gets a JSON object specified by key.
     * @param key key of the object to be retrieved
     * @param context optional context used to format the object
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    getJsonObject(key: string, context?: TemplateContext): DetailedResult<JsonObject, JsonObjectMapFailureReason>;
}

/**
 * A SimpleObjectMap presents a view of a simple map of JsonObjects
 */
export class SimpleObjectMap implements JsonObjectMap {
    protected readonly _keyPredicate: (key: string) => boolean;
    protected readonly _objects: Map<string, JsonObject>;
    protected readonly _converter: Converter<JsonObject, TemplateContext>;

    protected constructor(objects: Map<string, JsonObject>, context?: TemplateContext, keyPredicate?: (key: string) => boolean) {
        this._keyPredicate = (keyPredicate ? keyPredicate : SimpleObjectMap._defaultKeyPredicate);

        const badKey = Array.from(objects.keys()).find((k) => !this._keyPredicate(k));
        if (badKey !== undefined) {
            throw new Error(`${badKey}: invalid key`);
        }

        this._objects = objects;
        this._converter = JsonConverters.conditionalJson(context ?? {}).object();
    }

    /**
     * Creates a new SimpleObjectMap from the supplied objects
     * @param objects A map of the objects to be returned
     * @param context Context used to format returned objects
     * @param keyPredicate Optional predicate used to enforce key validity
     */
    public static create(objects: Map<string, JsonObject>, context?: TemplateContext, keyPredicate?: (key: string) => boolean): Result<SimpleObjectMap> {
        return captureResult(() => new SimpleObjectMap(objects, context, keyPredicate));
    }

    protected static _defaultKeyPredicate(key: string): boolean {
        return (!key.includes('{{')) && (!key.startsWith('?'));
    }

    /**
     * Determine if a key might be valid for this map but does not determine if key actually
     * exists. Allows key range to be constrained.
     * @param key key to be tested
     * @returns true if the key is in the valid range, false otherwise.
     */
    public keyIsInRange(key: string): boolean {
        return this._keyPredicate(key);
    }

    /**
     * Determines if an object with the specified key actually exists in the map.
     * @param key key to be tested
     * @returns true if an object with the specified key exists, false otherwise.
     */
    public has(key: string): boolean {
        return this._objects.has(key);
    }

    /**
     * Gets a JSON object specified by key.
     * @param key key of the object to be retrieved
     * @param context optional context used to format the object
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    public getJsonObject(key: string, context?: TemplateContext): DetailedResult<JsonObject, JsonObjectMapFailureReason> {
        const cfg = this._objects.get(key);
        if (!cfg) {
            return failWithDetail(`${key}: object not found`, 'unknown');
        }
        return propagateWithDetail(this._converter.convert(cfg, context), 'error');
    }
}

/**
 * A CompositeObjectMap presents a composed view of one or more other
 * JsonObjectMaps.
 */
export class CompositeObjectMap implements JsonObjectMap {
    protected _maps: JsonObjectMap[];

    protected constructor(maps: JsonObjectMap[]) {
        this._maps = maps;
    }

    /**
     * Creates a new CompositeObjectMap from the supplied maps
     * @param maps one or more object maps to be composed
     */
    public static create(maps: JsonObjectMap[]): Result<CompositeObjectMap> {
        return captureResult(() => new CompositeObjectMap(maps));
    }

    /**
     * Determine if a key might be valid for this map but does not determine if key actually
     * exists. Allows key range to be constrained.
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
     * @param context optional context used to format the object
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    public getJsonObject(key: string, context?: TemplateContext): DetailedResult<JsonObject, JsonObjectMapFailureReason> {
        for (const map of this._maps) {
            if (map.keyIsInRange(key)) {
                const result = map.getJsonObject(key, context);
                if (result.isSuccess() || (result.detail === 'error')) {
                    return result;
                }
            }
        }
        return failWithDetail(`${key}: config not found`, 'unknown');
    }
}
