import { global as globalThis } from '@storybook/global';

import { expect } from 'storybook/test';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: { label: 'Button' },
};

// We must not transpile destructuring, to make sure that we can analyze the context properties that are used in play.
// See: https://github.com/storybookjs/storybook/discussions/27389
export const DestructureNotTranspiled = {
  parameters: { chromatic: { disableSnapshot: true } },
  async play() {
    async function fn({ destructured }: { destructured: unknown }) {
      console.log(destructured);
    }
    const match = fn.toString().match(/[^(]*\(([^)]*)/);
    const params = match?.[0];
    await expect(params).toContain('destructured');
  },
};
