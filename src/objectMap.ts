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

import {
    Converter,
    DetailedResult,
    Result,
    captureResult,
    failWithDetail,
    recordToMap,
    succeed,
    succeedWithDetail,
} from '@fgv/ts-utils';

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
 * Predicate function for JsonObjectMap key names
 */
export type KeyPredicate = (key: string) => boolean;

/**
 * The default predicate for object maps excludes conditional or templated keys
 * @param key The key to be tested
 */
export function defaultKeyPredicate(key: string): boolean {
    return (!key.includes('{{')) && (!key.startsWith('?'));
}

/**
 * Helper to enforce a supplied prefix plus default key naming rules
 * @param key The key to be tested
 * @param prefix The prefix to expect
 */
export function prefixKeyPredicate(key: string, prefix: string): boolean {
    return key.startsWith(prefix) && (key !== prefix) && (!key.includes('{{'));
}

/**
 * A SimpleObjectMap presents a view of a simple map of JsonObjects
 */
export abstract class SimpleObjectMapBase<T> implements JsonObjectMap {
    protected readonly _keyPredicate: KeyPredicate;
    protected readonly _objects: Map<string, T>;
    protected readonly _converter: Converter<JsonObject, TemplateContext>;

    protected constructor(objects: Map<string, T>, context?: TemplateContext, keyPredicate?: KeyPredicate) {
        this._keyPredicate = (keyPredicate ? keyPredicate : defaultKeyPredicate);

        const badKey = Array.from(objects.keys()).find((k) => !this._keyPredicate(k));
        if (badKey !== undefined) {
            throw new Error(`${badKey}: invalid key`);
        }

        this._objects = objects;
        this._converter = JsonConverters.conditionalJson(context ?? {}).object();
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
        return this._get(key).onSuccess((cfg) => {
            return this._converter.convert(cfg, context).withFailureDetail('error');
        });
    }

    protected abstract _get(key: string): DetailedResult<JsonObject, JsonObjectMapFailureReason>;
}

/**
 * A SimpleObjectMap presents a view of a simple map of JsonObjects
 */
export class SimpleObjectMap extends SimpleObjectMapBase<JsonObject> {
    protected constructor(objects: Map<string, JsonObject>, context?: TemplateContext, keyPredicate?: KeyPredicate) {
        super(objects, context, keyPredicate);
    }

    /**
     * Creates a new SimpleObjectMap from the supplied objects
     * @param objects A string-keyed Record of the JsonObjects to be returned
     * @param context Context used to format returned objects
     * @param keyPredicate Optional predicate used to enforce key validity
     */
    public static createSimple(objects?: Record<string, JsonObject>, context?: TemplateContext, keyPredicate?: KeyPredicate): Result<SimpleObjectMap>;

    /**
     * Creates a new SimpleObjectMap from the supplied objects
     * @param objects A string-keyed Map of the JsonObjects to be returned
     * @param context Context used to format returned objects
     * @param keyPredicate Optional predicate used to enforce key validity
     */
    public static createSimple(objects?: Map<string, JsonObject>, context?: TemplateContext, keyPredicate?: KeyPredicate): Result<SimpleObjectMap>;
    public static createSimple(objects?: Map<string, JsonObject>|Record<string, JsonObject>, context?: TemplateContext, keyPredicate?: KeyPredicate): Result<SimpleObjectMap> {
        return SimpleObjectMap._toMap(objects).onSuccess((map) => {
            return captureResult(() => new SimpleObjectMap(map, context, keyPredicate));
        });
    }

    protected static _toMap(objects?: Map<string, JsonObject>|Record<string, JsonObject>): Result<Map<string, JsonObject>> {
        if (objects === undefined) {
            return captureResult(() => new Map<string, JsonObject>());
        }
        else if (!(objects instanceof Map)) {
            return recordToMap(objects, (_k, v) => succeed(v));
        }
        return succeed(objects);
    }

    protected _get(key: string): DetailedResult<JsonObject, JsonObjectMapFailureReason> {
        const cfg = this._objects.get(key);
        if (!cfg) {
            return failWithDetail(`${key}: object not found`, 'unknown');
        }
        return succeedWithDetail(cfg);
    }
}

