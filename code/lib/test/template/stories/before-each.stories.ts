import { expect, mocked, getByRole, spyOn, userEvent } from '@storybook/test';

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
  parameters: {
    chromatic: { disable: true },
  },
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
