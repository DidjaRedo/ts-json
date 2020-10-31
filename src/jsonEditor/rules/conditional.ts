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
import { JsonEditFailureReason, JsonEditorRuleBase, JsonPropertyEditFailureReason } from '../jsonEditorRule';
import { JsonEditorOptions, JsonEditorState } from '../jsonEditorState';
import { JsonObject, JsonValue, isJsonObject } from '../../common';

export interface ConditionalJsonKeyResult extends JsonObject {
    matchType: 'default'|'match';
}

export interface ConditionalJsonDeferredObject extends ConditionalJsonKeyResult{
    value: JsonValue;
}

export class ConditionalJsonEditorRule extends JsonEditorRuleBase {
    protected _defaultContext?: JsonEditorOptions;

    public constructor(context?: JsonEditorOptions) {
        super();
        this._defaultContext = context;
    }

    public static create(context?: JsonEditorOptions): Result<ConditionalJsonEditorRule> {
        return captureResult(() => new ConditionalJsonEditorRule(context));
    }

    public editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonPropertyEditFailureReason> {
        const result = this._tryParseCondition(key).onSuccess((deferred) => {
            if (isJsonObject(value)) {
                const rtrn: ConditionalJsonDeferredObject = { ...deferred, value };
                return succeedWithDetail(rtrn, 'deferred');
            }
            return failWithDetail<JsonObject, JsonPropertyEditFailureReason>(`${key}: conditional body must be object`, 'error');
        });

        if (result.isFailure() && (result.detail === 'error')) {
            return state.failValidation('invalidPropertyName', result.message);
        }

        return result;
    }

    public finalizeProperties(finalized: JsonObject[], _state: JsonEditorState): DetailedResult<JsonObject[], JsonEditFailureReason> {
        if (finalized.length > 1) {
            finalized = finalized.filter((o) => o.matchType === 'match');
        }
        if (finalized.length > 0) {
            return succeedWithDetail(finalized.map((o) => o.value).filter(isJsonObject), 'edited');
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    protected _tryParseCondition(token: string): DetailedResult<ConditionalJsonKeyResult, JsonPropertyEditFailureReason> {
        if (token.startsWith('?')) {
            // ignore everything after any #
            token = token.split('#')[0].trim();

            if (token === '?default') {
                return succeedWithDetail({ matchType: 'default' }, 'deferred');
            }

            const parts = token.substring(1).split('=');
            if (parts.length === 2) {
                if (parts[0].trim() !== parts[1].trim()) {
                    return failWithDetail(`Condition ${token} does not match`, 'ignore');
                }
                return succeedWithDetail({ matchType: 'match' }, 'deferred');
            }
            else if (parts.length === 1) {
                if (parts[0].trim().length === 0) {
                    return failWithDetail(`Condition ${token} does not match`, 'ignore');
                }
                return succeedWithDetail({ matchType: 'match' }, 'deferred');
            }
            else /*if (this._options.onInvalidPropertyName === 'error')*/ {
                return failWithDetail(`Malformed condition token ${token}`, 'error');
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }
}
