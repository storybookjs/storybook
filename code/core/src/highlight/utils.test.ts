import { describe, expect, it, vi } from 'vitest';

import type { Highlight, HighlightOptions } from './types.ts';
import { isSameElementMap, useStore, normalizeOptions } from './utils.ts';

describe('useStore', () => {
  it('should return the initial value', () => {
    const { get } = useStore(1);
    expect(get()).toBe(1);
  });

  it('should update the value', () => {
    const { get, set } = useStore(1);
    set(2);
    expect(get()).toBe(2);
  });

  it('should update the value using a function', () => {
    const { get, set } = useStore(1);
    set((value) => value + 1);
    expect(get()).toBe(2);
  });

  it('should subscribe and unsubscribe from the store', () => {
    const { set, subscribe } = useStore(1);
    const callback = vi.fn();

    const unsubscribe = subscribe(callback);
    set(2);
    expect(callback).toHaveBeenCalledWith(2);

    unsubscribe();
    set(3);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should invoke listener teardowns', () => {
    const { set, subscribe } = useStore();
    const callback = vi.fn();
    subscribe(() => callback);
    set(1);
    expect(callback).toHaveBeenCalledTimes(0);
    set(2);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should teardown the store', () => {
    const { get, teardown } = useStore(1);
    teardown();
    expect(get()).toBeUndefined();
  });
});

describe('normalizeOptions', () => {
  it('should apply the default outline style for a selector-only payload', () => {
    expect(normalizeOptions({ id: 'my-highlight', selectors: ['#button'] })).toEqual({
      id: 'my-highlight',
      priority: 0,
      selectors: ['#button'],
      styles: {
        outline: '2px dashed #029cfd',
      },
      menu: undefined,
    });
  });

  it('should pass through a full HighlightOptions payload', () => {
    const options = {
      id: 'my-highlight',
      priority: 5,
      selectors: ['#button', '.box'],
      styles: { outline: '3px solid red' },
      hoverStyles: { background: 'yellow' },
      focusStyles: { background: 'green' },
    };
    expect(normalizeOptions(options)).toEqual(options);
  });

  it('should flatten a one-dimensional menu into groups', () => {
    const menuItem = { id: 'action', title: 'Action' };
    // The channel payload is untyped at runtime, so a sender can send a flat menu.
    const options = { selectors: ['#button'], menu: [menuItem] } as unknown as HighlightOptions;
    expect(normalizeOptions(options)).toEqual(expect.objectContaining({ menu: [[menuItem]] }));
  });

  it('should keep an already two-dimensional menu unchanged', () => {
    const menuItem = { id: 'action', title: 'Action' };
    expect(
      normalizeOptions({ id: 'my-highlight', selectors: ['#button'], menu: [[menuItem]] })
    ).toEqual(expect.objectContaining({ menu: [[menuItem]] }));
  });

  it('should set menu to undefined when it is not an array', () => {
    const options = { selectors: ['#button'], menu: 'not-a-menu' } as unknown as HighlightOptions;
    expect(normalizeOptions(options)).toEqual(expect.objectContaining({ menu: undefined }));
  });
});

describe('isSameElementMap', () => {
  const first = {} as HTMLElement;
  const second = {} as HTMLElement;
  const styles = { outline: '1px solid red' };
  const highlight = (selectors: string[]): Highlight => ({
    id: 'test',
    priority: 0,
    selectors,
    styles,
  });

  it('should treat freshly built maps with the same elements and data as the same', () => {
    expect(
      isSameElementMap(
        new Map([[first, highlight(['a', 'b'])]]),
        new Map([[first, highlight(['a', 'b'])]])
      )
    ).toBe(true);
  });

  it('should see a different element set', () => {
    expect(
      isSameElementMap(new Map([[first, highlight(['a'])]]), new Map([[second, highlight(['a'])]]))
    ).toBe(false);
    expect(
      isSameElementMap(
        new Map([[first, highlight(['a'])]]),
        new Map([
          [first, highlight(['a'])],
          [second, highlight(['a'])],
        ])
      )
    ).toBe(false);
  });

  it('should see different selectors or highlight data for an element', () => {
    const current = new Map([[first, highlight(['a'])]]);
    expect(isSameElementMap(current, new Map([[first, highlight(['a', 'b'])]]))).toBe(false);
    expect(
      isSameElementMap(current, new Map([[first, { ...highlight(['a']), id: 'other' }]]))
    ).toBe(false);
    expect(
      isSameElementMap(
        current,
        new Map([[first, { ...highlight(['a']), styles: { outline: 'none' } }]])
      )
    ).toBe(false);
  });
});
