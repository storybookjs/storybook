import type { ComponentProps, FC } from 'react';
import React, { useContext, useMemo } from 'react';

import { SourceType } from 'storybook/internal/docs-tools';
import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';
import type { Args, ModuleExport, StoryId } from 'storybook/internal/types';

import type { SourceCodeProps } from '../components/Source';
import { Source as PureSource, SourceError } from '../components/Source';
import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import type { SourceContextProps, SourceItem } from './SourceContainer';
import { SourceContext, UNKNOWN_ARGS_HASH, argsHash } from './SourceContainer';
import { useServiceStorySnippet } from './use-service-story-docs.ts';
import { useTransformCode } from './useTransformCode';
import { withMdxComponentOverride } from './with-mdx-component-override';

export type SourceParameters = SourceCodeProps & {
  /** Where to read the source code from, see `SourceType` */
  type?: SourceType;
  /** Transform the detected source for display */
  transform?: (
    code: string,
    storyContext: ReturnType<DocsContextProps['getStoryContext']>
  ) => string | Promise<string>;
  transformCode?: boolean;
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

const IDENTITY_TRANSFORM = (code: string) => code;

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
  props,
  sourceParameters,
  snippet,
  serviceSnippet,
  storyContext,
}: {
  props: SourceProps;
  sourceParameters: SourceParameters;
  snippet: string;
  serviceSnippet: string;
  storyContext: ReturnType<DocsContextProps['getStoryContext']>;
}): { code: string; hasDirectCode: boolean } => {
  const directCode = props.code ?? sourceParameters.code;
  const hasDirectCode = directCode !== undefined;

  let codeToTransform: string;
  let transformer: SourceProps['transform'] | undefined;

  if (hasDirectCode) {
    codeToTransform = directCode;
    const shouldTransform = props.transformCode ?? sourceParameters.transformCode ?? false;
    transformer = shouldTransform ? (props.transform ?? sourceParameters.transform) : undefined;
  } else {
    const { __isArgsStory: isArgsStory } = storyContext.parameters ?? {};
    const type = props.type || sourceParameters.type || SourceType.AUTO;
    const staticSnippet = serviceSnippet || snippet;
    const useSnippet =
      // if user has explicitly set this as dynamic, use snippet
      type === SourceType.DYNAMIC ||
      // if this is an args story and there's a snippet
      (type === SourceType.AUTO && staticSnippet && isArgsStory);

    codeToTransform = useSnippet ? staticSnippet : sourceParameters.originalSource || '';
    transformer = props.transform ?? sourceParameters.transform;
  }

  const transformedCode = useTransformCode(
    codeToTransform,
    transformer ?? IDENTITY_TRANSFORM,
    storyContext
  );

  return { code: transformer ? transformedCode : codeToTransform, hasDirectCode };
};

// state is used by the Canvas block, which also calls useSourceProps
type PureSourceProps = ComponentProps<typeof PureSource>;

export const useSourceProps = (
  props: SourceProps,
  docsContext: DocsContextProps,
  sourceContext: SourceContextProps,
  serviceSnippet = ''
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
      } catch {
        // You are allowed to use <Source code="..." /> and <Canvas /> unattached.
      }
    }
  }, [docsContext, of]);

  const storyContext = story ? docsContext.getStoryContext(story) : {};

  const argsForSource = props.__forceInitialArgs
    ? storyContext.initialArgs
    : storyContext.unmappedArgs;

  const source = story ? getStorySource(story.id, argsForSource, sourceContext) : null;
  const sourceParameters = (story?.parameters?.docs?.source || {}) as SourceParameters;

  const { code, hasDirectCode } = useCode({
    props,
    sourceParameters,
    snippet: source ? source.code : '',
    serviceSnippet,
    storyContext: { ...storyContext, args: argsForSource },
  });

  if ('of' in props && of === undefined) {
    throw new InvalidBlockOfPropError();
  }

  const language = props.language ?? sourceParameters.language ?? 'jsx';
  const dark = props.dark ?? sourceParameters.dark ?? false;

  if (!hasDirectCode && !story) {
    return { error: SourceError.SOURCE_UNAVAILABLE };
  }

  const format = props.code !== undefined ? props.format : (source?.format ?? true);

  return { code, format, language, dark };
};

const SourceWithStoryDocsSnippet: FC<
  SourceProps & {
    docsContext: DocsContextProps;
    sourceContext: SourceContextProps;
    storyId: string;
  }
> = ({ storyId, docsContext, sourceContext, ...props }) => {
  const serviceSnippet = useServiceStorySnippet(storyId).data ?? '';
  const sourceProps = useSourceProps(props, docsContext, sourceContext, serviceSnippet);
  return <PureSource {...sourceProps} />;
};

/**
 * Story source doc block renders source code if provided, or the source for a story if `storyId` is
 * provided, or the source for the current story if nothing is provided.
 */
const SourceWithStorySnippet = (props: SourceProps) => {
  const { of } = props;
  const sourceContext = useContext(SourceContext);
  const docsContext = useContext(DocsContext);

  const story = useMemo(() => {
    if (of) {
      const resolved = docsContext.resolveOf(of, ['story']);
      return resolved.story;
    }
    try {
      return docsContext.storyById();
    } catch {
      // You are allowed to use <Source code="..." /> and <Canvas /> unattached.
    }
  }, [docsContext, of]);

  if (globalThis.FEATURES?.experimentalDocgenServer && story?.id) {
    return (
      <SourceWithStoryDocsSnippet
        {...props}
        docsContext={docsContext}
        sourceContext={sourceContext}
        storyId={story.id}
      />
    );
  }

  const sourceProps = useSourceProps(props, docsContext, sourceContext);
  return <PureSource {...sourceProps} />;
};

const SourceWithCode = (props: SourceProps) => {
  const docsContext = useContext(DocsContext);
  const sourceProps = useSourceProps(props, docsContext, EMPTY_SOURCE_CONTEXT);

  return <PureSource {...sourceProps} />;
};

const SourceImpl = (props: SourceProps) => {
  const hasCodeProp = props.code !== undefined;
  return hasCodeProp ? <SourceWithCode {...props} /> : <SourceWithStorySnippet {...props} />;
};

export const Source = withMdxComponentOverride('Source', SourceImpl);
