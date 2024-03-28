import type { ValueType } from '@previewjs/type-analyzer';
import type { SBType } from '@storybook/types';

export const convertToStorybook = (value: ValueType): SBType | undefined => {
  let result: SBType | undefined;
  switch (value.kind) {
    case 'boolean':
    case 'number':
    case 'string': {
      result = { name: value.kind };
      break;
    }
    case 'array':
    case 'tuple': {
      result = {
        name: 'array',
        // @ts-expect-error (not type-safe)
        value: Array.isArray(value.items)
          ? { name: 'union', value: value.items.map(convertToStorybook).filter(Boolean) }
          : convertToStorybook(value.items),
      };
      break;
    }
    case 'object': {
      result = { name: 'object', value: {} };

      for (const [prop, propValue] of Object.entries(value.fields)) {
        // @ts-expect-error (not type-safe)
        result.value[prop] = convertToStorybook(propValue);
      }
      break;
    }
    case 'enum': {
      result = { name: 'enum', value: Object.values(value.options) };
      break;
    }
    case 'optional': {
      result = convertToStorybook(value.type);
      // @ts-expect-error (not type-safe)
      result.required = false;
      break;
    }
    case 'union': {
      // @ts-expect-error (not type-safe)
      result = { name: 'union', value: value.types.map(convertToStorybook).filter(Boolean) };
      break;
    }
    case 'intersection': {
      // @ts-expect-error (not type-safe)
      result = { name: 'intersection', value: value.types.map(convertToStorybook).filter(Boolean) };
      break;
    }
    case 'literal': {
      result = { name: typeof value.value as 'boolean' | 'number' | 'string' };
      break;
    }
    case 'function':
    case 'set':
    case 'map':
    case 'any':
    case 'unknown':
    case 'promise':
    case 'record': {
      result = { name: 'other', value: '' };
      break;
    }
    default:
  }

  return result;
};
