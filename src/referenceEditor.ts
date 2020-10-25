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

import { DetailedResult, Result, captureResult, fail, failWithDetail, propagateWithDetail, succeed, succeedWithDetail } from '@fgv/ts-utils';
import { JsonEditFailureReason, JsonEditorRule, JsonObjectEditor } from './jsonMergeEditor';
import { JsonMerger, JsonMergerOptions } from './jsonMerger';
import { JsonObject, JsonValue, pickJsonObject } from './common';

import { JsonObjectMap } from './objectMap';
import { TemplateContext } from './templateContext';

/**
 * A JsonReferenceEditor extends a JsonMerger to insert json values
 * or objects from some other source into a file being merged. Objects
 * are conditionally formatted using an appropriate context before being
 * inserted.
 *
 * Reference formats:
 *
 * If a property name matches one of the available objects, the value of that property
 * is interpreted as follows:
 *    "default" - the matching object is formatted with the default context
 *    (Object) - string properties of the object are added to the current context and used to format
 *               the matching object.
 *    <any other string> - matching object is formatted with the default context and the element
 *               matching the string is used instead of the whole object. Supports dot notation
 *               for nested objects.
 * If a match is found, the _properties_ of the matching object are merged into the target.
 *
 * If a property string value matches one of the available objects, it will be replaced with the
 * entire matching object, formatted with the default context.
 */
export class JsonReferenceEditor implements JsonEditorRule {
    protected _objects: JsonObjectMap;

    protected constructor(objects: JsonObjectMap) {
        this._objects = objects;
    }

    /**
     * Creates a new JsonReferenceEditor for a supplied map of objects
     * @param objects The objects available for replacement.
     */
    public static create(objects: JsonObjectMap): Result<JsonReferenceEditor> {
        return captureResult(() => new JsonReferenceEditor(objects));
    }

    /**
     * Creates a JsonMerger which will replace object references usin the supplied
     * object map.
     * @param objects Map of objects available for replacement
     * @param options Any other options for the merger
     */
    public static createMerger(objects: JsonObjectMap, options?: JsonMergerOptions): Result<JsonMerger> {
        return JsonReferenceEditor.create(objects).onSuccess((editor) => {
            const mergerOptions = {
                ...(options ?? {}),
                editor,
            };
            return JsonMerger.create(mergerOptions);
        });
    }

    /**
     * Gets the context to use given the value of some property whose name matched a
     * resource plus the base context.
     * @param supplied The string or object supplied in the source json
     * @param baseContext The context in effect at the point of resolution
     */
    public static getContext(supplied: JsonValue, baseContext?: TemplateContext): Result<TemplateContext> {
        let context: TemplateContext = baseContext ?? {};
        if ((typeof supplied === 'object') && (!Array.isArray(supplied))) {
            context = { ...baseContext, ...supplied };
        }
        else if (typeof supplied !== 'string') {
            return fail(`Invalid template path or context: "${JSON.stringify(supplied)}"`);
        }
        return succeed(context);
    }

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
    public editProperty(key: string, value: JsonValue, target: JsonObject, editor: JsonObjectEditor, baseContext?: TemplateContext): Result<boolean> {
        if (this._objects.has(key)) {
            return JsonReferenceEditor.getContext(value, baseContext).onSuccess((context) => {
                const result = this._objects.getJsonObject(key, context).onSuccess((obj) => {
                    if ((typeof value !== 'string') || (value === 'default')) {
                        return succeedWithDetail(obj, 'unknown');
                    }
                    return propagateWithDetail(pickJsonObject(obj, value), 'error');
                });
                if (result.isSuccess()) {
                    return editor.mergeInPlace(target, result.value, context).onSuccess(() => succeed(true));
                }
                return fail(result.message);
            });
        }
        else if ((typeof value === 'string') && this._objects.has(value)) {
            const result = this._objects.getJsonObject(value, baseContext);
            if (result.isSuccess()) {
                const toMerge: JsonObject = {};
                toMerge[key] = result.value;
                return editor.mergeInPlace(target, toMerge, baseContext).onSuccess(() => succeed(true));
            }
            return fail(result.message);
        }
        return succeed(false);
    }

    public editValue(value: JsonValue, editor: JsonObjectEditor, context?: TemplateContext): DetailedResult<JsonValue, JsonEditFailureReason> {
        if (typeof value === 'string') {
            const result = this._objects.getJsonObject(value, context);
            if (result.isSuccess()) {
                return editor.cloneValue(result.value, context).withFailureDetail('error');
            }
            else if (result.detail === 'error') {
                return failWithDetail(result.message, 'error');
            }
        }
        return succeedWithDetail(value);
    }
}
