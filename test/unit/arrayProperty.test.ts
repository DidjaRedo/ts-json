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

import '@fgv/ts-utils-jest';

import * as JsonConverters from '../../src/converters';
import { ArrayPropertyConverter } from '../../src/arrayProperty';
import { mergeDefaultJsonConverterOptions } from '../../src';

describe('ArrayPropertyConverter class', () => {
    const token = '[[prop]]=value1,value2';
    const context = {};
    const converter = JsonConverters.json;
    const options = mergeDefaultJsonConverterOptions({});

    describe('static create', () => {
        test('succeeds with a parseable value and valid init', () => {
            expect(ArrayPropertyConverter.create(token, context, converter, options)).toSucceed();
        });

        test('fails with detail notAnArray if the token is not an array', () => {
            expect(ArrayPropertyConverter.create('whatever', context, converter, options)).toFailWithDetail(
                /not an array/i,
                'notAnArray',
            );
        });

        test('fails with detail error if the token is a malformed array', () => {
            expect(ArrayPropertyConverter.create('[[feh]', context, converter, options)).toFailWithDetail(
                /malformed array/i,
                'error',
            );
        });

        test('fails with detail disabled if useArrayTemplateNames is false', () => {
            const opts = mergeDefaultJsonConverterOptions({ useArrayTemplateNames: false });
            expect(ArrayPropertyConverter.create(token, context, converter, opts)).toFailWithDetail(
                /disabled/i,
                'disabled',
            );
        });

        test('fails with detail error if useArrayTemplateNames is true but deriveContext is not defined', () => {
            const opts = mergeDefaultJsonConverterOptions({ useArrayTemplateNames: true });
            opts.contextDeriver = undefined;
            expect(ArrayPropertyConverter.create(token, context, converter, opts)).toFailWithDetail(
                /no context.*function/i,
                'error',
            );
        });
    });
});
