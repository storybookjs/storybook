/* oxlint-disable react-classic/destructuring-assignment */
import React, { useCallback, useContext } from 'react';
import type { FC } from 'react';

import { FORCE_REMOUNT } from 'storybook/internal/core-events';
import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';
import type { ModuleExport, ModuleExports, StoryId } from 'storybook/internal/types';

import type { Layout, PreviewProps as PurePreviewProps } from '../components';
import { Preview as PurePreview, PreviewSkeleton } from '../components';
import { DocsContext } from './DocsContext';
import type { SourceProps } from './Source';
import { useSourceProps } from './Source';
import { SourceContext } from './SourceContainer';
import type { StoryProps } from './Story';
import { Story, getStoryId } from './Story';
import { useOf } from './useOf';
import { useStory } from './useStory';
import { withMdxComponentOverride } from './with-mdx-component-override';

type CanvasProps = Pick<PurePreviewProps, 'withToolbar' | 'additionalActions' | 'className'> & {
  /**
   * Pass the export defining a story to render that story
   *
   * ```jsx
   * import { Meta, Canvas } from '@storybook/addon-docs/blocks';
   * import * as ButtonStories from './Button.stories';
   *
   * <Meta of={ButtonStories} />
   * <Canvas of={ButtonStories.Primary} />
   * ```
   */
  of?: ModuleExport;
  /**
   * Pass all exports of the CSF file if this MDX file is unattached
   *
   * ```jsx
   * import { Canvas } from '@storybook/addon-docs/blocks';
   * import * as ButtonStories from './Button.stories';
   *
   * <Canvas of={ButtonStories.Primary} meta={ButtonStories} />;
   * ```
   */
  meta?: ModuleExports;
  /**
   * Pass the id of a story to render a story whose CSF file this docs file cannot import, such as
   * a story of another package
   *
   * ```jsx
   * import { Canvas } from '@storybook/addon-docs/blocks';
   *
   * <Canvas id="example-button--primary" />;
   * ```
   *
   * The id is an unattached reference. Nothing checks it before the docs page renders: renaming
   * the story or changing its title changes the id, and the page then shows an error. A change to
   * the story's file does not update an inline story until the docs page renders again. Prefer `of`
   * when the docs file can import the story.
   */
  id?: StoryId;
  /**
   * Specify the initial state of the source panel hidden: the source panel is hidden by default
   * shown: the source panel is shown by default none: the source panel is not available and the
   * button to show it is hidden
   *
   * @default 'hidden'
   */
  sourceState?: 'hidden' | 'shown' | 'none';
  /**
   * How to layout the story within the canvas padded: the story has padding within the canvas
   * fullscreen: the story is rendered edge to edge within the canvas centered: the story is
   * centered within the canvas
   *
   * @default 'padded'
   */
  layout?: Layout;
  /** @see {SourceProps} */
  source?: Omit<SourceProps, 'dark'>;
  /** @see {StoryProps} */
  story?: Pick<StoryProps, 'inline' | 'height' | 'autoplay' | '__forceInitialArgs' | '__primary'>;
};

const CanvasOf: FC<CanvasProps> = (props) => {
  const docsContext = useContext(DocsContext);
  const sourceContext = useContext(SourceContext);
  const { of, source } = props;
  if ('of' in props && of === undefined) {
    throw new InvalidBlockOfPropError();
  }

  const { story } = useOf(of || 'story', ['story']);
  const sourceProps = useSourceProps({ ...source, ...(of && { of }) }, docsContext, sourceContext);

  const layout =
    props.layout ?? story.parameters.layout ?? story.parameters.docs?.canvas?.layout ?? 'padded';
  const withToolbar = props.withToolbar ?? story.parameters.docs?.canvas?.withToolbar ?? false;
  const additionalActions =
    props.additionalActions ?? story.parameters.docs?.canvas?.additionalActions;
  const sourceState = props.sourceState ?? story.parameters.docs?.canvas?.sourceState ?? 'hidden';
  const className = props.className ?? story.parameters.docs?.canvas?.className;
  // By default, stories will be iframed, but most frameworks support inline rendering and override that in a docs entry file
  const inline = props.story?.inline ?? story.parameters?.docs?.story?.inline ?? false;

  const handleReloadStory = useCallback(() => {
    docsContext.channel.emit(FORCE_REMOUNT, { storyId: story.id });
  }, [docsContext.channel, story.id]);

  return (
    <PurePreview
      withSource={sourceState === 'none' ? undefined : sourceProps}
      isExpanded={sourceState === 'shown'}
      withToolbar={withToolbar}
      additionalActions={additionalActions}
      className={className}
      layout={layout}
      inline={inline}
      onReloadStory={inline ? handleReloadStory : undefined}
    >
      <Story of={of || story.moduleExport} meta={props.meta} {...props.story} />
    </PurePreview>
  );
};

// Loading the story makes the docs context reference its CSF file, so from then on the story
// resolves by its export like a story the docs file imports.
const CanvasById: FC<CanvasProps> = (props) => {
  const docsContext = useContext(DocsContext);
  const story = useStory(getStoryId(props, docsContext), docsContext);
  if (!story) {
    return <PreviewSkeleton />;
  }
  return <CanvasOf {...props} of={story.moduleExport} />;
};

const CanvasImpl: FC<CanvasProps> = (props) =>
  props.id === undefined ? <CanvasOf {...props} /> : <CanvasById {...props} />;

export const Canvas = withMdxComponentOverride('Canvas', CanvasImpl);
