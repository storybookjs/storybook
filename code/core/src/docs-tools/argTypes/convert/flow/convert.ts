import type { SBType } from '@storybook/core/types';

import { UnknownArgTypesError } from '@storybook/core/preview-errors';

import type { FlowLiteralType, FlowSigType, FlowType } from './types';

const isLiteral = (type: FlowType): type is FlowLiteralType => type.name === 'literal';
const toEnumOption = (element: FlowLiteralType) => element.value.replace(/['|"]/g, '');

const convertSig = (type: FlowSigType) => {
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
      throw new UnknownArgTypesError({ type: type, language: 'Flow' });
  }
};

export const convert = (type: FlowType): SBType | void => {
  const { name, raw } = type;
  const base: any = {};

  if (typeof raw !== 'undefined') {
    base.raw = raw;
  }
  switch (type.name) {
    case 'literal':
      return { ...base, name: 'other', value: type.value };
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
      if (type.elements?.every(isLiteral)) {
        return { ...base, name: 'enum', value: type.elements?.map(toEnumOption) };
      }
      return { ...base, name, value: type.elements?.map(convert) };

    case 'intersection':
      return { ...base, name, value: type.elements?.map(convert) };
    default:
      return { ...base, name: 'other', value: name };
  }
};
