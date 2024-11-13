/* eslint-disable local-rules/no-uncategorized-errors */
import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

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
    chromatic: { disable: true },
    nextjs: { rsc: false },
  },
};

export const Errored: Story = {
  tags: ['!test'],
  parameters: {
    chromatic: { disable: true },
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
