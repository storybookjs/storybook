// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IFRAME_RESIZE_CONTEXT,
  IFRAME_RESIZE_REQUEST_CONTEXT,
} from '../../../shared/constants/iframe-resize.ts';

import {
  isPassThroughContainer,
  isViewportOverlayUnderlay,
  setupContentResizeBroadcast,
} from './setupContentResizeBroadcast.ts';

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
  let activeCleanup: (() => void) | undefined;

  const installBroadcast = () => {
    activeCleanup?.();
    const result = setupContentResizeBroadcast();
    activeCleanup = result.cleanup;
    return result;
  };

  const measureAfterFreeze = async (setupBody?: () => void) => {
    window.history.replaceState(
      {},
      '',
      '/iframe.html?id=example--story&viewMode=story&embed=true&freeze=finished'
    );
    setupBody?.();
    const { onContentFrozen } = installBroadcast();
    onContentFrozen?.();
    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });
    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    return JSON.parse(message as string) as {
      context: string;
      width: number;
      height: number;
      src: string;
    };
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
    activeCleanup?.();
    activeCleanup = undefined;
    window.history.replaceState({}, '', previousHref);
    document.body.innerHTML = '';
    document.head.querySelector('#storybook-embed-sizing')?.remove();
    document.head.querySelector('#storybook-embed-ui')?.remove();
    vi.unstubAllGlobals();
  });

  describe('when freeze=finished', () => {
    beforeEach(() => {
      window.history.replaceState(
        {},
        '',
        '/iframe.html?id=example--story&viewMode=story&embed=true&freeze=finished'
      );
    });

    it('provides onContentFrozen', () => {
      const { onContentFrozen } = installBroadcast();
      expect(onContentFrozen).toEqual(expect.any(Function));
    });

    it('defers measurement until onContentFrozen', async () => {
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

      const { onContentFrozen } = installBroadcast();
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

    it('ignores parent remeasure requests until onContentFrozen', async () => {
      document.body.innerHTML = '<div id="storybook-root"><div id="content">Hello</div></div>';
      const content = document.getElementById('content') as HTMLDivElement;
      mockRect(content, {
        top: 0,
        left: 0,
        bottom: 48,
        right: 120,
        width: 120,
        height: 48,
      });

      const { onContentFrozen } = installBroadcast();
      const parent = window.parent as Window;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ context: IFRAME_RESIZE_REQUEST_CONTEXT }),
          source: parent,
        })
      );
      expect(postMessageSpy).not.toHaveBeenCalled();

      onContentFrozen?.();

      await vi.waitFor(() => {
        expect(postMessageSpy).toHaveBeenCalled();
      });

      postMessageSpy.mockClear();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ context: IFRAME_RESIZE_REQUEST_CONTEXT }),
          source: parent,
        })
      );

      await vi.waitFor(() => {
        expect(postMessageSpy).toHaveBeenCalled();
      });
    });
  });

  it('hides the in-iframe preparing loader for frozen embed thumbnails', () => {
    window.history.replaceState(
      {},
      '',
      '/iframe.html?id=example--story&viewMode=story&embed=true&freeze=finished'
    );
    installBroadcast();
    const style = document.getElementById('storybook-embed-ui');
    expect(style?.textContent).toContain('.sb-preparing-story');
    expect(style?.textContent).toContain('display: none');
  });

  it('does not hide the in-iframe preparing loader for embed without freeze', () => {
    installBroadcast();
    expect(document.getElementById('storybook-embed-ui')).toBeNull();
  });

  it('re-measures when the parent requests dimensions', async () => {
    const content = document.getElementById('content') as HTMLDivElement;
    mockRect(content, {
      top: 0,
      left: 0,
      bottom: 48,
      right: 120,
      width: 120,
      height: 48,
    });

    installBroadcast();
    expect(postMessageSpy).not.toHaveBeenCalled();

    const parent = window.parent as Window;
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ context: IFRAME_RESIZE_REQUEST_CONTEXT }),
        source: parent,
      })
    );

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalled();
    });
    const [message] = postMessageSpy.mock.calls.at(-1) ?? [];
    expect(JSON.parse(message as string).context).toBe(IFRAME_RESIZE_CONTEXT);
  });

  it('does not auto-measure embed previews without freeze', () => {
    installBroadcast();
    expect(postMessageSpy).not.toHaveBeenCalled();
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

    await measureAfterFreeze();
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

    const payload = await measureAfterFreeze();
    expect(payload.context).toBe(IFRAME_RESIZE_CONTEXT);
    expect(payload.width).toBeGreaterThan(0);
    expect(payload.height).toBeGreaterThan(0);
    expect(payload.src).toContain('embed=true');
  });

  it('ignores pass-through wrappers when measuring nested content', async () => {
    const payload = await measureAfterFreeze(() => {
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
    });
    expect(payload.width).toBe(80);
    expect(payload.height).toBe(40);
  });

  it('does not apply fit-content sizing to inline icon sprites while measuring', async () => {
    const payload = await measureAfterFreeze(() => {
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
    });
    expect(payload.width).toBe(80);
    expect(payload.height).toBe(40);
  });

  it('ignores full-viewport fixed underlays portaled to the body', async () => {
    const payload = await measureAfterFreeze(() => {
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
    });
    expect(payload.width).toBe(160);
    expect(payload.height).toBe(40);
  });

  it('adds measured body padding symmetrically around content bounds', async () => {
    const payload = await measureAfterFreeze(() => {
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
    });
    expect(payload.width).toBe(332);
    expect(payload.height).toBe(332);
  });

  it('does not add padding when the iframe body has none', async () => {
    const payload = await measureAfterFreeze(() => {
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
    });
    expect(payload.width).toBe(300);
    expect(payload.height).toBe(300);
  });
});
