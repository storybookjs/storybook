import type { Meta, StoryObj } from '@storybook/html';

type Args = { label: string };

const identity = <T>(value: T) => value;
const size = <number>12;

export default {
  title: 'Edge/TypeScript',
  render: (args: Args) => identity(`<button>${args.label}</button>`),
  args: { label: identity('Hi') },
  parameters: {
    layout: 'centered',
    docs: {
      source: {
        code: `line1
line2`,
      },
    },
  },
} satisfies Meta<Args> as Meta<Args>;

export const Primary: StoryObj<Args> = { args: { label: 'Primary' } };

export const Sized = {
  args: { label: `size ${size}` },
  tags: ['!dev'],
} satisfies StoryObj<Args>;

export const Composed: StoryObj<Args> = { ...Primary, name: 'Composed name' };
