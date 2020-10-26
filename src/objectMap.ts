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
    DetailedResult,
    Result,
    captureResult,
    fail,
    failWithDetail,
    mapResults,
    recordToMap,
    succeed,
} from '@fgv/ts-utils';

import { ConditionalJson } from './conditionalJson';
import { JsonObject } from './common';
import { JsonReferenceEditor } from './referenceEditor';
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
     * @param refs optional object map to resolve external references
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    getJsonObject(key: string, context?: TemplateContext, refs?: JsonObjectMap): DetailedResult<JsonObject, JsonObjectMapFailureReason>;
}

export interface ObjectMapKeyPolicyValidateOptions {
    makeValid?: boolean;
}

/**
 * Policy object responsible for validating or correcting
 * keys in a key map
 */
export class ObjectMapKeyPolicy<T> {
    protected readonly _defaultOptions?: ObjectMapKeyPolicyValidateOptions;
    protected readonly _isValid: (key: string, item?: T) => boolean;

    public constructor(options?: ObjectMapKeyPolicyValidateOptions, isValid?: (key: string, item?: T) => boolean) {
        this._defaultOptions = options;
        this._isValid = isValid ?? ObjectMapKeyPolicy.defaultKeyPredicate;
    }

    public static defaultKeyPredicate(key: string): boolean {
        return (key.length > 0) && (!key.includes('{{')) && (!key.startsWith('?'));
    }

    public isValid(key: string, item?: T): boolean {
        return this._isValid(key, item);
    }

    public validate(key: string, item?: T, _options?: ObjectMapKeyPolicyValidateOptions): Result<string> {
        return this.isValid(key, item) ? succeed(key) : fail(`${key}: invalid key`);
    }

    public validateItems(items: [string, T][], options?: ObjectMapKeyPolicyValidateOptions): Result<[string, T][]> {
        return mapResults(items.map((item) => {
            return this.validate(...item, options).onSuccess((valid) => {
                return succeed([valid, item[1]]);
            });
        }));
    }

    public validateMap(map: Map<string, T>, options?: ObjectMapKeyPolicyValidateOptions): Result<Map<string, T>> {
        return this.validateItems(Array.from(map.entries()), options).onSuccess((valid) => {
            return captureResult(() => new Map(valid));
        });
    }
}

export class PrefixKeyPolicy<T> extends ObjectMapKeyPolicy<T> {
    public readonly prefix: string;

    public constructor(prefix: string, options?: ObjectMapKeyPolicyValidateOptions) {
        super(options);
        this.prefix = prefix;
    }

    public isValid(key: string, _item?: T): boolean {
        return key.startsWith(this.prefix) && (key !== this.prefix) && ObjectMapKeyPolicy.defaultKeyPredicate(key);
    }

    public validate(key: string, item?: T, options?: ObjectMapKeyPolicyValidateOptions): Result<string> {
        options = options ?? this._defaultOptions;
        if (this.isValid(key, item)) {
            return succeed(key);
        }
        else if ((options?.makeValid === true) && ObjectMapKeyPolicy.defaultKeyPredicate(key)) {
            return succeed(`${this.prefix}${key}`);
        }
        return fail(`${key}: invalid key`);
    }
}

type MapOrRecord<T> = Map<string, T>|Record<string, T>;

/**
 * A SimpleObjectMap presents a view of a simple map of JsonObjects
 */
export abstract class SimpleObjectMapBase<T> implements JsonObjectMap {
    protected readonly _keyPolicy: ObjectMapKeyPolicy<T>;
    protected readonly _objects: Map<string, T>;
    protected readonly _defaultContext?: TemplateContext;

    protected constructor(objects: Map<string, T>, context?: TemplateContext, keyPolicy?: ObjectMapKeyPolicy<T>) {
        this._keyPolicy = keyPolicy ?? new ObjectMapKeyPolicy();
        this._objects = this._keyPolicy.validateMap(objects).getValueOrThrow();
        this._defaultContext = context;
    }

    protected static _toMap<T>(objects?: MapOrRecord<T>): Result<Map<string, T>> {
        if (objects === undefined) {
            return captureResult(() => new Map<string, T>());
        }
        else if (!(objects instanceof Map)) {
            return recordToMap(objects, (_k, v) => succeed(v));
        }
        return succeed(objects);
    }

