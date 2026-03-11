// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { global as globalThis } from '@storybook/global';

import { clearAllMocks, expect, waitFor } from 'storybook/test';

import { fetchData } from './ClearModuleMocks.api';

/**
 * The purpose of this story is to verify that the `clearAllMocks` function properly clears mocks
 * created with the `spy: true` option in `sb.mock()`. This is necessary because those mocks are
 * created with a different instance of `@vitest/spy` than the one bundled with storybook/test. This
 * means they won't be cleared by the `clearMocks` option of Vitest, and we need to use
 * `clearAllMocks` to clear them manually. See issue:
 * https://github.com/storybookjs/storybook/issues/34075
 */
const meta = {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: {
    label: 'Fetch Data',
    onClick: () => {
      fetchData();
    },
  },
  beforeEach: async () => {
    clearAllMocks();
  },
};

export default meta;

export const First = {
  args: {},
  play: async ({ canvas }: any) => {
    const button = await canvas.getByRole('button');
    await button.click();
    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1);
    });
  },
};

export const Second = {
  args: {},
  play: async ({ canvas }: any) => {
    const button = await canvas.getByRole('button');
    await button.click();
    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1);
    });
  },
};
