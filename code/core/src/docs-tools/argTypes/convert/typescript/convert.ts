import { UnknownArgTypesError } from 'storybook/internal/preview-errors';
import type { SBType } from 'storybook/internal/types';

import {
  isOpenStringMember,
  isParenthesizedOpenStringMember,
  isStringLiteralValue,
  parseLiteral,
  splitTopLevelUnionMembers,
} from '../utils.ts';
import type { TSIntersectionType, TSSigType, TSType } from './types.ts';

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

// Docgen emits standalone `string & {}` as an `intersection` of `string` and an
// empty object signature, which collapses to `string` (a text control) instead of
// an unusable object control.
const isEmptyObjectSignature = (type: TSType): boolean =>
  type.name === 'signature' && type.type === 'object' && type.signature.properties.length === 0;

const convertIntersection = (type: TSIntersectionType): SBType | void => {
  const meaningful = type.elements.filter((element) => !isEmptyObjectSignature(element));
  if (meaningful.length === 1) {
    return convert(meaningful[0]);
  }
  return {
    name: 'intersection',
    value: type.elements.map(convert).filter((value): value is SBType => value !== undefined),
  };
};

const collapsesToString = (type: TSType): boolean => {
  if (type.name !== 'intersection') {
    return false;
  }
  const meaningful = type.elements.filter((element) => !isEmptyObjectSignature(element));
  return meaningful.length === 1 && meaningful[0].name === 'string';
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
      // A union of string literals and a `string & {}` member accepts any string,
      // so it is a text control, not a closed enum. Docgen emits the idiom in two
      // shapes: parenthesized members become `{ name: 'unknown' }` (which carries no
      // raw text, so one `unknown` cannot be told from another), and bare
      // `string & {}` becomes an intersection of `string` and an empty object
      // signature. The idiom is counted per top-level union member: a count over
      // the whole raw text would also fire on nested uses like `Array<string & {}>`
      // or partial text like `mystring & {}`, and a parenthesized idiom must
      // "pay for" every `unknown` member or types like `(Foo)` would silently be
      // treated as strings. Mixed unions like `'sm' | 42 | (string & {})` keep
      // their type.
      if (typeof raw === 'string') {
        const members = splitTopLevelUnionMembers(raw);
        const parenthesizedIdioms = members.filter(isParenthesizedOpenStringMember).length;
        const bareIdioms = members.filter(
          (member) => isOpenStringMember(member) && !isParenthesizedOpenStringMember(member)
        ).length;
        const unknownCount = nonUndefinedElements.filter(
          (element) => element.name === 'unknown'
        ).length;
        const allStringCompatible = nonUndefinedElements.every(
          (element) =>
            element.name === 'unknown' ||
            element.name === 'null' ||
            (isLiteral(element) && isStringLiteralValue(element.value)) ||
            collapsesToString(element)
        );
        if (
          parenthesizedIdioms >= unknownCount &&
          parenthesizedIdioms + bareIdioms > 0 &&
          allStringCompatible
        ) {
          return { ...base, name: 'string' };
        }
      }
      return { ...base, name, value: type.elements.map(convert) };
    }
    case 'intersection': {
      const converted = convertIntersection(type);
      return converted ? { ...converted, ...base } : converted;
    }
    default:
      return { ...base, name: 'other', value: name };
  }
};
