import type { ComponentProps, FC } from 'react';
import React, { useContext, useMemo } from 'react';

import { isStoryDocsSnippetEligible, SourceType } from 'storybook/internal/docs-tools';
import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';
import type { Args, ModuleExport, PreparedStory, StoryId } from 'storybook/internal/types';
import type { StoryDocsSnippetSourceParameters } from 'storybook/open-service';

import type { SourceCodeProps } from '../components/Source';
import { Source as PureSource, SourceError } from '../components/Source';
import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import type { SourceContextProps, SourceItem } from './SourceContainer';
import { SourceContext, UNKNOWN_ARGS_HASH, argsHash } from './SourceContainer';
import { useDynamicSnippet } from './use-service-dynamic-snippet.ts';
import { useTransformCode } from './useTransformCode';
import { withMdxComponentOverride } from './with-mdx-component-override';

export type SourceParameters = SourceCodeProps &
  StoryDocsSnippetSourceParameters & {
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

const EMPTY_SOURCE_CONTEXT: SourceContextProps = { sources: {} };

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
  serviceSnippet,
  storyContext,
  typeFromProps,
  transformFromProps,
}: {
  snippet: string;
  serviceSnippet?: string;
  storyContext: ReturnType<DocsContextProps['getStoryContext']>;
  typeFromProps: SourceType;
  transformFromProps?: SourceProps['transform'];
}): string => {
  const parameters = storyContext.parameters ?? {};
  const { __isArgsStory: isArgsStory } = parameters;
  const sourceParameters = (parameters.docs?.source || {}) as SourceParameters;

  const type = typeFromProps || sourceParameters.type || SourceType.AUTO;

  const dynamicSnippet = serviceSnippet ?? snippet;
  const useSnippet =
    type === SourceType.DYNAMIC ||
    Boolean(type === SourceType.AUTO && dynamicSnippet && isArgsStory);
  const code =
    sourceParameters.code ?? (useSnippet ? dynamicSnippet : sourceParameters.originalSource) ?? '';
  const transformer =
    sourceParameters.code === undefined
      ? (transformFromProps ?? sourceParameters.transform)
      : undefined;

  return useTransformCode(code, transformer, storyContext);
};

// state is used by the Canvas block, which also calls useSourceProps
type PureSourceProps = ComponentProps<typeof PureSource>;

const sourceArgs = (
  props: Pick<SourceProps, '__forceInitialArgs'>,
  storyContext: Partial<ReturnType<DocsContextProps['getStoryContext']>>
): Args | undefined =>
  props.__forceInitialArgs ? storyContext.initialArgs : storyContext.unmappedArgs;

type SourceSubject =
  | {
      story: PreparedStory;
      storyContext: ReturnType<DocsContextProps['getStoryContext']>;
    }
  | { story?: undefined; storyContext?: undefined };

const useSourceSubject = (
  of: ModuleExport | undefined,
  docsContext: DocsContextProps
): SourceSubject => {
  const story = useMemo(() => {
    if (of) {
      return docsContext.resolveOf(of, ['story']).story;
    }
    try {
      return docsContext.storyById();
    } catch {
      return undefined;
    }
  }, [docsContext, of]);

  return story ? { story, storyContext: docsContext.getStoryContext(story) } : {};
};