    /**
     * Determine if a key might be valid for this map but does not determine if key actually
     * exists. Allows key range to be constrained.
     * @param key key to be tested
     * @returns true if the key is in the valid range, false otherwise.
     */
    public keyIsInRange(key: string): boolean {
        return this._keyPolicy.isValid(key);
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
     * @param refs optional map of objects that can be referenced
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    public abstract getJsonObject(key: string, context?: TemplateContext, refs?: JsonObjectMap): DetailedResult<JsonObject, JsonObjectMapFailureReason>;
}

/**
 * A SimpleObjectMap presents a view of a simple map of JsonObjects
 */
export class SimpleObjectMap extends SimpleObjectMapBase<JsonObject> {
    protected constructor(objects: Map<string, JsonObject>, context?: TemplateContext, keyPolicy?: ObjectMapKeyPolicy<JsonObject>) {
        super(objects, context, keyPolicy);
    }

    /**
     * Creates a new SimpleObjectMap from the supplied objects
     * @param objects A string-keyed Map or Record of the JsonObjects to be returned
     * @param context Context used to format returned objects
     * @param keyPredicate Optional predicate used to enforce key validity
     */
    public static createSimple(objects?: MapOrRecord<JsonObject>, context?: TemplateContext, keyPolicy?: ObjectMapKeyPolicy<JsonObject>): Result<SimpleObjectMap> {
        return SimpleObjectMap._toMap(objects).onSuccess((map) => {
            return captureResult(() => new SimpleObjectMap(map, context, keyPolicy));
        });
    }

    /**
     * Gets a JSON object specified by key.
     * @param key key of the object to be retrieved
     * @param context optional context used to format the object
     * @param refs optional map of objects that can be referenced
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    public getJsonObject(key: string, context?: TemplateContext, refs?: JsonObjectMap): DetailedResult<JsonObject, JsonObjectMapFailureReason> {
        context = context ?? this._defaultContext;
        const cfg = this._objects.get(key);
        if (!cfg) {
            return failWithDetail(`${key}: object not found`, 'unknown');
        }
        return ConditionalJson.create({ templateContext: context }).onSuccess((converter) => {
            return converter.object().convert(cfg, context).onSuccess((converted) => {
                if (refs) {
                    return JsonReferenceEditor.createMerger(refs, { converterOptions: { templateContext: context } }).onSuccess((merger) => {
                        return merger.mergeNewWithContext(context, converted);
                    });
                }
                return succeed(converted);
            }).withFailureDetail('error');
        }).withDetail('error');
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
    protected constructor(objects: Map<string, JsonObject>, context?: TemplateContext, keyPolicy?: ObjectMapKeyPolicy<JsonObject>) {
        super(objects, context, keyPolicy);
    }

    /**
     * Creates a new PrefixedObjectMap from the supplied objects
     * @param prefix A string prefix to be enforced for and added to key names as necessary
     * @param objects A string-keyed Map or Record of the JsonObjects to be returned
     * @param context Context used to format returned objects
     */
    public static createPrefixed(prefix: string, objects?: MapOrRecord<JsonObject>, context?: TemplateContext): Result<PrefixedObjectMap>;

    /**
     * Creates a new PrefixedObjectMap from the supplied objects
     * @param options A KeyPrefixOptions indicating the prefix to enforce and whether that prefix should
     * be added automatically if necessary (default true)
     * @param objects A string-keyed Map or record of the JsonObjects to be returned
     * @param context Context used to format returned objects
     */
    public static createPrefixed(options: KeyPrefixOptions, objects?: MapOrRecord<JsonObject>, context?: TemplateContext): Result<PrefixedObjectMap>;
    public static createPrefixed(prefixOptions: string|KeyPrefixOptions, objects?: MapOrRecord<JsonObject>, context?: TemplateContext
    ): Result<PrefixedObjectMap> {
        return SimpleObjectMapBase._toMap(objects).onSuccess((map) => {
            return captureResult(() => new PrefixedObjectMap(map, context, this._toPolicy(prefixOptions)));
        });
    }

    protected static _toPolicy(prefixOptions: string|KeyPrefixOptions): ObjectMapKeyPolicy<JsonObject> {
        if (typeof prefixOptions === 'string') {
            return new PrefixKeyPolicy(prefixOptions, { makeValid: true });
        }
        return new PrefixKeyPolicy(prefixOptions.prefix, { makeValid: (prefixOptions.addPrefix !== false) });
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
     * @param refs optional map of objects that can be referenced
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    public getJsonObject(key: string, context?: TemplateContext, refs?: JsonObjectMap): DetailedResult<JsonObject, JsonObjectMapFailureReason> {
        for (const map of this._maps) {
            if (map.keyIsInRange(key)) {
                const result = map.getJsonObject(key, context, refs);
                if (result.isSuccess() || (result.detail === 'error')) {
                    return result;
                }
            }
        }
        return failWithDetail(`${key}: config not found`, 'unknown');
    }
}
