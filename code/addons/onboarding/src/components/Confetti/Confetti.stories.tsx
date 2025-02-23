import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Confetti } from './Confetti';

const meta: Meta<typeof Confetti> = {
  component: Confetti,
  parameters: {
    chromatic: { disableSnapshot: true },
    layout: 'fullscreen',
  },
  decorators: [
    (StoryFn) => (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          alignContent: 'center',
          textAlign: 'center',
        }}
      >
        <span>Falling confetti! 🎉</span>
        <StoryFn />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Confetti>;

export const Default: Story = {};
