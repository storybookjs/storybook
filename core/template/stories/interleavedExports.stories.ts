import { global as globalThis } from '@storybook/global';

import './import';

export default {
  component: globalThis.Components.Pre,
  args: { text: 'Check that stories are processed OK' },
};

export const Story1 = {};

export const Story2 = {};
