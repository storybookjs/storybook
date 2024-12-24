import React from 'react';

import type { Channel } from 'storybook/internal/channels';
import {
  RESET_STORY_ARGS,
  STORY_ARGS_UPDATED,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';
import type { PreviewWeb } from 'storybook/internal/preview-api';
import type { ModuleExport, WebRenderer } from 'storybook/internal/types';

import type { PlayFunctionContext } from '@storybook/csf';
import type { Meta, ReactRenderer, StoryObj } from '@storybook/react';
import { within } from '@storybook/test';

import type { DocsContextProps } from '../blocks';
import * as ButtonStories from '../examples/Button.stories';
import type { StoryProps } from './Story';
import { Story as StoryComponent, StorySkeleton } from './Story';

// eslint-disable-next-line no-underscore-dangle
const preview = (window as any).__STORYBOOK_PREVIEW__ as PreviewWeb<ReactRenderer>;
const channel = (window as any).__STORYBOOK_ADDONS_CHANNEL__ as Channel;
const renderStoryToElement = preview.renderStoryToElement.bind(preview);

type ExtendedStoryProps = Omit<StoryProps, 'story'> & {
  storyExport: ModuleExport;
};

const meta: Meta<ExtendedStoryProps> = {
  // @ts-expect-error getting too complex with props
  component: StoryComponent,
  parameters: {
    layout: 'fullscreen',
    relativeCsfPaths: ['../examples/Button.stories'],
  },
  globals: { sb_theme: 'light' },
  args: {
    height: '100px',
    primary: false,
    // NOTE: the real story arg is a PreparedStory, which we'll get in the render function below
    storyExport: ButtonStories.Primary as any,
  },
  render({ storyExport, ...args }, { loaded }) {
    const docsContext = loaded.docsContext as DocsContextProps;
    const resolved = docsContext.resolveOf(storyExport, ['story']);
    // @ts-expect-error getting too complex with props
    return <StoryComponent {...args} story={resolved.story} />;
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Loading = {
  globals: { sb_theme: 'side-by-side' },
  render: () => <StorySkeleton />,
};

export const Inline: Story = {
  args: {
    inline: true,
    // @ts-expect-error getting too complex with props
    autoplay: false,
    forceInitialArgs: false,
    renderStoryToElement,
  },
};

export const InlineError: Story = {
  args: {
    storyExport: ButtonStories.ErrorStory,
    inline: true,
    // @ts-expect-error getting too complex with props
    autoplay: false,
    forceInitialArgs: false,
    renderStoryToElement,
  },
};

export const IFrame: Story = {
  name: 'IFrame',
  args: {
    inline: false,
  },
};

export const ForceInitialArgs = {
  args: {
    storyExport: ButtonStories.Primary,
    inline: true,
    autoplay: true,
    forceInitialArgs: true,
    renderStoryToElement,
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  // test that it ignores updated args by emitting an arg update and assert that it isn't reflected in the DOM
  play: async ({ args, canvasElement, loaded }: PlayFunctionContext<WebRenderer>) => {
    const docsContext = loaded.docsContext as DocsContextProps;
    const resolved = docsContext.resolveOf(args.storyExport, ['story']);

    await within(canvasElement).findByText(/Button/);

    const updatedPromise = new Promise<void>((resolve) => {
      channel.once(STORY_ARGS_UPDATED, resolve);
    });
    await channel.emit(UPDATE_STORY_ARGS, {
      storyId: resolved.story.id,
      updatedArgs: { label: 'Updated' },
    });
    await updatedPromise;
    await within(canvasElement).findByText(/Button/);

    await channel.emit(RESET_STORY_ARGS, { storyId: resolved.story.id });
    await new Promise<void>((resolve) => {
      channel.once(STORY_ARGS_UPDATED, resolve);
    });
  },
};

export const Autoplay: Story = {
  args: {
    storyExport: ButtonStories.Clicking,
    inline: true,
    // @ts-expect-error getting too complex with props
    autoplay: true,
    renderStoryToElement,
  },
};
