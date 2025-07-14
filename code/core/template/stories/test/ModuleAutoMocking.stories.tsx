import { global as globalThis } from '@storybook/global';

import { expect } from 'storybook/test';

import { fn } from './ModuleAutoMocking.utils';

// This story demonstrates module mocking. The imported util function is automocked,
// because a __mocks__/ModuleAutoMocking.utils.ts file exists.

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Html,
  render: () => {
    return `
      Function: ${fn().join(', ')}
    `;
  },
  parameters: {
    layout: 'fullscreen',
  },
};

export const Original = {
  play: async ({ canvasElement }: any) => {
    await expect(canvasElement.innerHTML).toContain('Function: automocked value');
  },
};
