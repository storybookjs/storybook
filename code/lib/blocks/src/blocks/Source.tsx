import type { ComponentProps, FC } from 'react';
import React, { useContext } from 'react';

import { SourceType } from 'storybook/internal/docs-tools';
import type { Args, ModuleExport, PreparedStory, StoryId } from 'storybook/internal/types';

import type { SourceCodeProps } from '../components/Source';
import { Source as PureSource, SourceError } from '../components/Source';
import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import type { SourceContextProps, SourceItem } from './SourceContainer';
import { SourceContext, UNKNOWN_ARGS_HASH, argsHash } from './SourceContainer';

type SourceParameters = SourceCodeProps & {
  /** Where to read the source code from, see `SourceType` */
  type?: SourceType;
  /** Transform the detected source for display */
  transform?: (
    code: string,
    storyContext: ReturnType<DocsContextProps['getStoryContext']>
  ) => string;
  /** Internal: set by our CSF loader (`enrichCsf` in `@storybook/csf-tools`). */
  originalSource?: string;
};

export type SourceProps = SourceParameters & {
  /**
   * Pass the export defining a story to render its source
   *
   * ```jsx
   * import { Source } from '@storybook/blocks';
   * import * as ButtonStories from './Button.stories';
   *
   * <Source of={ButtonStories.Primary} />;
   * ```
   */
  of?: ModuleExport;

  /** Internal prop to control if a story re-renders on args updates */
  __forceInitialArgs?: boolean;
};

const getStorySource = (
  storyId: StoryId,
  args: Args,
  sourceContext: SourceContextProps
): SourceItem => {
  const { sources } = sourceContext;

  const sourceMap = sources?.[storyId];
  // If the source decorator hasn't provided args, we fallback to the "unknown args"
  // version of the source (which means if you render a story >1 time with different args
  // you'll get the same source value both times).
  const source = sourceMap?.[argsHash(args)] || sourceMap?.[UNKNOWN_ARGS_HASH];

  // source rendering is async so source is unavailable at the start of the render cycle,
  // so we fail gracefully here without warning
  return source || { code: '' };
};

const getSnippet = ({
  snippet,
  storyContext,
  typeFromProps,
  transformFromProps,
}: {
  snippet: string;
  storyContext: ReturnType<DocsContextProps['getStoryContext']>;
  typeFromProps: SourceType;
  transformFromProps?: SourceProps['transform'];
}): string => {
  const { __isArgsStory: isArgsStory } = storyContext.parameters;
  const sourceParameters = (storyContext.parameters.docs?.source || {}) as SourceParameters;

  const type = typeFromProps || sourceParameters.type || SourceType.AUTO;

  // if user has hard-coded the snippet, that takes precedence
  if (sourceParameters.code !== undefined) {
    return sourceParameters.code;
  }

  const useSnippet =
    // if user has explicitly set this as dynamic, use snippet
    type === SourceType.DYNAMIC ||
    // if this is an args story and there's a snippet
    (type === SourceType.AUTO && snippet && isArgsStory);

  const code = useSnippet ? snippet : sourceParameters.originalSource || '';

  const transformer = transformFromProps ?? sourceParameters.transform;

  return transformer?.(code, storyContext) || code;
};

// state is used by the Canvas block, which also calls useSourceProps
type PureSourceProps = ComponentProps<typeof PureSource>;

export const useSourceProps = (
  props: SourceProps,
  docsContext: DocsContextProps<any>,
  sourceContext: SourceContextProps
): PureSourceProps => {
  let story: PreparedStory;
  const { of } = props;
  if ('of' in props && of === undefined) {
    throw new Error('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
  }

  if (of) {
    const resolved = docsContext.resolveOf(of, ['story']);
    story = resolved.story;
  } else {
    try {
      // Always fall back to the primary story for source parameters, even if code is set.
      story = docsContext.storyById();
    } catch (err) {
      // You are allowed to use <Source code="..." /> and <Canvas /> unattached.
    }
  }

  const sourceParameters = (story?.parameters?.docs?.source || {}) as SourceParameters;
  const { code } = props; // We will fall back to `sourceParameters.code`, but per story below
  let format = props.format ?? sourceParameters.format;
  const language = props.language ?? sourceParameters.language ?? 'jsx';
  const dark = props.dark ?? sourceParameters.dark ?? false;

  if (!code && !story) {
    return { error: SourceError.SOURCE_UNAVAILABLE };
  }
  if (code) {
    return {
      code,
      format,
      language,
      dark,
    };
  }
  const storyContext = docsContext.getStoryContext(story);

  // eslint-disable-next-line no-underscore-dangle
  const argsForSource = props.__forceInitialArgs
    ? storyContext.initialArgs
    : storyContext.unmappedArgs;

  const source = getStorySource(story.id, argsForSource, sourceContext);
  format = source.format ?? story.parameters.docs?.source?.format ?? false;

  return {
    code: getSnippet({
      snippet: source.code,
      storyContext: { ...storyContext, args: argsForSource },
      typeFromProps: props.type,
      transformFromProps: props.transform,
    }),
    format,
    language,
    dark,
  };
};

/**
 * Story source doc block renders source code if provided, or the source for a story if `storyId` is
 * provided, or the source for the current story if nothing is provided.
 */
export const Source: FC<SourceProps> = (props) => {
  const sourceContext = useContext(SourceContext);
  const docsContext = useContext(DocsContext);
  const sourceProps = useSourceProps(props, docsContext, sourceContext);
  return <PureSource {...sourceProps} />;
};
