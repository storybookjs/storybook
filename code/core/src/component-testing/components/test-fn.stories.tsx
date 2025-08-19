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
    children: 'From story',
  },
  play: async ({ canvas }) => {
    const button = canvas.getByText('From test');
    await expect(button).toBeInTheDocument();
  },
});
Default.test(
  'Exists in the dom',
  {
    args: {
      children: 'From test',
    },
  },
  async ({ canvas }) => {
    const button = canvas.getByText('From test');
    await expect(button).toBeInTheDocument();
  }
);
Default.test('onClick is called', async ({ canvas, userEvent, args }) => {
  const button = canvas.getByText('Default');
  await userEvent.click(button);
  await expect(args.onClick).toHaveBeenCalled();
});
