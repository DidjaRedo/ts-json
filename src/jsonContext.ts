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

import { DetailedResult, Result, succeed } from '@fgv/ts-utils';
import { JsonObject, JsonValue } from './common';

/**
 * Collection of variable used for template replacement in a JSON edit or conversion.
 */
export type TemplateVars = Record<string, unknown>;

/**
 * Describes one value in a TemplateVars collection of variables
 */
export type VariableValue = [string, unknown];

/**
 * Function used to create a new collection of template vars with one or more
 * new or changed values.
 */
export type TemplateVarsExtendFunction = (base: TemplateVars|undefined, values: VariableValue[]) => Result<TemplateVars|undefined>;

/**
 * This default implementation of a TemplateVarsExtendFunction creates a new collection
 * via inheritance from the supplied collection
 * @param base The base variables to be extendend
 * @param values The values to be added or overridden in the new variables
 */
export function defaultExtendVars(base: TemplateVars|undefined, values: VariableValue[]): Result<TemplateVars|undefined> {
    const rtrn = (base ? Object.create(base) : {});
    for (const v of values) {
        rtrn[v[0]] = v[1];
    }
    return succeed(rtrn);
}

/**
 * Failure reason for JsonObjectMap lookup, where 'unknown' means
 * that the object is not present in the map and 'error' means
 * that an error occurred while retrieving or converting it.
 */
export type JsonReferenceMapFailureReason = 'unknown'|'error';

/**
 * Interface for a simple map that returns named @see JsonObject objects with templating,
 * conditional logic, and external reference lookups applied using an optionally
 * supplied context.
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
     * @param vars optional variables used to format the object
     * @param refs optional object map to resolve external references
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    getJsonObject(key: string, vars?: TemplateVars, refs?: JsonObjectMap): DetailedResult<JsonObject, JsonReferenceMapFailureReason>;
}

/**
 * Interface for a simple map that returns named @see JsonValue values with templating, conditional logic,
 * and external reference lookups applied using an optionally supplied context.
 */
export interface JsonReferenceMap extends JsonObjectMap {
    /**
     * Gets a JSON value specified by key.
     * @param key key of the object to be retrieved
     * @param context Optional @see JsonContext used to format the value
     * @returns Success with the formatted object if successful. Failure with detail 'unknown'
     * if no such object exists, or failure with detail 'error' if the object was found but
     * could not be formatted.
     */
    // eslint-disable-next-line no-use-before-define
    getJsonValue(key: string, context?: JsonContext): DetailedResult<JsonValue, JsonReferenceMapFailureReason>;
}

/**
 * Context used to convert or edit JSON objects.
 */
export interface JsonContext {
    vars?: TemplateVars;
    refs?: JsonReferenceMap;
    extendVars?: TemplateVarsExtendFunction;
}

