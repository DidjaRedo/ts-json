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
import { Result, captureResult } from '@fgv/ts-utils';

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
