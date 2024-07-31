import { global as globalThis } from '@storybook/global';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore This alias is set in the sandbox. Using ts-ignore instead of ts-expect-error to avoid build errors in the sandbox.

import { foo } from '#utils';
import { expect, fn, isMockFunction, mocked } from '@storybook/test';

export default {
  component: globalThis.Components.Button,
  args: {
    onClick: fn(),
    label: 'Mock story',
  },
  parameters: {
    chromatic: {
      disable: true,
    },
  },
  beforeEach: () => {
    mocked(foo).mockReturnValue('mocked');
  },
  async play() {
    await expect(isMockFunction(foo)).toBe(true);
    await expect(foo()).toBe('mocked');
  },
};

export const Basic = {};
