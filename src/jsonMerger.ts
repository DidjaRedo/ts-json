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

import { DetailedResult, Result, captureResult } from '@fgv/ts-utils';
import { JsonEditFailureReason, JsonEditorContext } from './jsonMergeEditor';
import { JsonObject, JsonValue } from './common';

import { JsonConverterOptions } from './jsonConverter';
import { JsonEditor } from './jsonEditor';
import { TemplateContext } from './templateContext';

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
    protected readonly _editor: JsonEditor;

    /**
     * Constructs a new JsonMerger with supplied or default options
     * @param options Optional merger options
     */
    public constructor(options?: Partial<JsonMergerOptions>) {
        this._editor = JsonEditor.create({ vars: options?.converterOptions?.templateContext }).getValueOrThrow();
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
        return this._editor.mergeObjectInPlace(target, src, { vars: context });
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
        return this._editor.mergeObjectsInPlaceWithContext({ vars: context }, target, ...sources);
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

    // temporary scaffolding during refactor
    public cloneValue(src: JsonValue, context: JsonEditorContext): DetailedResult<JsonValue, JsonEditFailureReason> {
        return this._editor.clone(src, context).withFailureDetail('error');
    }
}
