import type { ComponentProps } from 'react';
import React from 'react';
import { expect } from '@storybook/jest';
import type { Meta, StoryObj } from '@storybook/react';

import { TooltipLinkList } from '@storybook/components';
import { styled } from '@storybook/theming';
import { screen, userEvent, within } from '@storybook/testing-library';
import type { State } from '@storybook/manager-api';
import { LinkIcon } from '@storybook/icons';
import { SidebarMenu, ToolbarMenu } from './Menu';
import { useDropdownMenu } from '../../container/Menu';
import { LayoutProvider } from '../layout/LayoutProvider';

const fakemenu: ComponentProps<typeof TooltipLinkList>['links'] = [
  { title: 'has icon', icon: <LinkIcon />, id: 'icon' },
  { title: 'has no icon', id: 'non' },
];

const meta = {
  component: SidebarMenu,
  title: 'Sidebar/Menu',
  args: {
    menu: fakemenu,
  },
  decorators: [(storyFn) => <LayoutProvider>{storyFn()}</LayoutProvider>],
} satisfies Meta<typeof SidebarMenu>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Items: Story = {
  render: () => <TooltipLinkList links={fakemenu} />,
};

export const Real: Story = {
  render: () => <SidebarMenu menu={fakemenu} isHighlighted />,
};

export const Toolbar = {
  render: () => <ToolbarMenu menu={fakemenu} />,
};

const DoubleThemeRenderingHack = styled.div({
  '#storybook-root > [data-side="left"] > &': {
    textAlign: 'right',
  },
});

export const Expanded: Story = {
  render: () => {
    const menu = useDropdownMenu(
      { whatsNewData: { status: 'SUCCESS', disableWhatsNewNotifications: false } } as State,
      {
        // @ts-expect-error (Converted from ts-ignore)
        getShortcutKeys: () => ({}),
        getAddonsShortcuts: () => ({}),
        versionUpdateAvailable: () => false,
        isWhatsNewUnread: () => true,
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

export const ExpandedWithoutWhatsNew: Story = {
  ...Expanded,
  render: () => {
    const menu = useDropdownMenu(
      { whatsNewData: undefined } as State,
      {
        // @ts-expect-error (invalid)
        getShortcutKeys: () => ({}),
        getAddonsShortcuts: () => ({}),
        versionUpdateAvailable: () => false,
        isWhatsNewUnread: () => false,
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
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await new Promise((res) => {
      setTimeout(res, 500);
    });
    await Expanded.play(context);
    const releaseNotes = await canvas.queryByText(/What's new/);
    await expect(releaseNotes).not.toBeInTheDocument();
  },
};
