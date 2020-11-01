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
import { CompositeJsonMap, JsonValue, PrefixedJsonMap, SimpleJsonMap } from '../../src';
import { JsonContext, JsonReferenceMap, TemplateVarsExtendFunction, defaultExtendVars } from '../../src/jsonContext';
import { JsonContextHelper } from '../../src/contextHelpers';

// Testing static helpers via class
describe('ContextHelpers class', () => {
    describe('extendVars method', () => {
        const helper = JsonContextHelper.create().getValueOrThrow();
        describe('with no base context', () => {
            test('returns a new TemplateVars with values added if supplied', () => {
                expect(helper.extendVars([
                    ['var1', 'new value 1'],
                    ['var2', 'new value 2'],
                ])).toSucceedWith({
                    var1: 'new value 1',
                    var2: 'new value 2',
                });
            });

            test('returns undefined if no new values are added', () => {
                expect(helper.extendVars()).toSucceedWith(undefined);
                expect(helper.extendVars([])).toSucceedWith(undefined);
            });
        });

        describe('with a base context', () => {
            const baseVars = { base1: 'base value 1' };
            describe('with no extend function', () => {
                const helper = JsonContextHelper.create({ vars: baseVars }).getValueOrThrow();
                test('returns a new TemplateVars with values added if supplied', () => {
                    expect(helper.extendVars([
                        ['var1', 'new value 1'],
                        ['var2', 'new value 2'],
                    ])).toSucceedWith(expect.objectContaining({
                        base1: 'base value 1',
                        var1: 'new value 1',
                        var2: 'new value 2',
                    }));
                });

                test('returns base context vars if no new values are added', () => {
                    expect(helper.extendVars()).toSucceedWith(baseVars);
                    expect(helper.extendVars([])).toSucceedWith(baseVars);
                });
            });

            describe('with an extend function', () => {
                test('uses the extension function from the base context if present', () => {
                    const testExtend: TemplateVarsExtendFunction = (b, v) => defaultExtendVars(b, v);
                    const extend = jest.fn(testExtend);
                    const context: JsonContext = { vars: baseVars, extendVars: extend };
                    const helper = JsonContextHelper.create(context).getValueOrThrow();

                    expect(helper.extendVars([['new1', 'new value 1']])).toSucceedWith(expect.objectContaining({
                        base1: 'base value 1',
                        new1: 'new value 1',
                    }));

                    expect(extend).toHaveBeenCalled();
                });
            });
        });
    });

    describe('extendRefs method', () => {
        const map1 = new Map<string, JsonValue>([['name', 'map1']]);
        const map2 = new Map<string, JsonValue>([['name', 'map2']]);
        const prefixMap1 = PrefixedJsonMap.createPrefixed('map1:', map1).getValueOrThrow();
        const prefixMap2 = PrefixedJsonMap.createPrefixed('map2:', map2).getValueOrThrow();
        describe('with no base context', () => {
            const helper = JsonContextHelper.create().getValueOrThrow();
            test('returns a new prefix map if refs are supplied', () => {
                expect(helper.extendRefs([prefixMap1, prefixMap2])).toSucceedAndSatisfy((refs: JsonReferenceMap) => {
                    expect(refs.getJsonValue('map1:name')).toSucceedWith('map1');
                    expect(refs.getJsonValue('map2:name')).toSucceedWith('map2');
                });
            });

            test('returns undefined if no new refs are supplied', () => {
                expect(helper.extendRefs([])).toSucceedWith(undefined);
                expect(helper.extendRefs()).toSucceedWith(undefined);
            });
        });

        describe('with a base context', () => {
            const baseMap = new Map<string, JsonValue>([['name', 'base'], ['baseIsVisible', 'yes']]);
            const simpleBaseMap = SimpleJsonMap.createSimple(baseMap).getValueOrDefault();
            const helper = JsonContextHelper.create({ refs: simpleBaseMap }).getValueOrThrow();

            test('returns a new prefix map if refs are supplied', () => {
                expect(helper.extendRefs([prefixMap1, prefixMap2])).toSucceedAndSatisfy((refs: JsonReferenceMap) => {
                    expect(refs.getJsonValue('name')).toSucceedWith('base');
                    expect(refs.getJsonValue('map1:name')).toSucceedWith('map1');
                    expect(refs.getJsonValue('map2:name')).toSucceedWith('map2');
                });
            });

            test('applies reference overrides in the order supplied', () => {
                const simpleMap1 = SimpleJsonMap.createSimple(map1).getValueOrThrow();
                const simpleMap2 = SimpleJsonMap.createSimple(map2).getValueOrThrow();

                expect(helper.extendRefs([simpleMap1])).toSucceedAndSatisfy((refs: JsonReferenceMap) => {
                    expect(refs.getJsonValue('name')).toSucceedWith('map1');
                    expect(refs.getJsonValue('baseIsVisible')).toSucceedWith('yes');
                });

                expect(helper.extendRefs([simpleMap2, simpleMap1])).toSucceedAndSatisfy((refs: JsonReferenceMap) => {
                    expect(refs.getJsonValue('name')).toSucceedWith('map2');
                    expect(refs.getJsonValue('baseIsVisible')).toSucceedWith('yes');
                });

                expect(helper.extendRefs([prefixMap2, simpleMap1])).toSucceedAndSatisfy((refs: JsonReferenceMap) => {
                    expect(refs.getJsonValue('name')).toSucceedWith('map1');
                    expect(refs.getJsonValue('baseIsVisible')).toSucceedWith('yes');
                });
            });

            test('returns the original map if no refs are supplied', () => {
                [
                    [],
                    undefined,
                ].forEach((t) => {
                    expect(helper.extendRefs(t)).toSucceedAndSatisfy((refs: JsonReferenceMap) => {
                        expect(refs.getJsonValue('name')).toSucceedWith('base');
                        expect(refs.getJsonValue('map1:name')).toFailWith(/not found/i);
                        expect(refs.getJsonValue('map2:name')).toFailWith(/not found/i);
                    });
                });
            });
        });
    });

    describe('extendContext method', () => {
        const map1 = new Map<string, JsonValue>([['name', 'map1']]);
        const map2 = new Map<string, JsonValue>([['name', 'map2']]);
        const prefixMap1 = PrefixedJsonMap.createPrefixed('map1:', map1).getValueOrThrow();
        const prefixMap2 = PrefixedJsonMap.createPrefixed('map2:', map2).getValueOrThrow();

        describe('with no base context', () => {
            const helper = JsonContextHelper.create().getValueOrThrow();

            test('returns a new context if vars or refs are supplied', () => {
                expect(helper.extendContext({ vars: [['added', 'added']] })).toSucceedWith({
                    vars: {
                        added: 'added',
                    },
                });

                expect(helper.extendContext({ refs: [prefixMap1] })).toSucceedAndSatisfy((context: JsonContext) => {
                    expect(context.vars).toBeUndefined();
                    expect(context.refs?.getJsonValue('map1:name')).toSucceedWith('map1');
                });

                expect(helper.extendContext({ vars: [['added', 'added']], refs: [prefixMap2] })).toSucceedAndSatisfy((context: JsonContext) => {
                    expect(context.vars).toEqual({ added: 'added' });
                    expect(context.refs?.getJsonValue('map2:name')).toSucceedWith('map2');
                });
            });

            test('returns undefined if no new values or reference maps are added', () => {
                expect(helper.extendContext()).toSucceedWith(undefined);
                expect(helper.extendContext({})).toSucceedWith(undefined);
                expect(helper.extendContext({ vars: [], refs: [] })).toSucceedWith(undefined);
            });
        });

        describe('with a base context', () => {
            const baseVars = { name: 'base', baseIsVisible: 'yes' };
            const baseMap = new Map<string, JsonValue>(Object.entries(baseVars));
            const simpleBaseMap = SimpleJsonMap.createSimple(baseMap).getValueOrDefault();
            describe('with no extendVars function', () => {
                const helper = JsonContextHelper.create({ vars: baseVars, refs: simpleBaseMap }).getValueOrThrow();

                test('correctly extends vars or refs if supplied', () => {
                    const newVars = { new1: 'new value 1' };
                    const simpleMap2 = SimpleJsonMap.createSimple(map2).getValueOrThrow();

                    expect(helper.extendContext({ vars: Object.entries(newVars) })).toSucceedWith({
                        vars: expect.objectContaining({ ... baseVars, ...newVars }),
                        refs: simpleBaseMap,
                    });

                    expect(helper.extendContext({ refs: [prefixMap1, simpleMap2] })).toSucceedAndSatisfy((context: JsonContext) => {
                        expect(context.vars).toEqual(baseVars);
                        expect(context.refs?.getJsonValue('name')).toSucceedWith('map2');
                        expect(context.refs?.getJsonValue('map1:name')).toSucceedWith('map1');
                        expect(context.refs?.getJsonValue('baseIsVisible')).toSucceedWith('yes');
                    });

                    expect(helper.extendContext({
                        vars: Object.entries(newVars),
                        refs: [prefixMap1, simpleMap2],
                    })).toSucceedAndSatisfy((context: JsonContext) => {
                        expect(context.vars).toEqual(expect.objectContaining({ ... baseVars, ...newVars }));
                        expect(context.refs?.getJsonValue('name')).toSucceedWith('map2');
                        expect(context.refs?.getJsonValue('map1:name')).toSucceedWith('map1');
                        expect(context.refs?.getJsonValue('baseIsVisible')).toSucceedWith('yes');
                    });
                });
            });
            describe('with an extendVars function', () => {
                const testExtend: TemplateVarsExtendFunction = (b, v) => defaultExtendVars(b, v);

                test('uses and preserves extendVars function if vars are present in base context', () => {
                    const extend = jest.fn(testExtend);
                    const helper = JsonContextHelper.create({
                        vars: baseVars,
                        refs: simpleBaseMap,
                        extendVars: extend,
                    }).getValueOrThrow();
                    const newVars = { new1: 'new value 1' };

                    expect(helper.extendContext({ vars: Object.entries(newVars) })).toSucceedWith({
                        vars: expect.objectContaining({ ... baseVars, ...newVars }),
                        refs: simpleBaseMap,
                        extendVars: extend,
                    });
                    expect(extend).toHaveBeenCalled();

                    extend.mockClear();

                    expect(helper.extendContext({ refs: [prefixMap1] })).toSucceedWith({
                        vars: baseVars,
                        refs: expect.any(CompositeJsonMap),
                        extendVars: extend,
                    });
                    expect(extend).not.toHaveBeenCalled();
                });

                test('uses and preserves extendVars function if no vars are present in base context', () => {
                    const extend = jest.fn(testExtend);
                    const helper = JsonContextHelper.create({
                        refs: simpleBaseMap,
                        extendVars: extend,
                    }).getValueOrThrow();
                    const newVars = { new1: 'new value 1' };

                    expect(helper.extendContext({ vars: Object.entries(newVars) })).toSucceedWith({
                        vars: expect.objectContaining({ ...newVars }),
                        refs: simpleBaseMap,
                        extendVars: extend,
                    });
                    expect(extend).toHaveBeenCalled();

                    extend.mockClear();

                    expect(helper.extendContext({ refs: [prefixMap1] })).toSucceedWith({
                        refs: expect.any(CompositeJsonMap),
                        extendVars: extend,
                    });
                    expect(extend).not.toHaveBeenCalled();
                });
            });
        });
    });
});

