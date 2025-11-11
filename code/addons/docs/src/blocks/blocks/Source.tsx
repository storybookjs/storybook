import type { ComponentProps } from 'react';
import React, { useContext, useMemo } from 'react';

import { SourceType } from 'storybook/internal/docs-tools';
import type { Args, ModuleExport, StoryId } from 'storybook/internal/types';

import type { SourceCodeProps } from '../components/Source';
import { Source as PureSource, SourceError } from '../components/Source';
import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import type { SourceContextProps, SourceItem } from './SourceContainer';
import { SourceContext, UNKNOWN_ARGS_HASH, argsHash } from './SourceContainer';
import { useTransformCode } from './useTransformCode';

export type SourceParameters = SourceCodeProps & {
  /** Where to read the source code from, see `SourceType` */
  type?: SourceType;
  /** Transform the detected source for display */
  transform?: (
    code: string,
    storyContext: ReturnType<DocsContextProps['getStoryContext']>
  ) => string | Promise<string>;
  /** Internal: set by our CSF loader (`enrichCsf` in `storybook/internal/csf-tools`). */
  originalSource?: string;
};

export type SourceProps = SourceParameters & {
  /**
   * Pass the export defining a story to render its source
   *
   * ```jsx
   * import { Source } from '@storybook/addon-docs/blocks';
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

const useCode = ({
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
  const parameters = storyContext.parameters ?? {};
  const { __isArgsStory: isArgsStory } = parameters;
  const sourceParameters = (parameters.docs?.source || {}) as SourceParameters;

  const type = typeFromProps || sourceParameters.type || SourceType.AUTO;

  const useSnippet =
    // if user has explicitly set this as dynamic, use snippet
    type === SourceType.DYNAMIC ||
    // if this is an args story and there's a snippet
    (type === SourceType.AUTO && snippet && isArgsStory);

  const code = useSnippet ? snippet : sourceParameters.originalSource || '';
  const transformer = transformFromProps ?? sourceParameters.transform;

  const transformedCode = transformer ? useTransformCode(code, transformer, storyContext) : code;

  if (sourceParameters.code !== undefined) {
    return sourceParameters.code;
  }

  return transformedCode;
};

// state is used by the Canvas block, which also calls useSourceProps
type PureSourceProps = ComponentProps<typeof PureSource>;

export const useSourceProps = (
  props: SourceProps,
  docsContext: DocsContextProps<any>,
  sourceContext: SourceContextProps
): PureSourceProps => {
  const { of } = props;

  const story = useMemo(() => {
    if (of) {
      const resolved = docsContext.resolveOf(of, ['story']);
      return resolved.story;
    } else {
      try {
        // Always fall back to the primary story for source parameters, even if code is set.
        return docsContext.storyById();
      } catch (err) {
        // You are allowed to use <Source code="..." /> and <Canvas /> unattached.
      }
    }
  }, [docsContext, of]);

  const storyContext = story ? docsContext.getStoryContext(story) : {};

  const argsForSource = props.__forceInitialArgs
    ? storyContext.initialArgs
    : storyContext.unmappedArgs;

  const source = story ? getStorySource(story.id, argsForSource, sourceContext) : null;

  const transformedCode = useCode({
    snippet: source ? source.code : '',
    storyContext: { ...storyContext, args: argsForSource },
    typeFromProps: props.type as SourceType,
    transformFromProps: props.transform,
  });

  if ('of' in props && of === undefined) {
    throw new Error('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
  }

  const sourceParameters = (story?.parameters?.docs?.source || {}) as SourceParameters;
  let format = props.format;

  const language = props.language ?? sourceParameters.language ?? 'jsx';
  const dark = props.dark ?? sourceParameters.dark ?? false;

  if (!props.code && !story) {
    return { error: SourceError.SOURCE_UNAVAILABLE };
  }

  if (props.code) {
    return {
      code: props.code,
      format,
      language,
      dark,
    };
  }

  format = source?.format ?? true;

  return {
    code: transformedCode,
    format,
    language,
    dark,
  };
};

/**
 * Story source doc block renders source code if provided, or the source for a story if `storyId` is
 * provided, or the source for the current story if nothing is provided.
 */
export const Source = (props: SourceProps) => {
  const sourceContext = useContext(SourceContext);
  const docsContext = useContext(DocsContext);
  const sourceProps = useSourceProps(props, docsContext, sourceContext);
  return <PureSource {...sourceProps} />;
};
