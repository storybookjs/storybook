import { UnknownArgTypesError } from 'storybook/internal/preview-errors';
import type { SBType } from 'storybook/internal/types';

import { parseLiteral } from '../utils';
import type { TSSigType, TSType } from './types';

// Type guards for narrowing TSType discriminant unions
const isLiteral = (type: TSType): boolean => type.name === 'literal';
const isUndefined = (type: TSType): boolean => type.name === 'undefined';

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
    case 'Array': {
      return { ...base, name: 'array', value: type.elements.map(convert) };
    }
    case 'signature':
      return { ...base, ...convertSig(type) };
    case 'union': {
      const nonUndefinedElements = type.elements.filter((element) => !isUndefined(element));
      const allLiterals = nonUndefinedElements.length > 0 && nonUndefinedElements.every(isLiteral);

      if (allLiterals) {
        return {
          ...base,
          name: 'enum',
          value: nonUndefinedElements.map((element) => {
            // We know element is a literal type because of the allLiterals check
            const literalElement = element as Extract<typeof element, { name: 'literal' }>;
            return parseLiteral(literalElement.value);
          }),
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
