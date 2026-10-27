// @vitest-environment happy-dom
import { Channel } from 'storybook/internal/channels';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HIGHLIGHT,
  HIGHLIGHT_MENU,
  HIGHLIGHT_MENU_INTERACTION,
  REMOVE_HIGHLIGHT,
  RESET_HIGHLIGHT,
} from './constants.ts';
import type { HighlightMenuState } from './types.ts';
import { useHighlights } from './useHighlights.ts';

describe('useHighlights', () => {
  let channel: Channel;
  let frames: Array<FrameRequestCallback | undefined>;
  let target: HTMLElement;
  let resizeObserverCallback: (() => void) | undefined;
  let lastMenuState: HighlightMenuState | undefined;

  const flushFrames = () => {
    // Drain cascading frames: callbacks queued while flushing (e.g. a box remeasure scheduling
    // the menu state emission) run in the same flush.
    while (frames.some(Boolean)) {
      const pending = frames;
      frames = [];
      pending.forEach((callback) => callback?.(0));
    }
  };

  const clickAt = (x: number, y: number) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'pageX', { value: x });
    Object.defineProperty(event, 'pageY', { value: y });
    Object.defineProperty(event, 'clientX', { value: x - window.scrollX });
    Object.defineProperty(event, 'clientY', { value: y - window.scrollY });
    document.dispatchEvent(event);
    flushFrames();
  };

  const setScroll = (x: number, y: number) => {
    vi.stubGlobal('scrollX', x);
    vi.stubGlobal('scrollY', y);
    document.dispatchEvent(new Event('scroll'));
    flushFrames();
  };

  const stubTargetRect = (rect: Partial<DOMRect>) => {
    const full = { top: 20, left: 20, width: 50, height: 50, bottom: 70, right: 70, x: 20, y: 20 };
    target.getBoundingClientRect = () => ({ ...full, ...rect }) as DOMRect;
  };

  /** The last emitted menu state, which must be open. */
  const openMenu = () => {
    if (!lastMenuState?.open) {
      throw new Error('Expected an open menu state');
    }
    return lastMenuState;
  };

  const moveTarget = (rect: Partial<DOMRect>) => {
    stubTargetRect(rect);
    resizeObserverCallback?.();
    flushFrames();
  };

  beforeEach(() => {
    vi.stubGlobal('__STORYBOOK_HIGHLIGHT_INITIALIZED', false);
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      frames[handle - 1] = undefined;
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeObserverCallback = callback;
        }
        observe() {
          resizeObserverCallback?.();
        }
        unobserve() {}
        disconnect() {
          resizeObserverCallback = undefined;
        }
      }
    );
    vi.stubGlobal('scrollX', 0);
    vi.stubGlobal('scrollY', 0);

    document.body.innerHTML = '<div id="storybook-root"></div>';
    target = document.createElement('div');
    target.id = 'target';
    target.style.position = 'absolute';
    target.getBoundingClientRect = () =>
      ({
        top: 20,
        left: 20,
        width: 50,
        height: 50,
        bottom: 70,
        right: 70,
        x: 20,
        y: 20,
      }) as DOMRect;
    document.getElementById('storybook-root')!.appendChild(target);

    channel = new Channel({});
    lastMenuState = undefined;
    channel.on(HIGHLIGHT_MENU, (state: HighlightMenuState) => {
      lastMenuState = state;
    });
    useHighlights(channel);

    channel.emit(HIGHLIGHT, {
      id: 'h1',
      selectors: ['#target'],
      menu: [[{ id: 'item-1', title: 'Open docs', clickable: true }]],
    });
    flushFrames();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates highlight boxes for matched elements without rendering a menu', () => {
    expect(document.querySelector('[data-highlight-dimensions="w50h50"]')).not.toBeNull();
    expect(document.getElementById('storybook-highlights-menu')).toBeNull();
    // No menu is shown until a targetable element is clicked
    expect(lastMenuState).toEqual({ open: false });
  });

  it('emits menu state to the manager when a targetable element is clicked', () => {
    clickAt(30, 30);

    expect(lastMenuState).toBeDefined();
    expect(openMenu().targets).toHaveLength(1);
    expect(openMenu().targets[0]!.label).toBe('div#target');
    // The payload must not include renderable DOM content; menu definitions live in the
    // manager-side registry, and the element is identified by its non-content label alone
    expect(Object.keys(openMenu().targets[0]!).sort()).toEqual(['details', 'id', 'key', 'label']);
    expect(openMenu().selected).toBeNull();
    expect(openMenu().coords).toEqual({ x: 30, y: 30 });
  });

  it('does not emit menu state when clicking outside targetable elements', () => {
    clickAt(30, 30);
    expect(openMenu().targets).toHaveLength(1);

    clickAt(500, 500);
    expect(lastMenuState).toEqual({ open: false });
  });

  it('closes the menu when the preview scrolls', () => {
    clickAt(30, 30);
    expect(openMenu().coords).toEqual({ x: 30, y: 30 });

    stubTargetRect({ top: -80, bottom: -30 });
    setScroll(0, 100);
    expect(lastMenuState).toEqual({ open: false });
  });

  it('closes the menu when the preview resizes', () => {
    clickAt(30, 30);
    expect(openMenu().coords).toEqual({ x: 30, y: 30 });

    stubTargetRect({ top: 120, bottom: 170 });
    window.dispatchEvent(new Event('resize'));
    flushFrames();
    expect(lastMenuState).toEqual({ open: false });
  });

  it('closes the menu when the layout changes', () => {
    clickAt(30, 30);
    expect(openMenu().coords).toEqual({ x: 30, y: 30 });

    moveTarget({ top: 200, bottom: 250 });
    expect(lastMenuState).toEqual({ open: false });
  });

  it('positions the menu at the newly clicked target right away', () => {
    const second = document.createElement('span');
    second.id = 'other';
    second.style.position = 'absolute';
    // A separate, non-overlapping target further down the document
    second.getBoundingClientRect = () =>
      ({
        top: 200,
        left: 200,
        width: 50,
        height: 50,
        bottom: 250,
        right: 250,
        x: 200,
        y: 200,
      }) as DOMRect;
    document.getElementById('storybook-root')!.appendChild(second);
    channel.emit(HIGHLIGHT, {
      id: 'h2',
      selectors: ['#other'],
      menu: [[{ id: 'item-2', title: 'Other' }]],
    });
    flushFrames();

    clickAt(30, 30);
    expect(openMenu().targets[0]!.id).toBe('h1');
    expect(openMenu().coords).toEqual({ x: 30, y: 30 });

    // Clicking another target must re-anchor the menu before the new state is published
    clickAt(210, 210);
    expect(openMenu().targets).toHaveLength(1);
    expect(openMenu().targets[0]!.id).toBe('h2');
    expect(openMenu().coords).toEqual({ x: 210, y: 210 });
  });

  it('handles select and deselect interactions from the manager', () => {
    const second = document.createElement('span');
    second.id = 'other';
    second.style.position = 'absolute';
    // Overlaps the click point so both elements become click targets
    second.getBoundingClientRect = () =>
      ({
        top: 15,
        left: 15,
        width: 60,
        height: 60,
        bottom: 75,
        right: 75,
        x: 15,
        y: 15,
      }) as DOMRect;
    document.getElementById('storybook-root')!.appendChild(second);
    channel.emit(HIGHLIGHT, {
      id: 'h2',
      selectors: ['#other'],
      menu: [[{ id: 'item-2', title: 'Other' }]],
    });
    flushFrames();

    clickAt(30, 30);
    expect(openMenu().targets).toHaveLength(2);
    expect(openMenu().selected).toBeNull();

    const secondKey = openMenu().targets[1]!.key;
    channel.emit(HIGHLIGHT_MENU_INTERACTION, { action: 'select', key: secondKey });
    expect(openMenu().selected).toBe(secondKey);

    channel.emit(HIGHLIGHT_MENU_INTERACTION, { action: 'deselect' });
    expect(openMenu().selected).toBeNull();
  });

  it('ignores malformed menu interactions without corrupting selection', () => {
    const second = document.createElement('span');
    second.id = 'other';
    second.style.position = 'absolute';
    second.getBoundingClientRect = () =>
      ({
        top: 15,
        left: 15,
        width: 60,
        height: 60,
        bottom: 75,
        right: 75,
        x: 15,
        y: 15,
      }) as DOMRect;
    document.getElementById('storybook-root')!.appendChild(second);
    channel.emit(HIGHLIGHT, {
      id: 'h2',
      selectors: ['#other'],
      menu: [[{ id: 'item-2', title: 'Other' }]],
    });
    flushFrames();

    clickAt(30, 30);
    const secondKey = openMenu().targets[1]!.key;
    channel.emit(HIGHLIGHT_MENU_INTERACTION, { action: 'select', key: secondKey });
    expect(openMenu().selected).toBe(secondKey);

    for (const interaction of [
      null,
      {},
      { action: 'select' },
      { action: 'select', key: '' },
      { action: 'select', key: 1 },
      { action: 'select', key: 'unknown' },
      { action: 'select', key: '__proto__' },
      { action: 'focus', key: null },
      { action: 'unknown', key: secondKey },
    ]) {
      channel.emit(HIGHLIGHT_MENU_INTERACTION, interaction);
      expect(openMenu().selected).toBe(secondKey);
    }
  });

  it('ignores interactions for a target that is no longer in the menu', () => {
    const second = document.createElement('span');
    second.id = 'other';
    second.style.position = 'absolute';
    // Overlaps the first target, and also covers an area the first target does not
    second.getBoundingClientRect = () =>
      ({
        top: 15,
        left: 15,
        width: 60,
        height: 60,
        bottom: 75,
        right: 75,
        x: 15,
        y: 15,
      }) as DOMRect;
    document.getElementById('storybook-root')!.appendChild(second);
    channel.emit(HIGHLIGHT, {
      id: 'h2',
      selectors: ['#other'],
      menu: [[{ id: 'item-2', title: 'Other' }]],
    });
    flushFrames();

    clickAt(30, 30);
    const keyOf = (label: string) => openMenu().targets.find((t) => t.label === label)!.key;
    const targetKey = keyOf('div#target');
    const otherKey = keyOf('span#other');

    // The target list changes before the manager's interaction arrives
    clickAt(72, 72);
    expect(openMenu().targets.map(({ key }) => key)).toEqual([otherKey]);

    channel.emit(HIGHLIGHT_MENU_INTERACTION, { action: 'select', key: targetKey });
    expect(openMenu().selected).toBeNull();
  });

  it('closes the menu on a close interaction', () => {
    clickAt(30, 30);
    expect(openMenu().targets).toHaveLength(1);

    channel.emit(HIGHLIGHT_MENU_INTERACTION, { action: 'close' });
    expect(lastMenuState).toEqual({ open: false });
  });

  it('clears the menu when the highlight is removed or reset', () => {
    clickAt(30, 30);
    expect(openMenu().targets).toHaveLength(1);

    channel.emit(REMOVE_HIGHLIGHT, 'h1');
    expect(lastMenuState).toEqual({ open: false });

    channel.emit(HIGHLIGHT, {
      id: 'h1',
      selectors: ['#target'],
      menu: [[{ id: 'item-1', title: 'Open docs' }]],
    });
    flushFrames();
    clickAt(30, 30);
    expect(openMenu().targets).toHaveLength(1);

    channel.emit(RESET_HIGHLIGHT);
    expect(lastMenuState).toEqual({ open: false });
  });
});
