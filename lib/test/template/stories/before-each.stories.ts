/* eslint-disable @typescript-eslint/naming-convention,storybook/prefer-pascal-case */
import { expect } from '@storybook/test';

const meta = {
  component: globalThis.Components.Button,
  args: { label: 'Button' },
};

export default meta;

export const before_each_and_loaders_can_extend_context = {
  parameters: { chromatic: { disable: true } },
  loaders(context) {
    context.foo = ['bar'];
  },
  beforeEach(context) {
    context.foo = [...context.foo, 'baz'];
  },
  async play({ foo }) {
    await expect(foo).toEqual(['bar', 'baz']);
  },
};

export const context_prop_is_available = {
  parameters: { chromatic: { disable: true } },
  async play({ context, canvasElement }) {
    await expect(context.canvasElement).toEqual(canvasElement);
  },
};

export const step_and_canvas_element_can_be_used_in_loaders_and_before_each = {
  parameters: { chromatic: { disable: true } },
  loaders({ step, canvasElement }) {
    step('loaders', async () => {
      await expect(canvasElement).toBeInTheDocument();
    });
  },
  beforeEach({ step, canvasElement }) {
    step('before each', async () => {
      await expect(canvasElement).toBeInTheDocument();
    });
  },
};
