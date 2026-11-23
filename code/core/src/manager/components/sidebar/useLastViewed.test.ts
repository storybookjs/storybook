// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Selection, StoryRef } from './types.ts';
import { useLastViewed } from './useLastViewed.ts';

const ref = (storyId: string, refId = 'storybook_internal'): StoryRef => ({ storyId, refId });

const store = (items: unknown) => localStorage.setItem('lastViewedStoryIds', JSON.stringify(items));
const stored = () => JSON.parse(localStorage.getItem('lastViewedStoryIds') ?? 'null');

const renderLastViewed = (selection: Selection) =>
  renderHook((props: { selection: Selection }) => useLastViewed(props.selection), {
    initialProps: { selection },
  });

describe('useLastViewed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('reads the stored entries and drops the malformed ones', () => {
    store([ref('a'), null, 'b', { storyId: 'c' }, ref('d', 'composed')]);

    const { result } = renderLastViewed(null);

    expect(result.current.lastViewed).toEqual([ref('a'), ref('d', 'composed')]);
  });

  it('drops the entries whose fields have the wrong type', () => {
    store([
      { storyId: {}, refId: 'storybook_internal' },
      { storyId: 'a', refId: 1 },
      { storyId: '', refId: 'storybook_internal' },
      { storyId: 'b', refId: '' },
      { ...ref('c'), anchor: 5 },
      { ...ref('d'), anchor: null },
      [ref('e')],
      { ...ref('f'), anchor: 'usage' },
      ref('g'),
    ]);

    const { result } = renderLastViewed(null);

    expect(result.current.lastViewed).toEqual([{ ...ref('f'), anchor: 'usage' }, ref('g')]);
  });

  it('starts empty when nothing valid is stored', () => {
    store({ storyId: 'a', refId: 'storybook_internal' });

    const { result } = renderLastViewed(null);

    expect(result.current.lastViewed).toEqual([]);
  });

  it('puts every opened entry first and saves the list', () => {
    store([ref('a'), ref('b'), ref('c')]);

    const { result, rerender } = renderLastViewed(ref('b'));
    expect(result.current.lastViewed).toEqual([ref('b'), ref('a'), ref('c')]);

    rerender({ selection: ref('d') });
    expect(result.current.lastViewed).toEqual([ref('d'), ref('b'), ref('a'), ref('c')]);

    rerender({ selection: { ...ref('a'), anchor: 'usage' } });
    expect(result.current.lastViewed).toEqual([
      { ...ref('a'), anchor: 'usage' },
      ref('d'),
      ref('b'),
      ref('a'),
      ref('c'),
    ]);

    vi.advanceTimersByTime(1000);
    expect(stored()).toEqual([
      { ...ref('a'), anchor: 'usage' },
      ref('d'),
      ref('b'),
      ref('a'),
      ref('c'),
    ]);
  });

  it('keeps the list when the opened entry is already first', () => {
    store([ref('a'), ref('b')]);

    const { result, rerender } = renderLastViewed(ref('a'));
    const initial = result.current.lastViewed;
    rerender({ selection: ref('a') });

    expect(result.current.lastViewed).toBe(initial);
  });

  it('keeps only the current entry when cleared', () => {
    store([ref('a'), ref('b'), ref('c')]);

    const { result } = renderLastViewed(ref('c'));
    act(() => result.current.clearLastViewed());

    expect(result.current.lastViewed).toEqual([ref('c')]);
    vi.advanceTimersByTime(1000);
    expect(stored()).toEqual([ref('c')]);
  });
});
