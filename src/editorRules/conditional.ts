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

import { DetailedResult, Result, captureResult, failWithDetail, succeedWithDetail } from '@fgv/ts-utils';
import { JsonEditFailureReason, JsonEditorRule } from '../jsonEditorRule';
import { JsonEditorContext, JsonEditorState } from '../jsonEditorState';
import { JsonObject, JsonValue, isJsonObject } from '../common';

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

/*
interface ConditionalJsonFragment {
    condition: JsonCondition;
    value: JsonObject;
}
*/

function tryParseCondition(token: string): DetailedResult<JsonCondition, JsonEditFailureReason> {
    if (token.startsWith('?')) {
        // ignore everything after any #
        token = token.split('#')[0].trim();

        if (token === '?default') {
            const condition = new JsonDefaultCondition();
            return condition.isMatch ? succeedWithDetail(condition) : failWithDetail('no match', 'ignore');
        }

        const parts = token.substring(1).split('=');
        if (parts.length === 2) {
            const condition = new JsonMatchCondition(parts[0].trim(), parts[1].trim());
            return condition.isMatch ? succeedWithDetail(condition) : failWithDetail('no match', 'ignore');
        }
        else if (parts.length === 1) {
            const condition = new JsonDefinedCondition(parts[0].trim());
            return condition.isMatch ? succeedWithDetail(condition) : failWithDetail('no match', 'ignore');
        }
        else /*if (this._options.onInvalidPropertyName === 'error')*/ {
            return failWithDetail(`Malformed condition token ${token}`, 'error');
        }
    }
    return failWithDetail('inapplicable', 'inapplicable');
}


export class ConditionalJsonEditorRule implements JsonEditorRule {
    protected _defaultContext?: JsonEditorContext;

    public constructor(context?: JsonEditorContext) {
        this._defaultContext = context;
    }

    public static create(context?: JsonEditorContext): Result<ConditionalJsonEditorRule> {
        return captureResult(() => new ConditionalJsonEditorRule(context));
    }

    public editProperty(key: string, value: JsonValue, _state: JsonEditorState): DetailedResult<JsonObject, JsonEditFailureReason> {
        return tryParseCondition(key).onSuccess((_condition) => {
            if (isJsonObject(value)) {
                return succeedWithDetail(value);
            }
            return failWithDetail(`${key}: conditional body must be object`, 'error');
        });
    }

    public editValue(_value: JsonValue, _state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason> {
        return failWithDetail('inapplicable', 'inapplicable');
    }
}
