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

import { DetailedFailure, Result, failWithDetail, succeed } from '@fgv/ts-utils';
import { JsonContext, JsonReferenceMap, TemplateVars, VariableValue } from '../jsonContext';
import { JsonEditFailureReason, JsonPropertyEditFailureReason } from './jsonEditorRule';

import { JsonContextHelper } from '../contextHelpers';
import { JsonEditor } from './jsonEditor';
import { JsonObject } from '../common';

export type JsonEditorValidationRules = 'invalidPropertyName'|'invalidPropertyValue'|'undefinedPropertyValue';

export interface JsonEditorValidationOptions {
    /**
     * If onInvalidPropertyName is 'error' (default) then any property name
     * that is invalid after template rendering causes an error and stops
     * conversion.  If onInvalidPropertyName is 'ignore', then names which
     * are invalid after template rendering are passed through unchanged.
     */
    onInvalidPropertyName: 'error'|'ignore';

    /**
     * If onInvalidPropertyValue is 'error' (default) then any illegal
     * property value other than undefined causes an error and stops
     * conversion.  If onInvalidPropertyValue is 'ignore' then any
     * invalid property values are silently ignored.
     */
    onInvalidPropertyValue: 'error'|'ignore';

    /**
     * If onUnknownPropertyValue is error, then any property with
     * value undefined will cause an error and stop conversion.  If
     * onUndefinedPropertyValue is 'ignore' (default) then any
     * property with value undefined is silently ignored.
     */
    onUndefinedPropertyValue: 'error'|'ignore';
}

export interface JsonEditorOptions {
    context?: JsonContext;
    validation: JsonEditorValidationOptions;
}

export class JsonEditorState {
    protected static _nextId = 0;

    public readonly editor: JsonEditor;

    public get context(): JsonContext|undefined { return this.options.context; }
    public readonly options: JsonEditorOptions;
    protected readonly _deferred: JsonObject[] = [];
    protected readonly _id: number;

    public constructor(editor: JsonEditor, baseOptions: JsonEditorOptions, runtimeContext?: JsonContext) {
        this.editor = editor;
        this.options = JsonEditorState._getEffectiveOptions(baseOptions, runtimeContext).getValueOrThrow();
        this._id = JsonEditorState._nextId++;
    }

    protected static _getEffectiveOptions(options: JsonEditorOptions, context?: JsonContext): Result<JsonEditorOptions> {
        if (!context) {
            return succeed(options);
        }
        return JsonContextHelper.mergeContext(options.context, context).onSuccess((merged) => {
            return succeed({ context: merged, validation: options.validation });
        });
    }

    public defer(obj: JsonObject): void {
        this._deferred.push(obj);
    }

    public get deferred(): JsonObject[] {
        return this._deferred;
    }

    public getVars(defaultContext?: JsonContext): TemplateVars|undefined {
        return this.options.context?.vars ?? defaultContext?.vars;
    }

    public getRefs(defaultContext?: JsonContext): JsonReferenceMap|undefined {
        return this.options.context?.refs ?? defaultContext?.refs;
    }

    public getContext(defaultContext?: JsonContext): JsonContext|undefined {
        return JsonContextHelper.mergeContext(defaultContext, this.options.context).getValueOrDefault();
    }

    public extendContext(baseContext: JsonContext|undefined, add: { vars?: VariableValue[], refs?: JsonReferenceMap[] }): Result<JsonContext|undefined> {
        const context = this.getContext(baseContext);
        return JsonContextHelper.extendContext(context, add);
    }

    public failValidation<T=JsonObject>(
        rule: JsonEditorValidationRules,
        message?: string,
        validation?: JsonEditorValidationOptions,
    ): DetailedFailure<T, JsonEditFailureReason> {
        let detail: JsonPropertyEditFailureReason = 'error';
        const effective = validation ?? this.options.validation;
        switch (rule) {
            case 'invalidPropertyName':
                detail = (effective.onInvalidPropertyName !== 'ignore') ? 'error' : 'inapplicable';
                break;
            case 'invalidPropertyValue':
                detail = (effective.onInvalidPropertyValue !== 'ignore') ? 'error' : 'ignore';
                break;
            case 'undefinedPropertyValue':
                detail = (effective.onUndefinedPropertyValue !== 'error') ? 'ignore' : 'error';
                // istanbul ignore next
                message = message ?? 'Cannot convert undefined to JSON';
                break;
        }
        // istanbul ignore next
        return failWithDetail(message ?? rule, detail);
    }
}
