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
    readJsonFileSync,
    writeJsonFileSync,
} from '../../src/file';

import fs from 'fs';

describe('JsonFile module', () => {
    describe('readJsonFilSync function', () => {
        test('returns a requested json file', () => {
            const path = 'path/to/some/file.json';
            const payload = { someProperty: 'some value', prop: [1, 2] };
            jest.spyOn(fs, 'readFileSync').mockImplementation((gotPath: unknown) => {
                if (typeof gotPath !== 'string') {
                    throw new Error('Mock implementation only accepts string');
                }
                expect(gotPath).toContain(path);
                return JSON.stringify(payload);
            });

            expect(readJsonFileSync(path)).toSucceedWith(payload);
        });

        test('propagates any error', () => {
            const path = 'path/to/some/file.json';
            jest.spyOn(fs, 'readFileSync').mockImplementation((gotPath: unknown) => {
                if (typeof gotPath !== 'string') {
                    throw new Error('Mock implementation only accepts string');
                }
                expect(gotPath).toContain(path);
                throw new Error('Mock Error!');
            });

            expect(readJsonFileSync(path)).toFailWith(/mock error/i);
        });
    });

    describe('writeJsonFileSync function', () => {
        test('saves to the requested json file', () => {
            const path = 'path/to/some/file.json';
            const payload = { someProperty: 'some value', prop: [1, 2] };
            jest.spyOn(fs, 'writeFileSync').mockImplementation((gotPath: unknown, gotPayload: unknown) => {
                if ((typeof gotPath !== 'string') || (typeof gotPayload !== 'string')) {
                    throw new Error('Mock implementation only accepts string');
                }
                expect(gotPath).toContain(path);
                expect(JSON.parse(gotPayload)).toEqual(payload);
            });

            expect(writeJsonFileSync(path, payload)).toSucceedWith(true);
        });

        test('propagates an error', () => {
            const path = 'path/to/some/file.json';
            const payload = { someProperty: 'some value', prop: [1, 2] };
            jest.spyOn(fs, 'writeFileSync').mockImplementation((gotPath: unknown) => {
                if (typeof gotPath !== 'string') {
                    throw new Error('Mock implementation only accepts string');
                }
                expect(gotPath).toContain(path);
                throw new Error('Mock Error!');
            });

            expect(writeJsonFileSync(path, payload)).toFailWith(/mock error/i);
        });
    });
});
