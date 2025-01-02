import { expect, fn } from '@storybook/test';

const meta = { component: globalThis.Components.Button };

export default meta;

export const MountShouldBeDestructured = {
  parameters: { chromatic: { disable: true } },
  args: {
    label: 'Button',
    onClick: fn(),
  },
  async play(context) {
    let error;

    // TODO use expect.toThrow once this issue is fixed
    // https://github.com/storybookjs/storybook/issues/28406
    try {
      await context.mount();
    } catch (e) {
      error = e;
    }
    await expect(error?.name).toContain('MountMustBeDestructuredError');
  },
};
