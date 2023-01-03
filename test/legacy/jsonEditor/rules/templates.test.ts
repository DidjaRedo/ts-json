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

import { JsonEditor } from '../../../../src/jsonEditor/jsonEditor';
import { TemplatedJsonEditorRule } from '../../../../src/jsonEditor/rules';

describe('TemplatedJsonEditorRule', () => {
    const defaultContext = { vars: { var: 'value' } };
    const rule = TemplatedJsonEditorRule.create().orThrow();
    const editor = JsonEditor.create({ context: defaultContext }, [rule]).orThrow();

    const src1 = {
        src1var: '{{var}}',
        value: 'original value',
        alternate: 'original alternate',
        '{{var}}1': 'original {{var}} 1',
        child: {
            src1var: '{{var}}',
            value: 'original value',
            alternate: 'original alternate',
        },
    };
    const src2 = {
        '{{var}}': '{{var}} from src2',
        child: {
            src2var: '{{var}}',
            '{{var}}': 'nested templated name',
        },
    };
    const src3 = {
        '{{var}}': '{{var}} from src3',
        src3array: ['{{var}}', '{{var}} 2'],
        child: {
            '{{var}}': 'nested templated name from src3',
        },
        child2: {
            '{{var}}': '{{var}} from src3',
            '{{var}}Array': ['{{var}} 1', '{{var}} 2'],
        },
    };

    test('uses base context if override is undefined', () => {
        const expected = {
            src1var: 'value',
            value: 'value from src3',
            alternate: 'original alternate',
            value1: 'original value 1',
            child: {
                src1var: 'value',
                src2var: 'value',
                value: 'nested templated name from src3',
                alternate: 'original alternate',
            },
            child2: {
                value: 'value from src3',
                valueArray: ['value 1', 'value 2'],
            },
            src3array: ['value', 'value 2'],
        };
        expect(editor.mergeObjectsInPlace({}, [src1, src2, src3])).toSucceedWith(expected);
    });

    test('uses override context if supplied', () => {
        const alternateContext = { vars: { var: 'alternate' } };
        const expected = {
            src1var: 'alternate',
            value: 'original value',
            alternate: 'alternate from src3',
            alternate1: 'original alternate 1',
            child: {
                src1var: 'alternate',
                src2var: 'alternate',
                value: 'original value',
                alternate: 'nested templated name from src3',
            },
            child2: {
                alternate: 'alternate from src3',
                alternateArray: ['alternate 1', 'alternate 2'],
            },
            src3array: ['alternate', 'alternate 2'],
        };
        expect(editor.mergeObjectsInPlaceWithContext(alternateContext, {}, [src1, src2, src3])).toSucceedWith(expected);
    });

    test('does not replace variables if no context variables are available', () => {
        [
            JsonEditor.create(undefined, [rule]).orThrow(),
            JsonEditor.create({}, [rule]).orThrow(),
        ].forEach((e2) => {
            expect(e2.clone({
                'prop': '{{value}}',
            })).toSucceedWith({
                'prop': '{{value}}',
            });
        });
    });

    describe('with a rule context', () => {
        const ruleContext = { vars: { prop: 'rule', value: 'RULE' } };
        const altRule = TemplatedJsonEditorRule.create({ context: ruleContext }).orThrow();

        test('uses rule context if no other context is available', () => {
            const editor = JsonEditor.create(undefined, [altRule]).orThrow();
            expect(editor.clone({ '{{prop}}': '{{value}}' })).toSucceedWith({ rule: 'RULE' });
        });

        test('uses editor context if available', () => {
            const editorContext = { vars: { prop: 'editor', value: 'EDITOR' } };
            const editor = JsonEditor.create({ context: editorContext }).orThrow();
            expect(editor.clone({ '{{prop}}': '{{value}}' })).toSucceedWith({ editor: 'EDITOR' });
        });

        test('uses runtime context if supplied', () => {
            const editorContext = { vars: { prop: 'editor', value: 'EDITOR' } };
            const runtimeContext = { vars: { prop: 'runtime', value: 'RUNTIME' } };
            const editor = JsonEditor.create({ context: editorContext }).orThrow();
            expect(editor.clone({ '{{prop}}': '{{value}}' }, runtimeContext)).toSucceedWith({ runtime: 'RUNTIME' });
        });
    });

    test('propagates render errors', () => {
        const vars = { prop: 'property', value: 'inserted value' };
        const editor = JsonEditor.create({ context: { vars } }).orThrow();

        expect(editor.clone({ '{{prop': '{{value}}' })).toFailWith(/cannot render/i);
        expect(editor.clone({ '{{prop}}': '{{value' })).toFailWith(/cannot render/i);
        expect(editor.clone('{{value')).toFailWith(/cannot render/i);
        expect(editor.clone(['{{prop'])).toFailWith(/cannot render/i);
    });

    test('does not render property names if useNameTemplates is false', () => {
        const rule = TemplatedJsonEditorRule.create({ useNameTemplates: false }).orThrow();
        const vars = { prop: 'property', value: 'inserted value' };
        const editor = JsonEditor.create({ context: { vars } }, [rule]).orThrow();
        expect(editor.clone({
            '{{prop}}': '{{value}}',
        })).toSucceedWith({
            '{{prop}}': 'inserted value',
        });
    });

    test('does not render property values if useValueTemplates is false', () => {
        const rule = TemplatedJsonEditorRule.create({ useValueTemplates: false }).orThrow();
        const vars = { prop: 'property', value: 'inserted value' };
        const editor = JsonEditor.create({ context: { vars } }, [rule]).orThrow();
        expect(editor.clone({
            '{{prop}}': '{{value}}',
        })).toSucceedWith({
            'property': '{{value}}',
        });
    });
});
