import { global as globalThis } from '@storybook/global';

import { expect } from 'storybook/test';
import { v4 } from 'uuid';

// This story is used to test the node module mocking for modules which have an exports field in their package.json.

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  decorators: [
    (storyFn) =>
      storyFn({
        args: {
          text: `UUID Version: ${v4()}`,
        },
      }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.innerHTML).toContain('UUID Version: MOCK-V4');
  },
};

export const Original = {};
