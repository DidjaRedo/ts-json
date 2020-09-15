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
import { JsonConverterOptions, defaultJsonConverterOptions } from './jsonConverter';
import {
    JsonObject,
    JsonValue,
    isJsonObject,
    isJsonPrimitive,
} from './common';


import { JsonMerger } from './jsonMerger';
import Mustache from 'Mustache';
import { arrayOf } from '@fgv/ts-utils/converters';

/**
 * ConditionalJsonOptions to configure a ConditionalJson Converter
 */
export interface ConditionalJsonOptions extends JsonConverterOptions {
    /**
     * If onMalformedCondition is 'error' (default), any property name beginning with
     * '?' that cannot be parsed as a condition causes an error.  If onMalformedCondition
     * is 'ignore', unparseable names are preserved unconditionally.
     */
    onMalformedCondition: 'ignore'|'error';
}

/**
 * Default conditional JSON options:
 * - onMalformedCondition: 'error'
 */
export const defaultConditionalJsonOptions: ConditionalJsonOptions = {
    ...defaultJsonConverterOptions,
    onMalformedCondition: 'error',
};

interface JsonCondition {
    readonly isMatch: boolean;
    readonly isDefault: boolean;
}

class JsonMatchCondition implements JsonCondition {
    public readonly lhs: string;
    public readonly rhs: string;

    public constructor(lhs: string, rhs: string) {
        this.lhs = lhs;
        this.rhs = rhs;
    }

    public get isMatch(): boolean {
        return this.lhs === this.rhs;
    }

    public get isDefault(): boolean {
        return false;
    }
}

class JsonDefinedCondition implements JsonCondition {
    public readonly value: string;

    public constructor(value: string) {
        this.value = value.trim();
    }

    public get isMatch(): boolean {
        return (this.value.length > 0);
    }

    public get isDefault(): boolean {
        return false;
    }
}

class JsonDefaultCondition implements JsonCondition {
    public get isMatch(): boolean {
        return false;
    }

    public get isDefault(): boolean {
        return true;
    }
}

interface ConditionalJsonFragment {
    condition: JsonCondition;
    value: JsonObject;
}

/**
 * A ConditionalJson is a ts-utils Converter which applies optional templating
 * and then conditional flattening to a supplied unknown object.
 */
export class ConditionalJson extends BaseConverter<JsonValue> {
    protected _options: ConditionalJsonOptions;
    protected _merger: JsonMerger;

    /**
     * Create a new ConditionalJson converter with the supplied or default
     * options.
     * @param options Optional conditional json options
     */
    public constructor(options?: Partial<ConditionalJsonOptions>) {
        super((from) => this._convert(from));
        this._options = { ...defaultConditionalJsonOptions, ... (options ?? {}) };
        this._merger = new JsonMerger();

        if (this._options.templateContext === undefined) {
            this._options.useValueTemplates = false;
            this._options.useNameTemplates = false;
        }
    }

    /**
     * Creates a new ConditionalJson object with the supplied or default options.
     * @param options Success with a new ConditionalJson object on success, or Failure with
     * an informative message if creation fails.
     */
    public static create(options?: Partial<ConditionalJsonOptions>): Result<ConditionalJson> {
        return captureResult(() => new ConditionalJson(options));
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
        const pending: ConditionalJsonFragment[] = [];

        for (const prop in src) {
            // istanbul ignore else
            if (src.hasOwnProperty(prop)) {
                let resolvedProp = prop;
                if (this._options.useNameTemplates && this._isTemplateString(prop)) {
                    // resolve any templates in the property name
                    const renderResult = this._render(prop);
                    if (renderResult.isSuccess()) {
                        resolvedProp = renderResult.value;
                    }
                    else if (this._options.onMalformedCondition === 'error') {
                        return fail(`${prop}: ${renderResult.message}`);
                    }
                }

                const fragmentResult = this._tryParseConditionalFragment(resolvedProp, src[prop]);
                if (fragmentResult.isFailure()) {
                    return fail(fragmentResult.message);
                }
                else if (fragmentResult.value !== undefined) {
                    pending.push(fragmentResult.value);
                }
                else {
                    if (pending.length > 0) {
                        const result = this._emitPendingConditions(json, pending);
                        if (result.isFailure()) {
                            return fail(result.message);
                        }
                        pending.splice(0, pending.length);
                    }

                    const result = this.convert(src[prop]).onSuccess((v) => {
                        json[resolvedProp] = v;
                        return succeed(v);
                    });

                    if (result.isFailure() && (this._options.onInvalidProperty === 'error')) {
                        return fail(result.message);
                    }
                }
            }
        }

        if (pending.length > 0) {
            return this._emitPendingConditions(json, pending);
        }
        return succeed(json);
    }

    protected _emitPendingConditions(target: JsonObject, pending: ConditionalJsonFragment[]): Result<JsonObject> {
        let haveMatch = false;
        for (const fragment of pending) {
            if (fragment.condition.isDefault && haveMatch) {
                // we've emitted something, so ignore the default
                haveMatch = false;
            }
            else if (fragment.condition.isMatch || fragment.condition.isDefault) {
                // either a match or an unmatched default, so emit the body
                const result = this.convert(fragment.value).onSuccess((resolvedBody) => {
                    // should never happen due to guard above
                    // istanbul ignore else
                    if (isJsonObject(resolvedBody)) {
                        return this._merger.mergeInPlace(target, resolvedBody);
                    }
                    else {
                        return fail('Conditional fragment body must be an object.');
                    }
                });

                if (result.isFailure()) {
                    return fail(result.message);
                }

                haveMatch = fragment.condition.isMatch;
            }
        }
        return succeed(target);
    }

    protected _tryParseCondition(token: string): Result<JsonCondition|undefined> {
        if (token.startsWith('?')) {
            // ignore everything after any #
            token = token.split('#')[0].trim();

            if (token === '?default') {
                return succeed(new JsonDefaultCondition());
            }

            const parts = token.substring(1).split('=');
            if (parts.length === 2) {
                return succeed(new JsonMatchCondition(parts[0].trim(), parts[1].trim()));
            }
            else if (parts.length === 1) {
                return succeed(new JsonDefinedCondition(parts[0].trim()));
            }
            else if (this._options.onMalformedCondition === 'error') {
                return fail(`Malformed condition token ${token}`);
            }
        }
        return succeed(undefined);
    }

    protected _tryParseConditionalFragment(token: string, value: JsonValue): Result<ConditionalJsonFragment|undefined> {
        return this._tryParseCondition(token).onSuccess((condition) => {
            if (condition !== undefined) {
                if (!isJsonObject(value)) {
                    return fail(`${token}: value of conditional property must be a non-array object`);
                }
                return succeed({ condition, value });
            }
            return succeed(undefined);
        });
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
