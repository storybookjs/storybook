import { expect } from 'storybook/internal/test';
import type { PlayFunctionContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.Components.Pre,
  args: { text: 'No content' },
};

export const Default = {
  play: async ({ title }: PlayFunctionContext<any>) => {
    await expect(title).toBe('core/autotitle');
  },
};
