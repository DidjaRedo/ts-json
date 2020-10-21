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
    CompositeObjectMap,
    JsonObject,
    SimpleObjectMap,
} from '../../src';

describe('ObjectMap module', () => {
    describe('SimpleObjectMap classe', () => {
        describe('static constructor', () => {
            test('succeeds for a map with valid keys', () => {
                const map = new Map<string, JsonObject>([['hello', {}], ['goodbye', {}]]);
                expect(SimpleObjectMap.create(map)).toSucceedWith(expect.any(SimpleObjectMap));
            });

            test('fails by default for a map with templated key names', () => {
                const map = new Map<string, JsonObject>([['{{hello}}', {}], ['goodbye', {}]]);
                expect(SimpleObjectMap.create(map)).toFailWith(/invalid key/i);
            });

            test('fails by default for a map with conditional key names', () => {
                const map = new Map<string, JsonObject>([['hello', {}], ['?test=test', {}]]);
                expect(SimpleObjectMap.create(map)).toFailWith(/invalid key/i);
            });

            test('applies a predicate if supplied', () => {
                const map = new Map<string, JsonObject>([['{{hello}}', {}], ['?test=test', {}]]);
                const predicate = (key: string): boolean => (key !== 'hello');
                expect(SimpleObjectMap.create(map, undefined, predicate)).toSucceed();

                const map2 = new Map<string, JsonObject>([['hello', {}], ['goodbye', {}]]);
                expect(SimpleObjectMap.create(map2, undefined, predicate)).toFailWith(/invalid key/i);
            });
        });

        describe('keyIsInRange method', () => {
            test('rejects conditional or templated key names by default', () => {
                const map = SimpleObjectMap.create(new Map<string, JsonObject>()).getValueOrThrow();
                expect(map.keyIsInRange('hello')).toBe(true);
                expect(map.keyIsInRange('{{hello}}')).toBe(false);
                expect(map.keyIsInRange('key with {{hello}} in a template')).toBe(false);
                expect(map.keyIsInRange('?test=test')).toBe(false);
            });

            test('applies a predicate if supplied', () => {
                const predicate = (key: string): boolean => (key !== 'hello');
                const map = SimpleObjectMap.create(new Map<string, JsonObject>(), undefined, predicate).getValueOrThrow();
                expect(map.keyIsInRange('hello')).toBe(false);
                expect(map.keyIsInRange('{{hello}}')).toBe(true);
            });
        });

        describe('has method', () => {
            const map = SimpleObjectMap.create(new Map<string, JsonObject>([['hello', {}], ['goodbye', {}]])).getValueOrThrow();
            test('correctly reports presence of a value', () => {
                expect(map.has('hello')).toBe(true);
                expect(map.has('{{hello}}')).toBe(false);
            });
        });

        describe('getJsonObject method', () => {
            const src: JsonObject = {
                '?{{var}}=value': {
                    'matched': '{{var}}',
                },
                '?{{var}}=error': {
                    '{{malformed': 'oops',
                },
                '?default': {
                    'noMatch': '{{var}}',
                },
                'unconditional{{prop}}': 'hello',
            };
            const map = SimpleObjectMap.create(
                new Map<string, JsonObject>([['src', src]]),
                { var: 'value', prop: 'Prop' },
            ).getValueOrThrow();

            test('formats a conditional object using the context supplied at construction time by default', () => {
                expect(map.getJsonObject('src')).toSucceedWith({
                    matched: 'value',
                    unconditionalProp: 'hello',
                });
            });

            test('formats a conditional object using a supplied context', () => {
                const context = { var: 'other', prop: 'Other' };
                expect(map.getJsonObject('src', context)).toSucceedWith({
                    noMatch: 'other',
                    unconditionalOther: 'hello',
                });
            });

            test('fails for an object that does not exist', () => {
                expect(map.getJsonObject('target')).toFailWith(/not found/i);
            });

            test('propagates errors from the template conversion', () => {
                const context = { var: 'error', prop: 'Other' };
                expect(map.getJsonObject('src', context)).toFailWith(/malformed/i);
            });
        });
    });

    describe('CompositeObjectMap class', () => {
        const src1 = {
            '?{{var}}=value': {
                'matched': '{{var}}',
            },
            '?{{var}}=error': {
                '{{malformed': 'oops',
            },
            '?default': {
                'noMatch': '{{var}}',
            },
            'unconditional{{prop}}': 'hello',
        };
        const simple1 = SimpleObjectMap.create(
            new Map<string, JsonObject>([['simple1:src1', src1]]),
            { var: 'simple1', prop: 'Simple1' },
            (k) => k.startsWith('simple1:'),
        ).getValueOrThrow();
        const src2 = {
            '?{{var}}=value': {
                'matched': '{{var}}',
            },
            '?{{var}}=error': {
                '{{malformed': 'oops',
            },
            '?default': {
                'noMatch': '{{var}}',
            },
            'unconditional{{prop}}': 'hello',
        };
        const simple2 = SimpleObjectMap.create(
            new Map<string, JsonObject>([['simple2:src2', src2]]),
            { var: 'simple2', prop: 'Simple2' },
            (k) => k.startsWith('simple2:'),
        ).getValueOrThrow();

        describe('static constructor', () => {
            test('succeeds with valid maps', () => {
                expect(CompositeObjectMap.create([simple1, simple2])).toSucceedWith(expect.any(CompositeObjectMap));
            });
        });

        const map = CompositeObjectMap.create([simple1, simple2]).getValueOrThrow();
        describe('keyIsInRange method', () => {
            test('returns true if the key is valid for any of the composed maps', () => {
                expect(map.keyIsInRange('simple1:object300')).toBe(true);
                expect(map.keyIsInRange('simple2:object300')).toBe(true);
            });

            test('returns false if the key is not valid for any of the composed maps', () => {
                expect(map.keyIsInRange('simple3:object300')).toBe(false);
            });
        });

        describe('has method', () => {
            test('returns true if the object is present in any of the composed maps', () => {
                expect(map.has('simple1:src1')).toBe(true);
                expect(map.has('simple2:src2')).toBe(true);
            });

            test('returns false if the object is not present in any of the composed maps', () => {
                expect(map.has('simple3:object300')).toBe(false);
                expect(map.has('simple1:src2')).toBe(false);
                expect(map.has('simple2:src1')).toBe(false);
            });
        });

        describe('getJsonObject method', () => {
            test('formats a conditional object using the context supplied at construction time by default', () => {
                expect(map.getJsonObject('simple1:src1')).toSucceedWith({
                    noMatch: 'simple1',
                    unconditionalSimple1: 'hello',
                });

                expect(map.getJsonObject('simple2:src2')).toSucceedWith({
                    noMatch: 'simple2',
                    unconditionalSimple2: 'hello',
                });
            });

            test('formats a conditional object using a supplied context', () => {
                const context = { var: 'value', prop: 'Prop' };
                expect(map.getJsonObject('simple1:src1', context)).toSucceedWith({
                    matched: 'value',
                    unconditionalProp: 'hello',
                });

                expect(map.getJsonObject('simple2:src2', context)).toSucceedWith({
                    matched: 'value',
                    unconditionalProp: 'hello',
                });
            });

            test('fails for an object that does not exist', () => {
                expect(map.getJsonObject('simple1:target')).toFailWith(/not found/i);
            });

            test('propagates errors from the template conversion', () => {
                const context = { var: 'error', prop: 'Other' };
                expect(map.getJsonObject('simple1:src1', context)).toFailWith(/malformed/i);
            });
        });
    });
});
