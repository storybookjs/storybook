import mapValues from 'lodash/mapValues.js';
import { dedent } from 'ts-dedent';
import { logger } from '@storybook/core/client-logger';
import { combineParameters } from './parameters';
import type { ArgTypesEnhancer, Renderer, SBType } from '@storybook/core/types';

const inferType = (value: any, name: string, visited: Set<any>): SBType => {
  const type = typeof value;
  switch (type) {
    case 'boolean':
    case 'string':
    case 'number':
    case 'function':
    case 'symbol':
      return { name: type };
    default:
      break;
  }
  if (value) {
    if (visited.has(value)) {
      logger.warn(dedent`
        We've detected a cycle in arg '${name}'. Args should be JSON-serializable.

        Consider using the mapping feature or fully custom args:
        - Mapping: https://storybook.js.org/docs/react/writing-stories/args#mapping-to-complex-arg-values
        - Custom args: https://storybook.js.org/docs/react/essentials/controls#fully-custom-args
      `);
      return { name: 'other', value: 'cyclic object' };
    }
    visited.add(value);
    if (Array.isArray(value)) {
      const childType: SBType =
        value.length > 0
          ? inferType(value[0], name, new Set(visited))
          : { name: 'other', value: 'unknown' };
      return { name: 'array', value: childType };
    }
    const fieldTypes = mapValues(value, (field) => inferType(field, name, new Set(visited)));
    return { name: 'object', value: fieldTypes };
  }
  return { name: 'object', value: {} };
};

export const inferArgTypes: ArgTypesEnhancer<Renderer> = (context) => {
  const { id, argTypes: userArgTypes = {}, initialArgs = {} } = context;
  const argTypes = mapValues(initialArgs, (arg, key) => ({
    name: key,
    type: inferType(arg, `${id}.${key}`, new Set()),
  }));
  const userArgTypesNames = mapValues(userArgTypes, (argType, key) => ({
    name: key,
  }));
  return combineParameters(argTypes, userArgTypesNames, userArgTypes);
};

inferArgTypes.secondPass = true;
