import type { StoryContext } from '@storybook/core/internal/types';

import { global as globalThis } from '@storybook/global';

import { expect } from '@storybook/core/test';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  args: { text: 'No content' },
};

export const Default = {
  play: async ({ title }: StoryContext<any>) => {
    await expect(title).toBe('core/autotitle');
  },
};
