import { logger } from 'storybook/internal/client-logger';
import type {
  Renderer,
  SBType,
  StoryContextForEnhancers,
  StrictArgTypes,
} from 'storybook/internal/types';

import { mapValues } from 'es-toolkit/object';
import { dedent } from 'ts-dedent';

import { combineParameters } from './parameters.ts';

/** The fields {@link inferArgTypes} reads; the full enhancer context is structurally assignable. */
export type InferArgTypesContext<TRenderer extends Renderer = Renderer> = Pick<
  StoryContextForEnhancers<TRenderer>,
  'id' | 'argTypes' | 'initialArgs'
>;

const isCyclicType = (type: SBType): boolean => {
  if (type.name === 'other' && type.value === 'cyclic object') {
    return true;
  }
  if (type.name === 'object' && type.value) {
    return Object.values(type.value).some((t) => isCyclicType(t));
  }
  if (type.name === 'array' && type.value) {
    return isCyclicType(type.value);
  }
  return false;
};

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

// Narrower param than `ArgTypesEnhancer` so it stays directly callable with a minimal context
// (e.g. `mergeServiceArgTypes`), while a full enhancer context remains structurally assignable —
// so it can still be registered in the `argTypesEnhancers` array.
export const inferArgTypes: ((context: InferArgTypesContext) => StrictArgTypes) & {
  secondPass?: boolean;
} = (context) => {
  const { id, argTypes: userArgTypes = {}, initialArgs = {} } = context;
  const cache = new Map<any, SBType>();
  const argTypes = Object.fromEntries(
    Object.entries(initialArgs)
      .filter(([key]) => !userArgTypes[key]?.type)
      .map(([key, arg]) => {
        const argName = `${id}.${key}`;
        const type = inferType(arg, argName, new Set(), cache);

        if (isCyclicType(type) && typeof arg?.toJSON === 'function') {
          try {
            const jsonValue = arg.toJSON();
            if (jsonValue !== arg) {
              const serializedType = inferType(jsonValue, argName, new Set(), new Map());
              if (!isCyclicType(serializedType)) {
                return [key, { name: key, type: serializedType }];
              }
            }
          } catch {
            // toJSON() threw; fall through to the cycle warning below
          }
        }

        if (isCyclicType(type)) {
          logger.warn(dedent`
            We've detected a cycle in arg '${argName}'. Args should be JSON-serializable.

            Consider using the mapping feature or fully custom args:
            - Mapping: https://storybook.js.org/docs/writing-stories/args#mapping-to-complex-arg-values
            - Custom args: https://storybook.js.org/docs/essentials/controls#fully-custom-args
          `);
        }

        return [key, { name: key, type }];
      })
  );
  const userArgTypesNames = mapValues(userArgTypes, (argType, key) => ({
    name: key,
  }));
  return combineParameters(argTypes, userArgTypesNames, userArgTypes) as StrictArgTypes;
};

inferArgTypes.secondPass = true;
