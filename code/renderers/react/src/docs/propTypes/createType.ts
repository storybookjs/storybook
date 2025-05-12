import type { DocgenPropType, ExtractedProp, PropType } from 'storybook/internal/docs-tools';
import { createSummaryValue, isTooLongForTypeSummary } from 'storybook/internal/docs-tools';

import {
  ARRAY_CAPTION,
  CLASS_CAPTION,
  CUSTOM_CAPTION,
  ELEMENT_CAPTION,
  FUNCTION_CAPTION,
  OBJECT_CAPTION,
  generateCode,
  generateObjectCode,
  isHtmlTag,
} from '../lib';
import type { InspectionArray, InspectionElement, InspectionObject } from '../lib/inspection';
import { InspectionType, inspectValue } from '../lib/inspection';
import {
  generateFuncSignature,
  generateShortFuncSignature,
  toMultilineSignature,
} from './generateFuncSignature';

const MAX_FUNC_LENGTH = 150;

enum PropTypesType {
  CUSTOM = 'custom',
  ANY = 'any',
  FUNC = 'func',
  SHAPE = 'shape',
  OBJECT = 'object',
  INSTANCEOF = 'instanceOf',
  OBJECTOF = 'objectOf',
  UNION = 'union',
  ENUM = 'enum',
  ARRAYOF = 'arrayOf',
  ELEMENT = 'element',
  ELEMENTTYPE = 'elementType',
  NODE = 'node',
}

interface EnumValue {
  value: string;
  computed: boolean;
}

interface TypeDef {
  name: string;
  short: string;
  compact: string | null;
  full: string | null;
  inferredType?: InspectionType | null;
}

function createTypeDef({
  name,
  short,
  compact,
  full,
  inferredType,
}: {
  name: string;
  short: string;
  compact: string | null;
  full?: string | null;
  inferredType?: InspectionType | null;
}): TypeDef {
  return {
    name,
    short,
    compact,
    full: full != null ? full : short,
    inferredType,
  };
}

function cleanPropTypes(value: string): string {
  return value.replace(/PropTypes./g, '').replace(/.isRequired/g, '');
}

function splitIntoLines(value: string): string[] {
  return value.split(/\r?\n/);
}

function prettyObject(ast: any, compact = false): string {
  return cleanPropTypes(generateObjectCode(ast, compact));
}

function prettyArray(ast: any, compact = false): string {
  return cleanPropTypes(generateCode(ast, compact));
}

function getCaptionForInspectionType(type: InspectionType): string {
  switch (type) {
    case InspectionType.OBJECT:
      return OBJECT_CAPTION;
    case InspectionType.ARRAY:
      return ARRAY_CAPTION;
    case InspectionType.CLASS:
      return CLASS_CAPTION;
    case InspectionType.FUNCTION:
      return FUNCTION_CAPTION;
    case InspectionType.ELEMENT:
      return ELEMENT_CAPTION;
    default:
      return CUSTOM_CAPTION;
  }
}

function generateTypeFromString(value: string, originalTypeName: string): TypeDef {
  const { inferredType, ast } = inspectValue(value);
  const { type } = inferredType;

  let short;
  let compact;
  let full;

  switch (type) {
    case InspectionType.IDENTIFIER:
    case InspectionType.LITERAL:
      short = value;
      compact = value;
      break;
    case InspectionType.OBJECT: {
      const { depth } = inferredType as InspectionObject;

      short = OBJECT_CAPTION;
      compact = depth === 1 ? prettyObject(ast, true) : null;
      full = prettyObject(ast);
      break;
    }
    case InspectionType.ELEMENT: {
      const { identifier } = inferredType as InspectionElement;

      short = identifier != null && !isHtmlTag(identifier) ? identifier : ELEMENT_CAPTION;
      compact = splitIntoLines(value).length === 1 ? value : null;
      full = value;
      break;
    }
    case InspectionType.ARRAY: {
      const { depth } = inferredType as InspectionArray;

      short = ARRAY_CAPTION;
      compact = depth <= 2 ? prettyArray(ast, true) : null;
      full = prettyArray(ast);
      break;
    }
    default:
      short = getCaptionForInspectionType(type);
      compact = splitIntoLines(value).length === 1 ? value : null;
      full = value;
      break;
  }

  return createTypeDef({
    name: originalTypeName,
    short,
    compact,
    full,
    inferredType: type,
  });
}

