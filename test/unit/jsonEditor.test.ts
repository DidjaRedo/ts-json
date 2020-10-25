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
import { JsonObject, JsonValue } from '../../src';
import { JsonObjectEditor } from '../../src/jsonEditor';

describe('JsonObjectEditor', () => {
    describe('create static method', () => {
        test('succeeds with no rules or context', () => {
            expect(JsonObjectEditor.create()).toSucceedWith(expect.any(JsonObjectEditor));
        });
    });

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

    describe('with no rules', () => {
        const goodTests: MergeSuccessCase[] = [
            {
                description: 'clobbers or adds primitive fields',
                base: {
                    stringField: 'string',
                    numberField: 10,
                    boolField: true,
                    untouchedField: 'untouched',
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
                    untouchedField: 'untouched',
                },
            },
            {
                description: 'merges or adds child objects',
                base: {
                    untouchedChild: {
                        untouchedNumber: 10,
                    },
                    child: {
                        untouchedString: 'original',
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
                    untouchedChild: {
                        untouchedNumber: 10,
                    },
                    child: {
                        untouchedString: 'original',
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
            {
                description: 'ignores undefined source values',
                base: {
                    untouchedArray: ['string', 'another string'],
                    mergedArray: ['base string', 'base string 2'],
                },
                source: {
                    mergedArray: ['added string 1'],
                    newArray: ['new string 1', 27],
                    ignoreMePlease: undefined as unknown as JsonValue,
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
            {
                description: 'fails for objects with an invalid array element',
                base: () => {
                    return {
                        arrayValue: [1, 2, 3],
                    };
                },
                source: () => {
                    return {
                        arrayValue: [4, (() => true) as unknown as JsonValue],
                    };
                },
                expected: /invalid json/i,
            },
            {
                description: 'fails for objects with inherited properties',
                base: () => {
                    return {
                        arrayValue: [1, 2, 3],
                    };
                },
                source: () => {
                    const obj1 = {
                        baseProp: 'from base',
                    };
                    return Object.create(obj1, {
                        myProp: {
                            value: 'from child',
                            enumerable: true,
                        },
                    });
                },
                expected: /merge inherited/i,
            },
        ];

        describe('mergeInPlace method', () => {
            const editor = JsonObjectEditor.create().getValueOrThrow();
            describe('with valid json', () => {
                for (const t of goodTests) {
                    test(`${t.description}`, () => {
                        const base = JSON.parse(JSON.stringify(t.base));
                        expect(editor.mergeInPlace(base, t.source)).toSucceedAndSatisfy((got) => {
                            expect(got).toEqual(t.expected);
                            // expect(got).not.toBe(base);
                        });
                    });
                }
            });

            describe('with invalid json', () => {
                failureTests.forEach((t) => {
                    test(t.description, () => {
                        const base = JSON.parse(JSON.stringify(t.base()));
                        const source = t.source() as JsonObject;
                        expect(editor.mergeInPlace(base, source)).toFailWith(t.expected);
                    });
                });
            });
        });
    });
});
