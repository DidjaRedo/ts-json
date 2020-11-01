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
import {
    ConditionalJsonEditorRule,
    MultiValueJsonEditorRule,
    ReferenceJsonEditorRule,
    TemplatedJsonEditorRule,
} from './jsonEditor/rules';
import { JsonArray, JsonObject, JsonValue, isJsonObject } from './common';
import {
    JsonContext,
    JsonObjectMap,
    TemplateVars,
    TemplateVarsExtendFunction,
    defaultExtendVars,
} from './jsonContext';

import { JsonEditor } from './jsonEditor/jsonEditor';
import { JsonEditorOptions } from './jsonEditor/jsonEditorState';
import { JsonEditorRule } from './jsonEditor/jsonEditorRule';

/**
 * Conversion options for JsonConverter
 */
export interface JsonConverterOptions {
    /**
     * If true and if template variables are available,
     * then string property values will be rendered using
     * mustache and those variables. Otherwise string properties
     * are copied without modification.
     *
     * Defaults to true if vars are supplied with options,
     * false otherwise.
     */
    useValueTemplates: boolean;

    /**
     * If true and if template variables are available,
     * then string property names will be rendered using
     * mustache and those variables. Otherwise string properties
     * are copied without modification.
     *
     * Defaults to true if vars are supplied with options,
     * false otherwise.
     */
    useNameTemplates: boolean;

    /**
     * If true and if template variables are available,
     * then string property names will be considered for
     * conditionals.
     *
     * Default is to match useNameTemplates
     */
    useConditionalNames: boolean;

    /**
     * If true and if both template variables and a
     * context derivation function is available, then properties
     * which match the multi-value name pattern will be expanded.
     * Default matches useNameTemplates.
     *
     * Default is true unless extendVars is explicitly set to
     * undefined.
     */
    useMultiValueTemplateNames: boolean;

    /**
     * The variables (mustache view) used to render templated string names
     * and properties.  See the mustache documentation for details of mustache
     * syntax and the template view.
     */
    vars?: TemplateVars;

    /**
     * Method used to extend variables for children of an array node during
     * expansion. Default is to use a built-in extension function unless
     * extendVars is explicitly set to undefined.
     */
    extendVars?: TemplateVarsExtendFunction;