function generateCustom({ raw }: DocgenPropType): TypeDef {
  if (raw != null) {
    return generateTypeFromString(raw, PropTypesType.CUSTOM);
  }

  return createTypeDef({
    name: PropTypesType.CUSTOM,
    short: CUSTOM_CAPTION,
    compact: CUSTOM_CAPTION,
  });
}

function generateFunc(extractedProp: ExtractedProp): TypeDef {
  const { jsDocTags } = extractedProp;

  if (jsDocTags != null) {
    if (jsDocTags.params != null || jsDocTags.returns != null) {
      return createTypeDef({
        name: PropTypesType.FUNC,
        // @ts-expect-error (Converted from ts-ignore)
        short: generateShortFuncSignature(jsDocTags.params, jsDocTags.returns),
        compact: null,
        // @ts-expect-error (Converted from ts-ignore)
        full: generateFuncSignature(jsDocTags.params, jsDocTags.returns),
      });
    }
  }

  return createTypeDef({
    name: PropTypesType.FUNC,
    short: FUNCTION_CAPTION,
    compact: FUNCTION_CAPTION,
  });
}

function generateShape(type: DocgenPropType, extractedProp: ExtractedProp): TypeDef {
  const fields = Object.keys(type.value)
    .map((key: string) => `${key}: ${generateType(type.value[key], extractedProp).full}`)
    .join(', ');

  const { inferredType, ast } = inspectValue(`{ ${fields} }`);
  const { depth } = inferredType as InspectionObject;

  return createTypeDef({
    name: PropTypesType.SHAPE,
    short: OBJECT_CAPTION,
    compact: depth === 1 && ast ? prettyObject(ast, true) : null,
    full: ast ? prettyObject(ast) : null,
  });
}

function objectOf(of: string): string {
  return `objectOf(${of})`;
}

function generateObjectOf(type: DocgenPropType, extractedProp: ExtractedProp): TypeDef {
  const { short, compact, full } = generateType(type.value, extractedProp);

  return createTypeDef({
    name: PropTypesType.OBJECTOF,
    short: objectOf(short),
    compact: compact != null ? objectOf(compact) : null,
    full: full ? objectOf(full) : full,
  });
}

function generateUnion(type: DocgenPropType, extractedProp: ExtractedProp): TypeDef {
  if (Array.isArray(type.value)) {
    const values = type.value.reduce(
      (acc: any, v: any) => {
        const { short, compact, full } = generateType(v, extractedProp);

        acc.short.push(short);
        acc.compact.push(compact);
        acc.full.push(full);

        return acc;
      },
      { short: [], compact: [], full: [] }
    );

    return createTypeDef({
      name: PropTypesType.UNION,
      short: values.short.join(' | '),
      compact: values.compact.every((x: string) => x != null) ? values.compact.join(' | ') : null,
      full: values.full.join(' | '),
    });
  }

  return createTypeDef({ name: PropTypesType.UNION, short: type.value, compact: null });
}

function generateEnumValue({ value, computed }: EnumValue): TypeDef {
  return computed
    ? generateTypeFromString(value, 'enumvalue')
    : createTypeDef({ name: 'enumvalue', short: value, compact: value });
}

