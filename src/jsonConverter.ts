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

/**
 * Conversion options for JsonConverter
 */
export interface JsonConverterOptions {
    /**
     * If true (default) and if a templateContext is supplied
     * then string property values will be rendered using
     * mustache and the templateContext. Otherwise string properties
     * are copied without modification.
     */
    useValueTemplates: boolean;

    /**
     * If true (default) and if a templateContext is supplied
     * then string property names will be rendered using
     * mustache and the templateContext. Otherwise string properties
     * are copied without modification.
     */
    useNameTemplates: boolean;

    /**
     * The mustache view used to render string names and properties. If
     * undefined (default) then mustache template rendering is disabled.
     * See the mustache documentation for details of mustache syntax and
     * the template view.
     */
    templateContext?: unknown;

    /**
     * If onInvalidProperty is 'error' (default) then any invalid property
     * value or name causes an error and stops conversion.  If onInvalidProperty
     * is 'ignore', then invalid properties are silently omitted.
     */
    onInvalidProperty: 'error'|'ignore';
}

/**
 * Default options for the JsonConverter
 */
export const defaultJsonConverterOptions: JsonConverterOptions = {
    useValueTemplates: true,
    useNameTemplates: true,
    onInvalidProperty: 'error',
};

/**
 * A ts-utils Converter from unknown to type-safe JSON, optionally rendering
 * any string property names or values using mustache with a supplied view.
 */
export class JsonConverter extends BaseConverter<JsonValue> {
    protected _options: JsonConverterOptions;

    /**
     * Constructs a new JsonConverter with supplied or default options
     * @param options Optional options to configure the converter
     */
    public constructor(options?: Partial<JsonConverterOptions>) {
        super((from) => this._convert(from));
        this._options = { ...defaultJsonConverterOptions, ... (options ?? {}) };

        if (this._options.templateContext === undefined) {
            this._options.useValueTemplates = false;
            this._options.useNameTemplates = false;
        }
    }

    /**
     * Creates a new converter.
     * @param options Optional options to conifgure the converter
     * @returns Success with a new JsonConverter on success, or Failure with an
     * informative message if an error occurs.
     */
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
