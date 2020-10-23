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

import { DetailedResult, Result, captureResult, fail, mapDetailedResults, populateObject, succeed, succeedWithDetail } from '@fgv/ts-utils';
import { JsonArray, JsonObject, JsonValue, isJsonArray, isJsonObject, isJsonPrimitive } from './common';
import { JsonConverter, JsonConverterOptions } from './jsonConverter';
import { TemplateContext } from './templateContext';

type MergeType = 'clobber'|'object'|'array'|'none';

export type JsonMergeEditFailureReason = 'ignore'|'error';

export interface JsonMergeEditor {
    /**
     * Called by the JsonMerger to possibly edit one of the properties being merged into a target object.
     * @param key The key of the property to be edited
     * @param value The value of the property to be edited
     * @param target The target object into which the results should be merged
     * @param editor A JsonMerger to use for child objects and properties
     * @param context The context used to format any referenced objects
     * @returns Returns Success with true the property was edited. Returns Success with false if the object
     * was not edited.  Returns Failure and a detailed message if an error occured during merge.
     */
    // eslint-disable-next-line no-use-before-define
    editProperty(key: string, value: JsonValue, target: JsonObject, editor: JsonMerger, context?: TemplateContext): Result<boolean>;

    /**
     * Called by the JsonMerger to possibly edit a property value or array element
     * @param value The value to be edited
     * @param editor A JsonMerger to use for child objects and properties
     * @param context The context used to format any referenced objects
     * @returns Returns success with the JsonValue to be inserted, even if the object to be inserted
     * was not edited.  Returns failure with 'ignore' if the value is to be ignored, or failure
     * with 'error' if an error occurs.
     */
    // eslint-disable-next-line no-use-before-define
    editValue(value: JsonValue, editor: JsonMerger, context?: TemplateContext): DetailedResult<JsonValue, JsonMergeEditFailureReason>;
}

export class JsonMergeEditorBase {
    // eslint-disable-next-line no-use-before-define
    public editProperty(_key: string, _value: JsonValue, _target: JsonObject, _editor: JsonMerger, _context?: TemplateContext): Result<boolean> {
        return succeed(false);
    }

    // eslint-disable-next-line no-use-before-define
    public editValue(value: JsonValue, _editor: JsonMerger, _context?: TemplateContext): DetailedResult<JsonValue, JsonMergeEditFailureReason> {
        return succeedWithDetail(value);
    }
}

const defaultEditor = new JsonMergeEditorBase();

/**
 * Configuration options for a JsonMerger
 */
export interface JsonMergerOptions {
    /**
     * Options passed to a JsonConverter used to convert any
     * child objects to be merged.
     */
    converterOptions?: Partial<JsonConverterOptions>;
    editor?: JsonMergeEditor;
}

/**
 * A configurable JsonMerger which merges JSON objects either in place or into a new object,
 * optionally applying mustache template rendering to merged properties and values.
 */
export class JsonMerger {
    protected readonly _converter: JsonConverter;
    protected readonly _editor: JsonMergeEditor;
    protected readonly _defaultContext: TemplateContext;

    /**
     * Constructs a new JsonMerger with supplied or default options
     * @param options Optional merger options
     */
    public constructor(options?: Partial<JsonMergerOptions>) {
        this._converter = new JsonConverter(options?.converterOptions);
        this._editor = options?.editor ?? defaultEditor;
        this._defaultContext = options?.converterOptions?.templateContext ?? {};
    }

