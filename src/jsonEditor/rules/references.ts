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

import { DetailedResult, Result, captureResult, fail, failWithDetail, succeedWithDetail } from '@fgv/ts-utils';
import { JsonEditFailureReason, JsonEditorRuleBase, JsonPropertyEditFailureReason } from '../jsonEditorRule';
import { JsonEditorOptions, JsonEditorState } from '../jsonEditorState';
import { JsonObject, JsonValue, isJsonObject, pickJsonObject } from '../../common';
import { JsonContext } from '../../jsonContext';

/**
 * The Reference JSON editor rule replaces property keys or values that match
 * some known object with a copy of that referenced object, formatted according
 * to the current context.
 *
 * A property key is matched if it matches any known referenceable value.
 * - If the value of the matched key is 'default', then the entire object is formatted
 *   with the current context, flattened and merged into the current object.
 * - If the value of the matched key is some other string, then the entire
 *   object is formatted with the current context, and the child of the resulting
 *   object at the specified path is flattened and merged into the current object.
 * - If the value of the matched key is an object, then the entire object is
 *   formatted with the current context extended to include any properties of
 *   that object, flattened, and merged into the current object.
 * - It is an error if the referenced value is not an object.
 *
 * Any property, array or literal value is matched if it matches any known
 * referenceable value. The referenced value is replaced by the referenced
 * value, formatted using the current editor context.
 */
export class ReferenceJsonEditorRule extends JsonEditorRuleBase {
    protected _options?: JsonEditorOptions;

    /**
     * Creates a new @see ReferenceJsonEditorRule.
     * @param options Optional configuration options for this rule
     */
    public constructor(options?: JsonEditorOptions) {
        super();
        this._options = options;
    }

    /**
     * Creates a new @see ReferenceJsonEditorRule.
     * @param options Optional configuration options for this rule
     */
    public static create(options?: JsonEditorOptions): Result<ReferenceJsonEditorRule> {
        return captureResult(() => new ReferenceJsonEditorRule(options));
    }

    /**
     * Evaluates a property for reference expansion.
     * @param key The key of the property to be considered
     * @param value The value of the property to be considered
     * @param state The editor state for the object being edited
     * @returns If the reference is successful, returns Success with a JsonObject to
     * be flattened and merged into the current object. Fails with detail 'inapplicable'
     * for non-reference keys or with detail 'error' if an error occurs.
     */
    public editProperty(key: string, value: JsonValue, state: JsonEditorState): DetailedResult<JsonObject, JsonPropertyEditFailureReason> {
        // istanbul ignore next
        const validation = this._options?.validation;
        // istanbul ignore next
        const refs = state.getRefs(this._options?.context);
        if (refs?.has(key)) {
            // need to apply any rules to the value before we evaluate it
            const cloneResult = state.editor.clone(value, state.context);
            if (cloneResult.isSuccess()) {
                value = cloneResult.value;
            }
            else {
                const message = `${key}: ${cloneResult.message}`;
                return state.failValidation('invalidPropertyName', message, validation);
            }

            const contextResult = this._extendContext(state, value);
            if (contextResult.isSuccess()) {
                const objResult = refs.getJsonObject(key, contextResult.value);
                // guarded by the has above so should never happen
                // istanbul ignore else
                if (objResult.isSuccess()) {
                    if ((typeof value !== 'string') || (value === 'default')) {
                        return succeedWithDetail<JsonObject, JsonEditFailureReason>(objResult.value, 'edited');
                    }
                    const pickResult = pickJsonObject(objResult.value, value);
                    if (pickResult.isFailure()) {
                        const message = `${key}: ${pickResult.message}`;
                        return state.failValidation('invalidPropertyName', message, validation);
                    }
                    return pickResult.withDetail('edited');
                }
                else if (objResult.detail !== 'unknown') {
                    const message = `${key}: ${objResult.message}`;
                    return state.failValidation('invalidPropertyName', message, validation);
                }
            }
            else {
                const message = `${key}: ${contextResult.message}`;
                return state.failValidation('invalidPropertyName', message, validation);
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    /**
     * Evaluates a property, array or literal value for reference replacement.
     * @param value The value to be evaluated
     * @param state The editor state for the object being edited
     */
    public editValue(value: JsonValue, state: JsonEditorState): DetailedResult<JsonValue, JsonEditFailureReason> {
        // istanbul ignore next
        const refs = state.getRefs(this._options?.context);

        if (refs && (typeof value === 'string')) {
            // istanbul ignore next
            const context = state.getContext(this._options?.context);
            const result = refs.getJsonValue(value, context);
            if (result.isSuccess()) {
                return succeedWithDetail(result.value, 'edited');
            }
            else if (result.detail === 'error') {
                return state.failValidation('invalidPropertyValue', result.message, this._options?.validation);
            }
        }
        return failWithDetail('inapplicable', 'inapplicable');
    }

    /**
     * Gets the template variables to use given the value of some property whose name matched a
     * resource plus the base template context.
     * @param supplied The string or object supplied in the source json
     * @param baseVars The context in effect at the point of resolution
     */
    protected _extendContext(state: JsonEditorState, supplied: JsonValue): Result<JsonContext|undefined> {
        const add: Record<string, unknown> = {};
        if (isJsonObject(supplied)) {
            add.vars = Object.entries(supplied);
        }
        else if (typeof supplied !== 'string') {
            return fail(`Invalid template path or context: "${JSON.stringify(supplied)}"`);
        }
        return state.extendContext(this._options?.context, add);
    }
}
