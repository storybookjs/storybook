/* eslint-disable @typescript-eslint/ban-types */
import {
  type PropDef,
  type PropDefaultValue,
  createSummaryValue,
  isTooLongForDefaultValueSummary,
} from 'storybook/internal/docs-tools';

import { isFunction, isPlainObject, isString } from 'es-toolkit/compat';
import type reactElementToJSXStringType from 'react-element-to-jsx-string';
// @ts-expect-error (this is needed, because our bundling prefers the `browser` field, but that yields CJS)
import reactElementToJSXStringRaw from 'react-element-to-jsx-string/dist/esm/index.js';

import { ELEMENT_CAPTION, FUNCTION_CAPTION, OBJECT_CAPTION } from '../captions';
import type { InspectionFunction } from '../inspection';
import { inspectValue } from '../inspection';
import { isHtmlTag } from '../isHtmlTag';
import { generateArray } from './generateArray';
import { generateObject } from './generateObject';
import { getPrettyElementIdentifier, getPrettyFuncIdentifier } from './prettyIdentifier';

const reactElementToJSXString = reactElementToJSXStringRaw as typeof reactElementToJSXStringType;

export type TypeResolver = (rawDefaultProp: any, propDef: PropDef) => PropDefaultValue;

export interface TypeResolvers {
  string: TypeResolver;
  object: TypeResolver;
  function: TypeResolver;
  default: TypeResolver;
}

function isReactElement(element: any): boolean {
  return element.$$typeof != null;
}

export function extractFunctionName(func: Function, propName: string): string | null {
  const { name } = func;

  // Comparison with the prop name is to discard inferred function names.
  if (name !== '' && name !== 'anonymous' && name !== propName) {
    return name;
  }

  return null;
}

const stringResolver: TypeResolver = (rawDefaultProp) => {
  return createSummaryValue(JSON.stringify(rawDefaultProp));
};

function generateReactObject(rawDefaultProp: any) {
  const { type } = rawDefaultProp;
  const { displayName } = type;

  const jsx = reactElementToJSXString(rawDefaultProp, {});

  if (displayName != null) {
    const prettyIdentifier = getPrettyElementIdentifier(displayName);

    return createSummaryValue(prettyIdentifier, jsx);
  }

  if (isString(type)) {
    // This is an HTML element.
    if (isHtmlTag(type)) {
      const jsxCompact = reactElementToJSXString(rawDefaultProp, { tabStop: 0 });
      const jsxSummary = jsxCompact.replace(/\r?\n|\r/g, '');

      if (!isTooLongForDefaultValueSummary(jsxSummary)) {
        return createSummaryValue(jsxSummary);
      }
    }
  }

  return createSummaryValue(ELEMENT_CAPTION, jsx);
}

const objectResolver: TypeResolver = (rawDefaultProp) => {
  if (isReactElement(rawDefaultProp) && rawDefaultProp.type != null) {
    return generateReactObject(rawDefaultProp);
  }

  if (isPlainObject(rawDefaultProp)) {
    const inspectionResult = inspectValue(JSON.stringify(rawDefaultProp));

    return generateObject(inspectionResult);
  }

  if (Array.isArray(rawDefaultProp)) {
    const inspectionResult = inspectValue(JSON.stringify(rawDefaultProp));

    return generateArray(inspectionResult);
  }

  return createSummaryValue(OBJECT_CAPTION);
};

const functionResolver: TypeResolver = (rawDefaultProp, propDef) => {
  let isElement = false;
  let inspectionResult;

  // Try to display the name of the component. The body of the component is omitted since the code has been transpiled.
  if (isFunction(rawDefaultProp.render)) {
    isElement = true;
  } else if (rawDefaultProp.prototype != null && isFunction(rawDefaultProp.prototype.render)) {
    isElement = true;
  } else {
    let innerElement;

    try {
      inspectionResult = inspectValue(rawDefaultProp.toString());

      const { hasParams, params } = inspectionResult.inferredType as InspectionFunction;
      if (hasParams) {
        // It might be a functional component accepting props.
        if (params.length === 1 && params[0].type === 'ObjectPattern') {
          innerElement = rawDefaultProp({});
        }
      } else {
        innerElement = rawDefaultProp();
      }

      if (innerElement != null) {
        if (isReactElement(innerElement)) {
          isElement = true;
        }
      }
    } catch (e) {
      // do nothing.
    }
  }

  const funcName = extractFunctionName(rawDefaultProp, propDef.name);
  if (funcName != null) {
    if (isElement) {
      return createSummaryValue(getPrettyElementIdentifier(funcName));
    }

    if (inspectionResult != null) {
      inspectionResult = inspectValue(rawDefaultProp.toString());
    }

    // @ts-expect-error (Converted from ts-ignore)
    const { hasParams } = inspectionResult.inferredType as InspectionFunction;

    return createSummaryValue(getPrettyFuncIdentifier(funcName, hasParams));
  }

  return createSummaryValue(isElement ? ELEMENT_CAPTION : FUNCTION_CAPTION);
};

const defaultResolver: TypeResolver = (rawDefaultProp) => {
  return createSummaryValue(rawDefaultProp.toString());
};

const DEFAULT_TYPE_RESOLVERS: TypeResolvers = {
  string: stringResolver,
  object: objectResolver,
  function: functionResolver,
  default: defaultResolver,
};

export function createTypeResolvers(customResolvers: Partial<TypeResolvers> = {}): TypeResolvers {
  return {
    ...DEFAULT_TYPE_RESOLVERS,
    ...customResolvers,
  };
}

// When react-docgen cannot provide a defaultValue we take it from the raw defaultProp.
// It works fine for types that are not transpiled. For the types that are transpiled, we can only provide partial support.
// This means that:
//   - The detail might not be available.
//   - Identifiers might not be "prettified" for all the types.
export function createDefaultValueFromRawDefaultProp(
  rawDefaultProp: any,
  propDef: PropDef,
  typeResolvers: TypeResolvers = DEFAULT_TYPE_RESOLVERS
): PropDefaultValue | null {
  try {
    // Keep the extra () otherwise it will fail for functions.
    switch (typeof rawDefaultProp) {
      case 'string':
        return typeResolvers.string(rawDefaultProp, propDef);
      case 'object':
        return typeResolvers.object(rawDefaultProp, propDef);
      case 'function': {
        return typeResolvers.function(rawDefaultProp, propDef);
      }
      default:
        return typeResolvers.default(rawDefaultProp, propDef);
    }
  } catch (e) {
    console.error(e);
  }

  return null;
}
