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
import { JsonEditFailureReason, JsonEditorRule } from '../../../src/jsonEditor/jsonEditorRule';
import { JsonObject, JsonValue, isJsonPrimitive } from '../../../src';

import { JsonEditor } from '../../../src/jsonEditor/jsonEditor';
import { JsonEditorState } from '../../../src/jsonEditor/jsonEditorState';
import { TemplatedJsonEditorRule } from '../../../src/jsonEditor/rules/templates';

describe('JsonObjectEditor', () => {
    describe('create static method', () => {
        test('succeeds with no rules or context', () => {
            expect(JsonEditor.create()).toSucceedWith(expect.any(JsonEditor));
        });
    });

    describe('with no rules', () => {
        describe('mergeObjectsInPlace method', () => {
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
                        expect(editor.mergeObjectsInPlace({}, t.base, t.source)).toSucceedAndSatisfy((got) => {
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
                                child: {
                                    funcValue: () => 'hello',
                                },
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
                        const base = t.base() as JsonObject;
                        const source = t.source() as JsonObject;
                        expect(editor.mergeObjectsInPlace({}, base, source)).toFailWith(t.expected);
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

    describe('merge methods', () => {
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

        describe('mergeObjectInPlace method', () => {
            test('updates the supplied target object', () => {
                const b = JSON.parse(JSON.stringify(base));
                expect(JsonEditor.default.mergeObjectInPlace(b, toMerge)).toSucceedAndSatisfy((merged) => {
                    expect(merged).toEqual(expected);
                    expect(merged).toBe(b);
                    expect(b).toEqual(expected);
                });
            });
        });

        describe('mergeObjectsInPlace method', () => {
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
                expect(JsonEditor.default.mergeObjectsInPlace(b, toMerge, toMerge2)).toSucceedAndSatisfy((merged) => {
                    expect(merged).toEqual(expected2);
                    expect(merged).toBe(b);
                    expect(b).toEqual(expected2);
                });
            });
        });
    });

    describe('with rules', () => {
        class TestRule implements JsonEditorRule {
            editProperty(key: string, value: JsonValue, _state: JsonEditorState): DetailedResult<JsonObject, JsonEditFailureReason> {
                if (key === 'replace:flatten') {
                    if (Array.isArray(value) || (typeof value !== 'object') || (value === null)) {
                        return failWithDetail(`${key}: cannot flatten non-object`, 'error');
                    }
                    return succeedWithDetail(value, 'edited');
                }
                else if (value === 'replace:object') {
                    const toMerge: JsonObject = {};
                    toMerge[key] = { child1: '{{var1}}', child2: 'value2' };
                    return succeedWithDetail(toMerge, 'edited');
                }
                else if (key === 'replace:ignore') {
                    return failWithDetail('ignored', 'ignore');
                }
                else if (key === 'replace:error') {
                    return failWithDetail('forced error', 'error');
                }
                else if (key === 'replace:badChild') {
                    return succeedWithDetail({
                        badFunc: (() => true) as unknown as JsonValue,
                    });
                }
                return failWithDetail('inapplicable', 'inapplicable');
            }

            editValue(value: JsonValue, _state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason> {
                if (value === 'replace:object') {
                    return succeedWithDetail({ child1: '{{var1}}', child2: 'value2' }, 'edited');
                }
                else if (value === 'replace:error') {
                    return failWithDetail('forced error', 'error');
                }
                else if (value === 'replace:badChild') {
                    return succeedWithDetail({
                        badFunc: (() => true) as unknown as JsonValue,
                    });
                }
                else if (value === 'replace:ignore') {
                    return failWithDetail('ignored', 'ignore');
                }
                return failWithDetail('inapplicable', 'inapplicable');
            }

            finalizeProperties(_deferred: JsonObject[], _state: JsonEditorState): DetailedResult<JsonObject[], JsonEditFailureReason> {
                return failWithDetail('inapplicable', 'inapplicable');
            }
        }

        describe('constructor', () => {
            test('succeeds with rules present', () => {
                expect(JsonEditor.create(undefined, [new TestRule()])).toSucceedWith(expect.any(JsonEditor));
            });
        });

        describe('clone method', () => {
            const context = { vars: { var1: 'value1' } };
            const rules = [new TemplatedJsonEditorRule(), new TestRule()];
            const editor = JsonEditor.create({ context }, rules).getValueOrThrow();
            test('edit function replaces literal values', () => {
                expect(editor.clone({
                    someLiteral: '{{var1}}',
                    'replace:flatten': {
                        child1: '{{var1}}',
                        child2: 'value2',
                    },
                    child: 'replace:object',
                    c2: {
                        c2obj: 'replace:object',
                    },
                    a1: [
                        'replace:object',
                    ],
                })).toSucceedWith({
                    someLiteral: 'value1',
                    child1: 'value1',
                    child2: 'value2',
                    child: {
                        child1: 'value1',
                        child2: 'value2',
                    },
                    c2: {
                        c2obj: {
                            child1: 'value1',
                            child2: 'value2',
                        },
                    },
                    a1: [{
                        child1: 'value1',
                        child2: 'value2',
                    }],
                });
            });

            test('edit functions can ignore properties and values', () => {
                expect(editor.clone({
                    used: 'used',
                    'replace:ignore': 'ignored',
                })).toSucceedWith({
                    used: 'used',
                });

                expect(editor.clone({
                    used: 'used',
                    ignored: 'replace:ignore',
                })).toSucceedWith({
                    used: 'used',
                });

                expect(editor.clone({
                    array: ['used', 'replace:ignore', 'also used'],
                })).toSucceedWith({
                    array: ['used', 'also used'],
                });
            });

            test('propagates errors from the edit function', () => {
                expect(editor.clone({
                    someLiteral: '{{var1}}',
                    'replace:flatten': 'hello',
                })).toFailWith(/cannot flatten/i);

                expect(editor.clone({
                    'replace:error': 'hello',
                })).toFailWith(/forced error/i);

                expect(editor.clone({
                    'bad': 'replace:error',
                })).toFailWith(/forced error/i);

                expect(editor.clone({
                    'array': ['replace:error'],
                })).toFailWith(/forced error/i);

                expect(editor.clone({
                    'badChild': 'replace:badChild',
                })).toFailWith(/invalid json/i);

                expect(editor.clone({
                    'replace:badChild': 'whatever',
                })).toFailWith(/invalid json/i);

                expect(editor.clone({
                    child: {
                        'replace:error': 'goodbye',
                    },
                })).toFailWith(/forced error/i);
            });
        });
    });
});
