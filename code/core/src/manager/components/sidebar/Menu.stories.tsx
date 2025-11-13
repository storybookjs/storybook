import React from 'react';

import { TooltipLinkList } from 'storybook/internal/components';

import { LinkIcon } from '@storybook/icons';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { styled } from 'storybook/theming';

import { useMenu } from '../../container/Menu';
import { universalChecklistStore as mockStore } from '../../manager-stores.mock';
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
  beforeEach: async () => {
    mockStore.setState({
      loaded: true,
      muted: false,
      accepted: ['controls'],
      done: ['add-component'],
      skipped: ['viewports'],
    });
  },
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
  globals: { sb_theme: 'light', viewport: 'desktop' },
  render: () => {
    const menu = useMenu({
      api: {
        // @ts-expect-error (Converted from ts-ignore)
        getShortcutKeys: () => ({}),
        getAddonsShortcuts: () => ({}),
        versionUpdateAvailable: () => false,
        isWhatsNewUnread: () => false,
        getDocsUrl: () => 'https://storybook.js.org/docs/',
      },
      showToolbar: false,
      isPanelShown: false,
      isNavShown: false,
      enableShortcuts: false,
    });
    return (
      <DoubleThemeRenderingHack>
        <SidebarMenu menu={menu} />
      </DoubleThemeRenderingHack>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('Wait 3 seconds for story to load', async () => {
      await new Promise((res) => {
        setTimeout(res, 3000);
      });
    });

    await step('Expand menu', async () => {
      const menuButton = await canvas.findByRole('switch');
      await userEvent.click(menuButton);
    });

    await step('Check menu is open', async () => {
      const aboutStorybookBtn = await screen.findByText(/About your Storybook/);
      await expect(aboutStorybookBtn).toBeInTheDocument();
    });
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
    const menu = useMenu({
      api: {
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
      showToolbar: false,
      isPanelShown: false,
      isNavShown: false,
      enableShortcuts: true,
    });

    return (
      <DoubleThemeRenderingHack>
        <SidebarMenu menu={menu} />
      </DoubleThemeRenderingHack>
    );
  },
  play: async (context) => {
    const canvas = within(context.canvasElement);
    // This story can have significant loading time.
    await new Promise((res) => {
      setTimeout(res, 2000);
    });
    const menuButton = await waitFor(() => canvas.findByRole('switch'));
    await userEvent.click(menuButton);
    const aboutStorybookBtn = await screen.findByText(/About your Storybook/);
    await expect(aboutStorybookBtn).toBeInTheDocument();
    const releaseNotes = canvas.queryByText(/What's new/);
    await expect(releaseNotes).not.toBeInTheDocument();
  },
};

export const ExpandedWithWhatsNew: Story = {
  ...Expanded,
  render: () => {
    const menu = useMenu({
      api: {
        // @ts-expect-error (invalid)
        getShortcutKeys: () => ({}),
        getAddonsShortcuts: () => ({}),
        versionUpdateAvailable: () => false,
        isWhatsNewUnread: () => true,
        getDocsUrl: () => 'https://storybook.js.org/docs/',
      },
      showToolbar: false,
      isPanelShown: false,
      isNavShown: false,
      enableShortcuts: false,
    });

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
