// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import React from 'react';
import type { FC, PropsWithChildren } from 'react';

import type { PreparedStory } from 'storybook/internal/types';

import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import { usePrimaryStory } from './usePrimaryStory';

const stories: Record<string, Partial<PreparedStory>> = {
  story1: { name: 'Story One', tags: ['!autodocs'] },
  story2: { name: 'Story Two', tags: ['autodocs'] },
  story3: { name: 'Story Three', tags: ['autodocs'] },
  story4: { name: 'Story Four', tags: [] },
};

const createMockContext = (storyList: PreparedStory[]) => ({
  componentStories: vi.fn(() => storyList),
});

const Wrapper: FC<PropsWithChildren<{ context: Partial<DocsContextProps> }>> = ({
  children,
  context,
}) => <DocsContext.Provider value={context as DocsContextProps}>{children}</DocsContext.Provider>;

describe('usePrimaryStory', () => {
  it('ignores !autodocs stories', () => {
    const mockContext = createMockContext([
      stories.story1,
      stories.story2,
      stories.story3,
    ] as PreparedStory[]);
    const { result } = renderHook(() => usePrimaryStory(), {
      wrapper: ({ children }) => <Wrapper context={mockContext}>{children}</Wrapper>,
    });
    expect(result.current?.name).toBe('Story Two');
  });

  it('selects the first autodocs story', () => {
    const mockContext = createMockContext([stories.story2, stories.story3] as PreparedStory[]);
    const { result } = renderHook(() => usePrimaryStory(), {
      wrapper: ({ children }) => <Wrapper context={mockContext}>{children}</Wrapper>,
    });
    expect(result.current?.name).toBe('Story Two');
  });

  it('returns undefined if no story has "autodocs" tag', () => {
    const mockContext = createMockContext([stories.story1, stories.story4] as PreparedStory[]);
    const { result } = renderHook(() => usePrimaryStory(), {
      wrapper: ({ children }) => <Wrapper context={mockContext}>{children}</Wrapper>,
    });
    expect(result.current).toBeUndefined();
  });

  it('returns undefined for empty story list', () => {
    const mockContext = createMockContext([]);
    const { result } = renderHook(() => usePrimaryStory(), {
      wrapper: ({ children }) => <Wrapper context={mockContext}>{children}</Wrapper>,
    });
    expect(result.current).toBeUndefined();
  });
});
