import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { GuidedTour } from './GuidedTour';

const meta = {
  component: GuidedTour,
  args: {
    onClose: fn(),
    onComplete: fn(),
  },
} satisfies Meta<typeof GuidedTour>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    step: '1:Intro',
    steps: [
      {
        key: '1:Intro',
        title: 'Welcome',
        content: 'Welcome to the guided tour!',
        target: '#storybook-root',
        disableBeacon: true,
        disableOverlay: true,
      },
      {
        key: '2:Controls',
        title: 'Controls',
        content: "Can't reach this step",
        target: '#storybook-root',
        disableBeacon: true,
        disableOverlay: true,
      },
    ],
  },
};
