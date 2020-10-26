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

import { JsonEditor } from '../../../src/jsonEditor';
import { PrefixedObjectMap } from '../../../src';
import { ReferenceJsonEditorRule } from '../../../src/editorRules/references';

describe('ReferenceJsonEditorRule', () => {
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
    const editor = JsonEditor.create({ refs, vars }, [rule]).getValueOrThrow();

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
        const e2 = JsonEditor.create({ refs }, [rule]).getValueOrThrow();
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
