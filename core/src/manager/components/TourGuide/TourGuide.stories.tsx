import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { TourGuide } from './TourGuide';

const meta = {
  component: TourGuide,
  args: {
    onComplete: fn(),
    onDismiss: fn(),
  },
} satisfies Meta<typeof TourGuide>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    steps: [
      {
        title: 'One',
        content: 'Welcome to the guided tour!',
        target: '#storybook-root',
      },
      {
        title: 'Two',
        content: 'More stuff',
        target: '#storybook-root',
      },
      {
        title: 'Three',
        content: 'Some more stuff',
        target: '#storybook-root',
      },
      {
        title: 'Four',
        content: 'All done',
        target: '#storybook-root',
      },
    ],
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [step, setStep] = useState<string>('one');
    return (
      <TourGuide
        {...args}
        step={step}
        onNext={() => setStep((v) => (v === 'one' ? 'two' : 'one'))}
      />
    );
  },
  args: {
    steps: [
      {
        key: 'one',
        title: 'One',
        content: 'Hello!',
        target: '#storybook-root',
      },
      {
        key: 'two',
        title: 'Two',
        content: 'I go back and forth!',
        target: '#storybook-root',
      },
      {
        key: 'three',
        title: 'Three',
        content: "Can't touch this",
        target: '#storybook-root',
      },
    ],
  },
};
