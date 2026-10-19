import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, waitFor } from 'storybook/test';

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

// The primary story renders in an iframe, so the page loads it once, under `Primary`.
export const StoriesInIframes: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/ButtonInIframe.stories'],
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('iframe')).toHaveLength(2));
    const ids = [...canvasElement.querySelectorAll('iframe')].map((iframe) => iframe.id);
    await expect(ids).toEqual([
      'iframe--addons-docs-examples-buttoniniframe--primary',
      'iframe--addons-docs-examples-buttoniniframe--secondary',
    ]);
  },
};
