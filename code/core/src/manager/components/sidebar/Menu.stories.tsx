import React from 'react';

import { TooltipLinkList } from 'storybook/internal/components';

import { LinkIcon } from '@storybook/icons';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { State } from 'storybook/manager-api';
import { expect, screen, userEvent, within } from 'storybook/test';
import { styled } from 'storybook/theming';

import { useMenu } from '../../container/Menu';
import { LayoutProvider } from '../layout/LayoutProvider';
import { type MenuList, SidebarMenu } from './Menu';

const fakemenu: MenuList = [
  [
    { title: 'has icon', icon: <LinkIcon />, id: 'icon' },
    { title: 'has no icon', id: 'non' },
  ],
];

const meta = {
  component: SidebarMenu,
  title: 'Sidebar/Menu',
  args: {
    menu: fakemenu,
  },
  globals: { sb_theme: 'side-by-side' },
  decorators: [(storyFn) => <LayoutProvider>{storyFn()}</LayoutProvider>],
} satisfies Meta<typeof SidebarMenu>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Items: Story = {
  render: () => <TooltipLinkList links={fakemenu} />,
};

export const Real: Story = {
  args: {
    isHighlighted: true,
  },
  // @ts-expect-error (non strict)
  render: (args) => <SidebarMenu menu={fakemenu} {...args} />,
};

const DoubleThemeRenderingHack = styled.div({
  '#storybook-root > [data-side="left"] > &': {
    textAlign: 'right',
  },
});

export const Expanded: Story = {
  globals: { sb_theme: 'light' },
  render: () => {
    const menu = useMenu(
      { whatsNewData: undefined } as State,
      {
        // @ts-expect-error (Converted from ts-ignore)
        getShortcutKeys: () => ({}),
        getAddonsShortcuts: () => ({}),
        versionUpdateAvailable: () => false,
        isWhatsNewUnread: () => false,
        getDocsUrl: () => 'https://storybook.js.org/docs/',
      },
      false,
      false,
      false,
      false,
      false
    );
    return (
      <DoubleThemeRenderingHack>
        <SidebarMenu menu={menu} />
      </DoubleThemeRenderingHack>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await new Promise((res) => {
      setTimeout(res, 500);
    });
    const menuButton = await canvas.findByRole('button');
    await userEvent.click(menuButton);
    const aboutStorybookBtn = await screen.findByText(/About your Storybook/);
    await expect(aboutStorybookBtn).toBeInTheDocument();
  },
  decorators: [
    (StoryFn) => (
      <div style={{ height: 800 }}>
        <StoryFn />
      </div>
    ),
  ],
};

export const ExpandedWithShortcuts: Story = {
  ...Expanded,
  render: () => {
    const menu = useMenu(
      { whatsNewData: undefined } as State,
      {
        // @ts-expect-error (invalid)
        getShortcutKeys: () => ({
          shortcutsPage: ['⌘', '⇧​', ','],
          toggleNav: ['⌥', 'S'],
          togglePanel: ['⌥', 'A'],
          toolbar: ['⌥', 'T'],
          panelPosition: ['⌥', 'D'],
          fullScreen: ['⌥', 'F'],
          search: ['⌥', 'K'],
          prevComponent: ['⌥', '↑'],
          nextComponent: ['⌥', '↓'],
          prevStory: ['⌥', '←'],
          nextStory: ['⌥', '→'],
          collapseAll: ['⌥', '⇧', '↑'],
        }),
        getAddonsShortcuts: () => ({}),
        versionUpdateAvailable: () => false,
        isWhatsNewUnread: () => false,
        getDocsUrl: () => 'https://storybook.js.org/docs/',
      },
      false,
      false,
      false,
      false,
      true
    );

    return (
      <DoubleThemeRenderingHack>
        <SidebarMenu menu={menu} />
      </DoubleThemeRenderingHack>
    );
  },
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await new Promise((res) => {
      setTimeout(res, 500);
    });
    // @ts-expect-error (non strict)
    await Expanded.play(context);
    const releaseNotes = await canvas.queryByText(/What's new/);
    await expect(releaseNotes).not.toBeInTheDocument();
  },
};

export const ExpandedWithWhatsNew: Story = {
  ...Expanded,
  render: () => {
    const menu = useMenu(
      { whatsNewData: { status: 'SUCCESS', disableWhatsNewNotifications: false } } as State,
      {
        // @ts-expect-error (invalid)
        getShortcutKeys: () => ({}),
        getAddonsShortcuts: () => ({}),
        versionUpdateAvailable: () => false,
        isWhatsNewUnread: () => true,
        getDocsUrl: () => 'https://storybook.js.org/docs/',
      },
      false,
      false,
      false,
      false,
      false
    );

    return (
      <DoubleThemeRenderingHack>
        <SidebarMenu menu={menu} isHighlighted />
      </DoubleThemeRenderingHack>
    );
  },
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await new Promise((res) => {
      setTimeout(res, 500);
    });
    // @ts-expect-error (non strict)
    await Expanded.play(context);
    const releaseNotes = await canvas.queryByText(/What's new/);
    await expect(releaseNotes).not.toBeInTheDocument();
  },
};
