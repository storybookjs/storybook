// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PreparedStory } from 'storybook/internal/types';

vi.mock('./use-service-story-docs.ts', () => ({
  useServiceStorySnippet: () => ({ data: '' }),
}));

import type { SourceContextProps } from './SourceContainer';
import type { DocsContextProps } from './DocsContext';
import type { SourceParameters, SourceProps } from './Source';
import { useSourceProps } from './Source';

const EMPTY_SOURCE_CONTEXT: SourceContextProps = { sources: {} };

const upper = (code: string) => code.toUpperCase();

const createDocsContext = (sourceParameters: SourceParameters | null): DocsContextProps => {
  const story =
    sourceParameters === null
      ? undefined
      : ({
          id: 'example--story',
          parameters: { __isArgsStory: false, docs: { source: sourceParameters } },
        } as unknown as PreparedStory);

  return {
    resolveOf: () => ({ story }) as any,
    storyById: () => {
      if (!story) {
        throw new Error('unattached');
      }
      return story;
    },
    getStoryContext: () => ({
      parameters: story?.parameters ?? {},
      unmappedArgs: {},
      initialArgs: {},
    }),
  } as unknown as DocsContextProps;
};

const getProps = (props: SourceProps, sourceParameters: SourceParameters | null = null) =>
  renderHook(() => useSourceProps(props, createDocsContext(sourceParameters), EMPTY_SOURCE_CONTEXT))
    .result.current;

describe('useSourceProps – transformCode', () => {
  it('ignores `transform` for direct code by default', () => {
    const { code } = getProps({ code: 'const x = 1;', transform: upper });
    expect(code).toBe('const x = 1;');
  });

  it('applies `transform` to direct code when `transformCode` is true', () => {
    const { code } = getProps({ code: 'const x = 1;', transform: upper, transformCode: true });
    expect(code).toBe('CONST X = 1;');
  });

  it('prop `transformCode` (false) overrides parameter `transformCode` (true)', () => {
    const { code } = getProps(
      { transformCode: false },
      { code: 'const y = 2;', transform: upper, transformCode: true }
    );
    expect(code).toBe('const y = 2;');
  });

  it('prop `transformCode` (true) overrides parameter `transformCode` (false)', () => {
    const { code } = getProps(
      { transformCode: true },
      { code: 'const y = 2;', transform: upper, transformCode: false }
    );
    expect(code).toBe('CONST Y = 2;');
  });

  it('uses the prop `transform` over the parameter `transform`', () => {
    const lower = (c: string) => c.toLowerCase();
    const { code } = getProps(
      { transform: upper, transformCode: true },
      { code: 'Const Y = 2;', transform: lower }
    );
    expect(code).toBe('CONST Y = 2;');
  });

  it('prop `code` takes precedence over parameter `code`', () => {
    const { code } = getProps({ code: 'const fromProp = 1;' }, { code: 'const fromParam = 2;' });
    expect(code).toBe('const fromProp = 1;');
  });

  it('returns a SOURCE_UNAVAILABLE error when there is no code and no story', () => {
    const { error } = getProps({});
    expect(error).toBeDefined();
  });
});
