import { global as globalThis } from '@storybook/global';
import { fn } from '@storybook/test';

export default {
  component: globalThis.Components.Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disable: true },
    docs: { toc: {} },
  },
};

export const One = { args: { label: 'One' } };
export const Two = { args: { label: 'Two' } };
export const Three = { args: { label: 'Three' } };
