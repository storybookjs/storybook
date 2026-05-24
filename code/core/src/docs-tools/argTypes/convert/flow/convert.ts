import { UnknownArgTypesError } from 'storybook/internal/preview-errors';
import type { SBType } from 'storybook/internal/types';

import type { FlowLiteralType, FlowSigType, FlowType } from './types.ts';

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
    case 'union': {
      // Filter out Flow's nullable markers (void, null) so optional unions like
      // ?('sm' | 'md' | 'lg') still resolve to an enum control.
      const meaningfulElements = type.elements?.filter(
        (element) => element.name !== 'void' && element.name !== 'null'
      );
      if (meaningfulElements && meaningfulElements.length > 0 && meaningfulElements.every(isLiteral)) {
        return { ...base, name: 'enum', value: meaningfulElements.map(toEnumOption) };
      }
      return { ...base, name, value: type.elements?.map(convert) };
    }

    case 'intersection':
      return { ...base, name, value: type.elements?.map(convert) };
    default:
      return { ...base, name: 'other', value: name };
  }
};
