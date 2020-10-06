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

import { ArrayPropertyConverter, ArrayPropertyOptions } from './arrayProperty';
import {
    BaseConverter,
    Converter,
    Result,
    captureResult,
    fail,
    propagateWithDetail,
    succeed,
} from '@fgv/ts-utils';
import { JsonArray, JsonObject, JsonValue, isJsonObject, isJsonPrimitive } from './common';
import { JsonMerger } from './jsonMerger';
import Mustache from 'mustache';
import { arrayOf } from '@fgv/ts-utils/converters';

/**
 * Conversion options for JsonConverter
 */
export interface JsonConverterOptions<TC=unknown> extends Partial<ArrayPropertyOptions<TC>> {
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
    templateContext?: TC;

    /**
     * If onInvalidPropertyName is 'error' (default) then any property name
     * that is invalid after template rendering causes an error and stops
     * conversion.  If onInvalidPropertyName is 'ignore', then names which
     * are invalid after template rendering are passed through unchanged.
     */
    onInvalidPropertyName: 'error'|'ignore';

    /**
     * If onInvalidPropertyVaule is 'error' (default) then any illegal
     * property value causes an error and stops conversion.  If
     * onInvalidPropertyValue is 'ignore' then any invalid property
     * values are silently ignored.
     */
    onInvalidPropertyValue: 'error'|'ignore';
}

export abstract class JsonConverterBase<TC=unknown> extends BaseConverter<JsonValue, TC> {
    protected constructor(options?: Partial<JsonConverterOptions<TC|undefined>>) {
        super(
            (from, _self, context) => this._convert(from, context),
            options?.templateContext,
        );
    }

    public object(): Converter<JsonObject, TC> {
        return this.map((jv) => {
            if (!isJsonObject(jv)) {
                return fail(`Cannot convert "${JSON.stringify(jv)}" to JSON object.`);
            }
            return succeed(jv);
        });
    }

    /**
     * Creates a new converter which ensures that the returned value is an array.
     */
    public array(): Converter<JsonArray, TC> {
        return this.map((jv) => {
            if ((!Array.isArray(jv)) || (typeof jv !== 'object')) {
                return fail(`Cannot convert "${JSON.stringify(jv)}" to JSON array.`);
            }
            return succeed(jv);
        });
    }

    protected abstract _convert(from: unknown, context?: TC): Result<JsonValue>;
}

export function mergeDefaultJsonConverterOptions<TC>(partial?: Partial<JsonConverterOptions<TC>>): JsonConverterOptions<TC> {
    return {
        useValueTemplates: true,
        useNameTemplates: true,
        onInvalidPropertyName: 'error',
        onInvalidPropertyValue: 'error',
        allowArrayProperties: true,
        ... (partial ?? {}),
    };
}

/**
 * A ts-utils Converter from unknown to type-safe JSON, optionally rendering
 * any string property names or values using mustache with a supplied view.
 */
export class JsonConverter<TC=unknown> extends JsonConverterBase<TC> {
    protected _options: JsonConverterOptions<TC|undefined>;

    /**
     * Constructs a new JsonConverter with supplied or default options
     * @param options Optional options to configure the converter
     */
    public constructor(options?: Partial<JsonConverterOptions<TC|undefined>>) {
        super(options);

        this._options = mergeDefaultJsonConverterOptions(options);
        if (this._options.templateContext === undefined) {
            this._options.useValueTemplates = false;
            this._options.useNameTemplates = false;
        }
    }

    public get defaultContext(): TC|undefined { return this._options.templateContext; }

    /**
     * Creates a new converter.
     * @param options Optional options to conifgure the converter
     * @returns Success with a new JsonConverter on success, or Failure with an
     * informative message if an error occurs.
     */
    public static create<TC=unknown>(options?: Partial<JsonConverterOptions<TC|undefined>>): Result<JsonConverter<TC>> {
        return captureResult(() => new JsonConverter<TC>(options));
    }

    /**
     * Converts an arbitrary JSON object using a supplied context in place of the default
     * supplied at construction time.
     * @param from The object to be converted
     * @param context The context to use
     */
    protected _convert(from: unknown, context: TC|undefined): Result<JsonValue> {
        if (this._options.useValueTemplates && this._isTemplateString(from, context)) {
            return this._render(from, context);
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
                let resolvedProp = prop;

                if (this._options.useNameTemplates && this._isTemplateString(prop, context)) {
                    // resolve any templates in the property name
                    const renderResult = this._render(prop, context);
                    if (renderResult.isSuccess() && (renderResult.value.length > 0)) {
                        resolvedProp = renderResult.value;
                    }
                    else if (this._options.onInvalidPropertyName === 'error') {
                        if (renderResult.isFailure()) {
                            return fail(`${prop}: cannot render name - ${renderResult.message}`);
                        }
                        return fail(`${prop}: renders empty name`);
                    }
                }

                const arrayResult = ArrayPropertyConverter.create(resolvedProp, context, this, this._options).onSuccess((ap) => {
                    return propagateWithDetail(ap.convert(src[prop], context), 'error');
                });

                if (arrayResult.isSuccess()) {
                    const mergeResult = new JsonMerger().mergeInPlace(json, arrayResult.value);
                    if (mergeResult.isFailure()) {
                        return fail(`${prop}: ${mergeResult.message}`);
                    }
                }
                else if ((arrayResult.detail === 'error') && (this._options.onInvalidPropertyName === 'error')) {
                    return fail(`${prop}: Invalid array property - ${arrayResult.message}`);
                }
                else {
                    const result = this.convert(src[prop], context).onSuccess((v) => {
                        json[resolvedProp] = v;
                        return succeed(v);
                    });

                    if (result.isFailure() && (this._options.onInvalidPropertyValue === 'error')) {
                        return fail(`${prop}: cannot convert - ${result.message}`);
                    }
                }
            }
        }
        return succeed(json);
    }

    protected _render(template: string, context: TC|undefined): Result<string> {
        return captureResult(() => Mustache.render(template, context));
    }

    protected _isTemplateString(from: unknown, context: TC|undefined): from is string {
        if ((context !== undefined) && (typeof from === 'string')) {
            return from.includes('{{');
        }
        return false;
    }
}
