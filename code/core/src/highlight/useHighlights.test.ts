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
    const pending = frames;
    frames = [];
    pending.forEach((callback) => callback?.(0));
  };

  const clickAt = (x: number, y: number) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'pageX', { value: x });
    Object.defineProperty(event, 'pageY', { value: y });
    document.dispatchEvent(event);
    flushFrames();
  };

  const setScroll = (x: number, y: number) => {
    Object.defineProperty(window, 'scrollX', { value: x, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    document.dispatchEvent(new Event('scroll'));
    flushFrames();
  };

  const moveTarget = (rect: Partial<DOMRect>) => {
    const full = { top: 20, left: 20, width: 50, height: 50, bottom: 70, right: 70, x: 20, y: 20 };
    target.getBoundingClientRect = () => ({ ...full, ...rect }) as DOMRect;
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
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });

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
      menu: [[{ id: 'item-1', title: 'Open docs', clickEvent: 'my-click-event' }]],
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
    expect(lastMenuState).toEqual({ targets: [], selected: null, coords: null });
  });

  it('emits menu state to the manager when a targetable element is clicked', () => {
    clickAt(30, 30);

    expect(lastMenuState).toBeDefined();
    expect(lastMenuState!.targets).toHaveLength(1);
    expect(lastMenuState!.targets[0]!.details.element.outerHTML).toContain('id="target"');
    expect(lastMenuState!.targets[0]!.menu).toHaveLength(1);
    expect(lastMenuState!.selected).toBeNull();
    expect(lastMenuState!.coords).toEqual({ x: 30, y: 30 });
  });

  it('does not emit menu state when clicking outside targetable elements', () => {
    clickAt(30, 30);
    expect(lastMenuState!.targets).toHaveLength(1);

    clickAt(500, 500);
    expect(lastMenuState!.targets).toHaveLength(0);
    expect(lastMenuState!.coords).toBeNull();
  });

  it('keeps the menu coordinates in sync when the preview scrolls', () => {
    clickAt(30, 30);
    expect(lastMenuState!.coords).toEqual({ x: 30, y: 30 });

    setScroll(0, 100);
    expect(lastMenuState!.coords).toEqual({ x: 30, y: -70 });
  });

  it('keeps the menu anchored to its element when the layout changes', () => {
    clickAt(30, 30);
    expect(lastMenuState!.coords).toEqual({ x: 30, y: 30 });

    moveTarget({ top: 200, bottom: 250 });
    expect(lastMenuState!.coords).toEqual({ x: 30, y: 210 });
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
    expect(lastMenuState!.targets).toHaveLength(2);
    expect(lastMenuState!.selected).toBeNull();

    channel.emit(HIGHLIGHT_MENU_INTERACTION, { action: 'select', index: 1 });
    expect(lastMenuState!.selected).toBe(1);

    channel.emit(HIGHLIGHT_MENU_INTERACTION, { action: 'deselect' });
    expect(lastMenuState!.selected).toBeNull();
  });

  it('clears the menu when the highlight is removed or reset', () => {
    clickAt(30, 30);
    expect(lastMenuState!.targets).toHaveLength(1);

    channel.emit(REMOVE_HIGHLIGHT, 'h1');
    expect(lastMenuState!.targets).toHaveLength(0);
    expect(lastMenuState!.coords).toBeNull();

    channel.emit(HIGHLIGHT, {
      id: 'h1',
      selectors: ['#target'],
      menu: [[{ id: 'item-1', title: 'Open docs' }]],
    });
    flushFrames();
    clickAt(30, 30);
    expect(lastMenuState!.targets).toHaveLength(1);

    channel.emit(RESET_HIGHLIGHT);
    expect(lastMenuState!.targets).toHaveLength(0);
  });
});
