import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { EllipsisIcon } from '@storybook/icons';

import { ContextMenuButton } from './ContextMenuButton.tsx';

/**
 * The ⋯ trigger for a sidebar row's context menu. A ghost Button that tints on hover, and takes
 * the selection accent inside a selected row (`[data-selected="true"]`) so it stays visible on the
 * selection color.
 */
const meta = {
  title: 'Sidebar/ContextMenuButton',
  component: ContextMenuButton,
  globals: { sb_theme: 'side-by-side' },
  args: {
    ariaLabel: 'Open context menu',
    children: <EllipsisIcon />,
  },
  decorators: [
    (StoryFn) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof ContextMenuButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
};

export const FocusVisible: Story = {
  parameters: { pseudo: { focusVisible: true } },
};

export const OnSelectedRow: Story = {
  decorators: [
    (StoryFn) => (
      <div data-selected="true" style={{ display: 'flex', padding: 4 }}>
        <StoryFn />
      </div>
    ),
  ],
};

export const OnSelectedRowHover: Story = {
  ...OnSelectedRow,
  parameters: { pseudo: { hover: true } },
};
