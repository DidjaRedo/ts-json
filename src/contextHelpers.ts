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

import { JsonContext, JsonObjectMap, TemplateVars, VariableValue, defaultExtendVars } from './jsonContext';
import { Result, captureResult, succeed } from '@fgv/ts-utils';
import { CompositeObjectMap } from './objectMap';

export class JsonContextHelper {
    protected _context: JsonContext;

    public constructor(context: JsonContext) {
        this._context = context;
    }

    public static create(context: JsonContext): Result<JsonContextHelper> {
        return captureResult(() => new JsonContextHelper(context));
    }

    public static extendContextVars(baseContext: JsonContext|undefined, vars: VariableValue[]): Result<TemplateVars|undefined> {
        if (vars.length > 0) {
            const extend = baseContext?.deriveVars ?? defaultExtendVars;
            return extend(baseContext?.vars ?? {}, vars);
        }
        return succeed(baseContext?.vars);
    }

    public static extendContextRefs(baseContext: JsonContext|undefined, refs: JsonObjectMap[]): Result<JsonObjectMap|undefined> {
        if (refs.length > 0) {
            const full = baseContext?.refs ? [...refs, baseContext?.refs] : refs;
            if (full.length > 0) {
                return CompositeObjectMap.create(full);
            }
        }
        return succeed(baseContext?.refs);
    }

    public static extendContext(baseContext: JsonContext|undefined, add: { vars?: VariableValue[], refs?: JsonObjectMap[] }): Result<JsonContext|undefined> {
        return JsonContextHelper.extendContextVars(baseContext, add.vars || []).onSuccess((vars) => {
            return JsonContextHelper.extendContextRefs(baseContext, add.refs || []).onSuccess((refs) => {
                if (!vars && !refs && !baseContext?.deriveVars) {
                    return succeed(undefined);
                }
                return succeed({ vars, refs, deriveVars: baseContext?.deriveVars });
            });
        });
    }

    public extendVars(vars: VariableValue[]): Result<TemplateVars|undefined> {
        return JsonContextHelper.extendContextVars(this._context, vars);
    }

    public extendRefs(refs: JsonObjectMap[]): Result<JsonObjectMap|undefined> {
        return JsonContextHelper.extendContextRefs(this._context, refs);
    }

    public extendContext(add: { vars?: VariableValue[], refs?: JsonObjectMap[] }): Result<JsonContext|undefined> {
        return JsonContextHelper.extendContext(this._context, add);
    }
}
