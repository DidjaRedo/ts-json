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
    TemplateVarsDeriveFunction,
    deriveTemplateVars,
} from './jsonContext';

import { JsonEditor } from './jsonEditor/jsonEditor';
import { JsonEditorContext } from './jsonEditor/jsonEditorState';

/**
 * Conversion options for JsonConverter
 */
export interface JsonConverterOptions {
    /**
     * If true (default) and if a templateContext is supplied
     * then string property values will be rendered using
     * mustache and the templateContext. Otherwise string properties
     * are copied without modification.
     */
    useValueTemplates: boolean;

    /**
     * If true (default) and if a templateContext is supplied
     * then string property names will be rendered using
     * mustache and the templateContext. Otherwise string properties
     * are copied without modification.
     */
    useNameTemplates: boolean;

    /**
     * If true and if a context derivation function is
     * supplied, then properties which match the array name
     * pattern will be expanded. Default matches useNameTemplates.
     */
    useArrayTemplateNames: boolean;

    /**
     * The mustache view used to render string names and properties. If
     * undefined (default) then mustache template rendering is disabled.
     * See the mustache documentation for details of mustache syntax and
     * the template view.
     */
    templateContext?: TemplateVars;

    /**
     * Method used to derive context for children of an array node during
     * expansion. If undefined then array name expansion is disabled.
     */
    deriveContext?: TemplateVarsDeriveFunction;

    /**
     * An optional object map used to insert any references in the
     * converted JSON.  If undefined, then reference expansion is
     * disabled.
     */
    referenceMap?: JsonObjectMap;

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

    onUndefinedPropertyValue: 'error'|'ignore';
}

export function mergeDefaultJsonConverterOptions(partial?: Partial<JsonConverterOptions>): JsonConverterOptions {
    const options: JsonConverterOptions = {
        useValueTemplates: (partial?.templateContext !== undefined),
        useNameTemplates: (partial?.templateContext !== undefined),
        useArrayTemplateNames: (partial?.templateContext !== undefined),
        onInvalidPropertyName: 'error',
        onInvalidPropertyValue: 'error',
        onUndefinedPropertyValue: 'ignore',
        deriveContext: deriveTemplateVars,
        ... (partial ?? {}),
    };

    if (options.deriveContext === undefined) {
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
    return JsonEditor.create({ vars: options.templateContext, validation });
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
