import { UnknownArgTypesError } from '@storybook/core/preview-errors';
import type { SBType } from '@storybook/core/types';
import type { TSType, TSSigType } from './types';
import { parseLiteral } from '../utils';

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
  if (typeof raw !== 'undefined') base.raw = raw;
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
    case 'union':
      let result;
      if (type.elements?.every((element) => element.name === 'literal')) {
        result = {
          ...base,
          name: 'enum',
          // @ts-expect-error fix types
          value: type.elements?.map((v) => parseLiteral(v.value)),
        };
      } else {
        result = { ...base, name, value: type.elements?.map(convert) };
      }
      return result;
    case 'intersection':
      return { ...base, name, value: type.elements?.map(convert) };
    default:
      return { ...base, name: 'other', value: name };
  }
};