    /**
     * Constructs a new JsonMerger with supplied or default options
     * @param options Optional merger options
     * @returns Success with the new JsonMerger, or Failure if an error occurs.
     */
    public static create(options?: Partial<JsonMergerOptions>): Result<JsonMerger> {
        return captureResult(() => new JsonMerger(options));
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
    public mergeInPlace(target: JsonObject, src: JsonObject, context?: TemplateContext): Result<JsonObject> {
        context = context ?? this._defaultContext;
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                const propertyResult = this._converter.resolvePropertyName(key, context).onSuccess((resolvedKey) => {
                    return this._editor.editProperty(resolvedKey, src[key], target, this, context)
                        .onFailure((message) => fail(`${resolvedKey}: Edit failed - ${message}`))
                        .onSuccess((edited) => succeed({ resolvedKey, edited }));
                }).onSuccess((edit) => {
                    if (!edit.edited) {
                        return this._mergeProperty(target, edit.resolvedKey, src[key], context)
                            .onFailure((message) => fail(`${edit.resolvedKey}: Merge failed - ${message}`));
                    }
                    return succeed(true);
                });

                if (propertyResult.isFailure()) {
                    return fail(propertyResult.message);
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
     * applying mustache template rendering to merged properties and values. If an
     * optional context is supplied it overrides any context in the configuration.
     * Modifies the supplied target object.
     *
     * NOTE: Template rendering is applied only on merge, which means that any properties
     * or fields in the original target object will not be rendered.
     *
     * @param target The object into which values should be merged
     * @param sources The objects to be merged into the target
     */
    public mergeAllInPlaceWithContext(context: TemplateContext|undefined, target: JsonObject, ...sources: JsonObject[]): Result<JsonObject> {
        context = context ?? this._defaultContext;
        for (const src of sources) {
            const mergeResult = this.mergeInPlace(target, src, context);
            if (mergeResult.isFailure()) {
                return mergeResult;
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
        return this.mergeAllInPlaceWithContext(undefined, target, ...sources);
    }

    /**
     * Merges one or more supplied JSON objects into a new object, optionally
     * applying mustache template rendering to merged properties and values.
     * If an optional context is supplied, it overrides any context supplied
     * in configuration.
     * Does not modify any of the supplied objects.
     *
     * @param sources The objects to be merged
     */
    public mergeNewWithContext(context: TemplateContext|undefined, ...sources: JsonObject[]): Result<JsonObject> {
        return this.mergeAllInPlaceWithContext(context, {}, ...sources);
    }

    /**
     * Merges one or more supplied JSON objects into a new object, optionally
     * applying mustache template rendering to merged properties and values.
     * Does not modify any of the supplied objects.
     *
     * @param sources The objects to be merged
     */
    public mergeNew(...sources: JsonObject[]): Result<JsonObject> {
        return this.mergeAllInPlaceWithContext(undefined, {}, ...sources);
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

    protected _mergeProperty(target: JsonObject, resolvedKey: string, src: JsonValue, context?: TemplateContext): Result<boolean> {
        const editResult = this._editor.editValue(src, this, context);
        if (editResult.isFailure()) {
            return (editResult.detail === 'ignore') ? succeed(false) : fail(`${resolvedKey}: ${editResult.message}`);
        }
        const edited = editResult.value;

        const mergeResult = this._getMergeType(target[resolvedKey], edited);
        if (mergeResult.isFailure()) {
            return fail(`${resolvedKey}: ${mergeResult.message}`);
        }
        const mergeType = mergeResult.value;

        if (mergeType !== 'none') {
            let result: Result<JsonValue> = fail(`${resolvedKey}: Unexpected merge type ${mergeType}`);
            switch (mergeType) {
                case 'clobber':
                    result = this._cloneEdited(edited, context);
                    break;
                case 'array':
                    result = this._mergeArray(target[resolvedKey] as JsonArray, edited as JsonArray, context);
                    break;
                case 'object':
                    result = this.mergeInPlace(target[resolvedKey] as JsonObject, edited as JsonObject, context);
            }
            if (result.isFailure()) {
                return fail(`${resolvedKey}: ${result.message}`);
            }
            target[resolvedKey] = result.value;
        }
        return succeed(true);
    }

    protected _cloneEdited(src: JsonValue, context?: TemplateContext): DetailedResult<JsonValue, JsonMergeEditFailureReason> {
        if (isJsonObject(src)) {
            return this.mergeInPlace({}, src, context).withFailureDetail('error');
        }
        else if (isJsonArray(src)) {
            return this._mergeArray([], src, context).withFailureDetail('error');
        }

        return this._converter.convert(src, context)
            .withFailureDetail<JsonMergeEditFailureReason>('error')
            .onSuccess((converted) => {
                return this._editor.editValue(converted, this, context);
            });
    }

    protected _mergeArray(target: JsonArray, src: JsonArray, context?: TemplateContext): Result<JsonArray> {
        const results = src.map((v) => {
            return this._editor.editValue(v, this, context).onSuccess((edited) => {
                return this._cloneEdited(edited, context);
            });
        });

        return mapDetailedResults<JsonValue, JsonMergeEditFailureReason>(results, ['ignore']).onSuccess((converted) => {
            target.push(...converted);
            return succeed(target);
        });
    }
}
