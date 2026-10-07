import { useEffect, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, screen, waitFor } from 'storybook/test';

import { TourGuide } from './TourGuide.tsx';

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

const LateContent = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(setLoaded, 500, true);
    return () => clearTimeout(timeout);
  }, []);
  return loaded ? (
    <pre>{Array.from({ length: 20 }, (_, line) => `line ${line + 1}`).join('\n')}</pre>
  ) : null;
};

/**
 * A step whose content grows after it opens, like a lazily loaded code snippet, next to a target at
 * the bottom edge still keeps its buttons on screen.
 */
export const LateContentNearBottom: Story = {
  render: (args) => (
    <>
      <div
        id="tour-bottom-target"
        style={{ position: 'fixed', left: 8, bottom: 8, width: 80, height: 24 }}
      />
      <TourGuide {...args} />
    </>
  ),
  args: {
    steps: [
      {
        title: 'You just added your first story!',
        content: <LateContent />,
        target: '#tour-bottom-target',
        placement: 'right',
      },
    ],
  },
  play: async () => {
    await screen.findByText(/line 20/);
    const done = await screen.findByRole('button', { name: 'Last' });
    await waitFor(() =>
      expect(done.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
    );
  },
};
