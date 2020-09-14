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
import { ConditionalJson, JsonObject } from '../../src';

interface ConditionalJsonSuccessTest {
    description: string;
    src: JsonObject;
    expected: JsonObject;
}

describe('ConditionalJson class', () => {
    const successTestCases: ConditionalJsonSuccessTest[] = [
        {
            description: 'expands matching fragments',
            src: {
                unconditional: 'unconditional',
                '?this=this': {
                    conditional: 'matched',
                },
                unconditional2: 'unconditional the second',
                '?that=that': {
                    conditional2: 'conditional the second',
                }
            },
            expected: {
                unconditional: 'unconditional',
                conditional: 'matched',
                unconditional2: 'unconditional the second',
                conditional2: 'conditional the second',
            },
        },
        {
            description: 'does not expand non-matching fragments',
            src: {
                unconditional: 'unconditional',
                '?this=that': {
                    conditional: 'unmatched',
                },
            },
            expected: {
                unconditional: 'unconditional',
            },
        },
        {
            description: 'expands a default fragment if no preceding conditions match',
            src: {
                unconditional: 'unconditional',
                '?this=that': {
                    conditional: 'unmatched',
                },
                '?default': {
                    default: 'default',
                },
            },
            expected: {
                unconditional: 'unconditional',
                default: 'default',
            },
        },
        {
            description: 'does not expand a default fragment if any preceding conditions matches',
            src: {
                unconditional: 'unconditional',
                '?this=this': {
                    conditional: 'matched',
                },
                '?this=that': {
                    conditional: 'unmatched',
                },
                '?default': {
                    default: 'default',
                },
            },
            expected: {
                unconditional: 'unconditional',
                conditional: 'matched',
            },
        },
        {
            // this should become an option
            description: 'ignores malformed conditionals',
            src: {
                unconditional: 'unconditional',
                '?this=this=this': {
                    weird: 'but valid for now',
                }
            },
            expected: {
                unconditional: 'unconditional',
                '?this=this=this': {
                    weird: 'but valid for now',
                },
            },
        },
    ];

    describe('success cases', () => {
        const cjson = new ConditionalJson();
        successTestCases.forEach((t) => {
            test(t.description, () => {
                expect(cjson.convert(t.src)).toSucceedWith(t.expected);
            });
        });
    });
});
