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
import { JsonEditFailureReason, JsonPropertyEditFailureReason } from './jsonEditorRule';
import { JsonObjectMap, TemplateVars, TemplateVarsDeriveFunction, deriveTemplateVars } from '../jsonContext';

import { CompositeObjectMap } from '../objectMap';
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

export interface JsonEditorContext {
    vars?: TemplateVars;
    refs?: JsonObjectMap;
    deriveVars?: TemplateVarsDeriveFunction;
    validation?: JsonEditorValidationOptions;
}

type VariableTuple = [string, unknown];

export class JsonEditorState {
    public readonly editor: JsonEditor;

    public get context(): JsonEditorContext|undefined { return this._context; }
    protected readonly _context?: JsonEditorContext;
    protected readonly _deferred: JsonObject[] = [];

    public constructor(editor: JsonEditor, baseContext?: JsonEditorContext, runtimeContext?: JsonEditorContext) {
        this.editor = editor;
        this._context = JsonEditorState._getEffectiveContext(baseContext, runtimeContext);
    }

    protected static _getEffectiveContext(base?: JsonEditorContext, added?: JsonEditorContext): JsonEditorContext|undefined {
        if (base) {
            if (!added) {
                return base;
            }
            return {
                vars: added.vars ?? base.vars,
                refs: added.refs ?? base.refs,
                deriveVars: added.deriveVars ?? base.deriveVars,
                validation: {
                    onInvalidPropertyName: added.validation?.onInvalidPropertyName ?? base.validation?.onInvalidPropertyName ?? 'error',
                    onInvalidPropertyValue: added.validation?.onInvalidPropertyValue ?? base.validation?.onInvalidPropertyValue ?? 'error',
                    onUndefinedPropertyValue: added.validation?.onUndefinedPropertyValue ?? base.validation?.onUndefinedPropertyValue ?? 'ignore',
                },
            };
        }
        return added;
    }

    public defer(obj: JsonObject): void {
        this._deferred.push(obj);
    }

    public get deferred(): JsonObject[] {
        return this._deferred;
    }

    public getVars(defaultContext?: JsonEditorContext): TemplateVars|undefined {
        return this._context?.vars ?? defaultContext?.vars;
    }

    public getRefs(defaultContext?: JsonEditorContext): JsonObjectMap|undefined {
        return this._context?.refs ?? defaultContext?.refs;
    }

    public getContext(defaultContext?: JsonEditorContext): JsonEditorContext|undefined {
        return JsonEditorState._getEffectiveContext(defaultContext, this._context);
    }

    public extendVars(baseVars?: TemplateVars, addVars?: VariableTuple[]): Result<TemplateVars|undefined> {
        if (addVars && (addVars.length > 0)) {
            const derive = this._context?.deriveVars ?? deriveTemplateVars;
            return derive(baseVars, ...addVars);
        }
        return succeed(baseVars);
    }

    public extendRefs(baseRefs?: JsonObjectMap, addRefs?: JsonObjectMap[]): Result<JsonObjectMap|undefined> {
        if (addRefs && (addRefs.length > 0)) {
            const full = baseRefs ? [...addRefs, baseRefs] : [...addRefs];
            return CompositeObjectMap.create(full);
        }
        return succeed(baseRefs);
    }

    public extendContext(defaultContext: JsonEditorContext|undefined, add: { vars?: VariableTuple[], refs?: JsonObjectMap[] }): Result<JsonEditorContext|undefined> {
        const context = JsonEditorState._getEffectiveContext(this.getContext(defaultContext));
        return this.extendVars(context?.vars, add.vars).onSuccess((vars) => {
            return this.extendRefs(context?.refs, add.refs).onSuccess((refs) => {
                return succeed(JsonEditorState._getEffectiveContext(context, { refs, vars }));
            });
        });
    }

    public failValidation<T=JsonObject>(rule: JsonEditorValidationRules, message?: string): DetailedFailure<T, JsonEditFailureReason> {
        let detail: JsonPropertyEditFailureReason = 'error';
        switch (rule) {
            case 'invalidPropertyName':
                detail = (this._context?.validation?.onInvalidPropertyName !== 'ignore') ? 'error' : 'inapplicable';
                break;
            case 'invalidPropertyValue':
                detail = (this._context?.validation?.onInvalidPropertyValue !== 'ignore') ? 'error' : 'ignore';
                break;
            case 'undefinedPropertyValue':
                detail = (this._context?.validation?.onUndefinedPropertyValue !== 'error') ? 'ignore' : 'error';
                message = message ?? 'Cannot convert undefined to JSON';
                break;
        }
        return failWithDetail(message ?? rule, detail);
    }
}
