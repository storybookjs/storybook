import React from 'react';

import type { Meta, StoryObj } from '@storybook/nextjs';

import { expect, within } from 'storybook/test';

import { Nested, RSC, RSCWithAwait, RSCWithMultipleAwaits, SyncParentOfAsyncChild } from './RSC';

// The default `render` creates the story element with `React.createElement`, so `Default` covers
// the top-level async component code path, the other stories cover JSX.
export default {
  component: RSCWithAwait,
  args: { label: 'label' },
  parameters: {
    react: {
      rsc: true,
    },
  },
} as Meta<typeof RSCWithAwait>;

type Story = StoryObj<typeof RSCWithAwait>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('RSC with await label')).toBeVisible();
  },
};

export const WithoutAwait: Story = {
  render: (args) => <RSC {...args} />,
};

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

// The stories below suspend on real (timer based) promises. Before the async component promise
// cache was introduced they never rendered on React >= 19.0.0 (infinite re-render loop),
// see https://github.com/storybookjs/storybook/issues/30317
export const WithAwait: Story = {
  render: (args) => <RSCWithAwait {...args} />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('RSC with await label')).toBeVisible();
  },
};

export const WithMultipleAwaits: Story = {
  render: (args) => <RSCWithMultipleAwaits {...args} />,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('RSC with first and second await label')
    ).toBeVisible();
  },
};

export const NestedWithAwait: Story = {
  render: (args) => (
    <Nested>
      <RSCWithAwait {...args} />
    </Nested>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/Nested RSC with await label/)
    ).toBeVisible();
  },
};

export const AsyncChildOfSyncParent: Story = {
  render: (args) => <SyncParentOfAsyncChild {...args} />,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/Sync parent RSC with await label/)
    ).toBeVisible();
  },
};
