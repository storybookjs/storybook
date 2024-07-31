import type { FC, ComponentProps } from 'react';
import React, { useContext } from 'react';
import type {
  Renderer,
  ModuleExport,
  ModuleExports,
  PreparedStory,
  StoryId,
} from 'storybook/internal/types';

import { Story as PureStory, StorySkeleton } from '../components';
import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import { useStory } from './useStory';

type PureStoryProps = ComponentProps<typeof PureStory>;

/**
 * Props to reference another story
 */
type StoryRefProps = {
  /**
   * Pass the export defining a story to render that story
   *
   * ```jsx
   * import { Meta, Story } from '@storybook/blocks';
   * import * as ButtonStories from './Button.stories';
   *
   * <Meta of={ButtonStories} />
   * <Story of={ButtonStories.Primary} />
   * ```
   */
  of?: ModuleExport;
  /**
   * Pass all exports of the CSF file if this MDX file is unattached
   *
   * ```jsx
   * import { Story } from '@storybook/blocks';
   * import * as ButtonStories from './Button.stories';
   *
   * <Story of={ButtonStories.Primary} meta={ButtonStories} />
   * ```
   */
  meta?: ModuleExports;
};

type StoryParameters = {
  /**
   * Render the story inline or in an iframe
   */
  inline?: boolean;
  /**
   * When rendering in an iframe (`inline={false}`), set the story height
   */
  height?: string;
  /**
   * Whether to run the story's play function
   */
  autoplay?: boolean;
  /**
   * Internal prop to control if a story re-renders on args updates
   */
  __forceInitialArgs?: boolean;
  /**
   * Internal prop if this story is the primary story
   */
  __primary?: boolean;
};

export type StoryProps = StoryRefProps & StoryParameters;

export const getStoryId = (props: StoryProps, context: DocsContextProps): StoryId => {
  const { of, meta } = props as StoryRefProps;
  if ('of' in props && of === undefined) {
    throw new Error('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
  }

  if (meta) context.referenceMeta(meta, false);
  const resolved = context.resolveOf(of || 'story', ['story']);
  return resolved.story.id;
};

export const getStoryProps = <TFramework extends Renderer>(
  props: StoryParameters,
  story: PreparedStory<TFramework>,
  context: DocsContextProps<TFramework>
): PureStoryProps => {
  const { parameters = {} } = story || {};
  const { docs = {} } = parameters;
  const storyParameters = (docs.story || {}) as StoryParameters & { iframeHeight?: string };

  if (docs.disable) {
    return null;
  }

  // prefer block props, then story parameters defined by the framework-specific settings
  // and optionally overridden by users

  const inline = props.inline ?? storyParameters.inline ?? false;

  if (inline) {
    const height = props.height ?? storyParameters.height;
    const autoplay = props.autoplay ?? storyParameters.autoplay ?? false;
    return {
      story,
      inline: true,
      height,
      autoplay,
      // eslint-disable-next-line no-underscore-dangle
      forceInitialArgs: !!props.__forceInitialArgs,
      // eslint-disable-next-line no-underscore-dangle
      primary: !!props.__primary,
      renderStoryToElement: context.renderStoryToElement,
    };
  }

  const height = props.height ?? storyParameters.height ?? storyParameters.iframeHeight ?? '100px';
  return {
    story,
    inline: false,
    height,
    // eslint-disable-next-line no-underscore-dangle
    primary: !!props.__primary,
  };
};

const Story: FC<StoryProps> = (props = { __forceInitialArgs: false, __primary: false }) => {
  const context = useContext(DocsContext);
  const storyId = getStoryId(props, context);
  const story = useStory(storyId, context);

  if (!story) {
    return <StorySkeleton />;
  }

  const storyProps = getStoryProps(props, story, context);
  if (!storyProps) {
    return null;
  }

  return <PureStory {...storyProps} />;
};

export { Story };
