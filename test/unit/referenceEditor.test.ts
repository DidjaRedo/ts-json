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
    JsonMerger,
    JsonObject,
    JsonReferenceEditor,
    SimpleObjectMap,
} from '../../src';

describe('JsonReferenceEditor class', () => {
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
        'child': {
            'sourceVar': '{{var}}',
            'sourceProp': '{{prop}}',
        },
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
        'child': {
            'sourceVar': '{{var}}',
            'sourceProp': '{{prop}}',
        },
    };
    const simple2 = SimpleObjectMap.create(
        new Map<string, JsonObject>([['simple2:src2', src2]]),
        { var: 'simple2', prop: 'Simple2' },
        (k) => k.startsWith('simple2:'),
    ).getValueOrThrow();
    const map = CompositeObjectMap.create([simple1, simple2]).getValueOrThrow();

    describe('static constructors', () => {
        test('succeeds with a valid map', () => {
            expect(JsonReferenceEditor.create(map)).toSucceedWith(expect.any(JsonReferenceEditor));
        });
    });

    describe('static merger constructor', () => {
        test('succeeds with a valid map', () => {
            expect(JsonReferenceEditor.createMerger(map)).toSucceedWith(expect.any(JsonMerger));
        });
    });

    describe('getContext static method', () => {
        test('returns the base context for a string value', () => {
            const baseContext = { var: 'base', prop: 'Base' };
            expect(JsonReferenceEditor.getContext('default', baseContext)).toSucceedWith(baseContext);
            expect(JsonReferenceEditor.getContext('child', baseContext)).toSucceedWith(baseContext);
        });

        test('overrides the base context for an object value', () => {
            const baseContext = { var: 'base', prop: 'Base' };
            const addedContext = { prop: 'Added', extra: 'prop' };
            const mergedContext = { var: 'base', prop: 'Added', extra: 'prop' };
            expect(JsonReferenceEditor.getContext(addedContext, baseContext)).toSucceedWith(mergedContext);
        });

        test('applies an object value if base context is undefined', () => {
            const addedContext = { prop: 'Added', extra: 'prop' };
            expect(JsonReferenceEditor.getContext(addedContext, undefined)).toSucceedWith(addedContext);
        });

        test('fails for any other value', () => {
            const baseContext = { var: 'base', prop: 'Base' };
            expect(JsonReferenceEditor.getContext(10, baseContext)).toFailWith(/invalid template context/i);
        });
    });

    // testing specifics of editPropertyValue and editArrayItem using the JsonMerger integration
    const templateContext = { var: 'merger', prop: 'Merger' };
    const merger = JsonReferenceEditor.createMerger(map, { converterOptions: { templateContext } }).getValueOrThrow();
    describe('as used by JsonMerger', () => {
        describe('where key is a reference', () => {
            const src = {
                'simple1:src1': 'default',
            };
            test('uses the default context by default', () => {
                expect(merger.mergeNew(src)).toSucceedWith({
                    noMatch: 'merger',
                    unconditionalMerger: 'hello',
                    child: {
                        sourceProp: 'Merger',
                        sourceVar: 'merger',
                    },
                });
            });

            test('uses a context if supplied', () => {
                const override = { var: 'value', prop: 'Prop' };
                expect(merger.mergeNewWithContext(override, src)).toSucceedWith({
                    matched: 'value',
                    unconditionalProp: 'hello',
                    child: {
                        sourceProp: 'Prop',
                        sourceVar: 'value',
                    },
                });
            });

            test('applies context overrides if supplied', () => {
                expect(merger.mergeNew({ 'simple1:src1': { prop: 'Inline' } })).toSucceedWith({
                    noMatch: 'merger',
                    unconditionalInline: 'hello',
                    child: {
                        sourceProp: 'Inline',
                        sourceVar: 'merger',
                    },
                });
            });

            test('dereferences a child property for a non-default string', () => {
                expect(merger.mergeNew({ 'simple1:src1': 'child' })).toSucceedWith({
                    sourceProp: 'Merger',
                    sourceVar: 'merger',
                });
            });

            test('propagates merge errors', () => {
                expect(merger.mergeNew({ 'simple1:src1': { var: 'error' } })).toFailWith(/malformed/i);
            });
        });

        describe('where value is a reference', () => {
            test('inserts a reference to the whole object', () => {
                expect(merger.mergeNew({ ref: 'simple1:src1' })).toSucceedWith({
                    ref: {
                        noMatch: 'merger',
                        unconditionalMerger: 'hello',
                        child: {
                            sourceProp: 'Merger',
                            sourceVar: 'merger',
                        },
                    },
                });
            });

            test('inserts a referenced object into an array', () => {
                expect(merger.mergeNew({ ref: ['simple1:src1', 10, 'notAKey'] })).toSucceedWith({
                    ref: [{
                        noMatch: 'merger',
                        unconditionalMerger: 'hello',
                        child: {
                            sourceProp: 'Merger',
                            sourceVar: 'merger',
                        },
                    }, 10, 'notAKey'],
                });
            });

            test('propagates merge errors', () => {
                expect(merger.mergeNewWithContext({ var: 'error' }, { ref: 'simple1:src1' })).toFailWith(/malformed/i);
                expect(merger.mergeNewWithContext({ var: 'error' }, { ref: ['simple1:src1'] })).toFailWith(/malformed/i);
            });
        });
    });
});
