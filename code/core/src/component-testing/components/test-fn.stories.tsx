import React from 'react';

import { expect, fn } from 'storybook/test';

import preview from '../../../../.storybook/preview';

const Button = (args: React.ComponentProps<'button'>) => <button {...args} />;

const meta = preview.meta({
  component: Button,
  args: {
    children: 'Default',
    onClick: fn(),
  },
  tags: ['some-tag'],
});

export const Default = meta.story({
  args: {
    children: 'Arg from story',
  },
});
Default.test('simple', async ({ canvas, userEvent, args }) => {
  const button = canvas.getByText('Arg from story');
  await userEvent.click(button);
  await expect(args.onClick).toHaveBeenCalled();
});
Default.test(
  'with overrides',
  {
    args: {
      children: 'Arg from test',
    },
  },
  async ({ canvas }) => {
    const button = canvas.getByText('Arg from test');
    await expect(button).toBeInTheDocument();
  }
);
Default.test(
  'with play function',
  {
    play: async ({ canvas }) => {
      const button = canvas.getByText('Arg from story');
      await expect(button).toBeInTheDocument();
    },
  },
  async ({ canvas }) => {
    const button = canvas.getByText('Arg from story');
    await expect(button).toBeEnabled();
  }
);
export const Extended = Default.extend({
  args: {
    children: 'Arg from extended story',
  },
});
Extended.test('should have extended args', async ({ canvas }) => {
  const button = canvas.getByText('Arg from extended story');
  await expect(button).toBeEnabled();
});
