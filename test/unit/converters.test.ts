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

import { JsonValue, PrefixedJsonMap } from '../../src';

/* test data necessarily has lots of non-conformant names */
/* eslint-disable @typescript-eslint/naming-convention */

describe('converters module', () => {
    describe('json converter', () => {
        test('converts valid json', () => {
            [
                'string',
                123,
                false,
                null,
                { stringVal: 'string', boolVal: true, numVal: 100 },
                {
                    stringVal: 'string',
                    subObject: {
                        stringVal: 'string',
                        boolVal: false,
                        nullVal: null,
                    },
                    array: ['string 1', 'string 2', 'string 3', 3],
                },
            ].forEach((t) => {
                expect(JsonConverters.json.convert(t)).toSucceedWith(t as unknown as JsonValue);
            });
        });

        test('fails on invalid json', () => {
            [
                undefined,
                {
                    func: () => true,
                },
                () => true,
                [() => 123],
            ].forEach((t) => {
                expect(JsonConverters.json.convert(t)).toFailWith(/cannot convert/i);
            });
        });

        test('does not apply additional rules even with context', () => {
            const src = {
                '{{prop}}': '{{value}}',
                '?this=this': {
                    matchedThis: true,
                },
                '?default': {
                    matchedDefault: true,
                },
                '[[multi]]=first,second,third': '{{multi}}',
                'ref:o1': 'default',
                o1: 'ref:o1',
            };
            const vars = { prop: 'PROPERTY', value: 'VALUE' };
            const refSrc = { o1: { o1merged: true } };
            const refMap = new Map<string, JsonValue>(Object.entries(refSrc));
            const refs = PrefixedJsonMap.createPrefixed('ref:', refMap).getValueOrThrow();
            expect(JsonConverters.json.convert(src, { vars, refs })).toSucceedWith(src);
        });
    });

    describe('jsonObject converter', () => {
        test('converts a valid json object', () => {
            [
                { stringVal: 'string', boolVal: true, numVal: 100 },
            ].forEach((t) => {
                expect(JsonConverters.jsonObject.convert(t)).toSucceedWith(t);
            });
        });

        test('fails for invalid JSON or a non-object', () => {
            [
                undefined,
                {
                    func: () => true,
                },
                () => true,
                [() => 123],
                'this is a string but not an object',
                {
                    prop1: 'this is a valid property',
                    prop2: () => 'but this is not valid json',
                },
                ['this is a totally legit', 'json array', 'but not an object', 'burma shave'],
            ].forEach((t) => {
                expect(JsonConverters.jsonObject.convert(t)).toFailWith(/cannot convert/i);
            });
        });
    });


    describe('jsonArray converter', () => {
        test('converts a valid array object', () => {
            [
                ['this is a', 'valid json', 'array', true],
                [{ stringVal: 'string', boolVal: true, numVal: 100 }, 'hello'],
            ].forEach((t) => {
                expect(JsonConverters.jsonArray.convert(t)).toSucceedWith(t);
            });
        });

        test('fails for invalid JSON or a non-array', () => {
            [
                undefined,
                {
                    func: () => true,
                },
                () => true,
                [() => 123],
                'this is a string but not an array',
                {
                    prop1: 'this is a valid property',
                    prop2: 'valid too but this not an array',
                },
            ].forEach((t) => {
                expect(JsonConverters.jsonArray.convert(t)).toFailWith(/cannot convert/i);
            });
        });
    });

    describe('templatedJson converter', () => {
        const goodTemplateTests = [
            {
                description: 'applies templates to string values',
                src: {
                    stringVal: 'Hello {{test}}',
                    subObject: {
                        literal: 'This is a literal string',
                        subSubObject: {
                            hello: 'Hello {{subTest}}',
                        },
                    },
                },
                vars: {
                    test: 'Top Level Test',
                    subTest: 'Nested Test',
                },
                expected: {
                    stringVal: 'Hello Top Level Test',
                    subObject: {
                        literal: 'This is a literal string',
                        subSubObject: {
                            hello: 'Hello Nested Test',
                        },
                    },
                },
            },
            {
                description: 'applies templates to property names',
                src: {
                    '{{prop1}}': 'property 1',
                    prop2: 'property 2',
                    '{{prop2}}': 'template property 2',
                },
                vars: {
                    prop1: 'templateProperty1',
                    prop2: 'templateProperty2',
                },
                expected: {
                    templateProperty1: 'property 1',
                    prop2: 'property 2',
                    templateProperty2: 'template property 2',
                },
            },
        ];

        test('applies mustache templates to string values', () => {
            goodTemplateTests.forEach((t) => {
                expect(JsonConverters.templatedJson({ vars: t.vars }).convert(t.src)).toSucceedWith(t.expected as unknown as JsonValue);
            });
        });

        test('applies only template and multi-value but not conditional or reference rules if context is supplied', () => {
            const src = {
                '{{prop}}': '{{value}}',
                '?this=this': {
                    matchedThis: true,
                },
                '?default': {
                    matchedDefault: true,
                },
                '*multi=first,second,third': '{{multi}}',
                '[[multi]]=first,second,third': '{{multi}}',
                'ref:o1': 'default',
                o1: 'ref:o1',
            };
            const expected = {
                property: 'VALUE',
                '?this=this': {
                    matchedThis: true,
                },
                '?default': {
                    matchedDefault: true,
                },
                first: 'first',
                second: 'second',
                third: 'third',
                multi: ['first', 'second', 'third'],
                'ref:o1': 'default',
                o1: 'ref:o1',
            };
            const vars = { prop: 'property', value: 'VALUE' };
            const refSrc = { o1: { o1merged: true } };
            const refMap = new Map<string, JsonValue>(Object.entries(refSrc));
            const refs = PrefixedJsonMap.createPrefixed('ref:', refMap).getValueOrThrow();
            expect(JsonConverters.templatedJson().convert(src, { vars, refs })).toSucceedWith(expected);
        });

        test('returns a singleton if no options are supplied', () => {
            expect(JsonConverters.templatedJson()).toBe(JsonConverters.templatedJson());
        });

        test('does not return a singleton if options are supplied', () => {
            const options = {};
            expect(JsonConverters.templatedJson(options)).not.toBe(JsonConverters.templatedJson(options));
        });
    });

    describe('conditionalJson function', () => {
        const tests = [
            {
                src: {
                    '!unconditional': {
                        flattened: true,
                    },
                    unconditional: 'unconditional',
                    '?{{prop1}}=this': {
                        conditional: 'matched',
                    },
                    unconditional2: 'unconditional the second',
                    '?{{prop2}}=that': {
                        conditional2: '{{value2}}',
                    },
                    '!block1': {
                        '!block2': {
                            '?{{prop1}}=not this': {
                                block2: 'matched',
                            },
                            '?default': {
                                block2: 'default',
                            },
                        },
                        '!block3': {
                            '?{{prop2}}=not that': {
                                block3: 'matched',
                            },
                            '?default': {
                                block3: 'default',
                            },
                        },
                        '?{{prop1}}=this': {
                            block1: 'matched',
                        },
                        '?default': {
                            block1: 'default',
                        },
                    },
                },
                vars: {
                    prop1: 'this',
                    prop2: 'that',
                    value2: 'templated conditional the second',
                },
                expected: {
                    flattened: true,
                    unconditional: 'unconditional',
                    conditional: 'matched',
                    unconditional2: 'unconditional the second',
                    conditional2: 'templated conditional the second',
                    block1: 'matched',
                    block2: 'default',
                    block3: 'default',
                },
            },
        ];

        test('applies templates and conditions', () => {
            tests.forEach((t) => {
                expect(JsonConverters.conditionalJson({ vars: t.vars }).convert(t.src)).toSucceedWith(t.expected);
            });
        });

        test('applies only template, multi-value, and conditional but not reference rules if context is supplied', () => {
            const src = {
                '!flattenMe': {
                    flattened: true,
                },
                '{{prop}}': '{{value}}',
                '?this=this': {
                    matchedThis: true,
                },
                '?default': {
                    matchedDefault: true,
                },
                '*multi=first,second,third': '{{multi}}',
                '[[multi]]=first,second,third': '{{multi}}',
                'ref:o1': 'default',
                o1: 'ref:o1',
            };
            const expected = {
                flattened: true,
                property: 'VALUE',
                matchedThis: true,
                first: 'first',
                second: 'second',
                third: 'third',
                multi: ['first', 'second', 'third'],
                'ref:o1': 'default',
                o1: 'ref:o1',
            };
            const vars = { prop: 'property', value: 'VALUE' };
            const refSrc = { o1: { o1merged: true } };
            const refMap = new Map<string, JsonValue>(Object.entries(refSrc));
            const refs = PrefixedJsonMap.createPrefixed('ref:', refMap).getValueOrThrow();
            expect(JsonConverters.conditionalJson().convert(src, { vars, refs })).toSucceedWith(expected);
        });

        test('returns a singleton if no options are supplied', () => {
            expect(JsonConverters.conditionalJson()).toBe(JsonConverters.conditionalJson());
        });

        test('does not return a singleton if options are supplied', () => {
            const options = {};
            expect(JsonConverters.conditionalJson(options)).not.toBe(JsonConverters.conditionalJson(options));
        });
    });

    describe('richJson function', () => {
        test('applies templates, multi-value expansion, conditional merging and references', () => {
            const src = {
                '!flattenMe': {
                    flattened: true,
                },
                '{{prop}}': '{{value}}',
                '?this=this': {
                    matchedThis: true,
                },
                '?default': {
                    matchedDefault: true,
                },
                '*multi=first,second,third': '{{multi}}',
                '[[multi]]=first,second,third': '{{multi}}',
                'ref:o1': 'default',
                o1: 'ref:o1',
            };
            const expected = {
                flattened: true,
                property: 'VALUE',
                matchedThis: true,
                first: 'first',
                second: 'second',
                third: 'third',
                multi: ['first', 'second', 'third'],
                o1merged: true,
                o1: {
                    o1merged: true,
                },
            };
            const vars = { prop: 'property', value: 'VALUE' };
            const refSrc = { o1: { o1merged: true } };
            const refMap = new Map<string, JsonValue>(Object.entries(refSrc));
            const refs = PrefixedJsonMap.createPrefixed('ref:', refMap).getValueOrThrow();
            expect(JsonConverters.richJson().convert(src, { vars, refs })).toSucceedWith(expected);
        });

        test('returns a singleton if no options are supplied', () => {
            expect(JsonConverters.richJson()).toBe(JsonConverters.richJson());
        });

        test('does not return a singleton if options are supplied', () => {
            const options = {};
            expect(JsonConverters.richJson(options)).not.toBe(JsonConverters.richJson(options));
        });
    });
});
