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

import { JsonContext, JsonReferenceMap, TemplateVars, VariableValue, defaultExtendVars } from './jsonContext';
import { Result, captureResult, succeed } from '@fgv/ts-utils';
import { CompositeJsonMap } from './jsonReferenceMap';

export class JsonContextHelper {
    protected _context: JsonContext;

    public constructor(context: JsonContext) {
        this._context = context;
    }

    public static create(context: JsonContext): Result<JsonContextHelper> {
        return captureResult(() => new JsonContextHelper(context));
    }

    public static extendContextVars(baseContext: JsonContext|undefined, vars?: VariableValue[]): Result<TemplateVars|undefined> {
        if (vars && (vars.length > 0)) {
            const extend = baseContext?.extendVars ?? defaultExtendVars;
            return extend(baseContext?.vars ?? {}, vars);
        }
        return succeed(baseContext?.vars);
    }

    public static extendContextRefs(baseContext: JsonContext|undefined, refs?: JsonReferenceMap[]): Result<JsonReferenceMap|undefined> {
        if (refs && (refs.length > 0)) {
            const full = baseContext?.refs ? [...refs, baseContext?.refs] : refs;
            if (full.length > 0) {
                return CompositeJsonMap.create(full);
            }
        }
        return succeed(baseContext?.refs);
    }

    public static extendContext(baseContext: JsonContext|undefined, add: { vars?: VariableValue[], refs?: JsonReferenceMap[] }): Result<JsonContext|undefined> {
        return JsonContextHelper.extendContextVars(baseContext, add.vars || []).onSuccess((vars) => {
            return JsonContextHelper.extendContextRefs(baseContext, add.refs || []).onSuccess((refs) => {
                if (!vars && !refs && !baseContext?.extendVars) {
                    return succeed(undefined);
                }
                return succeed({ vars, refs, deriveVars: baseContext?.extendVars });
            });
        });
    }

    public static mergeContext(baseContext: JsonContext|undefined, add: JsonContext|undefined): Result<JsonContext|undefined> {
        if (baseContext) {
            if (add) {
                const rtrn: JsonContext = {
                    vars: add.vars ?? baseContext.vars,
                    refs: add.refs ?? baseContext.refs,
                };
                if (add.hasOwnProperty('extendVars')) {
                    rtrn.extendVars = add.extendVars;
                }
                else if (baseContext.hasOwnProperty('extendVars')) {
                    rtrn.extendVars = baseContext.extendVars;
                }
                return succeed(rtrn);
            }
            return succeed(baseContext);
        }
        return succeed(add);
    }

    public extendVars(vars: VariableValue[]): Result<TemplateVars|undefined> {
        return JsonContextHelper.extendContextVars(this._context, vars);
    }

    public extendRefs(refs: JsonReferenceMap[]): Result<JsonReferenceMap|undefined> {
        return JsonContextHelper.extendContextRefs(this._context, refs);
    }

    public extendContext(add: { vars?: VariableValue[], refs?: JsonReferenceMap[] }): Result<JsonContext|undefined> {
        return JsonContextHelper.extendContext(this._context, add);
    }
}
