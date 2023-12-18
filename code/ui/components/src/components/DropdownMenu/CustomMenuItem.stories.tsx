import type { Meta, StoryObj } from '@storybook/react';

import { CustomMenuItem } from './CustomMenuItem';

const meta: Meta<typeof CustomMenuItem> = {
  title: 'CustomMenuItem',
  component: CustomMenuItem,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof CustomMenuItem>;

export const Base: Story = {
  args: {
    label: 'Item #1',
  },
};

export const WithDescription: Story = {
  args: {
    ...Base.args,
    description: 'Description',
  },
};

export const WithIcon: Story = {
  args: {
    ...Base.args,
    icon: 'cog',
  },
};

export const Disabled: Story = {
  args: {
    ...Base.args,
    disabled: true,
  },
};

export const Active: Story = {
  args: {
    ...Base.args,
    ...WithDescription.args,
    ...WithIcon.args,
    active: true,
  },
};

export const WithStartInlineIndent: Story = {
  args: {
    ...Base.args,
    startInlineIndent: true,
  },
};

export const WithKeyboardShortcut: Story = {
  args: {
    ...Base.args,
    keyboardShortcut: {
      label: '⌘ + Alt',
      ariaKeyshortcuts: 'Meta+Alt',
    },
  },
};
