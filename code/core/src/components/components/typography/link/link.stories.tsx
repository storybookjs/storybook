import type { ComponentProps } from 'react';
import React from 'react';

import { DiscordIcon, SidebarIcon } from '@storybook/icons';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';
import { expect, fn } from 'storybook/test';

import { Link } from './link';

const onClick = action('onClick');

const meta = {
  component: Link,
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CancelWOnClick = {
  args: {
    href: '/',
    onClick,
    children: 'Try clicking with different mouse buttons and modifier keys (shift/ctrl/alt/cmd)',
  },
  name: 'Cancel w/ onClick',
} satisfies Story;

export const CancelWHref = {
  args: {
    href: 'http://example.com',
    children: 'Link',
  },
  name: 'Cancel w/ href',
} satisfies Story;

export const NoCancelWOnClick = {
  args: {
    href: '/',
    children: 'Any click will go through',
    onClick,
  },
  name: 'No-cancel w/ onClick',
} satisfies Story;

export const NoCancelWHref = {
  args: {
    href: 'http://example.com',
    children: 'Link',
  },
  name: 'No-cancel w/ href',
} satisfies Story;

export const ButtonLink = {
  args: {
    children: 'Click me',
    onClick: fn(),
  },
  name: 'Link-styled button',
  play: async ({ args, canvas }) => {
    const link = canvas.getByRole('button', { name: 'Click me' });
    link.focus();
    expect(link).toHaveFocus();
    link.click();
    expect(args.onClick).toHaveBeenCalled();
  },
} satisfies Story;

export const StyledLinks = {
  render: (args: ComponentProps<typeof Link>) => (
    <div>
      <Link href="http://google.com" {...args}>
        Default
      </Link>
      <br />
      <Link secondary href="http://google.com" {...args}>
        Secondary
      </Link>
      <br />
      <Link tertiary href="http://google.com" {...args}>
        tertiary
      </Link>
      <br />
      <Link nochrome href="http://google.com" {...args}>
        nochrome
      </Link>
      <br />
      <Link href="http://google.com" {...args}>
        <DiscordIcon />
        With icon in front
      </Link>
      <br />
      <Link title="Toggle sidebar" containsIcon href="http://google.com" {...args}>
        {/* A linked icon by itself   */}
        <SidebarIcon />
      </Link>
      <br />
      <Link containsIcon withArrow href="http://google.com" {...args}>
        With arrow behind
      </Link>
      <br />
      <span
        style={{
          background: '#333',
        }}
      >
        <Link inverse href="http://google.com" {...args}>
          Inverted colors
        </Link>
      </span>
      <br />
    </div>
  ),
  name: 'Styled links',
} satisfies Story;
