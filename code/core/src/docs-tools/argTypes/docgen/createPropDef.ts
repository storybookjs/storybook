import { convert } from '../convert/index.ts';
import type { JsDocParsingResult } from '../jsdocParser.ts';
import { createSummaryValue } from '../utils.ts';
import type { JsDocParam, PropDefaultValue } from './PropDef.ts';
import { createFlowPropDef } from './flow/createPropDef.ts';
import { createTsPropDef } from './typeScript/createPropDef.ts';
import type { DocgenInfo, DocgenPropDefaultValue, DocgenType, PropDef } from './types.ts';
import { TypeSystem } from './types.ts';
import { isDefaultValueBlacklisted } from './utils/defaultValue.ts';

export type PropDefFactory = (
  propName: string,
  docgenInfo: DocgenInfo,
  jsDocParsingResult?: JsDocParsingResult
) => PropDef;

function createType(type: DocgenType) {
  // A type could be null if a defaultProp has been provided without a type definition.
  // `detail` is optional named-type display text; pass it only when present so producers that
  // never set it keep the exact summary-only shape (no `detail: undefined` key).
  return type != null
    ? type.detail
      ? createSummaryValue(type.name, type.detail)
      : createSummaryValue(type.name)
    : null;
}

// A heuristic to tell if a defaultValue comes from RDT
function isReactDocgenTypescript(defaultValue: DocgenPropDefaultValue) {
  const { computed, func } = defaultValue;
  return typeof computed === 'undefined' && typeof func === 'undefined';
}

function isStringValued(type?: DocgenType) {
  if (!type) {
    return false;
  }

  if (type.name === 'string') {
    return true;
  }

  if (type.name === 'enum') {
    return (
      Array.isArray(type.value) &&
      type.value.every(
        ({ value: tv }) => typeof tv === 'string' && tv[0] === '"' && tv[tv.length - 1] === '"'
      )
    );
  }

  // The component-meta engine's normalized enum emission carries the member literals in the
  // type name (the shape react-docgen-typescript emits); same string-member semantics as the
  // `enum` shape above.
  if (typeof type.name === 'string' && type.name.includes('|')) {
    const parts = type.name.split('|').map((part) => part.trim());
    return parts.length > 0 && parts.every((part) => part.startsWith('"') && part.endsWith('"'));
  }

  return false;
}

function createDefaultValue(
  defaultValue: DocgenPropDefaultValue,
  type: DocgenType
): PropDefaultValue | null {
  if (defaultValue != null) {
    const { value } = defaultValue;

    if (!isDefaultValueBlacklisted(value)) {
      // Work around a bug in `react-docgen-typescript-loader`, which returns 'string' for a string
      // default, instead of "'string'" -- which is incorrect
      if (isReactDocgenTypescript(defaultValue) && isStringValued(type)) {
        return createSummaryValue(JSON.stringify(value));
      }

      return createSummaryValue(value);
    }
  }

  return null;
}

function createBasicPropDef(name: string, type: DocgenType, docgenInfo: DocgenInfo): PropDef {
  const { description, required, defaultValue } = docgenInfo;

  return {
    name,
    type: createType(type),
    required,
    description,
    defaultValue: createDefaultValue(defaultValue, type),
  };
}

function applyJsDocResult(propDef: PropDef, jsDocParsingResult?: JsDocParsingResult): PropDef {
  if (jsDocParsingResult?.includesJsDoc) {
    const { description, extractedTags } = jsDocParsingResult;

    if (description != null) {
      propDef.description = jsDocParsingResult.description;
    }

    const value = {
      ...extractedTags,
      params: extractedTags?.params?.map(
        (x): JsDocParam => ({
          name: x.getPrettyName(),
          description: x.description,
        })
      ),
    };

    if (Object.values(value).filter(Boolean).length > 0) {
      propDef.jsDocTags = value;
    }
  }

  return propDef;
}

export const javaScriptFactory: PropDefFactory = (propName, docgenInfo, jsDocParsingResult) => {
  const propDef = createBasicPropDef(propName, docgenInfo.type, docgenInfo);
  propDef.sbType = convert(docgenInfo);

  return applyJsDocResult(propDef, jsDocParsingResult);
};

export const tsFactory: PropDefFactory = (propName, docgenInfo, jsDocParsingResult) => {
  const propDef = createTsPropDef(propName, docgenInfo);
  propDef.sbType = convert(docgenInfo);

  return applyJsDocResult(propDef, jsDocParsingResult);
};

export const flowFactory: PropDefFactory = (propName, docgenInfo, jsDocParsingResult) => {
  const propDef = createFlowPropDef(propName, docgenInfo);
  propDef.sbType = convert(docgenInfo);

  return applyJsDocResult(propDef, jsDocParsingResult);
};

export const unknownFactory: PropDefFactory = (propName, docgenInfo, jsDocParsingResult) => {
  const propDef = createBasicPropDef(propName, { name: 'unknown' }, docgenInfo);

  return applyJsDocResult(propDef, jsDocParsingResult);
};

export const getPropDefFactory = (typeSystem: TypeSystem): PropDefFactory => {
  switch (typeSystem) {
    case TypeSystem.JAVASCRIPT:
      return javaScriptFactory;
    case TypeSystem.TYPESCRIPT:
      return tsFactory;
    case TypeSystem.FLOW:
      return flowFactory;
    default:
      return unknownFactory;
  }
};
