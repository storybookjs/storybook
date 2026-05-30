import { UnknownArgTypesError } from 'storybook/internal/preview-errors';
import type { SBType } from 'storybook/internal/types';

import { parseLiteral } from '../utils.ts';
import type { TSSigType, TSType } from './types.ts';

// Type guards for narrowing TSType discriminant unions
type TSLiteralType = Extract<TSType, { name: 'literal' }>;
type TSNullType = Extract<TSType, { name: 'null' }>;
type TSUndefinedType = Extract<TSType, { name: 'undefined' }>;

const isLiteral = (type: TSType): type is TSLiteralType => type.name === 'literal';
const isNull = (type: TSType): type is TSNullType => type.name === 'null';
const isUndefined = (type: TSType): type is TSUndefinedType => type.name === 'undefined';
const isEnumValue = (type: TSType): type is TSLiteralType | TSNullType =>
  isLiteral(type) || isNull(type);

const convertEnumValue = (type: TSLiteralType | TSNullType) =>
  isNull(type) ? null : parseLiteral(type.value);

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
    case 'null': {
      return { ...base, name: 'other', value: name };
    }
    case 'Array': {
      return { ...base, name: 'array', value: type.elements.map(convert) };
    }
    case 'signature':
      return { ...base, ...convertSig(type) };
    case 'union': {
      const nonUndefinedElements = type.elements.filter((element) => !isUndefined(element));
      const allEnumValues = nonUndefinedElements.length > 0 && nonUndefinedElements.every(isEnumValue);

      if (allEnumValues) {
        // TypeScript can't infer from .every(), so we filter again with the type guard
        const enumElements = nonUndefinedElements.filter(isEnumValue);
        return {
          ...base,
          name: 'enum',
          value: enumElements.map(convertEnumValue),
        };
      }
      return { ...base, name, value: type.elements.map(convert) };
    }
    case 'intersection':
      return { ...base, name, value: type.elements.map(convert) };
    default:
      return { ...base, name: 'other', value: name };
  }
};