    /**
     * If true and if a references map is supplied, then
     * references in the source object will be replaced with
     * the corresponding value from the map.
     *
     * Default is true if refs are present in options, false
     * otherwise.
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

/**
 * Merges an optionally supplied partial set of options with the default
 * converter options, producing a fully-resolved set of ConverterOptions
 * and taking all dynamic rules into account (e.g. template usage enabled
 * if variables are supplied and disabled if not)
 * @param partial An optional partial @see JsonConverterOptions to be merged
 */
export function mergeDefaultJsonConverterOptions(partial?: Partial<JsonConverterOptions>): JsonConverterOptions {
    const haveVars = (partial?.vars !== undefined);
    const haveRefs = (partial?.refs !== undefined);
    const extender = partial?.hasOwnProperty('extendVars') ? partial.extendVars : defaultExtendVars;
    const haveExtender = (extender !== undefined);
    const namesDefault = (partial?.useNameTemplates ?? haveVars);

    const options: JsonConverterOptions = {
        useValueTemplates: partial?.useValueTemplates ?? haveVars,
        useNameTemplates: namesDefault,
        useConditionalNames: partial?.useConditionalNames ?? namesDefault,
        useMultiValueTemplateNames: partial?.useMultiValueTemplateNames ?? (haveExtender && namesDefault),
        useReferences: partial?.useMultiValueTemplateNames ?? haveRefs,
        onInvalidPropertyName: partial?.onInvalidPropertyName ?? 'error',
        onInvalidPropertyValue: partial?.onInvalidPropertyValue ?? 'error',
        onUndefinedPropertyValue: partial?.onUndefinedPropertyValue ?? 'ignore',
        extendVars: extender,
    };
    if (partial?.vars) {
        options.vars = partial?.vars;
    }
    if (partial?.refs) {
        options.refs = partial?.refs;
    }
    return options;
}

/**
 * Creates a new @see JsonContext using values supplied in an optional partial
 * @see JsonConverterOptions
 * @param partial Optional partial @see JsonConverterOptions used to populate the context
 */
export function contextFromConverterOptions(partial?: Partial<JsonConverterOptions>): JsonContext|undefined {
    const context: JsonContext = {};
    if (partial?.vars) {
        context.vars = partial?.vars;
    }
    if (partial?.refs) {
        context.refs = partial?.refs;
    }
    if (partial?.hasOwnProperty('extendVars')) {
        context.extendVars = partial?.extendVars;
    }
    return (context.vars || context.refs || context.extendVars) ? context : undefined;
}

/**
 * Creates a new @see JsonEditor from an optionally supplied partial @see JsonConverterOptions.
 * Expands supplied options with default values and constructs an editor with
 * matching configuration and defined rules.
 * @param partial Optional partial @see JsonConverterOptions used to create the editor
 */
export function converterOptionsToEditor(partial?: Partial<JsonConverterOptions>): Result<JsonEditor> {
    const converterOptions = mergeDefaultJsonConverterOptions(partial);
    const context = contextFromConverterOptions(partial);
    const validation = {
        onInvalidPropertyName: converterOptions.onInvalidPropertyName ?? 'error',
        onInvalidPropertyValue: converterOptions.onInvalidPropertyValue ?? 'error',
        onUndefinedPropertyValue: converterOptions.onUndefinedPropertyValue ?? 'ignore',
    };
    const editorOptions: JsonEditorOptions = { context, validation };

    const rules: JsonEditorRule[] = [];
    if (converterOptions.useNameTemplates || converterOptions.useValueTemplates) {
        const templateOptions = {
            ...editorOptions,
            useNameTemplates: converterOptions.useNameTemplates,
            useValueTemplates: converterOptions.useValueTemplates,
        };
        rules.push(new TemplatedJsonEditorRule(templateOptions));
    }
    if (converterOptions.useConditionalNames) {
        rules.push(new ConditionalJsonEditorRule(editorOptions));
    }
    if (converterOptions.useMultiValueTemplateNames) {
        rules.push(new MultiValueJsonEditorRule(editorOptions));
    }
    if (converterOptions.useReferences) {
        rules.push(new ReferenceJsonEditorRule(editorOptions));
    }

    return JsonEditor.create(editorOptions, rules);
}

/**
 * A thin wrapper to allow an arbitrary @see JsonEditor to be used via the
 * ts-utils @see Converter pattern.
 */
export class JsonEditorConverter extends BaseConverter<JsonValue, JsonContext> {
    private _editor: JsonEditor;

    /**
     * Constructs a new @see JsonEditorConverter which uses the supplied editor
     * @param editor
     */
    public constructor(editor: JsonEditor) {
        super(
            (from, _self, context) => this._convert(from, context),
            editor.options.context,
        );
        this._editor = editor;
    }

    /**
     * Constructs a new @see JsonEditorConverter which uses the supplied editor
     * @param editor
     */
    public createWithEditor(editor: JsonEditor): Result<JsonEditorConverter> {
        return captureResult(() => new JsonEditorConverter(editor));
    }

    /**
     * Gets a derived converter which fails if the resulting converted
     * @see JsonValue is not a @see JsonObject
     */
    public object(): Converter<JsonObject, JsonContext> {
        return this.map((jv) => {
            if (!isJsonObject(jv)) {
                return fail(`Cannot convert "${JSON.stringify(jv)}" to JSON object.`);
            }
            return succeed(jv);
        });
    }

    /**
     * Gets a derived converter which fails if the resulting converted
     * @see JsonValue is not a @see JsonArray
     */
    public array(): Converter<JsonArray, JsonContext> {
        return this.map((jv) => {
            if ((!Array.isArray(jv)) || (typeof jv !== 'object')) {
                return fail(`Cannot convert "${JSON.stringify(jv)}" to JSON array.`);
            }
            return succeed(jv);
        });
    }

