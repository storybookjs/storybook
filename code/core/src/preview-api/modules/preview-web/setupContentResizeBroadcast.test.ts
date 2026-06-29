// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IFRAME_RESIZE_CONTEXT } from '../../../shared/constants/iframe-resize.ts';

import {
  isPassThroughContainer,
  isViewportOverlayUnderlay,
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

describe('isPassThroughContainer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="parent"><div id="child"></div></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const mockRects = (entries: Record<string, { width: number; height: number }>) => {
    for (const [id, { width, height }] of Object.entries(entries)) {
      const element = document.getElementById(id) as HTMLElement;
      Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          top: 0,
          left: 0,
          bottom: height,
          right: width,
          width,
          height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
    }
  };

  it('treats stretched undecorated wrappers as pass-through', () => {
    mockRects({ parent: { width: 800, height: 40 }, child: { width: 800, height: 40 } });
    expect(isPassThroughContainer(document.getElementById('child')!)).toBe(true);
  });

  it('keeps replaced elements such as buttons', () => {
    document.getElementById('child')!.outerHTML = '<button id="child">Click</button>';
    mockRects({ parent: { width: 800, height: 40 }, child: { width: 80, height: 40 } });
    expect(isPassThroughContainer(document.getElementById('child')!)).toBe(false);
  });

  it('keeps elements with explicit width', () => {
    const child = document.getElementById('child') as HTMLDivElement;
    child.style.width = '100%';
    mockRects({ parent: { width: 800, height: 40 }, child: { width: 800, height: 40 } });
    expect(isPassThroughContainer(child)).toBe(false);
  });

  it('keeps elements with visible decoration', () => {
    const child = document.getElementById('child') as HTMLDivElement;
    child.style.backgroundColor = 'red';
    mockRects({ parent: { width: 800, height: 40 }, child: { width: 800, height: 40 } });
    expect(isPassThroughContainer(child)).toBe(false);
  });

  it('keeps elements with direct text content', () => {
    const child = document.getElementById('child') as HTMLDivElement;
    child.textContent = 'Hello';
    mockRects({ parent: { width: 800, height: 40 }, child: { width: 120, height: 40 } });
    expect(isPassThroughContainer(child)).toBe(false);
  });
});

describe('isViewportOverlayUnderlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="underlay"></div>';
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  const mockViewportRect = (element: HTMLElement) => {
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 0,
        left: 0,
        bottom: 600,
        right: 800,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
  };

  it('treats full-viewport fixed transparent layers as underlays', () => {
    const underlay = document.getElementById('underlay') as HTMLDivElement;
    underlay.style.position = 'fixed';
    underlay.style.inset = '0';
    mockViewportRect(underlay);
    expect(isViewportOverlayUnderlay(underlay)).toBe(true);
  });

  it('treats full-viewport absolute transparent layers as underlays', () => {
    const underlay = document.getElementById('underlay') as HTMLDivElement;
    underlay.style.position = 'absolute';
    underlay.style.inset = '0';
    mockViewportRect(underlay);
    expect(isViewportOverlayUnderlay(underlay)).toBe(true);
  });

  it('keeps visible modal backdrops', () => {
    const underlay = document.getElementById('underlay') as HTMLDivElement;
    underlay.style.position = 'fixed';
    underlay.style.inset = '0';
    underlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    mockViewportRect(underlay);
    expect(isViewportOverlayUnderlay(underlay)).toBe(false);
  });

  it('keeps non-viewport fixed elements', () => {
    const underlay = document.getElementById('underlay') as HTMLDivElement;
    underlay.style.position = 'fixed';
    underlay.style.inset = '0';
    Object.defineProperty(underlay, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 0,
        left: 0,
        bottom: 200,
        right: 180,
        width: 180,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    expect(isViewportOverlayUnderlay(underlay)).toBe(false);
  });
});

