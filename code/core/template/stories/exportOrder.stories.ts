import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.Components.Pre,
  args: { text: 'Check that Story2 is listed before Story1' },
};

export const Story1 = {};
export const Story2 = {};

export const __namedExportsOrder = ['Story2', 'Story1'];
