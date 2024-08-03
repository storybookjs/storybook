import { global as globalThis } from '@storybook/global';
import { expect } from '@storybook/test';
import type { PlayFunctionContext } from '@storybook/core/types';

export default {
  component: globalThis.Components.Pre,
  args: { text: 'No content' },
};

export const Default = {
  play: async ({ title }: PlayFunctionContext<any>) => {
    await expect(title).toBe('core/autotitle');
  },
};
