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

/**
 * Returned by the _tryMatch method of the @see ConditionalJsonEditorRule
 * to indicate whether a successful match was due to a matching condition
 * or a default value.
 */
export interface ConditionalJsonKeyResult extends JsonObject {
    matchType: 'default'|'match';
}

/**
 * On a successful match, the @see ConditionalJsonEditorRule stores a
 * ConditionalJsonDeferredObject describing the matching result, to
 * be resolved at finalization time.
 */
export interface ConditionalJsonDeferredObject extends ConditionalJsonKeyResult{
    value: JsonValue;
}

/**
 * The Conditional JSON editor rule evaluates properties with conditional keys,
 * omitting non-matching keys and merging keys that match, or default keys only
 * if no other keys match.
 *
 * The default syntax for a conditional key is:
 *    "?value1=value2" - matches if value1 and value2 are the same, is ignored otherwise.
 *    "?value" - matches if value is a non-empty, non-whitespace string. Is ignored otherwise.
 *    "?default" - matches only if no other conditional blocks in the same object were matched
 */
export class ConditionalJsonEditorRule extends JsonEditorRuleBase {
    protected _options?: JsonEditorOptions;

    /**
     * Creates a new ConditionalJsonEditorRule
     * @param options Optional options used for this rule
     */
    public constructor(options?: JsonEditorOptions) {
        super();
        this._options = options;
    }

    /**
     * Creates a new ConditionalJsonEditorRule
     * @param options Optional options used for this rule
     */
    public static create(options?: JsonEditorOptions): Result<ConditionalJsonEditorRule> {
        return captureResult(() => new ConditionalJsonEditorRule(options));
    }

    /**
     * Evaluates a property for conditional application.
     * @param key The key of the property to be considered
     * @param value The value of the property to be considered
     * @param state The editor state for the object being edited
     * @returns Returns Success with detail 'deferred' and a @see ConditionalJsonDeferredObject
     * for a matching or default key. Fails with detail 'ignore' for a non-matching
     * conditional and with detail 'error' if an error occurs. Otherwise fails
     * with detail 'inapplicable'.
     */
    public editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonPropertyEditFailureReason> {
        const result = this._tryParseCondition(key, state).onSuccess((deferred) => {
            if (isJsonObject(value)) {
                const rtrn: ConditionalJsonDeferredObject = { ...deferred, value };
                return succeedWithDetail(rtrn, 'deferred');
            }
            return failWithDetail<JsonObject, JsonPropertyEditFailureReason>(`${key}: conditional body must be object`, 'error');
        });

        if (result.isFailure() && (result.detail === 'error')) {
            return state.failValidation('invalidPropertyName', result.message, this._options?.validation);
        }

        return result;
    }

    /**
     * Finalizes any deferred conditional properties. If the only deferred property is
     * default, that property is emitted. Otherwise all matching properties are emitted.
     * @param finalized The deferred properties to be considered for merge
     * @param _state The editor state for the object being edited
     */
    public finalizeProperties(finalized: JsonObject[], _state: JsonEditorState): DetailedResult<JsonObject[], JsonEditFailureReason> {
        if (finalized.length > 1) {
            finalized = finalized.filter((o) => o.matchType === 'match');
        }
        if (finalized.length > 0) {
            return succeedWithDetail(finalized.map((o) => o.value).filter(isJsonObject), 'edited');
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    /**
     * Determines if a given property key is conditional. Derived classes can override this
     * method to use a different format for conditional properties.
     * @param key The key of the property to consider.
     * @param state The editor state of the object being edited.
     * @returns Success with detail 'deferred' and a @see ConditionalJsonKeyResult describing the
     * match for a default or matching conditional property.  Fails with detail 'ignore' for
     * a non-matching conditional property. Fails with detail 'error' if an error occurs
     * or with detail 'inapplicable' if the key does not represent a conditional property.
     */
    protected _tryParseCondition(key: string, state: JsonEditorState): DetailedResult<ConditionalJsonKeyResult, JsonPropertyEditFailureReason> {
        if (key.startsWith('?')) {
            // ignore everything after any #
            key = key.split('#')[0].trim();

            if (key === '?default') {
                return succeedWithDetail({ matchType: 'default' }, 'deferred');
            }

            const parts = key.substring(1).split('=');
            if (parts.length === 2) {
                if (parts[0].trim() !== parts[1].trim()) {
                    return failWithDetail(`Condition ${key} does not match`, 'ignore');
                }
                return succeedWithDetail({ matchType: 'match' }, 'deferred');
            }
            else if (parts.length === 1) {
                if (parts[0].trim().length === 0) {
                    return failWithDetail(`Condition ${key} does not match`, 'ignore');
                }
                return succeedWithDetail({ matchType: 'match' }, 'deferred');
            }
            else {
                const message = `Malformed condition token ${key}`;
                return state.failValidation('invalidPropertyName', message, this._options?.validation);
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }
}
