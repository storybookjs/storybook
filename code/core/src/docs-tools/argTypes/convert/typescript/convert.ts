import { UnknownArgTypesError } from 'storybook/internal/preview-errors';
import type { SBType } from 'storybook/internal/types';

import { parseLiteral } from '../utils.ts';
import type { TSSigType, TSType } from './types.ts';

// Type guards for narrowing TSType discriminant unions
type TSLiteralType = Extract<TSType, { name: 'literal' }>;
type TSUndefinedType = Extract<TSType, { name: 'undefined' }>;
type TSNullType = Extract<TSType, { name: 'null' }>;

const isLiteral = (type: TSType): type is TSLiteralType => type.name === 'literal';
const isUndefined = (type: TSType): type is TSUndefinedType => type.name === 'undefined';
const isNull = (type: TSType): type is TSNullType => type.name === 'null';

const convertSig = (type: TSSigType) => {
  switch (type.type) {
    case 'function':
      return { name: 'function' };
    case 'object':
      const values: any = {};
      type.signature.properties.forEach((prop) => {
        values[prop.key] = convert(prop.value);
      });
      return {
        name: 'object',
        value: values,
      };
    default:
      throw new UnknownArgTypesError({ type, language: 'Typescript' });
  }
};

// `string & {}` is the TypeScript idiom for "literal hints plus any string" (used
// throughout CSSProperties and similar library types). Docgen emits it either as an
// `intersection` of `string` and an empty object signature, or as an `unknown`
// member inside a union. Both shapes mean `string`, so they collapse to a text
// control instead of an unusable object control.
type TSIntersectionType = Extract<TSType, { name: 'intersection' }>;

const isEmptyObjectSignature = (type: TSType): boolean =>
  type.name === 'signature' && type.type === 'object' && type.signature.properties.length === 0;

const convertIntersection = (type: TSIntersectionType): SBType | void => {
  const meaningful = type.elements.filter((element) => !isEmptyObjectSignature(element));
  if (meaningful.length === 1) {
    return convert(meaningful[0]);
  }
  return { name: 'intersection', value: type.elements.map(convert) };
};

export const convert = (type: TSType): SBType | void => {
  const { name, raw } = type;
  const base: any = {};

  if (typeof raw !== 'undefined') {
    base.raw = raw;
  }
  switch (type.name) {
    case 'string':
    case 'number':
    case 'symbol':
    case 'boolean': {
      return { ...base, name };
    }
    case 'Array': {
      return { ...base, name: 'array', value: type.elements.map(convert) };
    }
    case 'signature':
      return { ...base, ...convertSig(type) };
    case 'union': {
      // `undefined` members (typically from optional props) are dropped from the options,
      // while `null` members (emitted by react-docgen as `{ name: 'null' }`, not as literals)
      // are kept as a selectable `null` option. At least one literal is required so that
      // e.g. `string | null` is not misclassified as an enum.
      const nonUndefinedElements = type.elements.filter((element) => !isUndefined(element));
      const isLiteralEnum =
        nonUndefinedElements.some(isLiteral) &&
        nonUndefinedElements.every((element) => isLiteral(element) || isNull(element));

      if (isLiteralEnum) {
        return {
          ...base,
          name: 'enum',
          value: nonUndefinedElements.map((element) =>
            isLiteral(element) ? parseLiteral(element.value) : null
          ),
        };
      }
      // A union of literals and a `string & {}` member (emitted as `unknown`)
      // accepts any string, so it is a text control, not a closed enum.
      if (
        nonUndefinedElements.some((element) => element.name === 'unknown') &&
        typeof raw === 'string' &&
        /\bstring\s*&\s*\{\s*\}/.test(raw)
      ) {
        return { ...base, name: 'string' };
      }
      return { ...base, name, value: type.elements.map(convert) };
    }
    case 'intersection': {
      const converted = convertIntersection(type);
      return converted ? { ...base, ...converted } : converted;
    }
    default:
      return { ...base, name: 'other', value: name };
  }
};
