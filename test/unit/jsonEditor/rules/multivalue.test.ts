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
    MultiValueJsonEditorRule,
    ReferenceJsonEditorRule,
    TemplatedJsonEditorRule,
} from '../../../../src/jsonEditor/rules';

import { JsonEditor } from '../../../../src/jsonEditor/jsonEditor';
import { PrefixedObjectMap } from '../../../../src';

describe('MultiValueJsonEditorRule', () => {
    const o1 = { name: 'o1', kid: '{{kid}}' };
    const o2 = {
        name: 'o2',
        child: {
            name: 'o2.child',
            prop: '{{var}}',
            kid: '{{kid}}',
        },
    };
    const vars = { var: 'Original Value' };
    const refs = PrefixedObjectMap.createPrefixed('ref:', { o1, o2 }).getValueOrThrow();
    const templateRule = TemplatedJsonEditorRule.create().getValueOrThrow();
    const multiValueRule = MultiValueJsonEditorRule.create().getValueOrThrow();
    const referenceRule = ReferenceJsonEditorRule.create().getValueOrThrow();
    const editor = JsonEditor.create({ refs, vars }, [templateRule, multiValueRule, referenceRule]).getValueOrThrow();

    test('expands a multivalue key', () => {
        expect(editor.clone({
            '[[kid]]=kv1,kv2': '{{kid}} value',
        })).toSucceedWith({
            kv1: 'kv1 value',
            kv2: 'kv2 value',
        });
    });

    test('propagates other context values when expanding a multivalue key', () => {
        expect(editor.clone({
            '[[kid]]=kv1,kv2': '{{kid}} {{var}}',
        })).toSucceedWith({
            kv1: 'kv1 Original Value',
            kv2: 'kv2 Original Value',
        });
    });

    test('passes context to resolved objects', () => {
        expect(editor.clone({
            '[[kid]]=o1,o2': {
                'ref:{{kid}}': 'default',
            },
        })).toSucceedWith({
            o1: {
                name: 'o1',
                kid: 'o1',
            },
            o2: {
                name: 'o2',
                child: {
                    name: 'o2.child',
                    prop: 'Original Value',
                    kid: 'o2',
                },
            },
        });
    });

    test('fails for malformed multivalue property names', () => {
        expect(editor.clone({
            '[[kid': 'test',
        })).toFailWith(/malformed/i);
    });
});
