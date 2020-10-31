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

import { CompositeObjectMap, JsonObject, PrefixedObjectMap, TemplateVars } from '../../../../src';
import { JsonEditor } from '../../../../src/jsonEditor/jsonEditor';
import { ReferenceJsonEditorRule } from '../../../../src/jsonEditor/rules';

describe('ReferenceJsonEditorRule', () => {
    describe('new tests', () => {
        const o1 = { name: 'o1' };
        const o2 = {
            name: 'o2',
            child: {
                name: 'o2.child',
                grandchild: {
                    name: 'o2.grandchild',
                },
            },
        };
        const o3 = {
            name: 'o3',
            prop1: '{{var1}}',
            prop2: '{{var2}}',
        };
        const o4 = {
            name: 'o4',
            '?error': {
                '{{bad': 'should fail}}',
            },
        };
        const vars = { var1: 'Original1', var2: 'Original2' };
        const refs = PrefixedObjectMap.createPrefixed('ref:', { o1, o2, o3, o4 }).getValueOrThrow();
        const rule = ReferenceJsonEditorRule.create().getValueOrThrow();
        const editor = JsonEditor.create({ context: { refs, vars } }, [rule]).getValueOrThrow();

        test('flattens an object specified as key with default', () => {
            expect(editor.clone({
                'ref:o1': 'default',
            })).toSucceedWith({
                name: 'o1',
            });
        });

        test('picks and flattens a child from an object specified as key with path', () => {
            expect(editor.clone({
                'ref:o2': 'child',
            })).toSucceedWith({
                name: 'o2.child',
                grandchild: {
                    name: 'o2.grandchild',
                },
            });

            expect(editor.clone({
                'ref:o2': 'child.grandchild',
            })).toSucceedWith({
                name: 'o2.grandchild',
            });
        });

        test('uses context supplied at create for objects specified as key with default', () => {
            expect(editor.clone({
                'ref:o3': 'default',
            })).toSucceedWith({
                name: 'o3',
                prop1: 'Original1',
                prop2: 'Original2',
            });
        });

        test('uses context supplied at runtime if present', () => {
            expect(editor.clone({
                'ref:o3': 'default',
            }, { vars: { var1: 'Alternate1', var2: 'Alternate2' } })).toSucceedWith({
                name: 'o3',
                prop1: 'Alternate1',
                prop2: 'Alternate2',
            });
        });

        test('uses overrides from a context supplied in the declaration', () => {
            expect(editor.clone({
                'ref:o3': {
                    'var1': 'Inline1',
                },
            })).toSucceedWith({
                name: 'o3',
                prop1: 'Inline1',
                prop2: 'Original2',
            });
        });

        test('inserts an entire object specified by value', () => {
            expect(editor.clone({
                o1: 'ref:o1',
                array: ['ref:o1', 'ref:o2'],
            }));
        });

        test('succeds without reference insertion if no context or references are defined', () => {
            const e2 = JsonEditor.create(undefined, [rule]).getValueOrThrow();
            expect(e2.clone({ o3: 'ref:o3' })).toSucceedWith({ o3: 'ref:o3' });
        });

        test('succeeds without template replacement if references are defined without context', () => {
            const e2 = JsonEditor.create({ context: { refs } }, [rule]).getValueOrThrow();
            expect(e2.clone({
                o3: 'ref:o3',
            })).toSucceedWith({
                o3: {
                    name: 'o3',
                    prop1: '{{var1}}',
                    prop2: '{{var2}}',
                },
            });
        });

        test('propagates errors from object resolution', () => {
            expect(editor.clone({
                'ref:o4': {
                    error: true,
                },
            })).toFailWith(/cannot render name/i);

            expect(editor.clone(
                { error: 'ref:o4' },
                { vars: { error: true } },
            )).toFailWith(/cannot render name/i);
        });

        test('propagates errors from context resolution', () => {
            expect(editor.clone({
                'ref:o4': true,
            })).toFailWith(/invalid template path or context/i);
        });
    });
    describe('referenceEditor compatibility', () => {
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
        const simple1 = PrefixedObjectMap.createPrefixed(
            'simple1:',
            new Map<string, JsonObject>([['simple1:src1', src1]]),
            { var: 'simple1', prop: 'Simple1' },
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
        const simple2 = PrefixedObjectMap.createPrefixed(
            'simple2:',
            new Map<string, JsonObject>([['simple2:src2', src2]]),
            { var: 'simple2', prop: 'Simple2' },
        ).getValueOrThrow();
        const refs = CompositeObjectMap.create([simple1, simple2]).getValueOrThrow();
        const vars = { var: 'merger', prop: 'Merger' };
        const editor = JsonEditor.create({ context: { vars, refs } }).getValueOrThrow();

        describe('where key is a reference', () => {
            const src = {
                'simple1:src1': 'default',
            };
            test('uses the default context by default', () => {
                expect(editor.clone(src)).toSucceedWith({
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
                expect(editor.clone(src, { vars: override })).toSucceedWith({
                    matched: 'value',
                    unconditionalProp: 'hello',
                    child: {
                        sourceProp: 'Prop',
                        sourceVar: 'value',
                    },
                });
            });

            test('applies context overrides if supplied', () => {
                expect(editor.clone({ 'simple1:src1': { prop: 'Inline' } })).toSucceedWith({
                    noMatch: 'merger',
                    unconditionalInline: 'hello',
                    child: {
                        sourceProp: 'Inline',
                        sourceVar: 'merger',
                    },
                });
            });

            test('dereferences a child property for a non-default string', () => {
                expect(editor.clone({ 'simple1:src1': 'child' })).toSucceedWith({
                    sourceProp: 'Merger',
                    sourceVar: 'merger',
                });
            });

            test('edits a property whose name is inserted via a template', () => {
                const vars2: TemplateVars = { ...vars, insert: 'simple1:src1' };
                expect(editor.clone({ '{{insert}}': 'child' }, { vars: vars2 })).toSucceedWith({
                    sourceProp: 'Merger',
                    sourceVar: 'merger',
                });
            });

            test('propagates merge errors', () => {
                expect(editor.clone({ 'simple1:src1': { var: 'error' } })).toFailWith(/malformed/i);
            });
        });

        describe('where value is a reference', () => {
            test('inserts a reference to the whole object', () => {
                expect(editor.clone({ ref: 'simple1:src1' })).toSucceedWith({
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
                expect(editor.clone({ ref: ['simple1:src1', 10, 'notAKey'] })).toSucceedWith({
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

            test('edits a reference inserted via a template into a property value', () => {
                const vars2: TemplateVars = { ...vars, insert: 'simple1:src1' };
                expect(editor.clone({ 'child': '{{insert}}' }, { vars: vars2 })).toSucceedWith({
                    child: {
                        noMatch: 'merger',
                        unconditionalMerger: 'hello',
                        child: {
                            sourceProp: 'Merger',
                            sourceVar: 'merger',
                        },
                    },
                });
            });

            test('edits a reference inserted via a template into an array', () => {
                const vars2: TemplateVars = { ...vars, insert: 'simple1:src1' };
                expect(editor.clone({ 'array': ['{{insert}}'] }, { vars: vars2 })).toSucceedWith({
                    array: [{
                        noMatch: 'merger',
                        unconditionalMerger: 'hello',
                        child: {
                            sourceProp: 'Merger',
                            sourceVar: 'merger',
                        },
                    }],
                });
            });
        });

        test('propagates merge errors', () => {
            expect(editor.clone({ ref: 'simple1:src1' }, { vars: { var: 'error' } })).toFailWith(/malformed/i);
            expect(editor.clone({ ref: ['simple1:src1'] }, { vars: { var: 'error' } })).toFailWith(/malformed/i);
        });
    });
});
