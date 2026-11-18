import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Confetti } from './Confetti.tsx';

const meta = {
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
} satisfies Meta<typeof Confetti>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
