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
    succeedWithDetail,
} from '@fgv/ts-utils';

import { JsonContext, JsonReferenceMap, JsonReferenceMapFailureReason } from './jsonContext';
import { JsonObject, JsonValue, isJsonObject } from './common';
import { JsonEditor } from './jsonEditor';

export interface ReferenceMapKeyPolicyValidateOptions {
    makeValid?: boolean;
}

/**
 * Policy object responsible for validating or correcting
 * keys in a reference map
 */
export class ReferenceMapKeyPolicy<T> {
    protected readonly _defaultOptions?: ReferenceMapKeyPolicyValidateOptions;
    protected readonly _isValid: (key: string, item?: T) => boolean;

    public constructor(options?: ReferenceMapKeyPolicyValidateOptions, isValid?: (key: string, item?: T) => boolean) {
        this._defaultOptions = options;
        this._isValid = isValid ?? ReferenceMapKeyPolicy.defaultKeyPredicate;
    }

    public static defaultKeyPredicate(key: string): boolean {
        return (key.length > 0) && (!key.includes('{{')) && (!key.startsWith('?'));
    }

    public isValid(key: string, item?: T): boolean {
        return this._isValid(key, item);
    }

    public validate(key: string, item?: T, _options?: ReferenceMapKeyPolicyValidateOptions): Result<string> {
        return this.isValid(key, item) ? succeed(key) : fail(`${key}: invalid key`);
    }

    public validateItems(items: [string, T][], options?: ReferenceMapKeyPolicyValidateOptions): Result<[string, T][]> {
        return mapResults(items.map((item) => {
            return this.validate(...item, options).onSuccess((valid) => {
                return succeed([valid, item[1]]);
            });
        }));
    }

    public validateMap(map: Map<string, T>, options?: ReferenceMapKeyPolicyValidateOptions): Result<Map<string, T>> {
        return this.validateItems(Array.from(map.entries()), options).onSuccess((valid) => {
            return captureResult(() => new Map(valid));
        });
    }
}

export class PrefixKeyPolicy<T> extends ReferenceMapKeyPolicy<T> {
    public readonly prefix: string;

    public constructor(prefix: string, options?: ReferenceMapKeyPolicyValidateOptions) {
        super(options);
        this.prefix = prefix;
    }

    public isValid(key: string, _item?: T): boolean {
        return key.startsWith(this.prefix) && (key !== this.prefix) && ReferenceMapKeyPolicy.defaultKeyPredicate(key);
    }

    public validate(key: string, item?: T, options?: ReferenceMapKeyPolicyValidateOptions): Result<string> {
        // istanbul ignore next
        const makeValid = (options ?? this._defaultOptions)?.makeValid === true;
        if (this.isValid(key, item)) {
            return succeed(key);
        }
        else if (makeValid && ReferenceMapKeyPolicy.defaultKeyPredicate(key)) {
            return succeed(`${this.prefix}${key}`);
        }
        return fail(`${key}: invalid key`);
    }
}

export type MapOrRecord<T> = Map<string, T>|Record<string, T>;

/**
 * A SimpleJsonMap presents a view of a simple map of @see JsonValue
 */
export abstract class SimpleJsonMapBase<T> implements JsonReferenceMap {
    protected readonly _keyPolicy: ReferenceMapKeyPolicy<T>;
    protected readonly _values: Map<string, T>;
    protected readonly _context?: JsonContext;

    protected constructor(values?: MapOrRecord<T>, context?: JsonContext, keyPolicy?: ReferenceMapKeyPolicy<T>) {
        values = SimpleJsonMapBase._toMap(values).getValueOrThrow();
        this._keyPolicy = keyPolicy ?? new ReferenceMapKeyPolicy();
        this._values = this._keyPolicy.validateMap(values).getValueOrThrow();
        this._context = context;
    }

