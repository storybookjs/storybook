import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.Components.Pre,
  args: { text: 'Check that stories are processed OK' },
};

export const Story1 = {};

import './import';

export const Story2 = {};
