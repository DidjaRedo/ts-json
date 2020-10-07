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
    DetailedResult,
    Result,
    allSucceed,
    captureResult,
    failWithDetail,
    propagateWithDetail,
    succeed,
} from '@fgv/ts-utils';
import { JsonObject, JsonValue } from './common';
import { TemplateContext, TemplateContextDeriver } from './templateContext';
import { JsonConverterOptions } from './jsonConverter';

export type ArrayContextCreator<TC=unknown> = (propName: string, propValue: string, context?: TC) => Result<TC>;

export type ArrayPropertyFailureReason = 'error'|'disabled'|'notAnArray';
export class ArrayPropertyParts {
    public readonly token: string;
    public readonly propertyVariable: string;
    public readonly propertyValues: string[];

    public constructor(token: string, propertyVariable: string, values: string[]) {
        this.token = token;
        this.propertyVariable = propertyVariable;
        this.propertyValues = values;
    }

    public static tryParse(token: string): DetailedResult<ArrayPropertyParts, ArrayPropertyFailureReason> {
        if (!token.startsWith('[[')) {
            return failWithDetail(`Not an array property: ${token}`, 'notAnArray');
        }

        const parts = token.substring(2).split(']]=');
        if (parts.length !== 2) {
            return failWithDetail(`Malformed array property: ${token}`, 'error');
        }

        const valueParts = parts[1].split(',');
        return propagateWithDetail(captureResult(() => new ArrayPropertyParts(token, parts[0], valueParts)), 'error');
    }
}

export class ArrayPropertyConverter extends BaseConverter<JsonObject, TemplateContext> {
    protected readonly _parts: ArrayPropertyParts;
    protected readonly _childConverter: Converter<JsonValue, TemplateContext>;
    protected readonly _options: JsonConverterOptions;
    protected readonly _deriveContext: TemplateContextDeriver;

    protected constructor(
        parts: ArrayPropertyParts,
        baseContext: TemplateContext|undefined,
        childConverter: Converter<JsonValue, TemplateContext>,
        options: JsonConverterOptions,
    ) {
        super((from, _self, context) => this._convert(from, context), baseContext);
        this._parts = parts;
        this._childConverter = childConverter;
        this._options = options;
        if (options.contextDeriver === undefined) {
            throw new Error(`${parts.token}: Cannot expand - no context mutation function`);
        }
        this._deriveContext = options.contextDeriver;
    }

    public static create(
        token: string,
        context: TemplateContext|undefined,
        converter: Converter<JsonValue, TemplateContext>,
        options: JsonConverterOptions,
    ): DetailedResult<ArrayPropertyConverter, ArrayPropertyFailureReason> {
        if (options.useArrayTemplateNames === false) {
            return failWithDetail(`${token}: array property names are disabled`, 'disabled');
        }

        return ArrayPropertyParts.tryParse(token).onSuccess((p) => {
            return ArrayPropertyConverter._create(p, context, converter, options);
        });
    }

    public static tryConvert(
        token: string,
        from: JsonValue,
        context: TemplateContext|undefined,
        converter: Converter<JsonValue, TemplateContext>,
        options: JsonConverterOptions,
    ): DetailedResult<JsonObject, ArrayPropertyFailureReason> {
        return ArrayPropertyConverter.create(token, context, converter, options).onSuccess((ap) => {
            return propagateWithDetail(ap.convert(from, context), 'error');
        });
    }

    protected static _create(
        property: ArrayPropertyParts,
        baseContext: TemplateContext|undefined,
        converter: Converter<JsonValue, TemplateContext>,
        options: JsonConverterOptions
    ): DetailedResult<ArrayPropertyConverter, ArrayPropertyFailureReason> {
        return propagateWithDetail(
            captureResult(() => new ArrayPropertyConverter(property, baseContext, converter, options)),
            'error'
        );
    }

    protected _convert(from: unknown, context?: TemplateContext): Result<JsonObject> {
        const json: JsonObject = {};

        return allSucceed(this._parts.propertyValues.map((pv) => {
            return this._deriveContext(context, [this._parts.propertyVariable, pv]).onSuccess((effectiveContext) => {
                return this._childConverter.convert(from, effectiveContext).onSuccess((value) => {
                    json[pv] = value;
                    return succeed(value);
                });
            });
        }), json);
    }
}
