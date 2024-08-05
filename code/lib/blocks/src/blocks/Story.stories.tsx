import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from '@storybook/test';

import { Story as StoryBlock } from './Story';
import * as ButtonStories from '../examples/Button.stories';
import * as StoryComponentStories from '../components/Story.stories';
import * as StoryParametersStories from '../examples/StoryParameters.stories';

const meta: Meta<typeof StoryBlock> = {
  component: StoryBlock,
  parameters: {
    layout: 'fullscreen',
    relativeCsfPaths: ['../examples/Button.stories', '../examples/StoryParameters.stories'],
    docsStyles: true,
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

export const DefaultAttached: Story = {};

export const Of: Story = {
  args: {
    of: ButtonStories.Primary,
  },
};

export const OfWithMeta: Story = {
  args: {
    of: ButtonStories.Secondary,
    meta: ButtonStories.default,
  },
};

export const OfWithMetaUnattached: Story = {
  parameters: { attached: false },
  args: {
    of: ButtonStories.Secondary,
    meta: ButtonStories.default,
  },
};

export const OfError: Story = {
  args: {
    of: ButtonStories.ErrorStory,
  },
};

export const OfUndefined: Story = {
  args: {
    // @ts-expect-error this is supposed to be undefined
    // eslint-disable-next-line import/namespace
    of: ButtonStories.NotDefined,
  },
  parameters: { chromatic: { disableSnapshot: true } },
  tags: ['!test'],
};

export const Inline: Story = {
  args: {
    of: StoryParametersStories.NoParameters,
    inline: true,
  },
};

export const InlineWithHeightProps: Story = {
  ...Inline,
  args: {
    of: StoryParametersStories.NoParameters,
    inline: true,
    height: '600px',
  },
};

export const InlineWithHeightParameter: Story = {
  ...Inline,
  args: {
    of: StoryParametersStories.Height,
  },
};

export const IFrameProps: Story = {
  ...Inline,
  name: 'IFrame Props',
  args: {
    of: StoryParametersStories.NoParameters,
    inline: false,
  },
  parameters: {
    chromatic: {
      delay: 3000,
    },
  },
  play: async ({ canvasElement }) => {
    // this is mostly to fix flakiness in chromatic, specifically on Safari
    // where the scrollbar appears inconsistently and causes the snapshot to be different
    await waitFor(
      async () => {
        const iframeEl = canvasElement.querySelector('iframe');
        await expect(
          iframeEl!.contentDocument!.querySelector('[data-testid="sb-iframe-text"]')
        ).toBeVisible();
      },
      { timeout: 10000 }
    );
  },
};

export const IFrameWithParameter: Story = {
  ...Inline,
  name: 'IFrame With Parameter',
  args: {
    of: StoryParametersStories.InlineFalse,
  },
};

export const IFrameWithHeightProps: Story = {
  ...Inline,
  name: 'IFrame With Height Props',
  args: {
    of: StoryParametersStories.NoParameters,
    inline: false,
    height: '300px',
  },
};

export const IFrameWithHeightParameter: Story = {
  ...Inline,
  name: 'IFrame With Height Parameter',
  args: {
    of: StoryParametersStories.InlineFalseWithHeight,
  },
};

export const IFrameWithIFrameHeightParameter: Story = {
  ...Inline,
  name: 'IFrame With IFrame Height Parameter',
  args: {
    of: StoryParametersStories.InlineFalseWithIframeHeight,
  },
};

export const WithDefaultInteractions: Story = {
  args: {
    of: ButtonStories.Clicking,
  },
  parameters: {
    chromatic: { delay: 500 },
  },
};

export const WithInteractionsAutoplayInProps: Story = {
  args: {
    of: ButtonStories.Clicking,
    autoplay: true,
  },
  parameters: {
    chromatic: { delay: 500 },
  },
};

export const WithInteractionsAutoplayInParameters: Story = {
  args: {
    of: ButtonStories.ClickingInDocs,
  },
  parameters: {
    chromatic: { delay: 500 },
  },
};

export const ForceInitialArgs: Story = {
  ...StoryComponentStories.ForceInitialArgs,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  args: {
    of: ButtonStories.Primary,
    storyExport: ButtonStories.Primary,
    __forceInitialArgs: true,
  } as any,
};