describe('setupContentResizeBroadcast', () => {
  let previousHref: string;
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  const mockResizeObserver = () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private callback: ResizeObserverCallback;

        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }

        observe() {
          this.callback([], this as unknown as ResizeObserver);
        }

        unobserve() {}
        disconnect() {}
      } as typeof ResizeObserver
    );
  };

  const mockRect = (
    element: HTMLElement,
    rect: {
      top: number;
      left: number;
      bottom: number;
      right: number;
      width: number;
      height: number;
    }
  ) => {
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });
  };

  beforeEach(() => {
    previousHref = window.location.href;
    window.history.replaceState({}, '', '/iframe.html?id=example--story&viewMode=story&embed=true');
    document.body.innerHTML = '<div id="storybook-root"><div id="content">Hello</div></div>';
    postMessageSpy = vi.fn();
    vi.stubGlobal('parent', { postMessage: postMessageSpy });
  });

  afterEach(() => {
    window.history.replaceState({}, '', previousHref);
    document.body.innerHTML = '';
    document.head.querySelector('#storybook-embed-sizing')?.remove();
    vi.unstubAllGlobals();
  });

  it('does not install when embed=true is absent', () => {
    window.history.replaceState({}, '', '/iframe.html?id=example--story&viewMode=story');
    expect(setupContentResizeBroadcast()).toEqual({});
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('removes embed sizing styles after measuring content', async () => {
    const content = document.getElementById('content') as HTMLDivElement;
    mockRect(content, {
      top: 0,
      left: 0,
      bottom: 48,
      right: 120,
      width: 120,
      height: 48,
    });

    mockResizeObserver();
    setupContentResizeBroadcast();

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });
    expect(document.getElementById('storybook-embed-sizing')).toBeNull();
  });

  it('posts iframe.resize with content dimensions', async () => {
    const content = document.getElementById('content') as HTMLDivElement;
    mockRect(content, {
      top: 0,
      left: 0,
      bottom: 48,
      right: 120,
      width: 120,
      height: 48,
    });

    mockResizeObserver();
    setupContentResizeBroadcast();

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });
    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    const payload = JSON.parse(message as string);
    expect(payload.context).toBe(IFRAME_RESIZE_CONTEXT);
    expect(payload.width).toBeGreaterThan(0);
    expect(payload.height).toBeGreaterThan(0);
    expect(payload.src).toContain('embed=true');
  });

  it('ignores pass-through wrappers when measuring nested content', async () => {
    document.body.innerHTML =
      '<div id="storybook-root"><div id="wrapper"><button id="button">Click</button></div></div>';

    const root = document.getElementById('storybook-root') as HTMLDivElement;
    const wrapper = document.getElementById('wrapper') as HTMLDivElement;
    const button = document.getElementById('button') as HTMLButtonElement;
    mockRect(root, {
      top: 0,
      left: 0,
      bottom: 40,
      right: 800,
      width: 800,
      height: 40,
    });
    mockRect(wrapper, {
      top: 0,
      left: 0,
      bottom: 40,
      right: 800,
      width: 800,
      height: 40,
    });
    mockRect(button, {
      top: 0,
      left: 0,
      bottom: 40,
      right: 80,
      width: 80,
      height: 40,
    });

    mockResizeObserver();
    setupContentResizeBroadcast();

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });
    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    const payload = JSON.parse(message as string);
    expect(payload.width).toBe(80);
    expect(payload.height).toBe(40);
  });

  it('does not apply fit-content sizing to inline icon sprites while measuring', async () => {
    document.body.innerHTML =
      '<div id="storybook-root"><svg data-chromatic="ignore" style="position:absolute;width:0;height:0"><symbol id="icon"><path d="M0 0h300v20H0z"></path></symbol></svg><button id="button">Filter</button></div>';

    const button = document.getElementById('button') as HTMLButtonElement;
    mockRect(button, {
      top: 0,
      left: 0,
      bottom: 40,
      right: 80,
      width: 80,
      height: 40,
    });

    mockResizeObserver();
    setupContentResizeBroadcast();

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });
    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    const payload = JSON.parse(message as string);
    expect(payload.width).toBe(80);
    expect(payload.height).toBe(40);
  });

  it('ignores full-viewport fixed underlays portaled to the body', async () => {
    document.body.innerHTML =
      '<div id="storybook-root"><button id="button">Animal</button></div><div id="underlay"></div>';

    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);

    const button = document.getElementById('button') as HTMLButtonElement;
    const underlay = document.getElementById('underlay') as HTMLDivElement;
    underlay.style.position = 'fixed';
    underlay.style.inset = '0';

    mockRect(button, {
      top: 0,
      left: 0,
      bottom: 40,
      right: 160,
      width: 160,
      height: 40,
    });
    mockRect(underlay, {
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      width: 800,
      height: 600,
    });

    mockResizeObserver();
    setupContentResizeBroadcast();

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });
    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    const payload = JSON.parse(message as string);
    expect(payload.width).toBe(160);
    expect(payload.height).toBe(40);
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

  it('adds measured body padding symmetrically around content bounds', async () => {
    document.body.style.padding = '16px';
    const content = document.getElementById('content') as HTMLDivElement;
    mockRect(content, {
      top: 16,
      left: 16,
      bottom: 316,
      right: 316,
      width: 300,
      height: 300,
    });

    mockResizeObserver();
    setupContentResizeBroadcast();

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });
    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    const payload = JSON.parse(message as string);
    expect(payload.width).toBe(332);
    expect(payload.height).toBe(332);
  });

  it('does not add padding when the iframe body has none', async () => {
    document.body.style.padding = '0';
    const content = document.getElementById('content') as HTMLDivElement;
    mockRect(content, {
      top: 0,
      left: 0,
      bottom: 300,
      right: 300,
      width: 300,
      height: 300,
    });

    mockResizeObserver();
    setupContentResizeBroadcast();

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });
    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    const payload = JSON.parse(message as string);
    expect(payload.width).toBe(300);
    expect(payload.height).toBe(300);
  });

  it('defers measurement until onContentFrozen when freeze=finished is set', async () => {
    window.history.replaceState(
      {},
      '',
      '/iframe.html?id=example--story&viewMode=story&embed=true&freeze=finished'
    );
    document.body.innerHTML =
      '<div id="storybook-root"><button id="button">Animal</button></div><div id="underlay"></div>';

    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);

    const button = document.getElementById('button') as HTMLButtonElement;
    const underlay = document.getElementById('underlay') as HTMLDivElement;
    underlay.style.position = 'fixed';
    underlay.style.inset = '0';

    mockRect(button, {
      top: 0,
      left: 0,
      bottom: 40,
      right: 160,
      width: 160,
      height: 40,
    });
    mockRect(underlay, {
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      width: 800,
      height: 600,
    });

    const { onContentFrozen } = setupContentResizeBroadcast();
    expect(postMessageSpy).not.toHaveBeenCalled();

    onContentFrozen?.();

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });

    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    const payload = JSON.parse(message as string);
    expect(payload.width).toBe(160);
    expect(payload.height).toBe(40);
  });
});
