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

import * as fs from 'fs';
import * as path from 'path';
import { Converter, Result, captureResult, fail, mapResults, succeed } from '@fgv/ts-utils';

import { JsonValue } from './common';

/**
 * Convenience function to read type-safe JSON from a file
 * @param srcPath Path of the file to read
 */
export function readJsonFileSync(srcPath: string): Result<JsonValue> {
    return captureResult(() => {
        const fullPath = path.resolve(srcPath);
        const body = fs.readFileSync(fullPath, 'utf8').toString();
        return JSON.parse(body) as JsonValue;
    });
}

/**
 * Convenience function to read a JSON file and apply a supplied converter
 * @param srcPath Path of the file to read
 * @param converter Converter used to convert the file contents
 */
export function convertJsonFileSync<T>(srcPath: string, converter: Converter<T>): Result<T> {
    return readJsonFileSync(srcPath).onSuccess((json) => {
        return converter.convert(json);
    });
}

/**
 * Options for directory conversion
 * TODO: add filtering, allowed and excluded
 */
export interface DirectoryConvertOptions<T, TC=unknown> {
    /**
     * The converter used to convert incoming JSON objects
     */
    converter: Converter<T, TC>;
}

/**
 * Return value for one item in a directory conversion
 */
export interface ReadDirectoryItem<T> {
    /**
     * Relative name of the file that was processed
     */
    filename: string;

    /**
     * The payload of the file
     */
    item: T;
}

/**
 * Reads all JSON files from a directory and apply a supplied converter
 * @param srcPath The path of the folder to be read
 * @param options Options to control conversion and filtering
 */
export function convertJsonDirectorySync<T>(srcPath: string, options: DirectoryConvertOptions<T>): Result<ReadDirectoryItem<T>[]> {
    return captureResult<ReadDirectoryItem<T>[]>(() => {
        const fullPath = path.resolve(srcPath);
        if (!fs.statSync(fullPath).isDirectory()) {
            throw new Error(`${fullPath}: Not a directory`);
        }
        const files = fs.readdirSync(fullPath, { withFileTypes: true });
        const results = files.map((fi) => {
            if (fi.isFile() && (path.extname(fi.name) === '.json')) {
                const filePath = path.resolve(fullPath, fi.name);
                return convertJsonFileSync(filePath, options.converter).onSuccess((payload) => {
                    return succeed({
                        filename: fi.name,
                        item: payload,
                    });
                }).onFailure((message) => {
                    return fail(`${fi.name}: ${message}`);
                });
            }
            return undefined;
        }).filter((r): r is Result<ReadDirectoryItem<T>> => r !== undefined);
        return mapResults(results).getValueOrThrow();
    });
}

/**
 * Convenience function to write type-safe JSON to a file
 * @param srcPath Path of the file to write
 * @param value The JSON object to be written
 */
export function writeJsonFileSync(srcPath: string, value: JsonValue): Result<boolean> {
    return captureResult(() => {
        const fullPath = path.resolve(srcPath);
        fs.writeFileSync(fullPath, JSON.stringify(value, undefined, 2));
        return true;
    });
}
