import React from 'react';

import { requireChannel } from 'storybook/internal/channels';
import {
  RESET_STORY_ARGS,
  STORY_ARGS_UPDATED,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';
import type { DocsContextProps, StoryContext } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, waitFor } from 'storybook/test';

import * as StoryComponentStories from '../components/Story.stories';
import * as ButtonStories from '../examples/Button.stories';
import * as StoryParametersStories from '../examples/StoryParameters.stories';
import { Story as StoryBlock } from './Story';

const meta = {
  component: StoryBlock,
  parameters: {
    layout: 'fullscreen',
    relativeCsfPaths: ['../examples/Button.stories', '../examples/StoryParameters.stories'],
    docsStyles: true,
  },
} satisfies Meta<typeof StoryBlock>;
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

export const InlineHtmlLang: Story = {
  ...Inline,
  args: {
    of: StoryParametersStories.HtmlLang,
    inline: true,
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const inner = canvasElement.querySelector('[id$="-inner"]');
      expect(inner).toHaveAttribute('lang', 'fr');
    });
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

const channel = requireChannel();

const primaryStoryId = (loaded: StoryContext['loaded']) =>
  (loaded.docsContext as DocsContextProps).resolveOf(ButtonStories.Primary, ['story']).story.id;

const iframeButton = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('iframe')!.contentDocument!.querySelector('#storybook-root button');

const waitForIframeText = (canvasElement: HTMLElement, text: string) =>
  waitFor(() => expect(iframeButton(canvasElement)).toHaveTextContent(text), { timeout: 10000 });

const argsUpdated = () => new Promise<void>((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));

export const IFrameFollowsArgs: Story = {
  ...Inline,
  name: 'IFrame Follows Args',
  args: {
    of: ButtonStories.Primary,
    inline: false,
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  // The IFrame stories change the shared args of `ButtonStories.Primary`; put them back even when
  // a `play` function fails part-way.
  beforeEach: ({ loaded }) => {
    const storyId = primaryStoryId(loaded);
    return async () => {
      const updated = argsUpdated();
      channel.emit(RESET_STORY_ARGS, { storyId });
      await updated;
    };
  },
  play: async ({ canvasElement, loaded }) => {
    const storyId = primaryStoryId(loaded);
    await waitForIframeText(canvasElement, 'Button');

    channel.emit(UPDATE_STORY_ARGS, { storyId, updatedArgs: { label: 'Updated' } });
    await waitForIframeText(canvasElement, 'Updated');

    channel.emit(RESET_STORY_ARGS, { storyId });
    await waitForIframeText(canvasElement, 'Button');
  },
};

export const IFrameUnsetsDroppedArgs: Story = {
  ...IFrameFollowsArgs,
  name: 'IFrame Unsets Dropped Args',
  play: async ({ canvasElement, loaded }) => {
    const storyId = primaryStoryId(loaded);
    const backgroundColor = () => {
      const button = iframeButton(canvasElement)!;
      return button.ownerDocument.defaultView!.getComputedStyle(button).backgroundColor;
    };
    await waitForIframeText(canvasElement, 'Button');

    channel.emit(UPDATE_STORY_ARGS, {
      storyId,
      updatedArgs: { backgroundColor: 'rgb(255, 0, 0)' },
    });
    await waitFor(() => expect(backgroundColor()).toBe('rgb(255, 0, 0)'), { timeout: 10000 });

    channel.emit(RESET_STORY_ARGS, { storyId });
    await waitFor(() => expect(backgroundColor()).not.toBe('rgb(255, 0, 0)'), { timeout: 10000 });
  },
};

export const IFrameKeepsArgsAcrossReload: Story = {
  ...IFrameFollowsArgs,
  name: 'IFrame Keeps Args Across Reload',
  play: async ({ canvasElement, loaded }) => {
    const storyId = primaryStoryId(loaded);
    await waitForIframeText(canvasElement, 'Button');

    channel.emit(UPDATE_STORY_ARGS, { storyId, updatedArgs: { label: 'Updated' } });
    await waitForIframeText(canvasElement, 'Updated');

    const iframe = canvasElement.querySelector('iframe')!;
    const documentBeforeReload = iframe.contentDocument;
    iframe.contentWindow!.location.reload();
    await waitFor(() => expect(iframe.contentDocument).not.toBe(documentBeforeReload), {
      timeout: 10000,
    });
    await waitForIframeText(canvasElement, 'Updated');
  },
};

export const IFrameForceInitialArgs: Story = {
  ...IFrameFollowsArgs,
  name: 'IFrame Force Initial Args',
  args: {
    of: ButtonStories.Primary,
    inline: false,
    __forceInitialArgs: true,
  },
  play: async ({ canvasElement, loaded }) => {
    const storyId = primaryStoryId(loaded);
    await waitForIframeText(canvasElement, 'Button');

    const updated = argsUpdated();
    channel.emit(UPDATE_STORY_ARGS, { storyId, updatedArgs: { label: 'Updated' } });
    await updated;
    // A wrongly relayed update would have re-rendered the iframe by now.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(iframeButton(canvasElement)).toHaveTextContent('Button');
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