    protected _convert(from: unknown, context?: JsonContext): Result<JsonValue> {
        return this._editor?.clone(from as JsonValue, context);
    }
}

/**
 * A ts-utils @see Converter from unknown to type-safe JSON, optionally rendering
 * any string property names or values using mustache with a supplied view.
 */
export class JsonConverter extends JsonEditorConverter {
    /**
     * Constructs a new JsonConverter with supplied or default options
     * @param options Optional options to configure the converter
     */
    public constructor(options?: Partial<JsonConverterOptions>) {
        const editor = converterOptionsToEditor(options).getValueOrThrow();
        super(editor);
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

export type TemplatedJsonConverterOptions = Omit<JsonConverterOptions, 'useNameTemplates'|'useValueTemplates'|'useMultivalueTemplateNmes'>;

/**
 * A ts-utils @see Converter from unknown to type-safe JSON with mustache
 * template rendering and multi-value property name rules enabled regardless
 * of initial context.
 */
export class TemplatedJsonConverter extends JsonEditorConverter {
    public static readonly templateOptions: Partial<JsonConverterOptions> = {
        useNameTemplates: true,
        useValueTemplates: true,
        useMultiValueTemplateNames: true,
        useConditionalNames: false,
    };

    /**
     * Constructs a new @see TemplatedJsonConverter with supplied or
     * default options
     * @param options Optional configuration or context for the converter
     */
    public constructor(options?: Partial<TemplatedJsonConverterOptions>) {
        options = { ...options, ...TemplatedJsonConverter.templateOptions };
        const editor = converterOptionsToEditor(options).getValueOrThrow();
        super(editor);
    }

    /**
     * Constructs a new @see TemplatedJsonConverter with supplied or
     * default options
     * @param options Optional configuration or context for the converter
     */
    public static create(options?: Partial<TemplatedJsonConverterOptions>): Result<JsonConverter> {
        return captureResult(() => new TemplatedJsonConverter(options));
    }
}

export type ConditionalJsonConverterOptions = Omit<TemplatedJsonConverterOptions, 'useConditionalNames'>;

/**
 * A ts-utils @see Converter from unknown to type-safe JSON with mustache
 * template rendering, multi-value property name and conditional property
 * name rules enabled regardless of initial context.
 */
export class ConditionalJsonConverter extends JsonEditorConverter {
    public static readonly conditionalOptions: Partial<JsonConverterOptions> = {
        ...TemplatedJsonConverter.templateOptions,
        useConditionalNames: true,
    };

    /**
     * Constructs a new @see ConditionalJsonConverter with supplied or
     * default options
     * @param options Optional configuration or context for the converter
     */
    public constructor(options?: Partial<ConditionalJsonConverterOptions>) {
        options = { ...options, ...ConditionalJsonConverter.conditionalOptions };
        const editor = converterOptionsToEditor(options).getValueOrThrow();
        super(editor);
    }

    /**
     * Constructs a new @see ConditionalJsonConverter with supplied or
     * default options
     * @param options Optional configuration or context for the converter
     */
    public static create(options?: Partial<ConditionalJsonConverterOptions>): Result<JsonConverter> {
        return captureResult(() => new ConditionalJsonConverter(options));
    }
}

export type RichJsonConverterOptions = Omit<ConditionalJsonConverterOptions, 'useReferences'>;

/**
 * A ts-utils @see Converter from unknown to type-safe JSON with mustache
 * template rendering, multi-value property name, conditional property
 * name, and external reference rules enabled regardless of initial context.
 */
export class RichJsonConverter extends JsonEditorConverter {
    public static readonly richOptions: Partial<JsonConverterOptions> = {
        ...ConditionalJsonConverter.conditionalOptions,
        useReferences: true,
    };

    /**
     * Constructs a new @see RichJsonConverter with supplied or
     * default options
     * @param options Optional configuration or context for the converter
     */
    public constructor(options?: Partial<RichJsonConverterOptions>) {
        options = { ...options, ...RichJsonConverter.richOptions };
        const editor = converterOptionsToEditor(options).getValueOrThrow();
        super(editor);
    }

    /**
     * Constructs a new @see RichJsonConverter with supplied or
     * default options
     * @param options Optional configuration or context for the converter
     */
    public static create(options?: Partial<RichJsonConverterOptions>): Result<JsonConverter> {
        return captureResult(() => new RichJsonConverter(options));
    }
}
