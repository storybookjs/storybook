import { describe, expect, it, vi } from 'vitest';

import type { HighlightOptions } from './types.ts';
import { clampToRect, normalizeOptions, previewToManagerCoords, useStore } from './utils.ts';

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

describe('previewToManagerCoords', () => {
  it('should map preview viewport coordinates onto the iframe position in the manager', () => {
    expect(
      previewToManagerCoords(
        { x: 100, y: 50 },
        { left: 300, top: 80, width: 800, height: 600 },
        {
          width: 800,
          height: 600,
        }
      )
    ).toEqual({ x: 400, y: 130 });
  });

  it('should account for a scaled iframe (e.g. a custom viewport or zoom)', () => {
    expect(
      previewToManagerCoords(
        { x: 100, y: 50 },
        { left: 300, top: 80, width: 400, height: 300 },
        {
          width: 800,
          height: 600,
        }
      )
    ).toEqual({ x: 350, y: 105 });
  });

  it('should not divide by a zero-sized iframe', () => {
    expect(
      previewToManagerCoords(
        { x: 100, y: 50 },
        { left: 0, top: 0, width: 0, height: 0 },
        {
          width: 0,
          height: 0,
        }
      )
    ).toEqual({ x: 0, y: 0 });
  });
});

describe('clampToRect', () => {
  const rect = { left: 100, top: 50, right: 900, bottom: 650 };

  it('should keep coordinates as-is when already inside the rect', () => {
    expect(clampToRect({ x: 400, y: 300 }, { width: 300, height: 200 }, rect)).toEqual({
      x: 400,
      y: 300,
    });
  });

  it('should clamp coordinates to stay within the rect', () => {
    expect(
      clampToRect({ x: 950, y: 700 }, { width: 300, height: 200 }, rect, {
        margin: 5,
        topOffset: 15,
      })
    ).toEqual({ x: 895, y: 430 });
  });

  it('should clamp horizontally on both sides when centered', () => {
    expect(
      clampToRect({ x: 50, y: 300 }, { width: 300, height: 200 }, rect, {
        margin: 5,
        centered: true,
      })
    ).toEqual({ x: 255, y: 300 });
    expect(
      clampToRect({ x: 900, y: 300 }, { width: 300, height: 200 }, rect, {
        margin: 5,
        centered: true,
      })
    ).toEqual({ x: 745, y: 300 });
  });

  it('should clamp coordinates below the rect top edge', () => {
    expect(
      clampToRect({ x: 400, y: 10 }, { width: 300, height: 100 }, rect, { margin: 5 })
    ).toEqual({ x: 400, y: 55 });
  });

  it('should pin a menu taller than the rect to its top edge', () => {
    expect(
      clampToRect({ x: 400, y: 300 }, { width: 300, height: 700 }, rect, {
        margin: 5,
        topOffset: 15,
      })
    ).toEqual({ x: 400, y: 55 });
  });
});
