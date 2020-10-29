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
    JsonConverterBase,
    JsonConverterOptions,
} from './jsonConverter';
import {
    Result,
    captureResult,
} from '@fgv/ts-utils';

/**
 * A ConditionalJson is a ts-utils Converter which applies optional templating
 * and then conditional flattening to a supplied unknown object.
 */
export class ConditionalJson extends JsonConverterBase {
    /**
     * Create a new ConditionalJson converter with the supplied or default
     * options.
     * @param options Optional converter options
     */
    public constructor(options?: Partial<JsonConverterOptions>) {
        super(options);
    }

    /**
     * Creates a new ConditionalJson object with the supplied or default options.
     * @param options Optional converter options
     * @returns Success with a new ConditionalJson object on success, or Failure with
     * an informative message if creation fails.
     */
    public static create(options?: Partial<JsonConverterOptions>): Result<ConditionalJson> {
        return captureResult(() => new ConditionalJson(options));
    }
}
