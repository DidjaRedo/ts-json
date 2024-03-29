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
import { ConditionalJsonConverter, JsonObject, JsonValue } from '../../src';
import { TemplateVars } from '../../src/jsonContext';

interface JsonConverterSuccessTest {
    description: string;
    src: JsonObject;
    context?: TemplateVars;
    expected: JsonObject;
}

describe('JsonConverter class', () => {
    describe('create static method', () => {
        test('returns success by default', () => {
            expect(ConditionalJsonConverter.create()).toSucceedWith(expect.any(ConditionalJsonConverter));
        });
    });

    const successTestCases: JsonConverterSuccessTest[] = [
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
                },
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
            description: 'expands conditional fragments inside an array',
            src: {
                array: [
                    {
                        unconditional: 'unconditional',
                        '?this=this': {
                            conditional: 'conditional',
                        },
                    },
                ],
            },
            expected: {
                array: [{
                    unconditional: 'unconditional',
                    conditional: 'conditional',
                }],
            },
        },
        {
            description: 'expands templates inside an array',
            src: {
                array: ['{{var1}}', '{{var2}}'],
            },
            context: {
                var1: 'value1',
                var2: 'value2',
            },
            expected: {
                array: ['value1', 'value2'],
            },
        },
        {
            description: 'ignores anything after # in a condition',
            src: {
                '?this=this#1': {
                    conditional1: 'property value 1',
                },
                unconditional: 'unconditional value',
                '?this=this#2': {
                    conditional2: 'property value 2',
                },
                default: {
                    '?default#1': {
                        default1: 'yes',
                    },
                    '?default#2': {
                        default2: 'yes',
                    },
                },
            },
            expected: {
                conditional1: 'property value 1',
                unconditional: 'unconditional value',
                conditional2: 'property value 2',
                default: {
                    default1: 'yes',
                    default2: 'yes',
                },
            },
        },
        {
            description: 'applies a "defined" condition if any non-empty string is present',
            src: {
                '?someValue': {
                    conditional: 'conditional 1',
                },
            },
            expected: {
                conditional: 'conditional 1',
            },
        },
        {
            description: 'does not apply a "defined" condition if no string is present',
            src: {
                '?': {
                    conditional: 'conditional 1',
                },
                unconditional: 'unconditional',
            },
            expected: {
                unconditional: 'unconditional',
            },
        },
        {
            description: 'applies template values if supplied',
            src: {
                unconditional: 'unconditional',
                '?{{prop1}}=this': {
                    conditional: 'matched',
                },
                unconditional2: 'unconditional the second',
                '?{{prop2}}=that': {
                    conditional2: '{{value2}}',
                },
            },
            context: {
                prop1: 'this',
                prop2: 'that',
                value2: 'templated conditional the second',
            },
            expected: {
                unconditional: 'unconditional',
                conditional: 'matched',
                unconditional2: 'unconditional the second',
                conditional2: 'templated conditional the second',
            },
        },
        {
            description: 'expands an multi-value property if a context is supplied',
            src: {
                '*prop={{properties}}': {
                    '{{prop}}Prop': '{{prop}} value',
                },
                '[[prop]]={{properties}}': {
                    '{{prop}}Prop': '{{prop}} value',
                },
            },
            context: {
                properties: ['first', 'second', 'third'],
            },
            expected: {
                first: {
                    firstProp: 'first value',
                },
                second: {
                    secondProp: 'second value',
                },
                third: {
                    thirdProp: 'third value',
                },
                prop: [
                    { firstProp: 'first value' },
                    { secondProp: 'second value' },
                    { thirdProp: 'third value' },
                ],
            },
        },
        {
            description: 'does not expand a multivalue property if no context is supplied',
            src: {
                '[[prop]]={{properties}}': {
                    '{{prop}}Prop': '{{prop}} value',
                },
                '*prop={{properties}}': {
                    '{{prop}}Prop': '{{prop}} value',
                },
            },
            expected: {
                '[[prop]]={{properties}}': {
                    '{{prop}}Prop': '{{prop}} value',
                },
                '*prop={{properties}}': {
                    '{{prop}}Prop': '{{prop}} value',
                },
            },
        },
        {
            description: 'does not apply nested conditionals multiple times',
            src: {
                '?group': {
                    '?{{which}}=first': {
                        got: 'first',
                        array: ['first 1', 'first 2'],
                    },
                    '?{{which}}=second': {
                        got: 'second',
                        array: ['second 1', 'second 2'],
                    },
                    '?default': {
                        got: 'default',
                        array: ['default 1', 'default 2'],
                    },
                },
            },
            context: {
                which: 'first',
            },
            expected: {
                got: 'first',
                array: ['first 1', 'first 2'],
            },
        },
    ];

    describe('success cases', () => {
        describe('with default context', () => {
            successTestCases.forEach((t) => {
                test(t.description, () => {
                    const cjson = new ConditionalJsonConverter({ vars: t.context });
                    expect(cjson.convert(t.src)).toSucceedWith(t.expected);
                });
            });
        });

        describe('with a context override', () => {
            successTestCases.forEach((t) => {
                test(t.description, () => {
                    const vars = (t.context !== undefined) ? {} : undefined;
                    const cjson = new ConditionalJsonConverter({ vars });
                    expect(cjson.convert(t.src, { vars: t.context })).toSucceedWith(t.expected);
                });
            });
        });
    });

    const failureTests = [
        {
            description: 'fails for non-JSON',
            src: () => 'hello',
            expected: /invalid json/i,
        },
        {
            description: 'fails for non-JSON in an array',
            src: () => [() => 'hello'],
            expected: /invalid json/i,
        },
        {
            description: 'fails for malformed template',
            src: {
                '{{value}': {
                    weird: 'and invalid',
                },
            },
            context: {
                prop: 'this',
            },
            expected: /cannot render name/i,
        },
        {
            description: 'fails for name that renders empty',
            src: {
                '{{bogus}}': {
                    weird: 'and invalid',
                },
            },
            context: {
                prop: 'this',
            },
            expected: /renders empty name/i,
        },
        {
            description: 'fails for malformed conditional',
            src: {
                '?this=this=this': {
                    weird: 'and invalid',
                },
            },
            expected: /malformed condition/i,
        },
        {
            description: 'fails for malformed array',
            src: {
                '[[feh': {
                    weird: 'and invalid',
                },
            },
            context: {},
            expected: /malformed multi-value/i,
        },
        {
            description: 'fails if conditional value is non-object',
            src: {
                '?this=this': 'hello',
            },
            expected: /must be.*object/i,
        },
        {
            description: 'propagates errors from inside matching conditions',
            src: {
                '?this=this': {
                    badProperty: () => 'hello',
                },
                unconditional: 'unconditional',
            },
            expected: /invalid json/i,
        },
        {
            description: 'propagates malformed render errors by default',
            src: {
                unconditional: 'unconditional',
                '?{{prop}=this': {
                    conditional: 'no go',
                },
            },
            context: {
                prop: 'this',
            },
            expected: /unclosed tag/i,
        },
    ];
    describe('failure cases', () => {
        failureTests.forEach((t) => {
            test(t.description, () => {
                const cjson = new ConditionalJsonConverter({ vars: t.context });
                expect(cjson.convert(t.src)).toFailWith(t.expected);
            });
        });
    });

    describe('with onInvalidPropertyName ignore', () => {
        const tests = [
            {
                src: {
                    '?this=this=this': {
                        property: 'weird but accepted',
                    },
                },
                context: {},
            },
            {
                src: {
                    '[[feh': {
                        property: 'weird but accepted',
                    },
                },
                context: {},
            },
        ];
        test('ignores malformed conditions or arrays', () => {
            tests.forEach((t) => {
                const cjson = new ConditionalJsonConverter({
                    onInvalidPropertyName: 'ignore',
                    vars: t.context,
                });
                expect(cjson.convert(t.src)).toSucceedWith(t.src as unknown as JsonValue);
            });
        });
    });

    describe('with onInvalidPropertyName ignore', () => {
        const tests = [
            {
                src: {
                    '{{prop}=this': {
                        property: 'weird but accepted',
                    },
                },
                context: {
                    prop: 'this',
                },
            },
            {
                src: {
                    '{{otherProp}}': {
                        property: 'weird but accepted',
                    },
                },
                context: {
                    prop: 'this',
                },
            },
        ];
        test('ignores invalid property names', () => {
            tests.forEach((t) => {
                const cjson = new ConditionalJsonConverter({
                    onInvalidPropertyName: 'ignore',
                    vars: t.context,
                });
                expect(cjson.convert(t.src)).toSucceedWith(t.src as unknown as JsonValue);
            });
        });
    });

    describe('object method', () => {
        test('converts valid objects', () => {
            const tests = [
                {
                    src: {
                        unconditional: 'unconditional',
                        '?{{prop1}}=this': {
                            conditional: 'matched',
                        },
                        unconditional2: 'unconditional the second',
                        '?{{prop2}}=that': {
                            conditional2: '{{value2}}',
                        },
                    },
                    context: {
                        prop1: 'this',
                        prop2: 'that',
                        value2: 'templated conditional the second',
                    },
                    expected: {
                        unconditional: 'unconditional',
                        conditional: 'matched',
                        unconditional2: 'unconditional the second',
                        conditional2: 'templated conditional the second',
                    },
                },
            ];
            for (const t of tests) {
                const cjson = new ConditionalJsonConverter({ vars: t.context }).object();
                expect(cjson.convert(t.src)).toSucceedWith(t.expected);
            }
        });

        test('fails for valid non-objects', () => {
            const tests = [
                {
                    src: 'hello',
                    expected: /cannot convert/i,
                },
            ];
            for (const t of tests) {
                const context = { prop: 'whatever' };
                const cjson = new ConditionalJsonConverter({ vars: context }).object();
                expect(cjson.convert(t.src)).toFailWith(t.expected);
            }
        });
    });

    describe('array method', () => {
        test('converts valid arrays', () => {
            const tests = [
                {
                    src: [
                        {
                            unconditional: 'unconditional',
                            '?{{prop1}}=this': {
                                conditional: 'matched',
                            },
                            unconditional2: 'unconditional the second',
                            '?{{prop2}}=that': {
                                conditional2: '{{value2}}',
                            },
                        },
                        'hello {{prop1}}',
                        true,
                    ],
                    context: {
                        prop1: 'this',
                        prop2: 'that',
                        value2: 'templated conditional the second',
                    },
                    expected: [
                        {
                            unconditional: 'unconditional',
                            conditional: 'matched',
                            unconditional2: 'unconditional the second',
                            conditional2: 'templated conditional the second',
                        },
                        'hello this',
                        true,
                    ],
                },
            ];
            for (const t of tests) {
                const cjson = new ConditionalJsonConverter({ vars: t.context }).array();
                expect(cjson.convert(t.src)).toSucceedWith(t.expected);
            }
        });

        test('fails for valid non-arrays', () => {
            const tests = [
                {
                    src: 'hello {{prop}}',
                    expected: /cannot convert/i,
                },
                {
                    src: {
                        prop: 'hello {{prop}}',
                    },
                    expected: /cannot convert/i,
                },
            ];
            for (const t of tests) {
                const context = { prop: 'whatever' };
                const cjson = new ConditionalJsonConverter({ vars: context }).array();
                expect(cjson.convert(t.src)).toFailWith(t.expected);
            }
        });
    });
});
