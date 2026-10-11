import { describe, expect, it, vi } from 'vitest';

import type { HighlightOptions } from './types.ts';
import { useStore, normalizeOptions } from './utils.ts';

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
    expect(normalizeOptions({ selectors: ['#button'] })).toEqual({
      id: undefined,
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
    expect(normalizeOptions({ selectors: ['#button'], menu: [[menuItem]] })).toEqual(
      expect.objectContaining({ menu: [[menuItem]] })
    );
  });

  it('should set menu to undefined when it is not an array', () => {
    const options = { selectors: ['#button'], menu: 'not-a-menu' } as unknown as HighlightOptions;
    expect(normalizeOptions(options)).toEqual(expect.objectContaining({ menu: undefined }));
  });
});
