import { global as globalThis } from '@storybook/global';

import { expect } from 'storybook/test';

import { fn } from './ModuleAutoMocking.utils';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Html,
  args: {
    content: () => `
      <div style="padding: 20px;">
        <p>
          This story demonstrates module mocking. The imported util function is automocked, because a
          <strong>__mocks__/ModuleAutoMocking.utils.ts</strong> file exists.
        </p>
        <ul>
          <li>Function: ${fn().join(', ')}</li>
        </ul>
      </div>
    `,
  },
  parameters: {
    layout: 'fullscreen',
  },
};

export const Original = {
  play: async ({ canvas }: any) => {
    await expect(canvas.getByText('Function: automocked value')).toBeInTheDocument();
  },
};
