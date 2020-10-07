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
  - [Templated JSON](#templated-json)
    - [Array Property Expansion](#array-property-expansion)
  - [Conditional JSON](#conditional-json)
    - [Conditional Match Properties](#conditional-match-properties)
    - [Defined Condition Properties](#defined-condition-properties)
    - [Default Condition Properties](#default-condition-properties)
    - [Comments for Uniqueness](#comments-for-uniqueness)
  - [Templating with Conditional JSON](#templating-with-conditional-json)
- [API](#api)
  - [Converters](#converters)
    - [Simple JSON Converter](#simple-json-converter)
    - [Templated JSON Converter](#templated-json-converter)
    - [Conditional JSON Converter](#conditional-json-converter)
  - [JSON Mergers](#json-mergers)
    - [mergeInPlace function](#mergeinplace-function)
    - [mergeAllInPlace function](#mergeallinplace-function)
    - [mergeNew function](#mergenew-function)
  - [JsonConverter class](#jsonconverter-class)
  - [ConditionalJson class](#conditionaljson-class)
  - [JsonMerger class](#jsonmerger-class)
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

### Templated JSON
*Templated JSON* is type-safe JSON, with [mustache](https://www.npmjs.com/package/mustache) template conversions applied to any string properties or keys using a supplied context.
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

#### Array Property Expansion
In a templated JSON object, a key of the form ```"[[name]]=value1,value2,...``` is expanded to multiple properties, one property per item in the comma-separated list that follows the equals sign.  Each property has the name of the corresponding list value, and the value of the property is resolved as templated JSON using a context with the property named inside of the square brackets assigned the list value being resolved.  For example:

```ts
    // with context:
    const context = {
        properties: ['first', 'second', 'third'],
    };

    // templated conversion of:
    const src = {
        '[[prop]]={{properties}}': {
            '{{prop}}Prop': '{{prop}} value',
        },
    };

    // yields
    const expected = {
        first: {
            firstProp: 'first value',
        },
        second: {
            secondProp: 'second value',
        },
        third: {
            thirdProp: 'third value',
        },
    };
```

The converter options for templated JSON allow for an override of the function that derives the context for each of the children, so it is possible to write a custom derivation function which sets different or additional values based on the
value passed in.

### Conditional JSON

*Conditional JSON* is *templated JSON*, but property names beginning with '?' reperesent conditional properties.

The value of any conditional property must be a JSON object. If the condition is satisfied, (a deep copy of) the children of the conditional property value are merged into the parent object. If the condition is not satisfied, the body is ignored.

#### Conditional Match Properties
Conditional match properties are identified by names of the form:
```ts
    '?value1=value2'
```
Where *value1* and *value2* are strings that do not include the equals sign. The condition is satisfied if *value2* and *value2* are identical. For example:
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

#### Defined Condition Properties
Defined condition properties are identified by names of the form:
```ts
    '?value'
```
Where *value* is any string, including the empty string.  The condition is satisfied if *value* is not-empty or whitespace. For example:
```ts
    {
        '?someValue': {
            conditional: 'conditional value',
        },
        unconditional: 'unconditional value',
    }
    // yields
    {
        conditional: 'condtional value',
        unconditional: 'unconditional value',
    }
```
but
```ts
    {
        '?': {
            conditional: 'conditional value',
        },
        unconditional: 'unconditional value',
    }
    // yields
    {
        unconditional: 'unconditional value',
    }
```

#### Default Condition Properties
The special conditional property *'?default'* is satisfied if none of the immediately preceding conditional properties match, otherwise it is omitted.  For example:
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

#### Comments for Uniqueness
In any conditional property name, anything that follows the first '#' character is ignored. This makes it possible to include multiple conditions that match the same value. For example:
```ts
    {
        '?this=this': {
            conditional: 'conditional 1',
        },
        unconditional: 'unconditional',
        '?this=this': {
            conditional: 'conditional 2'
        }
    }
```
is not valid JSON, because two properties have the same name, but:
```ts
    {
        '?this=this#1': {
            conditional: 'conditional 1',
        },
        unconditional: 'unconditional',
        '?this=this#2': {
            conditional: 'conditional 2'
        }
    }
    // is valid, and yields:
    {
        unconditional: 'unconditional',
        conditional: 'conditional 2',
    }
```

### Templating with Conditional JSON
Combined with [mustache](https://www.npmjs.com/package/mustache) templating, this conditional syntax allows simple and powerful generation or consumption of conditional JSON files.  For example, consider:
```ts
    {
        userName: '{{user}}',
        password: '{{pw}}',
        '?{{userType}}=admin': {
            rights: '...' // rights for admin
        },
        '?{{userType}}=bot': {
            rights: '...' // rights for bot
        }
        '?{{default}}': {
            rights: '...' // rights for normal user
        },
        '?{{externalId}}': {
            externalId: '{{externalId}}',
        }
    }
```
Given the context:
```ts
    {
        user: 'fred',
        pw: 'freds password',
        userType: 'admin',
        externalId: 'freds SSO credentials',
    }
```
Our example yields:
```ts
    {
        userName: 'fred',
        password: 'freds password',
        rights: '...', // rights for admin
        externalId: 'freds SSO credentials',
    }
```
But given the context:
```ts
    {
        user: 'r2d2',
        password: 'r2s pw',
        userType: 'bot',
    }
```
We get:
```ts
    {
        userName: 'r2d2',
        password: 'r2s pw',
        rights: '...', // rights for bot
    }
```

## API

### Converters

A convenience set of [ts-utils *Converters*](https://github.com/DidjaRedo/ts-utils/blob/master/README.md) and generators for the most common JSON conversions.

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

#### Templated JSON Converter

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

Use the *conditionalJson* converter to convert unknown to type-safe JSON, applying [mustache](https://www.npmjs.com/package/mustache) template conversions to any string properties or keys using the supplied context *and* merging or omitting conditional properties as appropriate.  For example:
```ts
    const config =     {
        userName: '{{user}}',
        password: '{{pw}}',
        '?{{userType}}=admin': {
            rights: '...' // rights for admin
        },
        '?{{userType}}=bot': {
            rights: '...' // rights for bot
        }
        '?{{default}}': {
            rights: '...' // rights for normal user
        },
        '?{{externalId}}': {
            externalId: '{{externalId}}',
        }
    };
    const context =     {
        user: 'fred',
        pw: 'freds password',
        userType: 'admin',
        externalId: 'freds SSO credentials',
    };

    const result = JsonConverters.conditionalJson(context).convert(config);
    // succeeds and yields
    {
        userName: 'fred',
        password: 'freds password',
        rights: '...', // rights for admin
        externalId: 'freds SSO credentials',
    }
```

### JSON Mergers
A convenience set of JSON merge functions.

#### mergeInPlace function
The *mergeInPlace* function takes a base object an object to be merged and updates the supplied base object with values from the merge object.  For example:
```ts
    const base = {
        property1: 'value 1',
        property2: 'value 2',
    };
    const merge = {
        property2: 'value 2A',
        property3: 'value 3A',
    };
    const result = JsonMergers.mergeInPlace(base, merge);
    // updates the base object and returns success with base object, which means
    // that both base and result.value have the shape:
    {
        property1: 'value 1',
        property2: 'value 2A',
        property3: 'value 3A',
    }
```

#### mergeAllInPlace function
The *mergeAllInPlace* function takes a base object and one or more objects to be merged, and updates the base object with values from each of the merge objects in the order supplied.  for example:
```ts
    const base = {
        property1: 'value 1',
        property2: 'value 2',
    };
    const mergeA = {
        property2: 'value 2A',
        property3: 'value 3A',
    };
    const mergeB = {
        property3: 'value 3B',
        property4: 'value 4B',
    };
    const result = JsonMergers.mergeInPlace(base, mergeA, mergeB);
    // updates the base object and returns success with base object, which means
    // that both base and result.value have the shape:
    {
        property1: 'value 1',
        property2: 'value 2A',
        property3: 'value 3B',
        property4: 'value 4B',
    }
```

#### mergeNew function
The *mergeNew* function takes a list of one or more objects to be merged and returns a new object which results from merging each of the objects in the order supplied.  For example:
```ts
    const base = {
        property1: 'value 1',
        property2: 'value 2',
    };
    const mergeA = {
        property2: 'value 2A',
        property3: 'value 3A',
    };
    const mergeB = {
        property3: 'value 3B',
        property4: 'value 4B',
    };
    const result = JsonMergers.mergeInPlace(base, mergeA, mergeB);
    // Returns success with a new object that has the shape:
    {
        property1: 'value 1',
        property2: 'value 2A',
        property3: 'value 3B',
        property4: 'value 4B',
    }
    // the original base variable is not affected
```

### JsonConverter class
The *JsonConverter* is a [ts-utils *Converter*](https://github.com/DidjaRedo/ts-utils/blob/master/README.md) that supports both templated- and simple-JSON conversion as described above but supports options to adapt the conversion behavior, e.g. to omit invalid values instead of failing.

### ConditionalJson class
The *ConditionalJson* class is [ts-utils *Converter*](https://github.com/DidjaRedo/ts-utils/blob/master/README.md) which converts conditional JSON as described above, but which supports additional options to adapt the conversion behavior.

### JsonMerger class
The *JsonMerger* class implements the JSON merge operations described above but supports additional options to adapt the merge behavior.
