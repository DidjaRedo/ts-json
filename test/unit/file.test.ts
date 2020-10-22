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

import * as Converters from '@fgv/ts-utils/converters';

import {
    ItemNameTransformFunction,
    convertJsonDirectorySync,
    convertJsonDirectoryToMapSync,
    convertJsonFileSync,
    readJsonFileSync,
    writeJsonFileSync,
} from '../../src/file';
import {
    MockFileConfig,
    MockFileSystem,
} from '@fgv/ts-utils-jest/helpers/fsHelpers';

import fs from 'fs';
import { succeed } from '@fgv/ts-utils';

describe('JsonFile module', () => {
    const mockDate = new Date();
    const mockGoodPath = 'path/to/some/file.json';
    const mockGoodPayload = {
        someProperty: 'some value',
        prop: [1, 2],
        now: mockDate.toISOString(),
    };

    const mockBadPath = 'path/to/some/malformed.json';
    const mockFsConfig: MockFileConfig[] = [
        {
            path: mockGoodPath,
            payload: JSON.stringify(mockGoodPayload),
            writable: false,
        },
        {
            path: mockBadPath,
            payload: '{ bad json',
            writable: false,
        },
    ];

    describe('readJsonFileSync function', () => {
        test('returns a requested json file', () => {
            const mockFs = new MockFileSystem(mockFsConfig);
            const spies = mockFs.startSpies();
            expect(readJsonFileSync(mockGoodPath)).toSucceedWith(mockGoodPayload);
            expect(spies.read).toHaveBeenCalledTimes(1);
            spies.restore();
        });

        test('fails for malformed json', () => {
            const mockFs = new MockFileSystem(mockFsConfig);
            const spies = mockFs.startSpies();
            expect(readJsonFileSync(mockBadPath)).toFailWith(/unexpected token/i);
            expect(spies.read).toHaveBeenCalledTimes(1);
            spies.restore();
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

    describe('convertJsonFileSync function', () => {
        const mockConverter = Converters.object({
            someProperty: Converters.string,
            prop: Converters.arrayOf(Converters.number),
            now: Converters.isoDate,
        });
        const mockConverted = {
            ...mockGoodPayload,
            now: mockDate,
        };

        test('converts a well-formed JSON file', () => {
            const mockFs = new MockFileSystem(mockFsConfig);
            const spies = mockFs.startSpies();
            spies.clear();
            expect(convertJsonFileSync(mockGoodPath, mockConverter)).toSucceedWith(mockConverted);
            expect(spies.read).toHaveBeenCalledTimes(1);
            spies.restore();
        });
    });

    describe('convertJsonDirectorySync function', () => {
        interface Thing {
            name: string;
            optionalString?: string;
        }
        const thing = Converters.object<Thing>({
            name: Converters.string,
            optionalString: Converters.string,
        }, ['optionalString']);
        const options = { converter: thing };

        test('reads JSON files from a folder, ignoring non-JSON', () => {
            expect(convertJsonDirectorySync('test/unit/data/file/good', options)).toSucceedAndMatchSnapshot();
        });

        test('fails for a non-folder', () => {
            expect(convertJsonDirectorySync('test/unit/data/file/good/thing1.json', options)).toFailWith(/not a directory/i);
        });

        test('fails by default if any of the items in the folder fail conversion', () => {
            expect(convertJsonDirectorySync('test/unit/data/file/bad', options)).toFailWith(/bad3.json/i);
        });
    });

    describe('convertJsonDirectoryToMapSync function', () => {
        interface Thing {
            name: string;
            optionalString?: string;
        }
        const thing = Converters.object<Thing>({
            name: Converters.string,
            optionalString: Converters.string,
        }, ['optionalString']);
        const options = { converter: thing };

        test('reads JSON files from a folder, ignoring non-JSON', () => {
            expect(convertJsonDirectoryToMapSync('test/unit/data/file/good', options)).toSucceedAndMatchSnapshot();
        });

        test('applies a name transformation to the returned map if supplied', () => {
            const transformName: ItemNameTransformFunction<Thing> = (n, t) => {
                expect(t).toBeDefined();
                return succeed(`thing:${n}`);
            };
            const myOptions = { ...options, transformName };
            expect(convertJsonDirectoryToMapSync('test/unit/data/file/good', myOptions)).toSucceedAndMatchSnapshot();
        });

        test('fails for a non-folder', () => {
            expect(convertJsonDirectoryToMapSync('test/unit/data/file/good/thing1.json', options)).toFailWith(/not a directory/i);
        });

        test('fails by default if any of the items in the folder fail conversion', () => {
            expect(convertJsonDirectoryToMapSync('test/unit/data/file/bad', options)).toFailWith(/bad3.json/i);
        });
    });

    describe('writeJsonFileSync function', () => {
        test('saves to the requested json file', () => {
            const path = 'path/to/some/file.json';
            const payload = { someProperty: 'some value', prop: [1, 2] };
            const spy = jest.spyOn(fs, 'writeFileSync').mockImplementation((gotPath: unknown, gotPayload: unknown) => {
                if ((typeof gotPath !== 'string') || (typeof gotPayload !== 'string')) {
                    throw new Error('Mock implementation only accepts string');
                }
                expect(gotPath).toContain(path);
                expect(JSON.parse(gotPayload)).toEqual(payload);
            });

            expect(writeJsonFileSync(path, payload)).toSucceedWith(true);
            spy.mockRestore();
        });

        test('propagates an error', () => {
            const path = 'path/to/some/file.json';
            const payload = { someProperty: 'some value', prop: [1, 2] };
            const spy = jest.spyOn(fs, 'writeFileSync').mockImplementation((gotPath: unknown) => {
                if (typeof gotPath !== 'string') {
                    throw new Error('Mock implementation only accepts string');
                }
                expect(gotPath).toContain(path);
                throw new Error('Mock Error!');
            });

            expect(writeJsonFileSync(path, payload)).toFailWith(/mock error/i);
            spy.mockRestore();
        });
    });
});
