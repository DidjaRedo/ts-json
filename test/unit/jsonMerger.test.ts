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

import { DetailedResult, Result, fail, failWithDetail, succeed } from '@fgv/ts-utils';
import { JsonObject, JsonValue } from '../../src';

import { JsonEditFailureReason } from '../../src/jsonMergeEditor';
import { JsonMerger } from '../../src/jsonMerger';

import { TemplateContext } from '../../src/templateContext';

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
            expected: /cannot convert/i,
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

    describe('mergeNew method', () => {
        const merger = JsonMerger.create().getValueOrThrow();
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

    describe('mergeNewWithContext method', () => {
        const templateContext = { var: 'value' };
        const merger = new JsonMerger({ converterOptions: { templateContext } });
        const src1 = {
            src1var: '{{var}}',
            value: 'original value',
            alternate: 'original alternate',
            '{{var}}1': 'original {{var}} 1',
            child: {
                src1var: '{{var}}',
                value: 'original value',
                alternate: 'original alternate',
            },
        };
        const src2 = {
            '{{var}}': '{{var}} from src2',
            child: {
                src2var: '{{var}}',
                '{{var}}': 'nested templated name',
            },
        };
        const src3 = {
            '{{var}}': '{{var}} from src3',
            src3array: ['{{var}}', '{{var}} 2'],
            child: {
                '{{var}}': 'nested templated name from src3',
            },
            child2: {
                '{{var}}': '{{var}} from src3',
                '{{var}}Array': ['{{var}} 1', '{{var}} 2'],
            },
        };

        test('uses base context if override is undefined', () => {
            const expected = {
                src1var: 'value',
                value: 'value from src3',
                alternate: 'original alternate',
                value1: 'original value 1',
                child: {
                    src1var: 'value',
                    src2var: 'value',
                    value: 'nested templated name from src3',
                    alternate: 'original alternate',
                },
                child2: {
                    value: 'value from src3',
                    valueArray: ['value 1', 'value 2'],
                },
                src3array: ['value', 'value 2'],
            };
            expect(merger.mergeNewWithContext(undefined, src1, src2, src3)).toSucceedWith(expected);
        });

        test('uses override context if supplied', () => {
            const alternateContext = { var: 'alternate' };
            const expected = {
                src1var: 'alternate',
                value: 'original value',
                alternate: 'alternate from src3',
                alternate1: 'original alternate 1',
                child: {
                    src1var: 'alternate',
                    src2var: 'alternate',
                    value: 'original value',
                    alternate: 'nested templated name from src3',
                },
                child2: {
                    alternate: 'alternate from src3',
                    alternateArray: ['alternate 1', 'alternate 2'],
                },
                src3array: ['alternate', 'alternate 2'],
            };
            expect(merger.mergeNewWithContext(alternateContext, src1, src2, src3)).toSucceedWith(expected);
        });
    });

    describe('constructor', () => {
        test('propagates options to converter', () => {
            const base = {
                baseString: '{{var1}}',
                mergedArray: ['{{var2}} in array'],
            };
            const add = {
                addedString: 'unmodified string',
                addedString2: 'string with {{var3}}',
                mergedArray: ['string with {{var4}}'],
            };
            const expected = {
                baseString: 'value 1',
                addedString: 'unmodified string',
                addedString2: 'string with value 3',
                mergedArray: ['value 2 in array', 'string with value 4'],
            };
            const merger = new JsonMerger({
                converterOptions: {
                    templateContext: {
                        var1: 'value 1',
                        var2: 'value 2',
                        var3: 'value 3',
                        var4: () => 'value 4',
                    },
                },
            });
            expect(merger.mergeNew(base, add)).toSucceedWith(expected);
        });
    });

    describe('with an edit function', () => {
        const editor = {
            editProperty: (key: string, src: JsonValue, target: JsonObject, merger: JsonMerger, context: TemplateContext): Result<boolean> => {
                if (key === 'replace:flatten') {
                    if (Array.isArray(src) || (typeof src !== 'object') || (src === null)) {
                        return fail(`${key}: cannot flatten non-object`);
                    }
                    return merger.mergeInPlace(target, src, context).onSuccess(() => {
                        return succeed(true);
                    });
                }
                else if (src === 'replace:object') {
                    const toMerge: JsonObject = {};
                    toMerge[key] = { child1: '{{var1}}', child2: 'value2' };
                    return merger.mergeInPlace(target, toMerge, context).onSuccess(() => {
                        return succeed(true);
                    });
                }
                else if (key === 'replace:ignore') {
                    return succeed(true);
                }
                else if (key === 'replace:error') {
                    return fail('forced error');
                }
                return succeed(false);
            },
            editValue: (src: JsonValue, merger: JsonMerger, context: TemplateContext): DetailedResult<JsonValue, JsonEditFailureReason> => {
                if (src === 'replace:object') {
                    const toMerge = { child1: '{{var1}}', child2: 'value2' };
                    return merger.mergeNewWithContext(context, toMerge).withFailureDetail('error');
                }
                else if (src === 'replace:error') {
                    return failWithDetail('forced error', 'error');
                }
                else if (src === 'replace:ignore') {
                    return failWithDetail('ignored', 'ignore');
                }
                return succeed(src).withFailureDetail('error');
            },
        };

        const templateContext = {
            var1: 'value1',
        };

        const merger = new JsonMerger({ converterOptions: { templateContext }, editor });
        test('edit function replaces literal values', () => {
            expect(merger.mergeNew({
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
            expect(merger.mergeNew({
                used: 'used',
                'replace:ignore': 'ignored',
            })).toSucceedWith({
                used: 'used',
            });

            expect(merger.mergeNew({
                used: 'used',
                ignored: 'replace:ignore',
            })).toSucceedWith({
                used: 'used',
            });

            expect(merger.mergeNew({
                array: ['used', 'replace:ignore', 'also used'],
            })).toSucceedWith({
                array: ['used', 'also used'],
            });
        });

        test('propagates errors from the edit function', () => {
            expect(merger.mergeNew({
                someLiteral: '{{var1}}',
                'replace:flatten': 'hello',
            })).toFailWith(/cannot flatten/i);

            expect(merger.mergeNew({
                'replace:error': 'hello',
            })).toFailWith(/forced error/i);

            expect(merger.mergeNew({
                'bad': 'replace:error',
            })).toFailWith(/forced error/i);

            expect(merger.mergeNew({
                'array': ['replace:error'],
            })).toFailWith(/forced error/i);
        });
    });
});
