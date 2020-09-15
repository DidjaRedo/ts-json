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

import {
    BaseConverter,
    Result,
    captureResult,
    fail,
    succeed,
} from '@fgv/ts-utils';
import { JsonObject, JsonValue, isJsonPrimitive } from './common';
import Mustache from 'mustache';
import { arrayOf } from '@fgv/ts-utils/converters';

export interface JsonConverterOptions {
    useValueTemplates: boolean;
    useNameTemplates: boolean;
    templateContext?: unknown;
    onInvalidProperty: 'error'|'ignore';
}

export const defaultConverterOptions: JsonConverterOptions = {
    useValueTemplates: true,
    useNameTemplates: true,
    onInvalidProperty: 'error',
};

export class JsonConverter extends BaseConverter<JsonValue> {
    protected _options: JsonConverterOptions;

    public constructor(options?: Partial<JsonConverterOptions>) {
        super((from) => this._convert(from));
        this._options = { ...defaultConverterOptions, ... (options ?? {}) };

        if (this._options.templateContext === undefined) {
            this._options.useValueTemplates = false;
            this._options.useNameTemplates = false;
        }
    }

    public static create(options?: Partial<JsonConverterOptions>): Result<JsonConverter> {
        return captureResult(() => new JsonConverter(options));
    }

    protected _convert(from: unknown): Result<JsonValue> {
        if (this._options.useValueTemplates && this._isTemplateString(from)) {
            return this._render(from);
        }

        if (isJsonPrimitive(from)) {
            return succeed(from);
        }

        if (typeof from !== 'object') {
            return fail(`Cannot convert ${JSON.stringify(from)} to JSON`);
        }

        if (Array.isArray(from)) {
            return arrayOf(this, 'failOnError').convert(from);
        }

        const src = from as JsonObject;
        const json: JsonObject = {};
        for (const prop in src) {
            // istanbul ignore else
            if (src.hasOwnProperty(prop)) {
                const result = this.convert(src[prop]).onSuccess((v) => {
                    if (this._options.useNameTemplates && this._isTemplateString(prop)) {
                        return (this._render(prop).onSuccess((targetProp) => {
                            json[targetProp] = v;
                            return succeed(v);
                        }));
                    }
                    json[prop] = v;
                    return succeed(v);
                });
                if (result.isFailure() && (this._options.onInvalidProperty === 'error')) {
                    return result;
                }
            }
        }
        return succeed(json);
    }

    protected _render(template: string): Result<string> {
        return captureResult(() => Mustache.render(template, this._options.templateContext));
    }

    protected _isTemplateString(from: unknown): from is string {
        if ((this._options.templateContext !== undefined) && (typeof from === 'string')) {
            return from.includes('{{');
        }
        return false;
    }
}
