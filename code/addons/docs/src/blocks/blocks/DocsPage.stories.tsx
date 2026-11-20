import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect } from 'storybook/test';

import { DocsPage } from './DocsPage';

const meta = {
  component: DocsPage,
  parameters: {
    layout: 'fullscreen',
    docsStyles: true,
    chromatic: {
      disableSnapshot: true,
    },
  },
} satisfies Meta<typeof DocsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const SingleStory: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/DocsPageParameters.stories'],
  },
};
export const SingleStoryWithHiddenStory: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/DocsPageHiddenStory.stories'],
    chromatic: { disableSnapshot: false },
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('This is the description for the visible story')
    ).toBeVisible();
    await expect(
      canvas.queryByText('This is the description for the hidden story')
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('heading', { level: 2, name: /Stories/ })
    ).not.toBeInTheDocument();
  },
};
export const PrimaryStoryLeftOutOfStories: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/DocsPageMountPrimary.stories'],
    chromatic: { disableSnapshot: false },
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 2, name: /Stories/ })
    ).toBeInTheDocument();
    await expect(
      await canvas.findByText('This is the description for the other story')
    ).toBeVisible();
  },
};