const useResolvedSourceProps = (
  props: SourceProps,
  subject: SourceSubject,
  sourceContext: SourceContextProps,
  serviceSnippet?: string,
  serviceWarning?: string
): PureSourceProps => {
  const { of } = props;
  const { story } = subject;
  const storyContext = subject.storyContext ?? {};
  const argsForSource = sourceArgs(props, storyContext);
  const source = story ? getStorySource(story.id, argsForSource ?? {}, sourceContext) : null;

  const transformedCode = useCode({
    snippet: source ? source.code : '',
    serviceSnippet,
    storyContext: { ...storyContext, args: argsForSource },
    typeFromProps: props.type as SourceType,
    transformFromProps: props.transform,
  });

  if ('of' in props && of === undefined) {
    throw new InvalidBlockOfPropError();
  }

  const sourceParameters = (story?.parameters?.docs?.source || {}) as SourceParameters;
  let format = props.format;

  const language = props.language ?? sourceParameters.language ?? 'jsx';
  const dark = props.dark ?? sourceParameters.dark ?? false;

  if (props.code === undefined && !story) {
    return { error: SourceError.SOURCE_UNAVAILABLE };
  }

  if (props.code !== undefined) {
    return {
      code: props.code,
      format,
      language,
      dark,
    };
  }

  format = source?.format ?? true;

  let warning: string | undefined;
  if (transformedCode === serviceSnippet) {
    warning = serviceWarning;
  } else if (transformedCode === source?.code) {
    warning = source.warning;
  }

  return {
    code: transformedCode,
    format,
    language,
    dark,
    warning,
  };
};

export const useSourceProps = (
  props: SourceProps,
  docsContext: DocsContextProps,
  sourceContext: SourceContextProps,
  serviceSnippet?: string,
  serviceWarning?: string
): PureSourceProps => {
  const subject = useSourceSubject(props.of, docsContext);
  return useResolvedSourceProps(props, subject, sourceContext, serviceSnippet, serviceWarning);
};

export const useSourcePropsWithDynamicSnippet = (
  props: SourceProps,
  story: PreparedStory,
  storyContext: ReturnType<DocsContextProps['getStoryContext']>,
  sourceContext: SourceContextProps
): PureSourceProps => {
  const record = useDynamicSnippet(
    story.id,
    sourceArgs(props, storyContext),
    props.__forceInitialArgs ? 'initial' : 'current'
  ).data;
  return useResolvedSourceProps(
    props,
    { story, storyContext },
    sourceContext,
    record?.source,
    record?.warning
  );
};

const SourceWithDynamicSnippet: FC<
  SourceProps & {
    sourceContext: SourceContextProps;
    subject: Extract<SourceSubject, { story: PreparedStory }>;
  }
> = ({ subject, sourceContext, ...props }) => {
  const { story, storyContext } = subject;
  const sourceProps = useSourcePropsWithDynamicSnippet(props, story, storyContext, sourceContext);
  return <PureSource {...sourceProps} />;
};

const SourceWithResolvedSubject: FC<
  SourceProps & {
    sourceContext: SourceContextProps;
    subject: SourceSubject;
  }
> = ({ subject, sourceContext, ...props }) => {
  const sourceProps = useResolvedSourceProps(props, subject, sourceContext);
  return <PureSource {...sourceProps} />;
};

/**
 * Story source doc block renders source code if provided, or the source for a story if `storyId` is
 * provided, or the source for the current story if nothing is provided.
 */
const SourceWithStorySnippet = (props: SourceProps) => {
  const { of, type } = props;
  const sourceContext = useContext(SourceContext);
  const docsContext = useContext(DocsContext);
  const subject = useSourceSubject(of, docsContext);

  if (
    globalThis.FEATURES?.experimentalDocgenServer &&
    subject.story &&
    isStoryDocsSnippetEligible(subject.story.parameters, type)
  ) {
    return <SourceWithDynamicSnippet {...props} sourceContext={sourceContext} subject={subject} />;
  }

  return <SourceWithResolvedSubject {...props} sourceContext={sourceContext} subject={subject} />;
};

const SourceWithCode = (props: SourceProps) => {
  const docsContext = useContext(DocsContext);
  const sourceProps = useSourceProps(props, docsContext, EMPTY_SOURCE_CONTEXT);

  return <PureSource {...sourceProps} />;
};

const SourceImpl = (props: SourceProps) => {
  const { code } = props;
  const hasCodeProp = code !== undefined;
  return hasCodeProp ? <SourceWithCode {...props} /> : <SourceWithStorySnippet {...props} />;
};

export const Source = withMdxComponentOverride('Source', SourceImpl);
