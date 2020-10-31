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
import { JsonConverter, JsonConverterOptions, mergeDefaultJsonConverterOptions } from '../../src/jsonConverter';

describe('JsonConverter class', () => {
    describe('mergeDefaultJsonConverterOptions function', () => {
        test('enables template names and values if a variables are supplied', () => {
            const expected: JsonConverterOptions = {
                useValueTemplates: true,
                useNameTemplates: true,
                useArrayTemplateNames: true,
                useReferences: false,
                vars: {},
                extendVars: expect.any(Function),
                onInvalidPropertyName: 'error',
                onInvalidPropertyValue: 'error',
                onUndefinedPropertyValue: 'ignore',
            };
            expect(mergeDefaultJsonConverterOptions({ vars: {} })).toEqual(expected);
        });

        test('disables template names and values and array expansion if no context is supplied', () => {
            const expected: JsonConverterOptions = {
                useValueTemplates: false,
                useNameTemplates: false,
                useArrayTemplateNames: false,
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
                useArrayTemplateNames: false,
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

    // most functionality tested indirectly via converters module
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
                '[[index]]=alpha,beta': 'index is {{index}}',
            })).toSucceedWith({
                someProperty: 'unchanged property should be unchanged value',
                alpha: 'index is alpha',
                beta: 'index is beta',
            });
        });

        test('expands using context supplied at conversion', () => {
            expect(converter.convert({
                someProperty: 'unchanged property should be {{unchanged}}',
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
        test('silently ignores invalid properties', () => {
            const converter = new JsonConverter({ onInvalidPropertyValue: 'ignore' });
            expect(converter.convert({
                valid: 'valid',
                invalid: () => 'invalid',
            })).toSucceedWith({
                valid: 'valid',
            });
        });
    });
});
