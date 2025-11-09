import { global as globalThis } from '@storybook/global';

import { expect, mocked } from 'storybook/test';

import { fn } from './ModuleMocking.utils';

// This story demonstrates auto module mocking. The imported util function is mocked in the
// .storybook/preview.js file via sb.mock(module) but a
// mock is not provided via __mocks__/ModuleMocking.utils.ts, meaning that the implementation of
// the mock has to happen at runtime.

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  parameters: {
    layout: 'fullscreen',
  },
};

export const Original = {
  decorators: [
    (storyFn: any) =>
      storyFn({ args: { text: `Function: ${(fn() ?? []).join(', ') || 'no value'}` } }),
  ],
  play: async ({ canvasElement }: any) => {
    await expect(mocked(fn)).toHaveBeenCalledWith();
    await expect(canvasElement.innerHTML).toContain('Function: no value');
  },
};

export const Mocked = {
  decorators: [
    (storyFn: any) => storyFn({ args: { text: `Function: ${fn().join(', ') || 'no value'}` } }),
  ],
  beforeEach() {
    mocked(fn).mockReturnValue(['mocked value']);
  },
  play: async ({ canvasElement }: any) => {
    await expect(canvasElement.innerHTML).toContain('Function: mocked value');
  },
};
