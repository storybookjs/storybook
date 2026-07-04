import type { SBType } from 'storybook/internal/types';

import { mapValues } from 'es-toolkit/object';

import { parseLiteral } from '../utils.ts';
import type { PTType } from './types.ts';

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
    case 'union': {
      const convertedValues = value.map((v: PTType) => convert(v));
      // When react-docgen-typescript exceeds its union-member limit it emits each
      // literal as a separate single-value enum inside a union.  Flatten those
      // into one enum so inferControls can render a select/radio control.
      if (
        convertedValues.length > 0 &&
        convertedValues.every(
          (v: any) => v?.name === 'enum' && Array.isArray(v.value) && v.value.length === 1
        )
      ) {
        return { ...base, name: 'enum', value: convertedValues.map((v: any) => v.value[0]) };
      }
      return { ...base, name: 'union', value: convertedValues };
    }
    case 'instanceOf':
    case 'element':
    case 'elementType':
    default: {
      if (name?.indexOf('|') > 0) {
        // react-docgen-typescript-plugin doesn't always produce enum-like unions
        // (like if a user has turned off shouldExtractValuesFromUnion) so here we
        // try to recover and construct one.  parseLiteral handles both single-
        // and double-quoted strings, unlike JSON.parse which rejects single quotes.
        try {
          const literalValues = name.split('|').map((v: string) => parseLiteral(v.trim()));
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
