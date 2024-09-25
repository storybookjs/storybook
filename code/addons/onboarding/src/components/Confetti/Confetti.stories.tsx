import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Confetti } from './Confetti';

const meta: Meta<typeof Confetti> = {
  component: Confetti,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  decorators: [
    (StoryFn) => (
      <div style={{ height: '100vh', width: '100vw' }}>
        <button>I am clickable</button>
        <StoryFn />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Confetti>;

export const Default: Story = {
  args: {
    recycle: true,
    numberOfPieces: 200,
    top: undefined,
    left: undefined,
    width: undefined,
    height: undefined,
    friction: 0.99,
    wind: 0,
    gravity: 0.1,
    initialVelocityX: 4,
    initialVelocityY: 10,
    tweenDuration: 5000,
  },
};

export const OneTimeConfetti: Story = {
  args: {
    ...Default.args,
    numberOfPieces: 800,
    recycle: false,
    tweenDuration: 20000,
    onConfettiComplete: (confetti) => {
      confetti?.reset();
    },
  },
};

export const Positioned: Story = {
  args: {
    ...Default.args,
    top: 100,
    left: 300,
    width: 300,
    height: 250,
  },
};
