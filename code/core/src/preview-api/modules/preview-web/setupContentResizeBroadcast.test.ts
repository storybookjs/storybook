// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IFRAME_RESIZE_CONTEXT,
  setupContentResizeBroadcast,
  shouldEmbed,
} from './setupContentResizeBroadcast.ts';

describe('shouldEmbed', () => {
  it('requires embed=true', () => {
    expect(shouldEmbed({ search: '?id=example--story&viewMode=story' })).toBe(false);
    expect(shouldEmbed({ search: '?id=example--story&viewMode=story&embed=true' })).toBe(true);
    expect(shouldEmbed({ search: '?id=example--story&viewMode=story&embed=false' })).toBe(false);
  });
});

describe('setupContentResizeBroadcast', () => {
  let previousHref: string;
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    previousHref = window.location.href;
    window.history.replaceState({}, '', '/iframe.html?id=example--story&viewMode=story&embed=true');
    document.body.innerHTML = '<div id="storybook-root"><div id="content">Hello</div></div>';
    postMessageSpy = vi.fn();
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: postMessageSpy },
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', previousHref);
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: window,
    });
    document.body.innerHTML = '';
  });

  it('does not install when embed=true is absent', () => {
    window.history.replaceState({}, '', '/iframe.html?id=example--story&viewMode=story');
    expect(setupContentResizeBroadcast()).toEqual({});
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('posts iframe.resize with content dimensions', async () => {
    const content = document.getElementById('content') as HTMLDivElement;
    Object.defineProperty(content, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 0,
        left: 0,
        bottom: 48,
        right: 120,
        width: 120,
        height: 48,
      }),
    });

    const OriginalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      private callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe() {
        this.callback([], this as unknown as ResizeObserver);
      }

      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;

    try {
      setupContentResizeBroadcast();

      await vi.waitFor(() => {
        expect(postMessageSpy).toHaveBeenCalled();
      });
    } finally {
      window.ResizeObserver = OriginalResizeObserver;
    }

    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    const payload = JSON.parse(message as string);
    expect(payload.context).toBe(IFRAME_RESIZE_CONTEXT);
    expect(payload.width).toBeGreaterThan(0);
    expect(payload.height).toBeGreaterThan(0);
    expect(payload.src).toContain('embed=true');
  });

  it('provides onContentFrozen when freeze=finished is also set', () => {
    window.history.replaceState(
      {},
      '',
      '/iframe.html?id=example--story&viewMode=story&embed=true&freeze=finished'
    );
    const { onContentFrozen } = setupContentResizeBroadcast();
    expect(onContentFrozen).toEqual(expect.any(Function));
  });
});
