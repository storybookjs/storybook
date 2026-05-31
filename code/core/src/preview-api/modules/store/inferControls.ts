import { logger } from 'storybook/internal/client-logger';
import type {
  ArgTypesEnhancer,
  Renderer,
  SBEnumType,
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

  // `parameters.controls.include` / `.exclude` should hide args regardless of whether the
  // story renders with args — otherwise non-args stories that define `argTypes` manually
  // ignore the filter and show every entry (including empty rows for filtered-out keys).
  // See https://github.com/storybookjs/storybook/issues/14739
  const filteredArgTypes = filterArgTypes(argTypes, include, exclude);

  if (!__isArgsStory) {
    return filteredArgTypes;
  }

  const withControls = mapValues(filteredArgTypes, (argType, name) => {
    return argType?.type && inferControl(argType, name.toString(), matchers);
  });

  return combineParameters(withControls, filteredArgTypes);
};

inferControls.secondPass = true;

export const argTypesEnhancers = [inferControls];
