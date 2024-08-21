import type { SBType } from '@storybook/core/types';

import mapValues from 'lodash/mapValues.js';

import { parseLiteral } from '../utils';
import type { PTType } from './types';

const SIGNATURE_REGEXP = /^\(.*\) => /;

export const convert = (type: PTType): SBType | any => {
  const { name, raw, computed, value } = type;
  const base: any = {};

  if (typeof raw !== 'undefined') {
    base.raw = raw;
  }

  switch (name) {
    case 'enum': {
      const values = computed ? value : value.map((v: PTType) => parseLiteral(v.value));
      return { ...base, name, value: values };
    }
    case 'string':
    case 'number':
    case 'symbol':
      return { ...base, name };
    case 'func':
      return { ...base, name: 'function' };
    case 'bool':
    case 'boolean':
      return { ...base, name: 'boolean' };
    case 'arrayOf':
    case 'array':
      return { ...base, name: 'array', value: value && convert(value as PTType) };
    case 'object':
      return { ...base, name };
    case 'objectOf':
      return { ...base, name, value: convert(value as PTType) };
    case 'shape':
    case 'exact':
      const values = mapValues(value, (field) => convert(field));
      return { ...base, name: 'object', value: values };
    case 'union':
      return { ...base, name: 'union', value: value.map((v: PTType) => convert(v)) };
    case 'instanceOf':
    case 'element':
    case 'elementType':
    default: {
      if (name?.indexOf('|') > 0) {
        // react-docgen-typescript-plugin doesn't always produce enum-like unions
        // (like if a user has turned off shouldExtractValuesFromUnion) so here we
        // try to recover and construct one.
        try {
          const literalValues = name.split('|').map((v: string) => JSON.parse(v));
          return { ...base, name: 'enum', value: literalValues };
        } catch (err) {
          // fall through
        }
      }
      const otherVal = value ? `${name}(${value})` : name;
      const otherName = SIGNATURE_REGEXP.test(name) ? 'function' : 'other';

      return { ...base, name: otherName, value: otherVal };
    }
  }
};
