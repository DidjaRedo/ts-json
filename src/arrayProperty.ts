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
    fail,
    failWithDetail,
    propagateWithDetail,
    succeed,
} from '@fgv/ts-utils';
import { JsonObject, JsonValue, isJsonObject } from './common';

export type ArrayContextCreator<TC=unknown> = (propName: string, propValue: string, context?: TC) => Result<TC>;
export interface ArrayPropertyOptions<TC=unknown> {
    allowArrayProperties: boolean;
    contextCreator: ArrayContextCreator<TC>;
}

export function defaultObjectContextCreator(propName: string, propValue: string, context?: Record<string, unknown>): Result<Record<string, unknown>> {
    if (!isJsonObject(context)) {
        return fail(`Cannot mutate context "${JSON.stringify(context)}": not an object`);
    }
    const mutant = Object.create(context) as Record<string, unknown>;
    mutant[propName] = propValue;
    return succeed(mutant);
}

export function defaultArrayPropertyOptions<TC=unknown>(partial?: Partial<ArrayPropertyOptions<TC>>): ArrayPropertyOptions<TC> {
    if (partial?.contextCreator !== undefined) {
        return {
            allowArrayProperties: partial?.allowArrayProperties ?? true,
            contextCreator: partial.contextCreator,
        };
    }
    return { allowArrayProperties: false, contextCreator: () => fail('context creator not implemented') };
}

export type ArrayPropertyFailureReason = 'error'|'disabled'|'notAnArray';
export class ArrayProperty {
    public readonly propertyVariable: string;
    public readonly propertyValues: string[];

    public constructor(propertyVariable: string, values: string[]) {
        this.propertyVariable = propertyVariable;
        this.propertyValues = values;
    }

    public static tryParse(token: string): DetailedResult<ArrayProperty, ArrayPropertyFailureReason> {
        if (!token.startsWith('[[')) {
            return failWithDetail(`Not an array property: ${token}`, 'notAnArray');
        }

        const parts = token.substring(2).split(']]=');
        if (parts.length !== 2) {
            return failWithDetail(`Malformed array property: ${token}`, 'error');
        }

        const valueParts = parts[1].split(',');
        return propagateWithDetail(captureResult(() => new ArrayProperty(parts[0], valueParts)), 'error');
    }
}

export class ArrayPropertyConverter<TC=unknown> extends BaseConverter<JsonObject, TC> {
    protected readonly _property: ArrayProperty;
    protected readonly _propertyConverter: Converter<JsonValue, TC>;
    protected readonly _options: ArrayPropertyOptions<TC>;

    protected constructor(
        property: ArrayProperty,
        baseContext: TC,
        converter: Converter<JsonValue, TC>,
        options: ArrayPropertyOptions<TC>
    ) {
        super((from, _self, context) => this._convert(from, context), baseContext);
        this._property = property;
        this._propertyConverter = converter;
        this._options = options;
    }

    public static create<TC=undefined>(
        token: string,
        context: TC,
        converter: Converter<JsonValue, TC>,
        options?: Partial<ArrayPropertyOptions<TC>>,
    ): DetailedResult<ArrayPropertyConverter<TC>, ArrayPropertyFailureReason> {
        const effectiveOptions = defaultArrayPropertyOptions(options);
        if (effectiveOptions.allowArrayProperties !== true) {
            return failWithDetail(`${token}: Array properties disabled`, 'disabled');
        }

        return ArrayProperty.tryParse(token).onSuccess((p) => {
            return ArrayPropertyConverter._create(p, context, converter, effectiveOptions);
        });
    }

    protected static _create<TC=undefined>(
        property: ArrayProperty,
        baseContext: TC,
        converter: Converter<JsonValue, TC>,
        options: ArrayPropertyOptions<TC>
    ): DetailedResult<ArrayPropertyConverter<TC>, ArrayPropertyFailureReason> {
        return propagateWithDetail(
            captureResult(() => new ArrayPropertyConverter(property, baseContext, converter, options)),
            'error'
        );
    }

    protected _convert(from: unknown, context?: TC): Result<JsonObject> {
        const json: JsonObject = {};
        context = this._context(context);

        return allSucceed(this._property.propertyValues.map((pv) => {
            return this._options.contextCreator(this._property.propertyVariable, pv, context).onSuccess((context) => {
                return this._propertyConverter.convert(from, context).onSuccess((value) => {
                    json[pv] = value;
                    return succeed(value);
                });
            });
        }), json);
    }
}
