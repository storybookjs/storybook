import React from 'react';

import { Popover } from 'storybook/internal/components';

import { FaceHappyIcon, StorybookIcon } from '@storybook/icons';

import { Menu } from 'react-aria-components';
import { expect, fn, userEvent, within } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { MenuItem } from './MenuItem';

const meta = preview.meta({
  id: 'menuitem-component',
  title: 'Overlay/MenuItem',
  component: MenuItem,
  args: {},
  decorators: [
    (Story) => (
      <Popover hasChrome padding="0 4px">
        <Menu aria-label="Menu" style={{ width: 200 }}>
          <Story />
        </Menu>
      </Popover>
    ),
  ],
});

export const Base = meta.story({
  args: {
    title: 'Menu item',
  },
});

export const WithIcon = meta.story({
  args: {
    title: 'Menu item',
    icon: <FaceHappyIcon />,
  },
});

export const WithDescription = meta.story({
  args: {
    title: 'Menu item',
    description: 'Clicking this will make you happy, I swear!',
  },
});

export const ExtraDefault = meta.story({
  args: {
    title: 'Menu item',
    isDefault: true,
  },
});

export const ExtraSelected = meta.story({
  args: {
    title: 'Menu item',
    isSelected: true,
  },
});

export const ExtraShortcut = meta.story({
  args: {
    title: 'Menu item',
    shortcut: ['control', 'alt', 'K'],
  },
});

export const ExtraHighlighted = meta.story({
  args: {
    title: 'Menu item',
    isHighlighted: true,
  },
});

export const ExtraExternal = meta.story({
  args: {
    title: 'Menu item',
    showExternalIcon: true,
  },
});

export const ExtraDisabled = meta.story({
  args: {
    title: 'Menu item',
    isDisabled: true,
  },
});

export const ExtraIndented = meta.story({
  args: {
    title: 'Menu item',
    isIndented: true,
  },
});

export const ExtraIndentedWithIcon = meta.story({
  args: {
    title: 'Menu item',
    isIndented: true,
    icon: <FaceHappyIcon />,
  },
});

export const WithHref = meta.story({
  args: {
    title: 'External link',
    icon: <StorybookIcon />,
    href: 'https://storybook.js.org',
    showExternalIcon: true,
  },
});

export const DisabledWithIcon = meta.story({
  args: {
    title: 'Disabled item',
    icon: <FaceHappyIcon />,
    isDisabled: true,
  },
});

export const DisabledWithDescription = meta.story({
  args: {
    title: 'Disabled item',
    description: 'This item is disabled and cannot be clicked',
    isDisabled: true,
  },
});

export const SelectedWithDescription = meta.story({
  args: {
    title: 'Selected item',
    description: 'This item is currently selected',
    isSelected: true,
  },
});

export const HighlightedWithIcon = meta.story({
  args: {
    title: 'Highlighted item',
    icon: <FaceHappyIcon />,
    isHighlighted: true,
  },
});

export const DefaultWithIcon = meta.story({
  args: {
    title: 'Default item',
    icon: <FaceHappyIcon />,
    isDefault: true,
  },
});

export const LongShortcut = meta.story({
  args: {
    title: 'Long shortcut',
    shortcut: ['control', 'alt', 'shift', 'meta', 'K'],
  },
});

export const LongTitle = meta.story({
  args: {
    title: 'This is a very long menu item title that might need to wrap or truncate',
    icon: <FaceHappyIcon />,
  },
});

export const LongDescription = meta.story({
  args: {
    title: 'Menu item',
    description:
      'This is a very long description that explains in great detail what this menu item does and why you might want to click on it. It goes on and on to test how the component handles long text content.',
    icon: <FaceHappyIcon />,
  },
});

export const Interactive = meta.story({
  args: {
    title: 'Interactive menu item',
    description: 'Click me to see event handling',
    icon: <FaceHappyIcon />,
    onAction: fn(),
  },
});

export const InteractiveDisabled = meta.story({
  args: {
    title: 'Disabled interactive item',
    description: 'This should not trigger any events',
    icon: <FaceHappyIcon />,
    isDisabled: true,
    onAction: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const item = canvas.getByText('Disabled interactive item');

    await userEvent.click(item);
    await expect(args.onAction).not.toHaveBeenCalled();
  },
});
