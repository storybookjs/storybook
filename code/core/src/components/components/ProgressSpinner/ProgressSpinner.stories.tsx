import React from 'react';

import { StopAltIcon } from '@storybook/icons';
import type { Meta, StoryObj } from '@storybook/react';

import { ProgressSpinner } from './ProgressSpinner';

const meta = {
  component: ProgressSpinner,
} satisfies Meta<typeof ProgressSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Forty: Story = {
  args: {
    percentage: 40,
  },
};

export const Seventy: Story = {
  args: {
    percentage: 70,
  },
};

export const Zero: Story = {
  args: {
    percentage: 0,
  },
};

export const Small: Story = {
  args: {
    percentage: 40,
    size: 16,
  },
};

export const Thick: Story = {
  args: {
    percentage: 40,
    width: 3,
  },
};

export const Paused: Story = {
  args: {
    percentage: 40,
    running: false,
  },
};

export const Colored: Story = {
  args: Forty.args,
  decorators: [
    (Story) => (
      <div style={{ color: 'hotpink' }}>
        <Story />
      </div>
    ),
  ],
};

export const WithContent: Story = {
  ...Colored,
  args: {
    ...Colored.args,
    children: <StopAltIcon size={10} />,
  },
};
