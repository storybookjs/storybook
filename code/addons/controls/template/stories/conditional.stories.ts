import type { PartialStoryFn, StoryContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.Components.Pre,
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { object: { ...context.args } } }),
  ],
};

export const MutuallyExclusiveModes = {
  argTypes: {
    mutuallyExclusiveA: { control: 'text', if: { arg: 'mutuallyExclusiveB', truthy: false } },
    mutuallyExclusiveB: { control: 'text', if: { arg: 'mutuallyExclusiveA', truthy: false } },
  },
};

export const ToggleControl = {
  argTypes: {
    colorMode: {
      control: 'boolean',
    },
    dynamicText: {
      if: { arg: 'colorMode', truthy: false },
      control: 'text',
    },
    dynamicColor: {
      if: { arg: 'colorMode' },
      control: 'color',
    },
  },
};

export const ToggleExpandCollapse = {
  argTypes: {
    advanced: {
      control: 'boolean',
    },
    margin: {
      control: 'number',
      if: { arg: 'advanced' },
    },
    padding: {
      control: 'number',
      if: { arg: 'advanced' },
    },
    cornerRadius: {
      control: 'number',
      if: { arg: 'advanced' },
    },
  },
};

export const GlobalBased = {
  argTypes: {
    ifThemeExists: { control: 'text', if: { global: 'sb_theme' } },
    ifThemeNotExists: { control: 'text', if: { global: 'sb_theme', exists: false } },
    ifLightTheme: { control: 'text', if: { global: 'sb_theme', eq: 'light' } },
    ifNotLightTheme: { control: 'text', if: { global: 'sb_theme', neq: 'light' } },
  },
};
