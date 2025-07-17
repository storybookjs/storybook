import { global as globalThis } from '@storybook/global';

import { expect, mocked } from 'storybook/test';

import { fn } from './ModuleSpyMocking.utils';

// This story demonstrates module mocking with spies. The imported util function is autospied,
// meaning that it is mocked automatically by Storybook, because the
// .storybook/preview.js file contains a sb.mock(module, {spy: true}) call for it.

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  decorators: [
    (storyFn: any) => storyFn({ args: { text: `Function: ${fn().join(', ') || 'no value'}` } }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export const Original = {
  play: async ({ canvasElement }: any) => {
    expect(mocked(fn)).toHaveBeenCalledWith();
    await expect(canvasElement.innerHTML).toContain('Function: original value');
  },
};
