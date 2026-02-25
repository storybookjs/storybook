import { logger } from 'storybook/internal/client-logger';
import type { ArgTypesEnhancer, Renderer, SBType } from 'storybook/internal/types';

import { mapValues } from 'es-toolkit/object';
import { dedent } from 'ts-dedent';

import { combineParameters } from './parameters';

const inferType = (
  value: any,
  name: string,
  visited: Set<any>,
  cache: Map<any, SBType>
): SBType => {
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
    // Check cache first for previously computed results
    if (cache.has(value)) {
      return cache.get(value)!;
    }

    // Check for cycles (currently being processed in this path)
    if (visited.has(value)) {
      logger.warn(dedent`
        We've detected a cycle in arg '${name}'. Args should be JSON-serializable.

        Consider using the mapping feature or fully custom args:
        - Mapping: https://storybook.js.org/docs/writing-stories/args#mapping-to-complex-arg-values
        - Custom args: https://storybook.js.org/docs/essentials/controls#fully-custom-args
      `);
      return { name: 'other', value: 'cyclic object' };
    }

    visited.add(value);

    let result: SBType;

    if (Array.isArray(value)) {
      const childType: SBType =
        value.length > 0
          ? inferType(value[0], name, visited, cache)
          : { name: 'other', value: 'unknown' };
      result = { name: 'array', value: childType };
    } else {
      const fieldTypes = mapValues(value, (field) => inferType(field, name, visited, cache));
      result = { name: 'object', value: fieldTypes };
    }

    visited.delete(value); // Remove from current path after processing
    cache.set(value, result); // Cache the result for future lookups

    return result;
  }
  return { name: 'object', value: {} };
};

export const inferArgTypes: ArgTypesEnhancer<Renderer> = (context) => {
  const { id, argTypes: userArgTypes = {}, initialArgs = {} } = context;
  const cache = new Map<any, SBType>();
  const argTypes = mapValues(initialArgs, (arg, key) => ({
    name: key,
    type: inferType(arg, `${id}.${key}`, new Set(), cache),
  }));
  const userArgTypesNames = mapValues(userArgTypes, (argType, key) => ({
    name: key,
  }));
  return combineParameters(argTypes, userArgTypesNames, userArgTypes);
};

inferArgTypes.secondPass = true;
