import type { PlayFunctionContext } from '@storybook/core/types';
import { global as globalThis } from '@storybook/global';
import { expect } from '@storybook/test';

export default {
  component: globalThis.Components.Pre,
  title: 'manual title',
  args: { text: 'No content' },
};

export const Default = {
  play: async ({ title }: PlayFunctionContext<any>) => {
    await expect(title).toBe('core/manual title');
  },
};
