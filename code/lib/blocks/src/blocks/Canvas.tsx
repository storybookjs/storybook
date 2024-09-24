/* eslint-disable react/destructuring-assignment */
import React, { useContext } from 'react';
import type { FC } from 'react';

import type { ModuleExport, ModuleExports } from 'storybook/internal/types';

import type { Layout, PreviewProps as PurePreviewProps } from '../components';
import { Preview as PurePreview } from '../components';
import { DocsContext } from './DocsContext';
import type { SourceProps } from './Source';
import { useSourceProps } from './Source';
import { SourceContext } from './SourceContainer';
import type { StoryProps } from './Story';
import { Story } from './Story';
import { useOf } from './useOf';

type CanvasProps = Pick<PurePreviewProps, 'withToolbar' | 'additionalActions' | 'className'> & {
  /**
   * Pass the export defining a story to render that story
   *
   * ```jsx
   * import { Meta, Canvas } from '@storybook/blocks';
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
   * import { Canvas } from '@storybook/blocks';
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

export const Canvas: FC<CanvasProps> = (props) => {
  const docsContext = useContext(DocsContext);
  const sourceContext = useContext(SourceContext);
  const { of, source } = props;
  if ('of' in props && of === undefined) {
    throw new Error('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
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

  return (
    <PurePreview
      withSource={sourceState === 'none' ? undefined : sourceProps}
      isExpanded={sourceState === 'shown'}
      withToolbar={withToolbar}
      additionalActions={additionalActions}
      className={className}
      layout={layout}
    >
      <Story of={of || story.moduleExport} meta={props.meta} {...props.story} />
    </PurePreview>
  );
};
