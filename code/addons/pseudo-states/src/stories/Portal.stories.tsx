import React, { type ComponentProps } from 'react';
import { createPortal } from 'react-dom';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';
import './grid.css';

const PortalButton = (props: ComponentProps<typeof Button>) =>
  createPortal(<Button {...props} />, document.body);

const meta = {
  title: 'Portal',
  component: PortalButton,
  render: (args, context) => <PortalButton {...args}>{context.name}</PortalButton>,
} satisfies Meta<typeof PortalButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    pseudo: { rootSelector: 'body' },
  },
};

export const Hover: Story = {
  parameters: {
    pseudo: { hover: true, rootSelector: 'body' },
  },
};

export const Focus: Story = {
  parameters: {
    pseudo: { focus: true, rootSelector: 'body' },
  },
};

export const Active: Story = {
  parameters: {
    pseudo: { active: true, rootSelector: 'body' },
  },
};

export const FocusedHover: Story = {
  parameters: {
    pseudo: { focus: true, hover: true, rootSelector: 'body' },
  },
};
