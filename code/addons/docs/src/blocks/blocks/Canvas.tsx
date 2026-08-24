/* oxlint-disable react-classic/destructuring-assignment */
import React, { useCallback, useContext } from 'react';
import type { FC } from 'react';

import { FORCE_REMOUNT } from 'storybook/internal/core-events';
import { isStoryDocsSnippetEligible } from 'storybook/internal/docs-tools';
import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';
import type { ModuleExport, ModuleExports, PreparedStory } from 'storybook/internal/types';

import type { Layout, PreviewProps as PurePreviewProps } from '../components';
import { Preview as PurePreview } from '../components';
import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import type { SourceProps } from './Source';
import { useSourceProps, useSourcePropsWithDynamicSnippet } from './Source';
import type { SourceContextProps } from './SourceContainer';
import { SourceContext } from './SourceContainer';
import type { StoryProps } from './Story';
import { Story } from './Story';
import { useOf } from './useOf';
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

type ResolvedCanvasProps = {
  docsContext: DocsContextProps;
  props: CanvasProps;
  sourceContext: SourceContextProps;
  story: PreparedStory;
};

const CanvasContent: FC<
  Omit<ResolvedCanvasProps, 'sourceContext'> & {
    sourceProps: ReturnType<typeof useSourceProps>;
  }
> = ({ docsContext, props, sourceProps, story }) => {
  const { of } = props;
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

const CanvasWithLegacySource: FC<ResolvedCanvasProps> = ({
  docsContext,
  props,
  sourceContext,
  story,
}) => {
  const sourceProps = useSourceProps(
    { ...props.source, ...(props.of && { of: props.of }) },
    docsContext,
    sourceContext
  );
  return (
    <CanvasContent
      docsContext={docsContext}
      props={props}
      sourceProps={sourceProps}
      story={story}
    />
  );
};

const CanvasWithDynamicSource: FC<ResolvedCanvasProps> = ({
  docsContext,
  props,
  sourceContext,
  story,
}) => {
  const sourceProps = useSourcePropsWithDynamicSnippet(
    { ...props.source, ...(props.of && { of: props.of }) },
    story,
    docsContext.getStoryContext(story),
    sourceContext
  );
  return (
    <CanvasContent
      docsContext={docsContext}
      props={props}
      sourceProps={sourceProps}
      story={story}
    />
  );
};

const CanvasImpl: FC<CanvasProps> = (props) => {
  const docsContext = useContext(DocsContext);
  const sourceContext = useContext(SourceContext);
  const { of } = props;
  if ('of' in props && of === undefined) {
    throw new InvalidBlockOfPropError();
  }

  const { story } = useOf(of || 'story', ['story']);
  const resolvedProps = { docsContext, props, sourceContext, story };

  return globalThis.FEATURES?.experimentalDocgenServer &&
    isStoryDocsSnippetEligible(story.parameters, props.source?.type) ? (
    <CanvasWithDynamicSource {...resolvedProps} />
  ) : (
    <CanvasWithLegacySource {...resolvedProps} />
  );
};

export const Canvas = withMdxComponentOverride('Canvas', CanvasImpl);
