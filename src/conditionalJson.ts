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
import { JsonObject, JsonValue, isJsonObject, isJsonPrimitive } from './common';
import { JsonMerger } from './jsonMerger';
import { arrayOf } from '@fgv/ts-utils/converters';

export interface ConditionalJsonOptions {
    onMalformedCondition: 'ignore'|'error';
}

export const defaultConditionalJsonOptions: ConditionalJsonOptions = {
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

    public toString(): string {
        return `?${this.lhs}=${this.rhs}`;
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

export class ConditionalJson extends BaseConverter<JsonValue> {
    protected _options: ConditionalJsonOptions;
    protected _merger: JsonMerger;

    public constructor(options?: Partial<ConditionalJsonOptions>) {
        super((from) => this._convert(from));
        this._options = { ...defaultConditionalJsonOptions, ... (options ?? {}) };
        this._merger = new JsonMerger();
    }

    public static create(options?: Partial<ConditionalJsonOptions>): Result<ConditionalJson> {
        return captureResult(() => new ConditionalJson(options));
    }

    protected _convert(from: unknown): Result<JsonValue> {
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
                const fragmentResult = this._tryParseConditionalFragment(prop, src[prop]);
                if (fragmentResult.isFailure()) {
                    return fail(fragmentResult.message);
                }

                if (fragmentResult.value !== undefined) {
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
                        json[prop] = v;
                        return succeed(v);
                    });

                    if (result.isFailure()) {
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

    protected _isCondition(from: unknown): from is string {
        if (typeof from === 'string') {
            return from.startsWith('?');
        }
        return false;
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

    protected _tryParseCondition(token: string): JsonCondition|undefined {
        if (token.startsWith('?')) {
            if (token === '?default') {
                return new JsonDefaultCondition();
            }

            const parts = token.substring(1).split('=');
            if (parts.length === 2) {
                return new JsonMatchCondition(parts[0].trim(), parts[1].trim());
            }
        }
        return undefined;
    }

    protected _tryParseConditionalFragment(token: string, value: JsonValue): Result<ConditionalJsonFragment|undefined> {
        const condition = this._tryParseCondition(token);
        if (condition !== undefined) {
            if (!isJsonObject(value)) {
                return fail(`${token}: value of conditional property must be a non-array object`);
            }
            return succeed({ condition, value });
        }
        return succeed(undefined);
    }
}
