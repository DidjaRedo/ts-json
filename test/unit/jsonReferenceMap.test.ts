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
    CompositeJsonMap,
    JsonObject,
    JsonValue,
    PrefixedJsonMap,
    SimpleJsonMap,
} from '../../src';

import { JsonEditor } from '../../src/jsonEditor';
import { ReferenceMapKeyPolicy } from '../../src/jsonReferenceMap';
import { isKeyOf } from '@fgv/ts-utils';

describe('JsonReferenceMap module', () => {
    describe('SimpleJsonMap class', () => {
        describe('static constructor', () => {
            const o1 = { name: 'o1' };
            const o2 = { name: 'o2' };
            const o3 = { name: 'o3' };

            test('succeeds with no Map or Record', () => {
                expect(SimpleJsonMap.createSimple()).toSucceedWith(expect.any(SimpleJsonMap));
            });

            test('succeeds with a valid record of objects', () => {
                const record = {
                    'o1': o1,
                    'o2': o2,
                    'o3': o3,
                };
                expect(SimpleJsonMap.createSimple(record)).toSucceedAndSatisfy((map: SimpleJsonMap) => {
                    for (const key in record) {
                        if (isKeyOf(key, record)) {
                            expect(map.has(key)).toBe(true);
                            expect(map.getJsonObject(key)).toSucceedWith(record[key]);
                        }
                    }
                });
            });
            test('succeeds with a valid Map of objects', () => {
                const srcMap = new Map<string, JsonObject>([
                    ['local:o1', o1],
                    ['local:o2', o2],
                    ['local:o3', o3],
                ]);
                expect(SimpleJsonMap.createSimple(srcMap)).toSucceedAndSatisfy((map: SimpleJsonMap) => {
                    for (const key of srcMap.keys()) {
                        expect(map.has(key)).toBe(true);
                        expect(map.getJsonObject(key)).toSucceedWith(srcMap.get(key) as unknown as JsonObject);
                    }
                });
            });

            test('fails by default for a map with templated key names', () => {
                const map = new Map<string, JsonObject>([['{{hello}}', {}], ['goodbye', {}]]);
                expect(SimpleJsonMap.createSimple(map)).toFailWith(/invalid key/i);
            });

            test('fails by default for a map with conditional key names', () => {
                const map = new Map<string, JsonObject>([['hello', {}], ['?test=test', {}]]);
                expect(SimpleJsonMap.createSimple(map)).toFailWith(/invalid key/i);
            });

            test('applies a key policy if supplied', () => {
                const keyPolicy = new ReferenceMapKeyPolicy<JsonValue>(undefined, (key: string): boolean => (key !== 'hello'));
                [
                    new Map<string, JsonObject>([['{{hello}}', {}], ['?test=test', {}]]),
                    { '{{hello}}': {}, '?test=test': {} } as Record<string, JsonValue>,
                ].forEach((t) => {
                    expect(SimpleJsonMap.createSimple(t as Map<string, JsonValue>, undefined, { keyPolicy })).toSucceed();
                });
            });
        });

        describe('keyIsInRange method', () => {
            test('rejects conditional or templated key names by default', () => {
                const map = SimpleJsonMap.createSimple(new Map<string, JsonValue>()).getValueOrThrow();
                expect(map.keyIsInRange('hello')).toBe(true);
                expect(map.keyIsInRange('{{hello}}')).toBe(false);
                expect(map.keyIsInRange('key with {{hello}} in a template')).toBe(false);
                expect(map.keyIsInRange('?test=test')).toBe(false);
            });

            test('applies a key policy if supplied', () => {
                const keyPolicy = new ReferenceMapKeyPolicy<JsonValue>(undefined, (key: string): boolean => (key !== 'hello'));
                const map = SimpleJsonMap.createSimple(new Map<string, JsonValue>(), undefined, { keyPolicy }).getValueOrThrow();
                expect(map.keyIsInRange('hello')).toBe(false);
                expect(map.keyIsInRange('{{hello}}')).toBe(true);
            });
        });

        describe('has method', () => {
            const map = SimpleJsonMap.createSimple(new Map<string, JsonValue>([['hello', {}], ['goodbye', {}]])).getValueOrThrow();
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
                '?{{insert}}': {
                    inserted: '{{insert}}',
                },
            };
            const map = SimpleJsonMap.createSimple(
                new Map<string, JsonValue>([
                    ['src', src],
                    ['primitive', 'primitive'],
                ]),
                { vars: { var: 'value', prop: 'Prop' } },
            ).getValueOrThrow();

            test('formats a conditional object using the context supplied at construction time by default', () => {
                expect(map.getJsonObject('src')).toSucceedWith({
                    matched: 'value',
                    unconditionalProp: 'hello',
                });
            });

            test('formats a conditional object using a supplied context', () => {
                const context = { vars: { var: 'other', prop: 'Other' } };
                expect(map.getJsonObject('src', context)).toSucceedWith({
                    noMatch: 'other',
                    unconditionalOther: 'hello',
                });
            });

            test('formats a conditional object using a supplied editor', () => {
                const basicEditor = JsonEditor.create({}, []).getValueOrDefault();
                const basicMap = SimpleJsonMap.createSimple(
                    new Map<string, JsonValue>([
                        ['src', src],
                        ['primitive', 'primitive'],
                    ]),
                    { vars: { var: 'value', prop: 'Prop' } },
                    { editor: basicEditor },
                ).getValueOrThrow();
                expect(basicMap.getJsonObject('src')).toSucceedWith(src);
            });

            test('substitutes references if an object map is supplied', () => {
                const o1: JsonObject = { name: 'o1' };
                const o2: JsonObject = { name: 'o2' };
                const refs = PrefixedJsonMap.createPrefixed(
                    'object:',
                    new Map<string, JsonObject>([['o1', o1], ['o2', o2]])
                ).getValueOrThrow();
                const context = { vars: { var: 'value', prop: 'prop', insert: 'object:o1' }, refs };
                expect(map.getJsonObject('src', context)).toSucceedWith({
                    matched: 'value',
                    unconditionalprop: 'hello',
                    inserted: {
                        name: 'o1',
                    },
                });
            });

            test('fails for a non-object value that exists', () => {
                expect(map.getJsonValue('primitive')).toSucceedWith('primitive');
                expect(map.getJsonObject('primitive')).toFailWith(/not an object/i);
            });

            test('fails for an object that does not exist', () => {
                expect(map.getJsonObject('target')).toFailWith(/not found/i);
            });

            test('propagates errors from the template conversion', () => {
                const context = { vars: { var: 'error', prop: 'Other' } };
                expect(map.getJsonObject('src', context)).toFailWith(/malformed/i);
            });
        });
    });

    describe('PrefixedJsonMap class', () => {
        const o1 = { o1: true };
        const o2 = { o3: true };
        const o3 = { o2: true };
        const entries: [string, JsonObject][] = [['o1', o1], ['o2', o2], ['o3', o3]];
        const srcMap = new Map(entries);
        const srcRecord = { o1, o2, 'o3': o3 };
        const testPrefix = 'testPrefix:';

        describe('createPrefixed static method', () => {
            test('succeeds and adds prefixes for a well-formed map', () => {
                expect(PrefixedJsonMap.createPrefixed(testPrefix, srcMap)).toSucceedAndSatisfy((map: PrefixedJsonMap) => {
                    entries.forEach((e) => {
                        const name = `${testPrefix}${e[0]}`;
                        expect(map.has(name)).toBe(true);
                        expect(map.getJsonObject(name)).toSucceedWith(e[1]);
                    });
                });
            });

            test('succeeds and adds prefixes for a well-formed record', () => {
                expect(PrefixedJsonMap.createPrefixed(testPrefix, srcRecord)).toSucceedAndSatisfy((map: PrefixedJsonMap) => {
                    entries.forEach((e) => {
                        const name = `${testPrefix}${e[0]}`;
                        expect(map.has(name)).toBe(true);
                        expect(map.getJsonObject(name)).toSucceedWith(e[1]);
                    });
                });
            });

            test('does not add a prefix if it already exists', () => {
                const extraName = `${testPrefix}extra`;
                const extra: JsonObject = { extra: true };
                const entries2: [string, JsonObject][] = [...entries, [extraName, extra]];
                const srcMap2 = new Map(entries2);
                expect(PrefixedJsonMap.createPrefixed(testPrefix, srcMap2)).toSucceedAndSatisfy((map: PrefixedJsonMap) => {
                    entries.forEach((e) => {
                        const name = `${testPrefix}${e[0]}`;
                        expect(map.has(name)).toBe(true);
                        expect(map.getJsonObject(name)).toSucceedWith(e[1]);
                    });
                    expect(map.has(extraName)).toBe(true);
                    expect(map.getJsonObject(extraName)).toSucceedWith(extra);
                });
            });

            test('does not add a prefix if addPrefix option is false', () => {
                const options = { addPrefix: false, prefix: testPrefix };
                expect(PrefixedJsonMap.createPrefixed(options, srcMap)).toFailWith(/invalid key/i);
            });

            test('formats object using a supplied editor', () => {
                const context = { vars: { 'var': 'value' } };
                const innerMap = new Map<string, JsonValue>([['obj', { value: '{{var}}' }]]);
                const basicEditor = JsonEditor.create({}, []).getValueOrDefault();
                const basicMap = PrefixedJsonMap.createPrefixed('test:', innerMap, context, basicEditor).getValueOrThrow();
                expect(basicMap.getJsonObject('test:obj')).toSucceedWith({ value: '{{var}}' });
            });
        });
    });

    describe('CompositeJsonMap class', () => {
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
        const simple1 = PrefixedJsonMap.createPrefixed(
            'simple1:',
            new Map<string, JsonValue>([
                ['simple1:src1', src1],
                ['simple1:primitive', 'simple1'],
            ]),
            { vars: { var: 'simple1', prop: 'Simple1' } },
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
        const simple2 = PrefixedJsonMap.createPrefixed(
            'simple2:',
            new Map<string, JsonValue>([
                ['simple2:src2', src2],
                ['simple2:primitive', 'simple2'],
            ]),
            { vars: { var: 'simple2', prop: 'Simple2' } },
        ).getValueOrThrow();

        describe('static constructor', () => {
            test('succeeds with valid maps', () => {
                expect(CompositeJsonMap.create([simple1, simple2])).toSucceedWith(expect.any(CompositeJsonMap));
            });
        });

        const map = CompositeJsonMap.create([simple1, simple2]).getValueOrThrow();
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
                const context = { vars: { var: 'value', prop: 'Prop' } };
                expect(map.getJsonObject('simple1:src1', context)).toSucceedWith({
                    matched: 'value',
                    unconditionalProp: 'hello',
                });

                expect(map.getJsonObject('simple2:src2', context)).toSucceedWith({
                    matched: 'value',
                    unconditionalProp: 'hello',
                });
            });

            test('fails for a non-object value that exists', () => {
                expect(map.getJsonValue('simple1:primitive')).toSucceedWith('simple1');
                expect(map.getJsonObject('simple1:primitive')).toFailWith(/not an object/i);
            });

            test('fails for an object that does not exist', () => {
                expect(map.getJsonObject('simple1:target')).toFailWith(/not found/i);
            });

            test('propagates errors from the template conversion', () => {
                const context = { vars: { var: 'error', prop: 'Other' } };
                expect(map.getJsonObject('simple1:src1', context)).toFailWith(/malformed/i);
            });
        });
    });
});
