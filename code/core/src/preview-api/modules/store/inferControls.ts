import { logger } from 'storybook/internal/client-logger';
import type {
  ArgTypesEnhancer,
  Renderer,
  SBEnumType,
  SBUnionType,
  SBLiteralType,
  StrictInputType,
} from 'storybook/internal/types';

import { mapValues } from 'es-toolkit/object';

import { filterArgTypes } from './filterArgTypes.ts';
import { combineParameters } from './parameters.ts';

export type ControlsMatchers = {
  date: RegExp;
  color: RegExp;
};

const inferControl = (argType: StrictInputType, name: string, matchers: ControlsMatchers): any => {
  const { type, options } = argType;
  if (!type) {
    return undefined;
  }

  // args that end with background or color e.g. iconColor
  if (matchers.color && matchers.color.test(name)) {
    const controlType = type.name;

    if (controlType === 'string') {
      return { control: { type: 'color' } };
    }

    if (controlType !== 'enum') {
      logger.warn(
        `Addon controls: Control of type color only supports string, received "${controlType}" instead`
      );
    }
  }

  // args that end with date e.g. purchaseDate
  if (matchers.date && matchers.date.test(name)) {
    return { control: { type: 'date' } };
  }

  switch (type.name) {
    case 'array':
      return { control: { type: 'object' } };
    case 'boolean':
      return { control: { type: 'boolean' } };
    case 'string':
      return { control: { type: 'text' } };
    case 'number':
      return { control: { type: 'number' } };
    case 'enum': {
      const { value } = type as SBEnumType;
      return { control: { type: value?.length <= 5 ? 'radio' : 'select' }, options: value };
    }
    case 'union': {
      const { value } = type as SBUnionType;
      if (!value || !Array.isArray(value)) {
        return { control: { type: 'object' } };
      }

      const QUOTE_REGEX = /^['"]|['"]$/g;
      const trimQuotes = (str: string) => str.replace(QUOTE_REGEX, '');
      const includesQuotes = (str: string) => QUOTE_REGEX.test(str);

      const inferredOptions = (
        value.filter((val) => {
          if (val.name === 'literal') {
            return val.value !== undefined && val.value !== null;
          }
          return false;
        }) as SBLiteralType[]
      ).map((val: SBLiteralType) => {
        const v = val.value;
        if (typeof v === 'string') {
          const trimmedValue = trimQuotes(v);
          return includesQuotes(v) || Number.isNaN(Number(trimmedValue))
            ? (trimmedValue === 'true' ? true : trimmedValue === 'false' ? false : trimmedValue)
            : Number(trimmedValue);
        }
        return v;
      });

      const hasComplexTypes = value.some((val) => {
        if (val.name === 'literal') return false;
        if (val.name === 'other') {
          return val.value !== 'undefined' && val.value !== 'void' && val.value !== 'null';
        }
        return true;
      });

      if (inferredOptions.length > 0 && !hasComplexTypes) {
        return {
          control: { type: inferredOptions.length <= 5 ? 'radio' : 'select' },
          options: inferredOptions,
        };
      }

      return { control: { type: 'object' } };
    }
    case 'function':
    case 'symbol':
      return null;
    default:
      return { control: { type: options ? 'select' : 'object' } };
  }
};

export const inferControls: ArgTypesEnhancer<Renderer> = (context) => {
  const {
    argTypes,
    parameters: { __isArgsStory, controls: { include = null, exclude = null, matchers = {} } = {} },
  } = context;

  if (!__isArgsStory) {
    return argTypes;
  }

  const filteredArgTypes = filterArgTypes(argTypes, include, exclude);
  const withControls = mapValues(filteredArgTypes, (argType, name) => {
    return argType?.type && inferControl(argType, name.toString(), matchers);
  });

  return combineParameters(withControls, filteredArgTypes);
};

inferControls.secondPass = true;

export const argTypesEnhancers = [inferControls];
