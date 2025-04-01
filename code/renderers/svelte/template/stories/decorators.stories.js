import { expect, fn } from 'storybook/test';

import BorderDecoratorBlue from './BorderDecoratorBlue.svelte';
import BorderDecoratorProps from './BorderDecoratorProps.svelte';
import BorderDecoratorRed from './BorderDecoratorRed.svelte';
import Button from './Button.svelte';

export default {
  component: Button,
  decorators: [() => BorderDecoratorRed],
  tags: ['autodocs'],
};

export const WithDefaultRedBorder = {};
export const WithBareBlueBorder = {
  decorators: [() => BorderDecoratorBlue],
};
export const WithPreparedBlueBorder = {
  decorators: [
    () => ({
      Component: BorderDecoratorBlue,
    }),
  ],
};
export const WithPropsBasedBorder = {
  decorators: [
    () => ({
      Component: BorderDecoratorProps,
      props: { color: 'green' },
    }),
  ],
};
export const WithArgsBasedBorderUnset = {
  argTypes: {
    color: { control: 'color' },
  },
  decorators: [(_, { args }) => ({ Component: BorderDecoratorProps, props: args })],
};
export const WithArgsBasedBorder = {
  ...WithArgsBasedBorderUnset,
  args: { color: 'lightblue' },
};

const decoratorCalled = fn();

export const DecoratorsRunOnce = {
  decorators: [
    (Story) => {
      decoratorCalled();
      return Story();
    },
  ],
  play: async () => {
    expect(decoratorCalled).toHaveBeenCalledTimes(1);
  },
};
