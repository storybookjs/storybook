import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './NestedRules';

const meta = {
  title: 'NestedRules',
  component: Button,
  render: (args, context) => <Button {...args}>{context.name}</Button>,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NestedHover: Story = {
  parameters: {
    pseudo: { focusVisible: true },
  },
  // TODO: Use this test once the pseudostates addon uses the beforeEach API
  // play: async ({ canvas }) => {
  //   const button = canvas.getByRole('button')!;
  //   await expect(getComputedStyle(button).textDecorationLine).toBe('underline');
  //   await expect(getComputedStyle(button).textDecorationColor).toBe('rgb(255, 0, 0)');
  // },
};