/**
 * Initialization options for a PrefixedObjectMap
 */
export interface KeyPrefixOptions {
    /**
     * Indicates whether the prefix should be added automatically as needed (default true)
     */
    addPrefix?: boolean;

    /**
     * The prefix to be enforced
     */
    prefix: string;
}

/**
 * A PrefixedObjectMap enforces a supplied prefix for all contained objects, optionally
 * adding the prefix as necessary (default true).
 */
export class PrefixedObjectMap extends SimpleObjectMap {
    protected _constraint: KeyPrefixOptions;

    protected constructor(constraint: KeyPrefixOptions, objects: Map<string, JsonObject>, context?: TemplateContext) {
        super(objects, context, (key) => prefixKeyPredicate(key, constraint.prefix));
        this._constraint = constraint;
    }

    /**
     * Creates a new PrefixedObjectMap from the supplied objects
     * @param prefix A string prefix to be enforced for and added to key names as necessary
     * @param objects A string-keyed Record of the JsonObjects to be returned
     * @param context Context used to format returned objects
     */
    public static createPrefixed(prefix: string, objects?: Record<string, JsonObject>, context?: TemplateContext): Result<PrefixedObjectMap>;

    /**
     * Creates a new PrefixedObjectMap from the supplied objects
     * @param options A KeyPrefixOptions indicating the prefix to enforce and whether that prefix should
     * be added automatically if necessary (default true)
     * @param objects A string-keyed Record of the JsonObjects to be returned
     * @param context Context used to format returned objects
     */
    public static createPrefixed(options: KeyPrefixOptions, objects?: Record<string, JsonObject>, context?: TemplateContext): Result<PrefixedObjectMap>;

    /**
     * Creates a new PrefixedObjectMap from the supplied objects
     * @param prefix A string prefix to be enforced for and added to key names as necessary
     * @param objects A string-keyed Map of the JsonObjects to be returned
     * @param context Context used to format returned objects
     */
    public static createPrefixed(prefix: string, objects?: Map<string, JsonObject>, context?: TemplateContext): Result<PrefixedObjectMap>;

    /**
     * Creates a new PrefixedObjectMap from the supplied objects
     * @param options A KeyPrefixOptions indicating the prefix to enforce and whether that prefix should
     * be added automatically if necessary (default true)
     * @param objects A string-keyed Map of the JsonObjects to be returned
     * @param context Context used to format returned objects
     */
    public static createPrefixed(options: KeyPrefixOptions, objects?: Map<string, JsonObject>, context?: TemplateContext): Result<PrefixedObjectMap>;
    public static createPrefixed(
        prefixOptions: string|KeyPrefixOptions,
        objects?: Map<string, JsonObject>|Record<string, JsonObject>,
        context?: TemplateContext
    ): Result<PrefixedObjectMap> {
        const options = PrefixedObjectMap._toOptions(prefixOptions);
        return PrefixedObjectMap._toPrefixedMap(options, objects).onSuccess((map) => {
            return captureResult(() => new PrefixedObjectMap(options, map, context));
        });
    }

    protected static _toPrefixedMap(options: KeyPrefixOptions, objects?: Map<string, JsonObject>|Record<string, JsonObject>): Result<Map<string, JsonObject>> {
        return SimpleObjectMap._toMap(objects).onSuccess((map) => {
            if (options.addPrefix !== false) {
                const entries: [string, JsonObject][] = Array.from(map.entries()).map((entry) => {
                    if (!entry[0].startsWith(options.prefix)) {
                        return [`${options.prefix}${entry[0]}`, entry[1]];
                    }
                    return entry;
                });
                return captureResult(() => new Map<string, JsonObject>(entries));
            }
            return succeed(map);
        });
    }

    protected static _toOptions(prefixOptions: string|KeyPrefixOptions): KeyPrefixOptions {
        if (typeof prefixOptions === 'string') {
            return { addPrefix: true, prefix: prefixOptions };
        }
        return prefixOptions;
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
