import React from 'react';

import type { StoryContext } from '@storybook/react';

import { expect, fn } from 'storybook/test';

import preview from './preview';

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

const doTest = async ({
  canvas,
  userEvent,
  args,
}: StoryContext<React.ComponentProps<'button'>>) => {
  const button = canvas.getByText('Arg from story');
  await userEvent.click(button);
  await expect(args.onClick).toHaveBeenCalled();
};
Default.test('referring to function in file', doTest);

Default.test(
  'with overrides',
  {
    args: {
      children: 'Arg from test override',
    },
    parameters: {
      viewport: {
        options: {
          sized: {
            name: 'Sized',
            styles: {
              width: '380px',
              height: '500px',
            },
          },
        },
      },
      chromatic: { viewports: [380] },
    },
    globals: { viewport: { value: 'sized' } },
    tags: ['!test'],
  },
  async ({ canvas }) => {
    const button = canvas.getByText('Arg from test override');
    await expect(button).toBeInTheDocument();
    expect(document.body.clientWidth).toBe(380);
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
