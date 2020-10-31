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
    Converter,
    Result,
    captureResult,
    fail,
    succeed,
} from '@fgv/ts-utils';
import { JsonArray, JsonObject, JsonValue, isJsonObject } from './common';
import {
    JsonObjectMap,
    TemplateVars,
    TemplateVarsExtendFunction,
    defaultExtendVars,
} from './jsonContext';

import { JsonEditor } from './jsonEditor/jsonEditor';
import { JsonEditorContext } from './jsonEditor/jsonEditorState';

/**
 * Conversion options for JsonConverter
 */
export interface JsonConverterOptions {
    /**
     * If true (default) and if template variables are supplied
     * then string property values will be rendered using
     * mustache and those variables. Otherwise string properties
     * are copied without modification.
     */
    useValueTemplates: boolean;

    /**
     * If true (default) and if template variables are supplied
     * then string property names will be rendered using
     * mustache and those variables. Otherwise string properties
     * are copied without modification.
     */
    useNameTemplates: boolean;

    /**
     * If true (default) and if a context derivation function is
     * supplied, then properties which match the array name
     * pattern will be expanded. Default matches useNameTemplates.
     */
    useArrayTemplateNames: boolean;

    /**
     * The variables (mustache view) used to render templated string names
     * and properties.  See the mustache documentation for details of mustache
     * syntax and the template view.
     */
    vars?: TemplateVars;

    /**
     * Method used to extend variables for children of an array node during
     * expansion.
     */
    extendVars?: TemplateVarsExtendFunction;

    /**
     * If true (default) and if a references map is supplied, then
     * references in the source object will be replaced with
     * the corresponding value from the map.
     */
    useReferences: boolean;

    /**
     * An optional object map used to insert any references in the
     * converted JSON.
     */
    refs?: JsonObjectMap;

    /**
     * If onInvalidPropertyName is 'error' (default) then any property name
     * that is invalid after template rendering causes an error and stops
     * conversion.  If onInvalidPropertyName is 'ignore', then names which
     * are invalid after template rendering are passed through unchanged.
     */
    onInvalidPropertyName: 'error'|'ignore';

    /**
     * If onInvalidPropertyVaule is 'error' (default) then any illegal
     * property value causes an error and stops conversion.  If
     * onInvalidPropertyValue is 'ignore' then any invalid property
     * values are silently ignored.
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

export function mergeDefaultJsonConverterOptions(partial?: Partial<JsonConverterOptions>): JsonConverterOptions {
    const options: JsonConverterOptions = {
        useValueTemplates: (partial?.vars !== undefined),
        useNameTemplates: (partial?.vars !== undefined),
        useArrayTemplateNames: (partial?.vars !== undefined) && ((partial?.hasOwnProperty('extendVars') !== true) || (partial?.extendVars !== undefined)),
        useReferences: (partial?.refs !== undefined),
        onInvalidPropertyName: 'error',
        onInvalidPropertyValue: 'error',
        onUndefinedPropertyValue: 'ignore',
        extendVars: defaultExtendVars,
        ... (partial ?? {}),
    };

    if (options.extendVars === undefined) {
        options.useArrayTemplateNames = false;
    }
    return options;
}

export function converterOptionsToEditor(options?: Partial<JsonConverterOptions>): Result<JsonEditor> {
    options = mergeDefaultJsonConverterOptions(options);
    const validation = {
        onInvalidPropertyName: options.onInvalidPropertyName ?? 'error',
        onInvalidPropertyValue: options.onInvalidPropertyValue ?? 'error',
        onUndefinedPropertyValue: options.onUndefinedPropertyValue ?? 'ignore',
    };
    return JsonEditor.create({ vars: options.vars, validation });
}

export abstract class JsonConverterBase extends BaseConverter<JsonValue, JsonEditorContext> {
    private _editor: JsonEditor;

    protected constructor(options?: Partial<JsonConverterOptions>) {
        const editor = converterOptionsToEditor(options).getValueOrThrow();

        super(
            (from, _self, context) => this._convert(from, context),
            editor.defaultContext,
        );
        this._editor = editor;
    }

    public object(): Converter<JsonObject, JsonEditorContext> {
        return this.map((jv) => {
            if (!isJsonObject(jv)) {
                return fail(`Cannot convert "${JSON.stringify(jv)}" to JSON object.`);
            }
            return succeed(jv);
        });
    }

    /**
     * Creates a new converter which ensures that the returned value is an array.
     */
    public array(): Converter<JsonArray, JsonEditorContext> {
        return this.map((jv) => {
            if ((!Array.isArray(jv)) || (typeof jv !== 'object')) {
                return fail(`Cannot convert "${JSON.stringify(jv)}" to JSON array.`);
            }
            return succeed(jv);
        });
    }

    protected _convert(from: unknown, context?: JsonEditorContext): Result<JsonValue> {
        return this._editor?.clone(from as JsonValue, context);
    }
}

/**
 * A ts-utils Converter from unknown to type-safe JSON, optionally rendering
 * any string property names or values using mustache with a supplied view.
 */
export class JsonConverter extends JsonConverterBase {
    /**
     * Constructs a new JsonConverter with supplied or default options
     * @param options Optional options to configure the converter
     */
    public constructor(options?: Partial<JsonConverterOptions>) {
        super(options);
    }

    /**
     * Creates a new converter.
     * @param options Optional options to conifgure the converter
     * @returns Success with a new JsonConverter on success, or Failure with an
     * informative message if an error occurs.
     */
    public static create(options?: Partial<JsonConverterOptions>): Result<JsonConverter> {
        return captureResult(() => new JsonConverter(options));
    }
}
