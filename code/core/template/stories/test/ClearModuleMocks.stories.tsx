// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/react-vite';

import { clearAllMocks, expect, waitFor } from 'storybook/test';

import { ClearModuleMocks } from './ClearModuleMocks';
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
  component: ClearModuleMocks,
  beforeEach: async () => {
    clearAllMocks();
  },
} satisfies Meta<typeof ClearModuleMocks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const First: Story = {
  args: {},
  play: async () => {
    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1);
    });
  },
};

export const Second: Story = {
  args: {},
  play: async () => {
    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1);
    });
  },
};
