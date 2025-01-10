import type { ComponentProps } from 'react';
import React from 'react';

import { DiscordIcon, SidebarIcon } from '@storybook/icons';

import { action } from '@storybook/addon-actions';

import { Link } from './link';

const onClick = action('onClick');

export default {
  component: Link,
};

export const CancelWOnClick = {
  args: {
    href: '/',
    onClick,
    children: 'Try clicking with different mouse buttons and modifier keys (shift/ctrl/alt/cmd)',
  },
  name: 'Cancel w/ onClick',
};

export const CancelWHref = {
  args: {
    href: 'http://example.com',
    children: 'Link',
  },
  name: 'Cancel w/ href',
};

export const NoCancelWOnClick = {
  args: {
    href: '/',
    children: 'Any click will go through',
    onClick,
  },
  name: 'No-cancel w/ onClick',
};

export const NoCancelWHref = {
  args: {
    href: 'http://example.com',
    children: 'Link',
  },
  name: 'No-cancel w/ href',
};

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
};
