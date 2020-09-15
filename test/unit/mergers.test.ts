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
import * as JsonMergers from '../../src/mergers';

describe('mergers module', () => {
    const base = {
        baseString: 'baseString',
    };
    const toMerge = {
        mergedString: 'mergedString',
    };
    const expected = {
        baseString: 'baseString',
        mergedString: 'mergedString',
    };

    describe('mergeInPlace function', () => {
        test('updates the supplied target object', () => {
            const b = JSON.parse(JSON.stringify(base));
            expect(JsonMergers.mergeInPlace(b, toMerge)).toSucceedAndSatisfy((merged) => {
                expect(merged).toEqual(expected);
                expect(merged).toBe(b);
                expect(b).toEqual(expected);
            });
        });
    });

    describe('mergeAllInPlace function', () => {
        const toMerge2 = {
            mergedString: 'mergedOverride',
            extraMergedString: 'extraMerged',
        };
        const expected2 = {
            baseString: 'baseString',
            mergedString: 'mergedOverride',
            extraMergedString: 'extraMerged',
        };
        test('updates the supplied target object', () => {
            const b = JSON.parse(JSON.stringify(base));
            expect(JsonMergers.mergeAllInPlace(b, toMerge, toMerge2)).toSucceedAndSatisfy((merged) => {
                expect(merged).toEqual(expected2);
                expect(merged).toBe(b);
                expect(b).toEqual(expected2);
            });
        });
    });

    describe('mergeNew function', () => {
        test('does not update the supplied target object', () => {
            const b = JSON.parse(JSON.stringify(base));
            expect(JsonMergers.mergeNew(b, toMerge)).toSucceedAndSatisfy((merged) => {
                expect(merged).toEqual(expected);
                expect(merged).not.toBe(b);
                expect(b).not.toEqual(expected);
            });
        });
    });
});
