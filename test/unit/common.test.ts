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

import { isJsonObject, isJsonPrimitive } from '../../src';

describe('json/common module', () => {
    describe('isJsonObject function', () => {
        test('returns true for a JSON object', () => {
            expect(isJsonObject({ prop: 'value' })).toBe(true);
        });

        test('returns false for a non-object or an array', () => {
            [
                'hello',
                true,
                10,
                [{ property: 'value' }],
                () => { return { property: 'value' }; },
            ].forEach((t) => {
                expect(isJsonObject(t)).toBe(false);
            });
        });
    });

    describe('isJsonPrimitive function', () => {
        test('returns true for a JSON primitive', () => {
            [
                'string',
                10,
                true,
                null,
            ].forEach((t) => {
                expect(isJsonPrimitive(t)).toBe(true);
            });
        });

        test('returns false for non-JSON primitives', () => {
            [
                [1, 2, 3],
                { a: true },
                () => 'hello',
            ].forEach((t) => {
                expect(isJsonPrimitive(t)).toBe(false);
            });
        });
    });
});
