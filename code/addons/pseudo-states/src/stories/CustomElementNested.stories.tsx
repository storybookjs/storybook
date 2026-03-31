import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import './CustomElementNested';
import './grid.css';
import { PseudoStateGrid } from './PseudoStateGrid';

const meta = {
  title: 'CustomElementNested',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  // @ts-expect-error We're dealing with a web component here
  render: (args, context) => <custom-element-nested>{context.name}</custom-element-nested>,
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <PseudoStateGrid
      render={(label) => (
        // @ts-expect-error We're dealing with a web component here
        <custom-element-nested>{label}</custom-element-nested>
      )}
    />
  ),
};

export const Default: Story = {};

export const Hover: Story = {
  parameters: {
    pseudo: { hover: true },
  },
};

export const Focus: Story = {
  parameters: {
    pseudo: { focus: true },
  },
};

export const Active: Story = {
  parameters: {
    pseudo: { active: true },
  },
};
