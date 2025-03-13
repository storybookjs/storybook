import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.Components.Button,
  args: {
    label: 'Click Me!',
  },
  argTypes: {
    onClick: {},
  },
  parameters: {
    chromatic: { disable: true },
    actions: { argTypesRegex: '^on.*' },
  },
};

export const String = {
  argTypes: {
    onClick: { action: 'clicked!' },
  },
};
export const Boolean = {
  argTypes: {
    onClick: { action: true },
  },
};