    protected static _toMap<T>(values?: MapOrRecord<T>): Result<Map<string, T>> {
        if (values === undefined) {
            return captureResult(() => new Map<string, T>());
        }
        else if (!(values instanceof Map)) {
            return recordToMap(values, (_k, v) => succeed(v));
        }
        return succeed(values);
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
        return this._values.has(key);
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
    public abstract getJsonValue(key: string, context?: JsonContext): DetailedResult<JsonValue, JsonReferenceMapFailureReason>;
}

/**
 * A SimpleJsonMap presents a view of a simple map of @see JsonValue
 */
export class SimpleJsonMap extends SimpleJsonMapBase<JsonValue> {
    protected _editor?: JsonEditor;

    protected constructor(values?: MapOrRecord<JsonValue>, context?: JsonContext, keyPolicy?: ReferenceMapKeyPolicy<JsonValue>) {
        super(values, context, keyPolicy);
    }

    /**
     * Creates a new @see SimpleJsonMap from the supplied objects
     * @param values A string-keyed Map or Record of the @see JsonObject to be returned
     * @param context Optional @see JsonContext used to format returned values
     * @param keyPolicy Optional @see ReferenceMapKeyPolicy used to enforce key validity
     */
    public static createSimple(values?: MapOrRecord<JsonValue>, context?: JsonContext, keyPolicy?: ReferenceMapKeyPolicy<JsonValue>): Result<SimpleJsonMap> {
        return captureResult(() => new SimpleJsonMap(values, context, keyPolicy));
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
        context = context ?? this._context;
        const value = this._values.get(key);
        if (!value) {
            return failWithDetail(`${key}: JSON value not found`, 'unknown');
        }
        return this._clone(value, context);
    }

    protected _clone(value: JsonValue, context?: JsonContext): DetailedResult<JsonValue, JsonReferenceMapFailureReason> {
        if (!this._editor) {
            const result = JsonEditor.create();
            // istanbul ignore next: nearly impossible to reproduce
            if (result.isFailure()) {
                return failWithDetail(result.message, 'error');
            }
            this._editor = result.value;
        }
        return this._editor.clone(value, context).withFailureDetail('error');
    }
}

/**
 * Initialization options for a PrefixedJsonMap
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
 * A PrefixedJsonMap enforces a supplied prefix for all contained values, optionally
 * adding the prefix as necessary (default true).
 */
export class PrefixedJsonMap extends SimpleJsonMap {
    protected constructor(values?: MapOrRecord<JsonValue>, context?: JsonContext, keyPolicy?: ReferenceMapKeyPolicy<JsonValue>) {
        super(values, context, keyPolicy);
    }

    /**
     * Creates a new @see PrefixedJsonMap from the supplied values
     * @param prefix A string prefix to be enforced for and added to key names as necessary
     * @param values A string-keyed Map or Record of the @see JsonValue to be returned
     * @param context Optional @see JsonContext used to format returned values
     */
    public static createPrefixed(prefix: string, values?: MapOrRecord<JsonValue>, context?: JsonContext): Result<PrefixedJsonMap>;

    /**
     * Creates a new @see PrefixedJsonMap from the supplied values
     * @param options A KeyPrefixOptions indicating the prefix to enforce and whether that prefix should
     * be added automatically if necessary (default true)
     * @param values A string-keyed Map or record of the @see JsonValue to be returned
     * @param context Optional @see JsonContext used to format returned values
     */
    public static createPrefixed(options: KeyPrefixOptions, values?: MapOrRecord<JsonValue>, context?: JsonContext): Result<PrefixedJsonMap>;
    public static createPrefixed(prefixOptions: string|KeyPrefixOptions, values?: MapOrRecord<JsonValue>, context?: JsonContext): Result<PrefixedJsonMap> {
        return captureResult(() => new PrefixedJsonMap(values, context, this._toPolicy(prefixOptions)));
    }

    protected static _toPolicy(prefixOptions: string|KeyPrefixOptions): ReferenceMapKeyPolicy<JsonValue> {
        if (typeof prefixOptions === 'string') {
            return new PrefixKeyPolicy(prefixOptions, { makeValid: true });
        }
        return new PrefixKeyPolicy(prefixOptions.prefix, { makeValid: (prefixOptions.addPrefix !== false) });
    }
}

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
