// @vitest-environment happy-dom
import React from 'react';

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StoriesHash } from 'storybook/manager-api';
import { ManagerContext } from 'storybook/manager-api';

import { useExpanded } from './useExpanded.ts';

const managerContext: any = {
  state: {},
  api: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ManagerContext.Provider value={managerContext}>{children}</ManagerContext.Provider>
);

const root = (id: string, startCollapsed = false): StoriesHash[string] =>
  ({
    type: 'root',
    id,
    name: id,
    depth: 0,
    children: [],
    startCollapsed,
  }) as any;

describe('useExpanded', () => {
  it('expands a default root when it first appears, without reopening collapsed ones', () => {
    const initial: StoriesHash = { a: root('a') };
    const { result, rerender } = renderHook(
      ({ data }) => useExpanded({ data, selectedStoryId: null }),
      { wrapper, initialProps: { data: initial } }
    );
    expect(result.current[0].has('a')).toBe(true);

    rerender({ data: { ...initial, b: root('b') } });
    expect(result.current[0].has('b')).toBe(true);

    act(() => result.current[1]({ ids: ['b'], append: true, value: false }));
    expect(result.current[0].has('b')).toBe(false);

    rerender({ data: { ...initial, b: root('b'), c: root('c') } });
    expect(result.current[0].has('b')).toBe(false);
    expect(result.current[0].has('c')).toBe(true);
  });

  it('keeps a startCollapsed root collapsed when it appears after mount', () => {
    const initial: StoriesHash = { a: root('a') };
    const { result, rerender } = renderHook(
      ({ data }) => useExpanded({ data, selectedStoryId: null }),
      { wrapper, initialProps: { data: initial } }
    );

    rerender({ data: { ...initial, b: root('b', true) } });
    expect(result.current[0].has('b')).toBe(false);
  });
});
