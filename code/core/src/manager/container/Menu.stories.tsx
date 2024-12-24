import React from 'react';

import { TooltipLinkList, WithTooltip } from '@storybook/core/components';
import type { Meta, StoryObj } from '@storybook/react';

import { action } from '@storybook/addon-actions';

import { Shortcut } from './Menu';

const onLinkClick = action('onLinkClick');

export default {
  component: TooltipLinkList,
  decorators: [
    (storyFn) => (
      <div
        style={{
          height: '300px',
        }}
      >
        <WithTooltip placement="top" startOpen tooltip={storyFn()}>
          <div>Tooltip</div>
        </WithTooltip>
      </div>
    ),
  ],
  excludeStories: ['links'],
} satisfies Meta<typeof TooltipLinkList>;

type Story = StoryObj<typeof TooltipLinkList>;

export const WithShortcuts = {
  args: {
    links: [
      {
        id: '1',
        title: 'Link 1',
        center: 'This is an addition description',
        right: <Shortcut keys={['⌘']} />,
        href: 'http://google.com',
        onClick: onLinkClick,
      },
      {
        id: '2',
        title: 'Link 2',
        center: 'This is an addition description',
        right: <Shortcut keys={['⌘', 'K']} />,
        href: 'http://google.com',
        onClick: onLinkClick,
      },
    ],
  },
} satisfies Story;

export const WithShortcutsActive = {
  args: {
    links: [
      {
        id: '1',
        title: 'Link 1',
        center: 'This is an addition description',
        active: true,
        right: <Shortcut keys={['⌘']} />,
        href: 'http://google.com',
        onClick: onLinkClick,
      },
      {
        id: '2',
        title: 'Link 2',
        center: 'This is an addition description',
        right: <Shortcut keys={['⌘', 'K']} />,
        href: 'http://google.com',
        onClick: onLinkClick,
      },
    ],
  },
} satisfies Story;
