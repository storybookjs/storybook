import { global as globalThis } from '@storybook/global';

import { expect, mocked } from 'storybook/test';

import { fn } from './ModuleSpyMocking.utils';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Html,
  args: {
    content: () => `
      <div style="padding: 20px;">
        <p>
          This story demonstrates module mocking <strong>with spies</strong>. The imported util
          function is autospied, meaning that it is mocked automatically by Storybook, because the
          <br />
          <strong>.storybook/preview.js</strong> file contains a
          <strong>sb.mock(module, {spy: true})</strong> call for it.
        </p>
        <p>
          The play function verifies that the function is called by calling
          <code>expect(mocked(fn)).toHaveBeenCalledWith();</code>
        </p>
        <ul>
          <li>Function: ${(fn() ?? []).join(', ') || 'no value'}</li>
        </ul>
      </div>
    `,
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
    expect(mocked(fn)).toHaveBeenCalledWith();
    await expect(canvas.getByText('Function: original value')).toBeInTheDocument();
  },
};
