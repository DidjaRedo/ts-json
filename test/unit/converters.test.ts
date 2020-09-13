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

import * as JsonConverters from '../../src/converters';

describe('JsonConverters module', () => {
    describe('json converter', () => {
        test('converts valid json', () => {
            [
                'string',
                123,
                false,
                null,
                { stringVal: 'string', boolVal: true, numVal: 100 },
                {
                    stringVal: 'string',
                    subObject: {
                        stringVal: 'string',
                        boolVal: false,
                        nullVal: null,
                    },
                    array: ['string 1', 'string 2', 'string 3', 3],
                },
            ].forEach((t) => {
                expect(JsonConverters.json.convert(t)).toSucceedWith(t);
            });
        });

        test('fails on invalid json', () => {
            [
                undefined,
                {
                    func: () => true,
                },
                () => true,
                [() => 123],
            ].forEach((t) => {
                expect(JsonConverters.json.convert(t)).toFailWith(/cannot convert/i);
            });
        });
    });

    describe('templatedJson converter', () => {
        test('applies mustache templates to string values', () => {
            const src = {
                stringVal: 'Hello {{test}}',
                subObject: {
                    literal: 'This is a literal string',
                    subSubObject: {
                        hello: 'Hello {{subTest}}',
                    },
                },
            };
            const view = {
                test: 'Top Level Test',
                subTest: 'Nested Test',
            };
            const expected = {
                stringVal: `Hello ${view.test}`,
                subObject: {
                    literal: 'This is a literal string',
                    subSubObject: {
                        hello: `Hello ${view.subTest}`,
                    },
                },
            };
            expect(JsonConverters.templatedJson(view).convert(src)).toSucceedWith(expected);
        });
    });
});
