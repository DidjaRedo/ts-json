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
    Converter,
    Result,
    captureResult,
    fail,
    succeed,
} from '@fgv/ts-utils';
import { JsonArray, JsonObject, JsonValue, isJsonObject, isJsonPrimitive } from './common';
import { TemplateContext, TemplateContextDeriveFunction, deriveTemplateContext } from './templateContext';

import { ArrayPropertyConverter } from './arrayProperty';
import { JsonMerger } from './jsonMerger';
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
     * If true (default) and if a context derivation function is
     * supplied, then properties which match the array name
     * pattern will be expanded.
     */
    useArrayTemplateNames: boolean;

    /**
     * The mustache view used to render string names and properties. If
     * undefined (default) then mustache template rendering is disabled.
     * See the mustache documentation for details of mustache syntax and
     * the template view.
     */
    templateContext?: TemplateContext;

    /**
     * Method used to derive context for children of an array node during
     * expansion. If undefined then array name expansion is disabled.
     */
    deriveContext?: TemplateContextDeriveFunction;

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

export function mergeDefaultJsonConverterOptions(partial?: Partial<JsonConverterOptions>): JsonConverterOptions {
    const options: JsonConverterOptions = {
        useValueTemplates: true,
        useNameTemplates: true,
        useArrayTemplateNames: true,
        onInvalidPropertyName: 'error',
        onInvalidPropertyValue: 'error',
        deriveContext: deriveTemplateContext,
        ... (partial ?? {}),
    };

    if (options.templateContext === undefined) {
        options.useValueTemplates = false;
        options.useNameTemplates = false;
    }

    if (options.deriveContext === undefined) {
        options.useValueTemplates = false;
    }
    return options;
}

export abstract class JsonConverterBase extends BaseConverter<JsonValue, TemplateContext> {
    protected _options: JsonConverterOptions;
    private _merger?: JsonMerger;

    protected constructor(options?: Partial<JsonConverterOptions>) {
        const effectiveOptions = mergeDefaultJsonConverterOptions(options);

        super(
            (from, _self, context) => this._convert(from, context),
            effectiveOptions.templateContext,
        );

        this._options = effectiveOptions;
    }

    public object(): Converter<JsonObject, TemplateContext> {
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
    public array(): Converter<JsonArray, TemplateContext> {
        return this.map((jv) => {
            if ((!Array.isArray(jv)) || (typeof jv !== 'object')) {
                return fail(`Cannot convert "${JSON.stringify(jv)}" to JSON array.`);
            }
            return succeed(jv);
        });
    }

    protected _resolvePropertyName(name: string, context?: TemplateContext): Result<string> {
        if (this._options.useNameTemplates && this._isTemplateString(name, context)) {
            // resolve any templates in the property name
            const renderResult = this._render(name, context);
            if (renderResult.isSuccess() && (renderResult.value.length > 0)) {
                return succeed(renderResult.value);
            }
            else if (this._options.onInvalidPropertyName === 'error') {
                if (renderResult.isFailure()) {
                    return fail(`${name}: cannot render name - ${renderResult.message}`);
                }
                return fail(`${name}: renders empty name`);
            }
        }
        return succeed(name);
    }

    protected _mergeProperty(sourceName: string, targetName: string, src: JsonObject, target: JsonObject, context?: TemplateContext): Result<JsonValue> {
        const arrayResult = ArrayPropertyConverter.tryConvert(targetName, src[sourceName], context, this, this._options);

        if (arrayResult.isSuccess()) {
            const mergeResult = this._mergeInPlace(target, arrayResult.value);
            if (mergeResult.isFailure()) {
                return fail(`${sourceName}: ${mergeResult.message}`);
            }
        }
        else if ((arrayResult.detail === 'error') && (this._options.onInvalidPropertyName === 'error')) {
            return fail(`${sourceName}: Invalid array property - ${arrayResult.message}`);
        }
        else {
            const result = this.convert(src[sourceName], context).onSuccess((v) => {
                target[targetName] = v;
                return succeed(v);
            });

            if (result.isFailure() && (this._options.onInvalidPropertyValue === 'error')) {
                return fail(`${sourceName}: cannot convert - ${result.message}`);
            }
        }

        return succeed(target);
    }

    protected _render(template: string, context?: TemplateContext): Result<string> {
        return captureResult(() => Mustache.render(template, context));
    }

    protected _isTemplateString(from: unknown, context?: TemplateContext): from is string {
        if ((context !== undefined) && (typeof from === 'string')) {
            return from.includes('{{');
        }
        return false;
    }

    protected _mergeInPlace(target: JsonObject, src: JsonObject): Result<JsonObject> {
        if (this._merger === undefined) {
            this._merger = new JsonMerger();
        }
        return this._merger.mergeInPlace(target, src);
    }

    protected abstract _convert(from: unknown, context?: TemplateContext): Result<JsonValue>;
}

/**
 * A ts-utils Converter from unknown to type-safe JSON, optionally rendering
 * any string property names or values using mustache with a supplied view.
 */
export class JsonConverter extends JsonConverterBase {
    /**
     * Constructs a new JsonConverter with supplied or default options
     * @param options Optional options to configure the converter
     */
    public constructor(options?: Partial<JsonConverterOptions>) {
        super(options);
    }

    public get defaultContext(): TemplateContext|undefined { return this._options.templateContext; }

    /**
     * Creates a new converter.
     * @param options Optional options to conifgure the converter
     * @returns Success with a new JsonConverter on success, or Failure with an
     * informative message if an error occurs.
     */
    public static create(options?: Partial<JsonConverterOptions>): Result<JsonConverter> {
        return captureResult(() => new JsonConverter(options));
    }

    /**
     * Converts an arbitrary JSON object using a supplied context in place of the default
     * supplied at construction time.
     * @param from The object to be converted
     * @param context The context to use
     */
    protected _convert(from: unknown, context?: TemplateContext): Result<JsonValue> {
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
                const result = this._resolvePropertyName(prop, context).onSuccess((resolvedName) => {
                    return this._mergeProperty(prop, resolvedName, src, json, context);
                });

                if (result.isFailure()) {
                    return result;
                }
            }
        }
        return succeed(json);
    }
}
