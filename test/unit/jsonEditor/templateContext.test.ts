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
import { defaultExtendVars } from '../../../src/jsonContext';

describe('templateContext module', () => {
    describe('deriveTemplateContext function', () => {
        test('adds properties', () => {
            expect(defaultExtendVars({
                prop1: 'value 1',
                prop2: 'value 2',
            }, [['prop1', 'override 1'], ['prop3', 'new value 3']])).toSucceedAndSatisfy((ctx: Record<string, unknown>) => {
                expect(ctx.prop1).toEqual('override 1');
                expect(ctx.prop2).toEqual('value 2');
                expect(ctx.prop3).toEqual('new value 3');
            });
        });

        test('preserves and adds functions', () => {
            expect(defaultExtendVars({
                func1: () => 'value 1',
                func2: () => 'value 2',
            },
            [
                ['func2', () => 'override 2'],
                ['func3', () => 'new value 3'],
            ],
            )).toSucceedAndSatisfy((ctx: Record<string, unknown>) => {
                expect(typeof ctx.func1).toEqual('function');
                expect(typeof ctx.func2).toEqual('function');
                expect(typeof ctx.func3).toEqual('function');
                if (typeof ctx.func1 === 'function') {
                    expect(ctx.func1()).toEqual('value 1');
                }
                if (typeof ctx.func2 === 'function') {
                    expect(ctx.func2()).toEqual('override 2');
                }
                if (typeof ctx.func3 === 'function') {
                    expect(ctx.func3()).toEqual('new value 3');
                }
            });
        });

        test('populates an empty object if base context is undefined', () => {
            expect(defaultExtendVars(undefined, [['prop1', 123]])).toSucceedWith({
                prop1: 123,
            });
        });
    });
});
