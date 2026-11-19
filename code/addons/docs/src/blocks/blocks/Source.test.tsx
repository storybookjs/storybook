// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SourceType } from 'storybook/internal/docs-tools';
import type { PreparedStory } from 'storybook/internal/types';

import type { DocsContextProps } from './DocsContext';
import type { SourceProps } from './Source';
import { useSourceProps } from './Source';
import type { SourceContextProps } from './SourceContainer';
import { UNKNOWN_ARGS_HASH } from './SourceContainer';

type ReducedStoryContext = ReturnType<DocsContextProps['getStoryContext']>;

const createMockDocsContext = (
  story: PreparedStory,
  storyContext: ReducedStoryContext
): DocsContextProps =>
  ({
    storyById: () => story,
    getStoryContext: () => storyContext,
  }) as unknown as DocsContextProps;

describe('useSourceProps — source transform handling (issue #35889)', () => {
  it('does not apply parameter transform twice when snippet arrives on later render for auto args story', () => {
    const storyContext: ReducedStoryContext = {
      id: 'story--primary',
      parameters: {
        __isArgsStory: true,
        docs: {
          source: {
            type: SourceType.AUTO,
            originalSource: '<Button />',
            transform: (code: string) => `T:${code}`,
          },
        },
      },
      args: {},
      initialArgs: {},
      unmappedArgs: {},
    } as unknown as ReducedStoryContext;
    const story: PreparedStory = {
      id: 'story--primary',
      parameters: storyContext.parameters,
    } as unknown as PreparedStory;
    const docsContext = createMockDocsContext(story, storyContext);

    const { result, rerender } = renderHook(
      ({ sourceContext, serviceSnippet, props }) =>
        useSourceProps(props, docsContext, sourceContext, serviceSnippet),
      {
        initialProps: {
          sourceContext: { sources: {} } as SourceContextProps,
          serviceSnippet: '',
          props: {} as SourceProps,
        },
      }
    );

    // Initial render before snippet arrives falls back to originalSource transformed
    expect(result.current.code).toBe('T:<Button />');

    // Snippet arrives after initial render (already transformed by emitTransformCode)
    rerender({
      sourceContext: {
        sources: {
          'story--primary': {
            [UNKNOWN_ARGS_HASH]: { code: 'T:<Button />' },
          },
        },
      },
      serviceSnippet: '',
      props: {},
    });

    // Should not apply transform a second time (would be T:T:<Button />)
    expect(result.current.code).toBe('T:<Button />');
  });

  it('does not apply parameter transform twice when snippet arrives on later render for dynamic story', () => {
    const storyContext: ReducedStoryContext = {
      id: 'story--primary',
      parameters: {
        __isArgsStory: true,
        docs: {
          source: {
            type: SourceType.DYNAMIC,
            originalSource: '<Button />',
            transform: (code: string) => `T:${code}`,
          },
        },
      },
      args: {},
      initialArgs: {},
      unmappedArgs: {},
    } as unknown as ReducedStoryContext;
    const story: PreparedStory = {
      id: 'story--primary',
      parameters: storyContext.parameters,
    } as unknown as PreparedStory;
    const docsContext = createMockDocsContext(story, storyContext);

    const { result, rerender } = renderHook(
      ({ sourceContext, serviceSnippet, props }) =>
        useSourceProps(props, docsContext, sourceContext, serviceSnippet),
      {
        initialProps: {
          sourceContext: { sources: {} } as SourceContextProps,
          serviceSnippet: '',
          props: {} as SourceProps,
        },
      }
    );

    expect(result.current.code).toBe('');

    // Snippet arrives after initial render
    rerender({
      sourceContext: {
        sources: {
          'story--primary': {
            [UNKNOWN_ARGS_HASH]: { code: 'T:<Button />' },
          },
        },
      },
      serviceSnippet: '',
      props: {},
    });

    expect(result.current.code).toBe('T:<Button />');
  });

  it('applies transform when raw service snippet arrives even if emitted snippet is present', () => {
    const storyContext: ReducedStoryContext = {
      id: 'story--primary',
      parameters: {
        __isArgsStory: true,
        docs: {
          source: {
            type: SourceType.AUTO,
            originalSource: '<Button />',
            transform: (code: string) => `T:${code}`,
          },
        },
      },
      args: {},
      initialArgs: {},
      unmappedArgs: {},
    } as unknown as ReducedStoryContext;
    const story: PreparedStory = {
      id: 'story--primary',
      parameters: storyContext.parameters,
    } as unknown as PreparedStory;
    const docsContext = createMockDocsContext(story, storyContext);

    const { result, rerender } = renderHook(
      ({ sourceContext, serviceSnippet, props }) =>
        useSourceProps(props, docsContext, sourceContext, serviceSnippet),
      {
        initialProps: {
          sourceContext: {
            sources: {
              'story--primary': {
                [UNKNOWN_ARGS_HASH]: { code: 'T:<Button />' },
              },
            },
          } as SourceContextProps,
          serviceSnippet: '',
          props: {} as SourceProps,
        },
      }
    );

    expect(result.current.code).toBe('T:<Button />');

    // Raw service snippet arrives: not pre-transformed, so transform must be applied
    rerender({
      sourceContext: {
        sources: {
          'story--primary': {
            [UNKNOWN_ARGS_HASH]: { code: 'T:<Button />' },
          },
        },
      },
      serviceSnippet: '<Svc />',
      props: {},
    });

    expect(result.current.code).toBe('T:<Svc />');
  });

  it('transforms originalSource once for type code even when snippet is present', () => {
    const storyContext: ReducedStoryContext = {
      id: 'story--primary',
      parameters: {
        __isArgsStory: true,
        docs: {
          source: {
            type: SourceType.CODE,
            originalSource: '<Button />',
            transform: (code: string) => `T:${code}`,
          },
        },
      },
      args: {},
      initialArgs: {},
      unmappedArgs: {},
    } as unknown as ReducedStoryContext;
    const story: PreparedStory = {
      id: 'story--primary',
      parameters: storyContext.parameters,
    } as unknown as PreparedStory;
    const docsContext = createMockDocsContext(story, storyContext);

    const { result } = renderHook(
      ({ sourceContext, serviceSnippet, props }) =>
        useSourceProps(props, docsContext, sourceContext, serviceSnippet),
      {
        initialProps: {
          sourceContext: {
            sources: {
              'story--primary': {
                [UNKNOWN_ARGS_HASH]: { code: 'T:<Snippet />' },
              },
            },
          } as SourceContextProps,
          serviceSnippet: '',
          props: {} as SourceProps,
        },
      }
    );

    expect(result.current.code).toBe('T:<Button />');
  });

  it('transforms originalSource once for auto non-args story even when snippet is present', () => {
    const storyContext: ReducedStoryContext = {
      id: 'story--primary',
      parameters: {
        __isArgsStory: false,
        docs: {
          source: {
            type: SourceType.AUTO,
            originalSource: '<Button />',
            transform: (code: string) => `T:${code}`,
          },
        },
      },
      args: {},
      initialArgs: {},
      unmappedArgs: {},
    } as unknown as ReducedStoryContext;
    const story: PreparedStory = {
      id: 'story--primary',
      parameters: storyContext.parameters,
    } as unknown as PreparedStory;
    const docsContext = createMockDocsContext(story, storyContext);

    const { result } = renderHook(
      ({ sourceContext, serviceSnippet, props }) =>
        useSourceProps(props, docsContext, sourceContext, serviceSnippet),
      {
        initialProps: {
          sourceContext: {
            sources: {
              'story--primary': {
                [UNKNOWN_ARGS_HASH]: { code: 'T:<Snippet />' },
              },
            },
          } as SourceContextProps,
          serviceSnippet: '',
          props: {} as SourceProps,
        },
      }
    );

    expect(result.current.code).toBe('T:<Button />');
  });

  it('applies transformFromProps to emitted snippet when explicitly provided on props', () => {
    const storyContext: ReducedStoryContext = {
      id: 'story--primary',
      parameters: {
        __isArgsStory: true,
        docs: {
          source: {
            type: SourceType.DYNAMIC,
            transform: (code: string) => `T:${code}`,
          },
        },
      },
      args: {},
      initialArgs: {},
      unmappedArgs: {},
    } as unknown as ReducedStoryContext;
    const story: PreparedStory = {
      id: 'story--primary',
      parameters: storyContext.parameters,
    } as unknown as PreparedStory;
    const docsContext = createMockDocsContext(story, storyContext);

    const { result } = renderHook(
      ({ sourceContext, serviceSnippet, props }) =>
        useSourceProps(props, docsContext, sourceContext, serviceSnippet),
      {
        initialProps: {
          sourceContext: {
            sources: {
              'story--primary': {
                [UNKNOWN_ARGS_HASH]: { code: 'T:<Button />' },
              },
            },
          } as SourceContextProps,
          serviceSnippet: '',
          props: {
            transform: (code: string) => `/*prop*/ ${code}`,
          } as SourceProps,
        },
      }
    );

    expect(result.current.code).toBe('/*prop*/ T:<Button />');
  });
});
