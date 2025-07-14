import { global as globalThis } from '@storybook/global';

import { expect, mocked } from 'storybook/test';

import { fn } from './ModuleMocking.utils';

// This story demonstrates auto module mocking. The imported util function is mocked in the
// .storybook/preview.js file via sb.mock(module) but a
// mock is not provided via __mocks__/ModuleMocking.utils.ts, meaning that the implementation of
// the mock has to happen at runtime.

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Html,
  render: () => {
    return `Function: ${(fn() ?? []).join(', ') || 'no value'}`;
  },
  parameters: {
    layout: 'fullscreen',
  },
  beforeEach() {
    mocked(fn).mockReset();
  },
};

export const Original = {
  play: async ({ canvas }: any) => {
    await expect(mocked(fn)).toHaveBeenCalledWith();
    await expect(canvas.getByText('Function: no value')).toBeInTheDocument();
  },
};

export const Mocked = {
  beforeEach() {
    mocked(fn).mockReturnValue(['mocked value']);
  },
  play: async ({ canvas }: any) => {
    await expect(canvas.getByText('Function: mocked value')).toBeInTheDocument();
  },
};
