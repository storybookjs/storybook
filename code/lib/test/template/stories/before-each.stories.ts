/* eslint-disable @typescript-eslint/naming-convention,storybook/prefer-pascal-case */
import { expect, getByRole, mocked, spyOn, userEvent } from '@storybook/test';

const meta = {
  component: globalThis.Components.Button,
  loaders() {
    spyOn(console, 'log').mockName('console.log');
    console.log('1 - [from loaders]');
  },
  beforeEach() {
    console.log('2 - [from meta beforeEach]');
  },
};

export default meta;

export const BeforeEachOrder = {
  parameters: { chromatic: { disable: true } },
  beforeEach() {
    console.log('3 - [from story beforeEach]');
  },
  decorators: (StoryFn: any) => {
    console.log('4 - [from decorator]');
    return StoryFn();
  },
  args: {
    label: 'Button',
    onClick: () => {
      console.log('5 - [from onClick]');
    },
  },
  async play({ canvasElement }: any) {
    await userEvent.click(getByRole(canvasElement, 'button'));

    await expect(mocked(console.log).mock.calls).toEqual([
      ['1 - [from loaders]'],
      ['2 - [from meta beforeEach]'],
      ['3 - [from story beforeEach]'],
      ['4 - [from decorator]'],
      ['5 - [from onClick]'],
    ]);
  },
};

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
