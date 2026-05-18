import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconSymbolsDecorator } from './Filter.story-helpers.tsx';
import { TypeIcon, TypeIconWithSymbol } from './TypeIcon.tsx';

const meta = {
  title: 'Sidebar/TypeIcon',
  component: TypeIconWithSymbol,
  globals: { sb_theme: 'side-by-side' },
  decorators: [
    IconSymbolsDecorator,
    (StoryFn) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof TypeIconWithSymbol>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Component: Story = {
  args: {
    item: {
      type: 'component',
    },
  },
};

export const StoryType: Story = {
  args: {
    item: {
      type: 'story',
      subtype: 'story',
    },
  },
};

export const Test: Story = {
  args: {
    item: {
      type: 'story',
      subtype: 'test',
    },
  },
};

export const Docs: Story = {
  args: {
    item: {
      type: 'docs',
    },
  },
};

export const Group: Story = {
  args: {
    item: {
      type: 'group',
    },
  },
};
