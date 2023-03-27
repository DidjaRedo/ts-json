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
import {
    ConditionalJsonConverter,
    JsonConverter,
    JsonConverterOptions,
    JsonEditorConverter,
    RichJsonConverter,
    TemplatedJsonConverter,
    contextFromConverterOptions,
    converterOptionsToEditor,
    mergeDefaultJsonConverterOptions,
} from '../../src/jsonConverter';
import { JsonEditor, JsonValue, PrefixedJsonMap, SimpleJsonMap } from '../../src';
import {
    TemplateVarsExtendFunction,
    defaultExtendVars,
} from '../../src/jsonContext';
import { JsonEditorOptions } from '../../src/jsonEditor/common';

/* test data necessarily has lots of non-conformant names */
/* eslint-disable @typescript-eslint/naming-convention */

describe('JsonConverter module', () => {
    describe('mergeDefaultJsonConverterOptions function', () => {
        test('uses expected defaults if no options are supplied', () => {
            const expected: JsonConverterOptions = {
                useValueTemplates: false,
                useNameTemplates: false,
                useConditionalNames: false,
                flattenUnconditionalValues: false,
                useMultiValueTemplateNames: false,
                useReferences: false,
                extendVars: expect.any(Function),
                onInvalidPropertyName: 'error',
                onInvalidPropertyValue: 'error',
                onUndefinedPropertyValue: 'ignore',
            };
            [
                undefined,
                {},
            ].forEach((t) => {
                expect(mergeDefaultJsonConverterOptions(t)).toEqual(expected);
            });
        });

        test('enables template names and values if vars are supplied', () => {
            const expected: JsonConverterOptions = {
                useValueTemplates: true,
                useNameTemplates: true,
                useConditionalNames: true,
                flattenUnconditionalValues: true,
                useMultiValueTemplateNames: true,
                useReferences: false,
                vars: {},
                extendVars: expect.any(Function),
                onInvalidPropertyName: 'error',
                onInvalidPropertyValue: 'error',
                onUndefinedPropertyValue: 'ignore',
            };
            expect(mergeDefaultJsonConverterOptions({ vars: {} })).toEqual(expected);
        });

        test('enables references if refs are supplied', () => {
            const refs = SimpleJsonMap.createSimple().orThrow();
            const expected: JsonConverterOptions = {
                useValueTemplates: false,
                useNameTemplates: false,
                useConditionalNames: false,
                flattenUnconditionalValues: false,
                useMultiValueTemplateNames: false,
                useReferences: true,
                refs: refs,
                extendVars: expect.any(Function),
                onInvalidPropertyName: 'error',
                onInvalidPropertyValue: 'error',
                onUndefinedPropertyValue: 'ignore',
            };
            expect(mergeDefaultJsonConverterOptions({ refs })).toEqual(expected);
        });

        test('disables template names and values and array expansion if no context is supplied', () => {
            const expected: JsonConverterOptions = {
                useValueTemplates: false,
                useNameTemplates: false,
                useConditionalNames: false,
                flattenUnconditionalValues: false,
                useMultiValueTemplateNames: false,
                useReferences: false,
                extendVars: expect.any(Function),
                onInvalidPropertyName: 'error',
                onInvalidPropertyValue: 'error',
                onUndefinedPropertyValue: 'ignore',
            };
            expect(mergeDefaultJsonConverterOptions()).toEqual(expected);
        });

        test('disables array template names if no extend vars function is present', () => {
            const expected: JsonConverterOptions = {
                useValueTemplates: true,
                useNameTemplates: true,
                useConditionalNames: true,
                flattenUnconditionalValues: true,
                useMultiValueTemplateNames: false,
                useReferences: false,
                vars: {},
                extendVars: undefined,
                onInvalidPropertyName: 'error',
                onInvalidPropertyValue: 'error',
                onUndefinedPropertyValue: 'ignore',
            };
            expect(mergeDefaultJsonConverterOptions({ vars: {}, extendVars: undefined })).toEqual(expected);
        });
    });

    describe('contextFromConverterOptions function', () => {
        const vars = { var: 'value' };
        const refs = SimpleJsonMap.createSimple().orThrow();
        const extendVars: TemplateVarsExtendFunction = (b, v) => defaultExtendVars(b, v);
        test('propagates vars, refs and extendVars from options to context', () => {
            expect(contextFromConverterOptions({ vars })).toEqual({ vars });
            expect(contextFromConverterOptions({ refs })).toEqual({ refs });
            expect(contextFromConverterOptions({ extendVars })).toEqual({ extendVars });
        });

        test('returns undefined if no vars, refs or extendVars are defined', () => {
            expect(contextFromConverterOptions({})).toBeUndefined();
        });
    });

    describe('convertOptionsToEditor function', () => {
        test('uses expected defaults if no options are supplied', () => {
            const expected: JsonEditorOptions = {
                validation: {
                    onInvalidPropertyName: 'error',
                    onInvalidPropertyValue: 'error',
                    onUndefinedPropertyValue: 'ignore',
                },
            };

            [
                undefined,
                {},
            ].forEach((t) => {
                expect(converterOptionsToEditor(t)).toSucceedAndSatisfy((editor: JsonEditor) => {
                    expect(editor.options).toEqual(expected);
                });
            });
        });
    });

    describe('JsonEditorConverter class', () => {
        describe('createWithEditor method', () => {
            test('succeeds with a valid editor', () => {
                const editor = JsonEditor.create().orThrow();
                expect(JsonEditorConverter.createWithEditor(editor)).toSucceedWith(expect.any(JsonEditorConverter));
            });
        });
    });

    describe('TemplatedJsonConverter class', () => {
        describe('create method', () => {
            test('creates a converter that supports template and multi-value but not other rules', () => {
                expect(TemplatedJsonConverter.create()).toSucceedAndSatisfy((converter: TemplatedJsonConverter) => {
                    const src = {
                        '{{prop}}': '{{value}}',
                        '?this=this': {
                            matchedThis: true,
                        },
                        '!unconditionalProp': {
                            flattened: true,
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
                        '!unconditionalProp': {
                            flattened: true,
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
                    const refs = PrefixedJsonMap.createPrefixed('ref:', refMap).orThrow();
                    expect(converter).toEqual(expect.any(TemplatedJsonConverter));
                    expect(converter.convert(src, { vars, refs })).toSucceedWith(expected);
                });
            });
        });
    });

    describe('ConditionalJsonConverter class', () => {
        describe('create method', () => {
            test('creates a converter that supports template, multi-value and conditional but not other rules', () => {
                expect(ConditionalJsonConverter.create()).toSucceedAndSatisfy((converter: ConditionalJsonConverter) => {
                    const src = {
                        '{{prop}}': '{{value}}',
                        '!unconditionalProp': {
                            flattenedUnconditional: true,
                        },
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
                        flattenedUnconditional: true,
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
                    const refs = PrefixedJsonMap.createPrefixed('ref:', refMap).orThrow();
                    expect(converter).toEqual(expect.any(ConditionalJsonConverter));
                    expect(converter.convert(src, { vars, refs })).toSucceedWith(expected);
                });
            });
        });
    });

    describe('RichJsonConverter class', () => {
        describe('create method', () => {
            test('creates a converter that supports template, multi-value and conditional and reference rules', () => {
                expect(RichJsonConverter.create()).toSucceedAndSatisfy((converter: RichJsonConverter) => {
                    const src = {
                        '{{prop}}': '{{value}}',
                        '!unconditionalProp': {
                            flattenedUnconditional: true,
                        },
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
                        flattenedUnconditional: true,
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
                    const refs = PrefixedJsonMap.createPrefixed('ref:', refMap).orThrow();
                    expect(converter).toEqual(expect.any(RichJsonConverter));
                    expect(converter.convert(src, { vars, refs })).toSucceedWith(expected);
                });
            });
        });
    });

    // most functionality tested indirectly via converters module
    describe('JsonConverter class', () => {
        describe('create method', () => {
            test('succeeds with no options', () => {
                expect(JsonConverter.create()).toSucceed();
            });

            test('succeeds with valid options', () => {
                expect(JsonConverter.create({ vars: { value: 'hello' } })).toSucceed();
            });
        });

        describe('with array expansion', () => {
            const converter = new JsonConverter({
                vars: {
                    unchanged: 'unchanged value',
                    index: 'original index',
                },
            });

            test('expands valid array template names', () => {
                expect(converter.convert({
                    someProperty: 'unchanged property should be {{unchanged}}',
                    '*index=alpha,beta': 'index is {{index}}',
                    '[[index]]=alpha,beta': 'index is {{index}}',
                })).toSucceedWith({
                    someProperty: 'unchanged property should be unchanged value',
                    alpha: 'index is alpha',
                    beta: 'index is beta',
                    index: ['index is alpha', 'index is beta'],
                });
            });

            test('expands using context supplied at conversion', () => {
                expect(converter.convert({
                    someProperty: 'unchanged property should be {{unchanged}}',
                    '*index=alpha,beta': 'index is {{index}}',
                    '[[index]]=alpha,beta': 'index is {{index}}',
                }, {
                    vars: {
                        unchanged: () => 'runtime value',
                        index: 'runtime index',
                    },
                })).toSucceedWith({
                    someProperty: 'unchanged property should be runtime value',
                    alpha: 'index is alpha',
                    beta: 'index is beta',
                    index: ['index is alpha', 'index is beta'],
                });
            });

            test('fails for invalid array template names', () => {
                expect(converter.convert({
                    someProperty: 'unchanged property should be {{unchanged}}',
                    '[[index]=alpha,beta': 'index is {{index}}',
                })).toFailWith(/malformed multi-value property/i);
            });

            test('fails for invalid child values', () => {
                expect(converter.convert({
                    someProperty: 'unchanged property should be {{unchanged}}',
                    '[[index]]=alpha,beta': {
                        title: 'index is {{index}}',
                        func: () => '{{index}}',
                    },
                })).toFailWith(/cannot convert/i);
            });
        });

        describe('with onInvalidPropertyName of error', () => {
            test('fails for invalid property names', () => {
                const converter = new JsonConverter({
                    vars: { value: 'hello' },
                    onInvalidPropertyName: 'error',
                });

                expect(converter.convert({
                    valid: 'valid name and value',
                    '{{invalid': 'invalid name valid value',
                })).toFailWith(/cannot render/i);
            });

            test('fails for empty property names', () => {
                const converter = new JsonConverter({
                    vars: { value: 'hello' },
                    onInvalidPropertyName: 'error',
                });

                expect(converter.convert({
                    valid: 'valid name and value',
                    '{{invalid}}': 'empty name valid value',
                })).toFailWith(/renders empty name/i);
            });
        });

        describe('with onInvalidPropertyName of ignore', () => {
            test('silently ignores invalid property names', () => {
                const converter = new JsonConverter({
                    onInvalidPropertyName: 'ignore',
                    vars: { prop: 'value' },
                });

                expect(converter.convert({
                    valid: 'valid',
                    '{{invalid': 'invalid name, valid value',
                })).toSucceedWith({
                    valid: 'valid',
                    '{{invalid': 'invalid name, valid value',
                });
            });

            test('silently ignores empty property names', () => {
                const converter = new JsonConverter({
                    onInvalidPropertyName: 'ignore',
                    vars: { prop: 'value' },
                });

                expect(converter.convert({
                    valid: 'valid',
                    '{{invalid}}': 'invalid name, valid value',
                })).toSucceedWith({
                    valid: 'valid',
                    '{{invalid}}': 'invalid name, valid value',
                });
            });
        });

        describe('with onInvalidPropertyValue of error', () => {
            test('fails for invalid property values', () => {
                const converter = new JsonConverter({ onInvalidPropertyValue: 'error' });
                expect(converter.convert({
                    valid: 'valid',
                    invalid: () => 'invalid',
                })).toFailWith(/cannot convert/i);
            });
        });

        describe('with onInvalidPropertyValue of ignore', () => {
            test('silently ignores properties with value undefined', () => {
                const converter = new JsonConverter({ onInvalidPropertyValue: 'ignore' });
                expect(converter.convert({
                    valid: 'valid',
                    invalid: () => 'invalid',
                })).toSucceedWith({
                    valid: 'valid',
                });
            });
        });

        describe('with onUndefinedPropertyValue of error', () => {
            test('fails for properties with value undefined', () => {
                const converter = new JsonConverter({ onUndefinedPropertyValue: 'error' });
                expect(converter.convert({
                    valid: 'valid',
                    invalid: undefined,
                })).toFailWith(/cannot convert/i);
            });
        });

        describe('with onUndefinedPropertyValue of ignore', () => {
            test('silently ignores invalid properties', () => {
                const converter = new JsonConverter({ onUndefinedPropertyValue: 'ignore' });
                expect(converter.convert({
                    valid: 'valid',
                    invalid: undefined,
                })).toSucceedWith({
                    valid: 'valid',
                });
            });
        });
    });
});