function generateEnum(type: DocgenPropType): TypeDef {
  if (Array.isArray(type.value)) {
    const values = type.value.reduce(
      (acc: any, v: EnumValue) => {
        const { short, compact, full } = generateEnumValue(v);

        acc.short.push(short);
        acc.compact.push(compact);
        acc.full.push(full);

        return acc;
      },
      { short: [], compact: [], full: [] }
    );

    return createTypeDef({
      name: PropTypesType.ENUM,
      short: values.short.join(' | '),
      compact: values.compact.every((x: string) => x != null) ? values.compact.join(' | ') : null,
      full: values.full.join(' | '),
    });
  }

  return createTypeDef({ name: PropTypesType.ENUM, short: type.value, compact: type.value });
}

function braceAfter(of: string): string {
  return `${of}[]`;
}

function braceAround(of: string): string {
  return `[${of}]`;
}

function createArrayOfObjectTypeDef(
  short: string,
  compact: string | null,
  full: string | null
): TypeDef {
  return createTypeDef({
    name: PropTypesType.ARRAYOF,
    short: braceAfter(short),
    compact: compact != null ? braceAround(compact) : null,
    full: full ? braceAround(full) : full,
  });
}

function generateArray(type: DocgenPropType, extractedProp: ExtractedProp): TypeDef {
  const { name, short, compact, full, inferredType } = generateType(type.value, extractedProp);

  if (name === PropTypesType.CUSTOM) {
    if (inferredType === InspectionType.OBJECT) {
      return createArrayOfObjectTypeDef(short, compact, full);
    }
  } else if (name === PropTypesType.SHAPE) {
    return createArrayOfObjectTypeDef(short, compact, full);
  }

  return createTypeDef({
    name: PropTypesType.ARRAYOF,
    short: braceAfter(short),
    compact: braceAfter(short),
  });
}

function generateType(type: DocgenPropType, extractedProp: ExtractedProp): TypeDef {
  try {
    switch (type.name) {
      case PropTypesType.CUSTOM:
        return generateCustom(type);
      case PropTypesType.FUNC:
        return generateFunc(extractedProp);
      case PropTypesType.SHAPE:
        return generateShape(type, extractedProp);
      case PropTypesType.INSTANCEOF:
        return createTypeDef({
          name: PropTypesType.INSTANCEOF,
          short: type.value,
          compact: type.value,
        });
      case PropTypesType.OBJECTOF:
        return generateObjectOf(type, extractedProp);
      case PropTypesType.UNION:
        return generateUnion(type, extractedProp);
      case PropTypesType.ENUM:
        return generateEnum(type);
      case PropTypesType.ARRAYOF:
        return generateArray(type, extractedProp);
      default:
        return createTypeDef({ name: type.name, short: type.name, compact: type.name });
    }
  } catch (e) {
    console.error(e);
  }

  return createTypeDef({ name: 'unknown', short: 'unknown', compact: 'unknown' });
}

export function createType(extractedProp: ExtractedProp): PropType | null {
  const { type } = extractedProp.docgenInfo;

  // A type could be null if a defaultProp has been provided without a type definition.
  if (type == null) {
    return null;
  }

  try {
    switch (type.name) {
      case PropTypesType.CUSTOM:
      case PropTypesType.SHAPE:
      case PropTypesType.INSTANCEOF:
      case PropTypesType.OBJECTOF:
      case PropTypesType.UNION:
      case PropTypesType.ENUM:
      case PropTypesType.ARRAYOF: {
        const { short, compact, full } = generateType(type, extractedProp);

        if (compact != null) {
          if (!isTooLongForTypeSummary(compact)) {
            return createSummaryValue(compact);
          }
        }

        return full ? createSummaryValue(short, full) : createSummaryValue(short);
      }
      case PropTypesType.FUNC: {
        const { short, full } = generateType(type, extractedProp);

        let summary = short;
        let detail;

        if (full && full.length < MAX_FUNC_LENGTH) {
          summary = full;
        } else if (full) {
          detail = toMultilineSignature(full);
        }

        return createSummaryValue(summary, detail);
      }
      default:
        return null;
    }
  } catch (e) {
    console.error(e);
  }

  return null;
}
