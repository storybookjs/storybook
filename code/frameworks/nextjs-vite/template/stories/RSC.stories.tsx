/* eslint-disable local-rules/no-uncategorized-errors */
import React from 'react';

import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Nested, RSC } from './RSC';

export default {
  component: RSC,
  args: { label: 'label' },
  parameters: {
    react: {
      rsc: true,
    },
  },
} as Meta<typeof RSC>;

type Story = StoryObj<typeof RSC>;

export const Default: Story = {};

export const DisableRSC: Story = {
  tags: ['!test'],
  parameters: {
    chromatic: { disableSnapshot: true },
    nextjs: { rsc: false },
  },
};

export const Errored: Story = {
  tags: ['!test', '!vitest'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  render: () => {
    throw new Error('RSC Error');
  },
};

export const NestedRSC: Story = {
  render: (args) => (
    <Nested>
      <RSC {...args} />
    </Nested>
  ),
};
