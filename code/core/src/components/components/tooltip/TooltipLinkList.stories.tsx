import React from 'react';

import { LinkIcon, LinuxIcon } from '@storybook/icons';
import type { Meta, StoryObj } from '@storybook/react';

import { action } from '@storybook/addon-actions';

import { TooltipLinkList } from './TooltipLinkList';
import { WithTooltip } from './WithTooltip';
import ellipseUrl from './assets/ellipse.png';

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

export const WithoutIcons = {
  args: {
    links: [
      {
        id: '1',
        title: 'Link 1',
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
      {
        id: '2',
        title: 'Link 2',
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
    ],
  },
} satisfies Story;

export const WithOneIcon = {
  args: {
    links: [
      {
        id: '1',
        title: 'Link 1',
        center: 'This is an addition description',
        icon: <LinkIcon />,
        href: 'http://google.com',
        onClick: onLinkClick,
      },
      {
        id: '2',
        title: 'Link 2',
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
    ],
  },
} satisfies Story;

export const ActiveWithoutAnyIcons = {
  args: {
    links: [
      {
        id: '1',
        title: 'Link 1',
        active: true,
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
      {
        id: '2',
        title: 'Link 2',
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
    ],
  },
} satisfies Story;

export const ActiveWithSeparateIcon = {
  args: {
    links: [
      {
        id: '1',
        title: 'Link 1',
        icon: <LinkIcon />,
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
      {
        id: '2',
        title: 'Link 2',
        active: true,
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
    ],
  },
} satisfies Story;

export const ActiveAndIcon = {
  args: {
    links: [
      {
        id: '1',
        title: 'Link 1',
        active: true,
        icon: <LinkIcon />,
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
      {
        id: '2',
        title: 'Link 2',
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
    ],
  },
} satisfies Story;

export const WithIllustration = {
  args: {
    links: [
      {
        id: '1',
        title: 'Link 1',
        active: true,
        icon: <LinkIcon />,
        right: <img src={ellipseUrl} width="16" height="16" alt="ellipse" />,
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
      {
        id: '2',
        title: 'Link 2',
        center: 'This is an addition description',
        right: <img src={ellipseUrl} width="16" height="16" alt="ellipse" />,
        href: 'http://google.com',
        onClick: onLinkClick,
      },
    ],
  },
} satisfies Story;

export const WithCustomIcon = {
  args: {
    links: [
      {
        id: '1',
        title: 'Link 1',
        active: true,
        icon: <LinuxIcon />,
        right: <img src={ellipseUrl} width="16" height="16" alt="ellipse" />,
        center: 'This is an addition description',
        href: 'http://google.com',
        onClick: onLinkClick,
      },
      {
        id: '2',
        title: 'Link 2',
        center: 'This is an addition description',
        right: <img src={ellipseUrl} width="16" height="16" alt="ellipse" />,
        href: 'http://google.com',
        onClick: onLinkClick,
      },
    ],
  },
} satisfies Story;
