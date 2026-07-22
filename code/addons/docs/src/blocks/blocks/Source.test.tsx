// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PreparedStory } from 'storybook/internal/types';

// The service-snippet path talks to the dev server; it is irrelevant to the
// code-resolution logic under test, so we stub it out here.
vi.mock('./use-service-story-docs.ts', () => ({
  useServiceStorySnippet: () => ({ data: '' }),
}));

import type { SourceContextProps } from './SourceContainer';
import type { DocsContextProps } from './DocsContext';
import type { SourceParameters, SourceProps } from './Source';
import { useSourceProps } from './Source';

const EMPTY_SOURCE_CONTEXT: SourceContextProps = { sources: {} };

const upper = (code: string) => code.toUpperCase();

/**
 * Builds a minimal `DocsContext` that always resolves to a single story with the given
 * `docs.source` parameters. When `story` is `null` the context is "unattached": `resolveOf`
 * returns no story and `storyById` throws, mirroring `<Source code="..." />` outside a story.
 */
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
  describe('code via the `code` prop', () => {
    it('renders the code verbatim when no transform is provided', () => {
      const { code } = getProps({ code: 'const x = 1;' });
      expect(code).toBe('const x = 1;');
    });

    it('ignores `transform` when `transformCode` is not set (default)', () => {
      const { code } = getProps({ code: 'const x = 1;', transform: upper });
      expect(code).toBe('const x = 1;');
    });

    it('ignores `transform` when `transformCode` is explicitly false', () => {
      const { code } = getProps({ code: 'const x = 1;', transform: upper, transformCode: false });
      expect(code).toBe('const x = 1;');
    });

    it('applies `transform` when `transformCode` is true', () => {
      const { code } = getProps({ code: 'const x = 1;', transform: upper, transformCode: true });
      expect(code).toBe('CONST X = 1;');
    });
  });

  describe('code via parameters.docs.source.code', () => {
    it('renders the parameter code verbatim by default', () => {
      const { code } = getProps({}, { code: 'const y = 2;', transform: upper });
      expect(code).toBe('const y = 2;');
    });

    it('applies the parameter `transform` when `transformCode` parameter is true', () => {
      const { code } = getProps(
        {},
        { code: 'const y = 2;', transform: upper, transformCode: true }
      );
      expect(code).toBe('CONST Y = 2;');
    });

    it('applies the prop `transform` to parameter code when `transformCode` prop is true', () => {
      const { code } = getProps(
        { transform: upper, transformCode: true },
        { code: 'const y = 2;' }
      );
      expect(code).toBe('CONST Y = 2;');
    });
  });

  describe('precedence', () => {
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

    it('prop `code` takes precedence over parameter `code`', () => {
      const { code } = getProps({ code: 'const fromProp = 1;' }, { code: 'const fromParam = 2;' });
      expect(code).toBe('const fromProp = 1;');
    });
  });

  describe('format resolution', () => {
    it('honors the `format` prop as-is when `code` is passed as a prop', () => {
      const { format } = getProps({ code: 'const x = 1;', format: 'dedent' });
      expect(format).toBe('dedent');
    });

    it('falls back to parameters.docs.source.format for parameter code', () => {
      const { format } = getProps({}, { code: 'const y = 2;', format: 'dedent' });
      expect(format).toBe('dedent');
    });
  });

  it('returns a SOURCE_UNAVAILABLE error when there is no code and no story', () => {
    const { error } = getProps({});
    expect(error).toBeDefined();
  });
});
