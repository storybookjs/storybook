import React from 'react';

import { Button, PopoverProvider, TooltipLinkList } from '@storybook/ui/internal/components';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from '@storybook/core/test';

import { initialState } from '@storybook/core/internal/deep/shared/checklist-store/checklistData.state';
import { Shortcut } from '../components/Shortcut.tsx';
import { internal_universalChecklistStore as mockStore } from '../manager-stores.mock.ts';

const onLinkClick = fn();

export default {
  component: TooltipLinkList,
  decorators: [
    (storyFn) => (
      <div
        style={{
          height: '300px',
        }}
      >
        <PopoverProvider
          ariaLabel="Menu"
          placement="top"
          defaultVisible
          padding={0}
          popover={storyFn()}
        >
          <Button ariaLabel={false}>Click me</Button>
        </PopoverProvider>
      </div>
    ),
  ],
  beforeEach: async () => {
    mockStore.setState({
      loaded: true,
      widget: {},
      items: {
        ...initialState.items,
        controls: { status: 'accepted' },
        renderComponent: { status: 'done' },
        viewports: { status: 'skipped' },
      },
    });
  },
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
