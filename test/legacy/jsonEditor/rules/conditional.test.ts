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
    ConditionalJsonEditorRule,
    MultiValueJsonEditorRule,
    ReferenceJsonEditorRule,
    TemplatedJsonEditorRule,
} from '../../../../src/jsonEditor/rules';
import { JsonObject, PrefixedJsonMap } from '../../../../src';

import { JsonEditor } from '../../../../src/jsonEditor/jsonEditor';

describe('ConditionalJsonEditorRule', () => {
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
    const refs = PrefixedJsonMap.createPrefixed('ref:', { o1, o2 }).getValueOrThrow();
    const templateRule = TemplatedJsonEditorRule.create().getValueOrThrow();
    const conditionalRule = ConditionalJsonEditorRule.create().getValueOrThrow();
    const multiValueRule = MultiValueJsonEditorRule.create().getValueOrThrow();
    const referenceRule = ReferenceJsonEditorRule.create().getValueOrThrow();
    const editor = JsonEditor.create({ context: { refs, vars } }, [templateRule, conditionalRule, multiValueRule, referenceRule]).getValueOrThrow();

    test('emits a matching condition', () => {
        expect(editor.clone({
            '?this=this': {
                prop: 'value',
            },
        })).toSucceedWith({
            prop: 'value',
        });
    });

    test('does not emit a non-matching condition', () => {
        expect(editor.clone({
            '?this=that': {
                prop: 'value',
            },
            unconditional: true,
        })).toSucceedWith({
            unconditional: true,
        });
    });

    test('matches all conditional operators', () => {
        [
            { condition: '?3=1', expect: 'no match' },
            { condition: '?2=2', expect: 'match' },
            { condition: '?1=3', expect: 'no match' },
            { condition: '?3>1', expect: 'match' },
            { condition: '?2>2', expect: 'no match' },
            { condition: '?1>3', expect: 'no match' },
            { condition: '?1<3', expect: 'match' },
            { condition: '?2<2', expect: 'no match' },
            { condition: '?1>3', expect: 'no match' },
            { condition: '?3>=1', expect: 'match' },
            { condition: '?2>=2', expect: 'match' },
            { condition: '?1>=3', expect: 'no match' },
            { condition: '?3<=1', expect: 'no match' },
            { condition: '?2<=2', expect: 'match' },
            { condition: '?1<=3', expect: 'match' },
            { condition: '?3!=1', expect: 'match' },
            { condition: '?2!=2', expect: 'no match' },
            { condition: '?1!=3', expect: 'match' },
        ].forEach((t) => {
            const obj: JsonObject = { '?default': { match: 'no match' } };
            obj[t.condition] = { match: 'match' };
            expect(editor.clone(obj)).toSucceedWith({ match: t.expect });
        });
    });

    test('ignores trailing and trailing spaces and spaces around conditional operators', () => {
        [
            { condition: '?this =this', expect: 'match' },
            { condition: '?this=    this', expect: 'match' },
            { condition: '?    this =this   ', expect: 'match' },
            { condition: '?3 > 1', expect: 'match' },
            { condition: '?2 =2', expect: 'match' },
            { condition: '?1  <  3', expect: 'match' },
        ].forEach((t) => {
            const obj: JsonObject = { '?default': { match: 'no match' } };
            obj[t.condition] = { match: 'match' };
            expect(editor.clone(obj)).toSucceedWith({ match: t.expect });
        });
    });

    test('emits multiple matching conditions', () => {
        expect(editor.clone({
            unconditional: true,
            '?value1=value1': {
                conditional1: true,
            },
            '?value2=value2': {
                conditional2: true,
            },
        })).toSucceedWith({
            unconditional: true,
            conditional1: true,
            conditional2: true,
        });
    });

    test('emits stanadalone default condition', () => {
        expect(editor.clone({
            unconditional: true,
            '?default': {
                default: true,
            },
        })).toSucceedWith({
            unconditional: true,
            default: true,
        });
    });

    test('emits default if no condition matches', () => {
        expect(editor.clone({
            unconditional: true,
            '?': {
                conditional1: true,
            },
            '?default': {
                default: true,
            },
        })).toSucceedWith({
            unconditional: true,
            default: true,
        });
    });

    test('suppresses default if any condition matches', () => {
        expect(editor.clone({
            unconditional: true,
            '?value1': {
                conditional1: true,
            },
            '?default': {
                default: true,
            },
        })).toSucceedWith({
            unconditional: true,
            conditional1: true,
        });
    });

    test('emits a flattened standalone unconditional object', () => {
        expect(editor.clone({
            unconditional: true,
            '!value': {
                emitMe: true,
            },
        })).toSucceedWith({
            unconditional: true,
            emitMe: true,
        });
    });

    test('emits default even if unconditional are present', () => {
        expect(editor.clone({
            '!value': {
                emitMe: true,
            },
            unconditional: true,
            '?': {
                conditional1: true,
            },
            '?default': {
                default: true,
            },
        })).toSucceedWith({
            emitMe: true,
            unconditional: true,
            default: true,
        });
    });

    test('fails for a malformed condition', () => {
        expect(editor.clone({
            '?x=y=;': {
                conditional1: true,
            },
        })).toFailWith(/malformed/i);
    });

    test('fails for a non-object conditional property', () => {
        expect(editor.clone({
            '?value=value': true,
        })).toFailWith(/body must be object/i);
    });

    describe('if flattenUnconditionalValues is false', () => {
        const noUnconditionalRule = ConditionalJsonEditorRule.create({ flattenUnconditionalValues: false }).getValueOrThrow();
        const editor2 = JsonEditor.create({ context: { refs, vars } }, [templateRule, noUnconditionalRule, multiValueRule, referenceRule]).getValueOrThrow();

        test('emits a flattened standalone unconditional object', () => {
            expect(editor2.clone({
                unconditional: true,
                '!value': {
                    emitMe: true,
                },
            })).toSucceedWith({
                unconditional: true,
                '!value': {
                    emitMe: true,
                },
            });
        });

        test('emits default even if unconditional are present', () => {
            expect(editor2.clone({
                '!value': {
                    emitMe: true,
                },
                unconditional: true,
                '?': {
                    conditional1: true,
                },
                '?default': {
                    default: true,
                },
            })).toSucceedWith({
                '!value': {
                    emitMe: true,
                },
                unconditional: true,
                default: true,
            });
        });
    });
});
