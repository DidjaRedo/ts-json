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
import { DetailedResult, failWithDetail, succeedWithDetail } from '@fgv/ts-utils';
import { JsonEditFailureReason, JsonEditorContext, JsonEditorRule } from '../../src/jsonEditorRules';
import { JsonObject, JsonValue, TemplateContext, isJsonPrimitive } from '../../src';

import { JsonEditor } from '../../src/jsonEditor';

describe('JsonObjectEditor', () => {
    describe('create static method', () => {
        test('succeeds with no rules or context', () => {
            expect(JsonEditor.create()).toSucceedWith(expect.any(JsonEditor));
        });
    });

    describe('with no rules', () => {
        describe('mergeObjectInPlace method', () => {
            const editor = JsonEditor.create().getValueOrThrow();

            describe('with valid json', () => {
                interface MergeSuccessCase {
                    description: string;
                    base: JsonObject;
                    source: JsonObject;
                    expected: JsonObject;
                }

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

                for (const t of goodTests) {
                    test(`${t.description}`, () => {
                        const base = JSON.parse(JSON.stringify(t.base));
                        expect(editor.mergeObjectInPlace(base, t.source)).toSucceedAndSatisfy((got) => {
                            expect(got).toEqual(t.expected);
                            // expect(got).not.toBe(base);
                        });
                    });
                }
            });

            describe('with invalid json', () => {
                interface MergeFailureCase {
                    description: string;
                    expected: string|RegExp;
                    base(): Record<string, unknown>;
                    source(): Record<string, unknown>;
                }

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

                failureTests.forEach((t) => {
                    test(t.description, () => {
                        const base = JSON.parse(JSON.stringify(t.base()));
                        const source = t.source() as JsonObject;
                        expect(editor.mergeObjectInPlace(base, source)).toFailWith(t.expected);
                    });
                });
            });
        });

        describe('clone method', () => {
            const editor = JsonEditor.create().getValueOrThrow();

            describe('with valid json', () => {
                const good: JsonValue[] = [
                    'literal string',
                    123,
                    false,
                    ['array', 123],
                    {
                        child: {
                            prop: 'value',
                            array: [
                                {
                                    prop: 'object in array',
                                },
                            ],
                        },
                        arrayInArray: [
                            ['hello', 'goodbye'],
                            [123, true],
                            {
                                arrayInObjectInArrayInArray: ['deep'],
                            },
                        ],
                    },
                ];
                test('succeeds with valid JSON', () => {
                    for (const t of good) {
                        expect(editor.clone(t)).toSucceedAndSatisfy((cloned) => {
                            expect(cloned).toEqual(t);
                            if (!isJsonPrimitive(cloned)) {
                                expect(cloned).not.toBe(t);
                            }
                        });
                    }
                });
            });
        });
    });

    describe('with rules', () => {
        class TestRule implements JsonEditorRule {
            editProperty(key: string, value: JsonValue, context?: JsonEditorContext): DetailedResult<JsonObject, JsonEditFailureReason> {
                const vars = context?.vars ?? {};
                if (key === 'replace:key') {
                    return succeedWithDetail({ replaced: value });
                }
                else if (key === 'replace:value') {
                    if (typeof value === 'string') {
                        if (vars[value]) {
                            return succeedWithDetail({ replaced: vars[value] as string });
                        }
                    }
                }
                return failWithDetail('inapplicable', 'inapplicable');
            }
            editValue(value: JsonValue, context?: JsonEditorContext): DetailedResult<JsonValue, JsonEditFailureReason> {
                const vars = context?.vars ?? {};
                if (typeof value === 'string') {
                    const parts = value.split(':');
                    if ((parts.length > 1) && (parts[0] === 'replace')) {
                        let replacementValue = 'default replacement';
                        if ((parts.length > 2) && (vars[parts[2]])) {
                            replacementValue = vars[parts[2]] as string;
                        }
                        if (parts[1] === 'object') {
                            return succeedWithDetail({ objectReplacement: replacementValue });
                        }
                        else if (parts[1] === 'string') {
                            return succeedWithDetail(replacementValue);
                        }
                    }
                }
                return failWithDetail('inapplicable', 'inapplicable');
            }
        }

        describe('constructor', () => {
            test('succeeds with rules present', () => {
                expect(JsonEditor.create(undefined, [new TestRule()])).toSucceedWith(expect.any(JsonEditor));
            });
        });

        describe('mergeObjectInPlace method', () => {
            const editor = JsonEditor.create(undefined, [new TestRule()]).getValueOrThrow();

            interface MergeTestCase {
                description: string;
                src: JsonObject;
                expected: JsonObject;
                vars?: TemplateContext;
            }

            const good: MergeTestCase[] = [
                {
                    description: 'edits a property name',
                    src: { 'replace:key': 'test value' },
                    expected: { replaced: 'test value' },
                },
                {
                    description: 'edits a property value based on key',
                    src: { 'replace:value': 'insertion' },
                    expected: { replaced: 'variable insertion' },
                    vars: { insertion: 'variable insertion' },
                },
                {
                    description: 'edits a property value based on value',
                    src: {
                        string: 'replace:string',
                        object: 'replace:object',
                        array: [
                            'replace:string',
                            'replace:object',
                        ],
                    },
                    expected: {
                        string: 'default replacement',
                        object: {
                            objectReplacement: 'default replacement',
                        },
                        array: [
                            'default replacement',
                            {
                                objectReplacement: 'default replacement',
                            },
                        ],
                    },
                },
                {
                    description: 'edits properties in child objects',
                    src: {
                        child: {
                            'replace:key': 'key name replacement',
                            string: 'replace:string:replacement',
                            grandchild: {
                                'replace:value': 'insertion',
                                array: [
                                    'replace:object',
                                ],
                            },
                        },
                    },
                    expected: {
                        child: {
                            replaced: 'key name replacement',
                            string: 'var replacement',
                            grandchild: {
                                replaced: 'variable insertion',
                                array: [
                                    {
                                        objectReplacement: 'default replacement',
                                    },
                                ],
                            },
                        },
                    },
                    vars: { insertion: 'variable insertion', replacement: 'var replacement' },
                },
            ];

            for (const t of good) {
                test(t.description, () => {
                    expect(editor.mergeObjectInPlace({}, t.src, { vars: t.vars })).toSucceedWith(t.expected);
                });
            }
        });
    });
});
