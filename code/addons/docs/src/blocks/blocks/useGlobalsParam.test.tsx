// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GLOBALS_UPDATED } from 'storybook/internal/core-events';
import type { DocsContextProps } from 'storybook/internal/types';

import { useGlobalsParam } from './useGlobalsParam';

const createMockContext = (
  storyContext: { initialGlobals: Record<string, unknown>; globals: Record<string, unknown> },
  handlers: Record<string, (...args: any[]) => void>
) =>
  ({
    storyById: vi.fn((id?: string) => ({ id })),
    getStoryContext: vi.fn(() => storyContext),
    channel: {
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        handlers[event] = cb;
      }),
      off: vi.fn(),
    },
  }) as unknown as DocsContextProps;

describe('useGlobalsParam', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns an empty string when there is no story', () => {
    const { result } = renderHook(() =>
      useGlobalsParam(undefined, createMockContext({} as any, {}))
    );
    expect(result.current).toBe('');
  });

  it('serializes the active globals, omitting those left at their default', () => {
    const context = createMockContext(
      { initialGlobals: { theme: 'light' }, globals: { theme: 'dark' } },
      {}
    );
    const { result } = renderHook(() => useGlobalsParam('button--primary', context));
    expect(result.current).toBe('theme:dark');
  });

  it('updates when the user changes a global from the toolbar', () => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const context = createMockContext(
      { initialGlobals: { theme: 'light' }, globals: { theme: 'light' } },
      handlers
    );
    const { result } = renderHook(() => useGlobalsParam('button--primary', context));
    expect(result.current).toBe('');

    act(() => {
      handlers[GLOBALS_UPDATED]({ initialGlobals: { theme: 'light' }, globals: { theme: 'dark' } });
    });
    expect(result.current).toBe('theme:dark');
  });
});
