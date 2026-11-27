import React, { Suspense } from 'react';

import { useArgs } from 'storybook/preview-api';
import { expect, within } from 'storybook/test';

import type { Meta, StoryObj } from '../index.ts';

let loaded = false;
let data: Promise<void> = Promise.resolve();
let finishLoading = () => {};

const SlowContent = () => {
  if (!loaded) {
    throw data;
  }
  return <span>slow content</span>;
};

const meta = {
  title: 'React/RSC Hooks',
  tags: ['vitest'],
  parameters: { react: { rsc: true } },
  args: { count: 0 },
  beforeEach: () => {
    loaded = false;
    data = new Promise((resolve) => {
      finishLoading = () => {
        loaded = true;
        resolve();
      };
    });
  },
} satisfies Meta<{ count: number }>;

export default meta;

type Story = StoryObj<typeof meta>;

// In Vitest, Storybook has already cleared the hooks context when play runs, as the browser does
// once the story has rendered.
export const HooksAfterChildSuspends: Story = {
  render: function Render() {
    const [{ count }] = useArgs<{ count: number }>();
    return (
      <>
        <span>count {count}</span>
        <SlowContent />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('slow content')).toBeNull();

    finishLoading();

    await expect(await canvas.findByText('slow content')).toBeInTheDocument();
    await expect(canvas.getByText('count 0')).toBeInTheDocument();
  },
};

export const FallbackInsideStory: Story = {
  render: function Render() {
    const [{ count }] = useArgs<{ count: number }>();
    return (
      <>
        <span>count {count}</span>
        <Suspense fallback={<span>loading</span>}>
          <SlowContent />
        </Suspense>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('loading')).toBeInTheDocument();
    await expect(canvas.getByText('count 0')).toBeInTheDocument();

    finishLoading();

    await expect(await canvas.findByText('slow content')).toBeInTheDocument();
  },
};
