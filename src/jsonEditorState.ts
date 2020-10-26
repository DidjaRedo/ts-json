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

import { CompositeObjectMap, JsonObjectMap } from './objectMap';
import { Result, captureResult, succeed } from '@fgv/ts-utils';
import { TemplateContext, TemplateContextDeriveFunction, deriveTemplateContext } from './templateContext';

import { JsonEditor } from './jsonEditor';

export interface JsonEditorContext {
    vars?: TemplateContext;
    refs?: JsonObjectMap;
    deriveVars?: TemplateContextDeriveFunction;
}

type VariableTuple = [string, unknown];

export class JsonEditorState {
    public get context(): JsonEditorContext|undefined { return this._context; }

    protected readonly _editor: JsonEditor;
    protected readonly _context?: JsonEditorContext;

    public constructor(editor: JsonEditor, baseContext?: JsonEditorContext, runtimeContext?: JsonEditorContext) {
        this._editor = editor;
        this._context = JsonEditorState._getEffectiveContext(baseContext, runtimeContext);
    }

    public static create(editor: JsonEditor, baseContext?: JsonEditorContext, defaultContext?: JsonEditorContext): Result<JsonEditorState> {
        return captureResult(() => new JsonEditorState(editor, baseContext, defaultContext));
    }

    protected static _getEffectiveContext(base?: JsonEditorContext, added?: JsonEditorContext): JsonEditorContext|undefined {
        if (base) {
            if (!added) {
                return base;
            }
            return { ...base, ...added };
        }
        return added;
    }

    public getVars(defaultContext?: JsonEditorContext): TemplateContext|undefined {
        return this._context?.vars ?? defaultContext?.vars;
    }

    public getRefs(defaultContext?: JsonEditorContext): JsonObjectMap|undefined {
        return this._context?.refs ?? defaultContext?.refs;
    }

    public getContext(defaultContext?: JsonEditorContext): JsonEditorContext|undefined {
        return JsonEditorState._getEffectiveContext(defaultContext, this._context);
    }

    public extendVars(baseVars?: TemplateContext, addVars?: VariableTuple[]): Result<TemplateContext|undefined> {
        if (addVars && (addVars.length > 0)) {
            const derive = this._context?.deriveVars ?? deriveTemplateContext;
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
}
