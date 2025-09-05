import React from 'react';

import type { StoryContext } from '@storybook/react-vite';

import { expect, fn } from 'storybook/test';

import preview from '../../../../.storybook/preview';

const Button = (args: React.ComponentProps<'button'>) => <button {...args} />;

const meta = preview.meta({
  component: Button,
  render: (args, { name }) => (
    <span>
      {name}
      <br />
      <br />
      <button {...args} />
    </span>
  ),
  args: {
    children: 'Default',
    onClick: fn(),
  },
  tags: ['some-tag', 'autodocs'],
});

export const WithNoTests = meta.story();

export const TestFunctionTypes = meta.story({
  args: {
    children: 'Arg from story',
  },
});

export const PlayFunction = meta.story({
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByText('Default');
    await userEvent.click(button);
  },
});

TestFunctionTypes.test('simple', async ({ canvas, userEvent, args }) => {
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
TestFunctionTypes.test('referring to function in file', doTest);

TestFunctionTypes.test(
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
    globals: { sb_theme: 'dark', viewport: { value: 'sized' } },
  },
  async ({ canvas }) => {
    const button = canvas.getByText('Arg from test override');
    await expect(button).toBeInTheDocument();
    expect(document.body.clientWidth).toBe(380);
  }
);

TestFunctionTypes.test(
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

export const ExtendedStorySinglePlayExample = TestFunctionTypes.extend({
  args: {
    children: 'Arg from extended story',
  },
  play: async ({ canvas }) => {
    const button = canvas.getByText('Arg from extended story');
    await expect(button).toBeEnabled();
  },
});

export const ExtendedStorySingleTestExample = TestFunctionTypes.extend({
  args: {
    children: 'Arg from extended story',
  },
});

ExtendedStorySingleTestExample.test(
  'this is a very long test name to explain that this story test should guarantee that the args have been extended correctly',
  async ({ canvas }) => {
    const button = canvas.getByText('Arg from extended story');
    await expect(button).toBeEnabled();
  }
);

// This is intentionally defined out-of-order
PlayFunction.test('should be clicked by play function', async ({ args }) => {
  await expect(args.onClick).toHaveBeenCalled();
});

export const TestNames = meta.story({
  args: {
    children: 'This story is no-op, just focus on the test names',
  },
});
TestNames.test(
  'should display an error when login is attempted with an expired session token',
  () => {}
);

TestNames.test(
  'should display an error when login is attempted with multiple invalid password attempts',
  () => {}
);

TestNames.test('should display an error when login is attempted with a revoked API key', () => {});

TestNames.test(
  'should display an error when login is attempted after exceeding the maximum session limit',
  () => {}
);

TestNames.test(
  'should display an error when login is attempted with a disabled user account',
  () => {}
);

TestNames.test(
  'should display an error when login is attempted with an unsupported authentication provider',
  () => {}
);

TestNames.test(
  'should display an error when login is attempted after the password reset process is incomplete',
  () => {}
);

TestNames.test(
  'should display an error when login is attempted with a malformed authentication request',
  () => {}
);

TestNames.test(
  'should display an error when login is attempted with an unverified email address',
  () => {}
);
