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

import { JsonMerger } from './jsonMerger';
import { JsonObject } from './common';
import { Result } from '@fgv/ts-utils';

const defaultMerger = new JsonMerger();

/**
 * Merges a single supplied JSON object into a supplied target. Modifies the supplied target object.
 *
 * @param target The object into which values should be merged
 * @param src The object to be merged
 */
export function mergeInPlace(target: JsonObject, src: JsonObject): Result<JsonObject> {
    return defaultMerger.mergeInPlace(target, src);
}

/**
 * Merges one or more supplied JSON object into a supplied target.  Modifies the supplied
 * target object.
 *
 * @param target The object into which values should be merged
 * @param sources The objects to be merged into the target
 */
export function mergeAllInPlace(target: JsonObject, ...sources: JsonObject[]): Result<JsonObject> {
    return defaultMerger.mergeAllInPlace(target, ...sources);
}

/**
 * Merges one or more supplied JSON objects into a new object, optionally
 * applying mustache template rendering to merged properties and values.
 * Does not modify any of the supplied objects.
 *
 * @param sources The objects to be merged
 */
export function mergeNew(...sources: JsonObject[]): Result<JsonObject> {
    return defaultMerger.mergeAllInPlace({}, ...sources);
}
