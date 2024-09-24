import React from 'react';

import { LinkIcon } from '@storybook/icons';
import type { Meta, StoryObj } from '@storybook/react';

import { Form } from '../form';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Button (Deprecated)',
  component: Button,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default = { args: { children: 'Default' } };

export const FormButton: Story = {
  render: (args) => <Form.Button {...args} />,
  args: { children: 'Form.Button' },
};

export const Primary: Story = { args: { primary: true, children: 'Primary' } };
export const Secondary: Story = { args: { secondary: true, children: 'Secondary' } };
export const Tertiary: Story = { args: { tertiary: true, children: 'Tertiary' } };
export const Gray: Story = { args: { gray: true, children: 'Gray' } };

export const Outline: Story = { args: { outline: true, children: 'Outline' } };
export const OutlinePrimary: Story = {
  args: { outline: true, primary: true, children: 'Outline Primary' },
};
export const OutlineSecondary: Story = {
  args: { outline: true, secondary: true, children: 'Outline Secondary' },
};
export const OutlineTertiary: Story = {
  args: { outline: true, tertiary: true, children: 'Outline Tertiary' },
};

export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } };
export const DisabledPrimary: Story = {
  args: { disabled: true, primary: true, children: 'Disabled Priary' },
};
export const DisabledSecondary: Story = {
  args: { disabled: true, secondary: true, children: 'Disabled Secondary' },
};
export const DisabledTertiary: Story = {
  args: { disabled: true, tertiary: true, children: 'Disabled Tertiary' },
};
export const DisabledGray: Story = {
  args: { disabled: true, gray: true, children: 'Disabled Gray' },
};

export const Small: Story = { args: { small: true, children: 'Small' } };
export const SmallPrimary: Story = {
  args: { small: true, primary: true, children: 'Small Priary' },
};
export const SmallSecondary: Story = {
  args: { small: true, secondary: true, children: 'Small Secondary' },
};
export const SmallTertiary: Story = {
  args: { small: true, tertiary: true, children: 'Small Tertiary' },
};
export const SmallGray: Story = {
  args: { small: true, gray: true, children: 'Small Gray' },
};

export const IsLink: Story = {
  args: { isLink: true, children: 'Button as a link' },
};

export const IconPrimary: Story = {
  args: {
    primary: true,
    containsIcon: true,
    title: 'link',
    children: <LinkIcon />,
  },
};
export const IconOutline: Story = {
  args: { outline: true, containsIcon: true, title: 'link', children: <LinkIcon /> },
};
export const IconOutlineSmall: Story = {
  args: {
    outline: true,
    containsIcon: true,
    small: true,
    title: 'link',
    children: <LinkIcon />,
  },
};
