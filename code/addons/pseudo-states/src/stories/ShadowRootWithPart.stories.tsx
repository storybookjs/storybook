import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ShadowRoot } from './ShadowRootWithPart.tsx';
import './grid.css';
import { PseudoStateGrid } from './PseudoStateGrid.tsx';

const meta = {
  title: 'ShadowRootWithPart',
  component: ShadowRoot,
} satisfies Meta<typeof ShadowRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => <PseudoStateGrid render={(label) => <ShadowRoot label={label} />} />,
};

export const Default: Story = {};

export const Hover: Story = {
  parameters: {
    pseudo: {
      hover: true,
    },
  },
};

export const Focus: Story = {
  parameters: {
    pseudo: {
      focus: true,
    },
  },
};

export const Active: Story = {
  parameters: {
    pseudo: {
      active: true,
    },
  },
};
