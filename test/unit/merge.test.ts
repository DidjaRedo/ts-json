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

import { JsonMerger } from '../../src/merge';
import { JsonObject } from '../../src';

interface MergeSuccessCase {
    description: string;
    base: JsonObject;
    source: JsonObject;
    expected: JsonObject;
}

interface MergeFailureCase {
    description: string;
    expected: string|RegExp;
    base(): Record<string, unknown>;
    source(): Record<string, unknown>;
}

describe('JsonMerger class', () => {
    const goodTests: MergeSuccessCase[] = [
        {
            description: 'clobbers or adds primitive fields',
            base: {
                stringField: 'string',
                numberField: 10,
                boolField: true,
                ignoredField: 'ignored',
            },
            source: {
                stringField: 'updated string',
                numberField: 20,
                boolField: false,
                newString: 'new string',
            },
            expected: {
                stringField: 'updated string',
                numberField: 20,
                boolField: false,
                newString: 'new string',
                ignoredField: 'ignored',
            },
        },
        {
            description: 'merges or adds child objects',
            base: {
                ignoredChild: {
                    ignoredNumber: 10,
                },
                child: {
                    ignoredString: 'original',
                    replacedString: 'original',
                },
            },
            source: {
                child: {
                    replacedString: 'replaced',
                },
                newChild: {
                    newString: 'new',
                },
            },
            expected: {
                ignoredChild: {
                    ignoredNumber: 10,
                },
                child: {
                    ignoredString: 'original',
                    replacedString: 'replaced',
                },
                newChild: {
                    newString: 'new',
                },
            },
        },
        {
            description: 'merges or adds child arrays',
            base: {
                untouchedArray: ['string', 'another string'],
                mergedArray: ['base string', 'base string 2'],
            },
            source: {
                mergedArray: ['added string 1'],
                newArray: ['new string 1', 27],
            },
            expected: {
                untouchedArray: ['string', 'another string'],
                mergedArray: ['base string', 'base string 2', 'added string 1'],
                newArray: ['new string 1', 27],
            },
        },
    ];

    const failureTests: MergeFailureCase[] = [
        {
            description: 'fails for objects with function properties',
            base: () => {
                return {
                    stringValue: 'string',
                };
            },
            source: () => {
                return {
                    funcValue: () => 'hello',
                };
            },
            expected: /invalid json/i,
        },
    ];

    describe('mergeNew method', () => {
        const merger = new JsonMerger();
        describe('with valid json', () => {
            goodTests.forEach((t) => {
                test(`${t.description} into new object`, () => {
                    const base = JSON.parse(JSON.stringify(t.base));
                    expect(merger.mergeNew(base, t.source)).toSucceedAndSatisfy((got) => {
                        expect(got).toEqual(t.expected);
                        expect(got).not.toBe(base);
                    });
                });
            });
        });

        describe('with invalid json', () => {
            failureTests.forEach((t) => {
                test(t.description, () => {
                    const base = t.base() as JsonObject;
                    const source = t.source() as JsonObject;
                    expect(merger.mergeNew(base, source)).toFailWith(t.expected);
                });
            });
        });
    });
});
