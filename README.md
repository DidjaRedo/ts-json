<div align="center">
  <h1>ts-json</h1>
  Typescript Utilities for JSON
</div>

<hr/>

## Summary

Assorted JSON-related typescript utilities that I'm tired of copying from project to project. 

---
- [Summary](#summary)
- [Installation](#installation)
- [Overview](#overview)
  - [Type-Safe JSON](#type-safe-json)
  - [Converters](#converters)
    - [Simple JSON Converter](#simple-json-converter)
    - [Temlating JSON Converter](#temlating-json-converter)
    - [Conditional JSON Converter](#conditional-json-converter)
## Installation

With npm:
```sh
npm install ts-json
```

## Overview

### Type-Safe JSON
A handful of types express valid JSON as typescript types:
```ts
type JsonPrimitive = boolean | number | string | null;
interface JsonObject { [key: string]: JsonValue }
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
interface JsonArray extends Array<JsonValue> { }
```

### Converters

A convenience set of [ts-utils](https://github.com/DidjaRedo/ts-utils/blob/master/README.md) *Converter*s for the most common JSON conversions.

#### Simple JSON Converter

Use the *json* converter to convert unknown to type-safe JSON. Fails if the value to be converted is not valid JSON.
```ts
    import * as JsonConverters from '@fgv/ts-json/converters';

    const result = JsonConverters.json.convert(someUnknown);
    if (result.isSuccess()) {
        // someUnknown was valid JSON
        // jsonResult.value is a JsonValue deep copy of someUnknown
    }
    else {
        // someUnknown was not valid JSON
        // jsonResult.message describes the error
    }
```

#### Temlating JSON Converter

Use the *templatedJson* converter to convert unknown to type-safe JSON, applying [mustache](https://www.npmjs.com/package/mustache) template conversions to any string properties or keys using the supplied context.
```ts
    const src = {
        '{{prop}}': '{{value}}',
        literalValue: 'literal',
    };

    const result = JsonConverters.templatedJson({ prop: 'someProp', value: 'some value' }).convert(src);
    // result.value is {
    //    someProp: 'some value',
    //    litealValue: 'literal',
    // }
```

#### Conditional JSON Converter

Use the *conditionalJson* converter to convert unknown to type-safe JSON, applying mustach template conversions to any string properties or keys using the supplied context *and* merging or omitting conditional properties as appropriate.

Conditional properties are identified by names that begin with '?' and have the form:
```ts
    '?value1=value2'
```
Where *value1* and *value2* are strings that do not include the equals sign. The value of a conditional property must be a JSON object.  If *value1* matches *value2*, the body of the property value is merged into the parent.  If *value1* does not match *value2*, the property is omitted.  For example:
```ts
    {
        '?someValue=someValue': {
            conditional1: 'conditional value 1',
        },
        '?someValue=someOtherValue': {
            conditional2: 'conditional value 2',
        }
        unconditional: true,
    }
    // yields
    {
        conditional1: 'conditional value 1',
        unconditional: true,
    }
```

The special conditional property *'?default'* matches if none of the immediately preceding conditional properties match, otherwise it is omitted.  For example:
```ts
    {
        '?someValue=someOtherValue': {
            conditional1: 'conditional value 1',
        },
        '?default': {
            conditional1: 'default conditional value',
        }
    }
    // yields
    {
        conditional1: 'default conditional value',
    }
```
but
```ts
    {
        '?someValue=someValue': {
            conditional1: 'conditional value 1',
        },
        '?default': {
            conditional1: 'default conditional value',
        }
    }
    // yields
    {
        conditional1: 'conditional value 1',
    }
```

Combined with [mustache](https://www.npmjs.com/package/mustache) templating, this syntax allows simple and powerful generation or consumption of conditional JSON files.  For example:
