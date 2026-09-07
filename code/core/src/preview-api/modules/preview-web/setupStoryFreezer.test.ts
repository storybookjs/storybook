// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { global as globalRef } from '@storybook/global';
import { STORY_HOT_UPDATED, STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import { setupStoryFreezer, shouldFreeze } from './setupStoryFreezer.ts';

type Listener = (...args: unknown[]) => void;

const createChannel = () => {
  const listeners = new Map<string, Listener[]>();

  return {
    on(eventName: string, listener: Listener) {
      const current = listeners.get(eventName) ?? [];
      current.push(listener);
      listeners.set(eventName, current);
    },
    emit(eventName: string, payload: unknown) {
      (listeners.get(eventName) ?? []).forEach((listener) => {
        listener(payload);
      });
    },
  };
};

describe('shouldEnableFreezeOnStoryFinished', () => {
  it('requires freeze=finished', () => {
    expect(
      shouldFreeze({
        search: '?id=example--story&viewMode=story',
      })
    ).toBe(false);
    expect(
      shouldFreeze({
        search: '?id=example--story&viewMode=story&freeze=finished',
      })
    ).toBe(true);
  });

  it('only enables for story mode', () => {
    expect(
      shouldFreeze({
        search: '?id=example--story&viewMode=docs&freeze=finished',
      })
    ).toBe(false);
  });
});

declare global {
  interface Window {
    __freezeInlineClicked?: boolean;
    __freezeScriptExecuted?: boolean;
  }
}

describe('setupStoryFreezer', () => {
  // The freezer replaces scheduling globals and injects freeze styles into
  // <head>; capture and restore them so a frozen test can't leak mutated
  // globals or styles into later tests.
  const SCHEDULING_GLOBALS = [
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'queueMicrotask',
  ] as const;
  const INJECTED_STYLE_IDS = [
    'storybook-freeze-end-frame-preload',
    'storybook-freeze-after-finished',
  ];

  let previousHref: string;
  let previousBody: string;
  let originalGlobals: Record<string, unknown>;
  let originalReload: Location['reload'];
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    previousHref = window.location.href;
    previousBody = document.body.innerHTML;
    originalGlobals = Object.fromEntries(
      SCHEDULING_GLOBALS.map((key) => [key, (window as unknown as Record<string, unknown>)[key]])
    );
    originalReload = window.location.reload.bind(window.location);
    reloadSpy = vi.fn();
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      writable: true,
      value: reloadSpy,
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', previousHref);
    document.body.innerHTML = previousBody;
    INJECTED_STYLE_IDS.forEach((id) => document.getElementById(id)?.remove());
    SCHEDULING_GLOBALS.forEach((key) => {
      Object.defineProperty(window, key, {
        configurable: true,
        writable: true,
        value: originalGlobals[key],
      });
    });
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      writable: true,
      value: originalReload,
    });
    delete window.__freezeInlineClicked;
    delete window.__freezeScriptExecuted;
  });

  it('installs for top-level iframe route when freeze=finished is set', () => {
    window.history.replaceState({}, '', '/iframe.html?id=example--story&freeze=finished');
    const channel = createChannel();
    expect(setupStoryFreezer(channel)).toBe(true);
  });

  it('pins animations at the end frame immediately when freeze mode is enabled', () => {
    window.history.replaceState(
      {},
      '',
      '/iframe.html?id=example--story&viewMode=story&freeze=finished'
    );

    const channel = createChannel();
    expect(setupStoryFreezer(channel)).toBe(true);

    const style = document.getElementById('storybook-freeze-end-frame-preload');
    expect(style).toBeTruthy();
    expect(style?.textContent).toContain('animation-direction: reverse');
    expect(style?.textContent).toContain('animation-play-state: paused');
  });

  it('freezes JavaScript and interaction after STORY_FINISHED', async () => {
    window.history.replaceState(
      {},
      '',
      '/iframe.html?id=example--story&viewMode=story&freeze=finished'
    );
    document.body.innerHTML = `
      <button id="btn" onclick="window.__freezeInlineClicked = true">Hello</button>
      <script id="to-remove">window.__freezeScriptExecuted = true;</script>
    `;

    const channel = createChannel();
    expect(setupStoryFreezer(channel)).toBe(true);

    const interactionSpy = vi.fn();
    const button = document.getElementById('btn') as HTMLButtonElement;
    button.addEventListener('click', interactionSpy);

    const timeoutSpy = vi.fn();
    channel.emit(STORY_RENDER_PHASE_CHANGED, { newPhase: 'finished', storyId: 'example--story' });
    await Promise.resolve();

    window.setTimeout(timeoutSpy, 0);
    await Promise.resolve();
    expect(timeoutSpy).not.toHaveBeenCalled();

    expect(document.querySelector('script')).toBeNull();
    expect(document.documentElement.outerHTML).not.toContain('onclick=');
    expect(document.getElementById('storybook-freeze-after-finished')).toBeTruthy();

    button.click();
    expect(interactionSpy).not.toHaveBeenCalled();
  });

  it('reloads the iframe on a hot update so it re-renders fresh and re-freezes', () => {
    window.history.replaceState(
      {},
      '',
      '/iframe.html?id=example--story&viewMode=story&freeze=finished'
    );
    const channel = createChannel();
    expect(setupStoryFreezer(channel)).toBe(true);

    channel.emit(STORY_HOT_UPDATED, undefined);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload on a hot update when freeze mode is disabled', () => {
    window.history.replaceState({}, '', '/iframe.html?id=example--story&viewMode=story');
    const channel = createChannel();
    expect(setupStoryFreezer(channel)).toBe(false);

    channel.emit(STORY_HOT_UPDATED, undefined);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  describe('animation freezing', () => {
    type StoryDocument = Document & {
      getAnimations?: (options?: { subtree?: boolean }) => Animation[];
    };

    let finish: ReturnType<typeof vi.fn>;
    let pause: ReturnType<typeof vi.fn>;
    let getAnimations: ReturnType<typeof vi.fn>;
    let previousGetAnimations: StoryDocument['getAnimations'];
    let previousQueueMicrotask: typeof window.queueMicrotask;

    beforeEach(() => {
      finish = vi.fn();
      pause = vi.fn();
      getAnimations = vi.fn(() => [{ finish, pause } as unknown as Animation]);
      const storyDocument = globalRef.document as StoryDocument;
      previousGetAnimations = storyDocument.getAnimations;
      storyDocument.getAnimations = getAnimations as StoryDocument['getAnimations'];
      previousQueueMicrotask = window.queueMicrotask;
      // Run the scheduled freeze synchronously so the test can assert without timing flakiness.
      Object.defineProperty(window, 'queueMicrotask', {
        configurable: true,
        writable: true,
        value: (callback: VoidFunction) => callback(),
      });
    });

    afterEach(() => {
      const storyDocument = globalRef.document as StoryDocument;
      if (previousGetAnimations) {
        storyDocument.getAnimations = previousGetAnimations;
      } else {
        Reflect.deleteProperty(storyDocument, 'getAnimations');
      }
      Object.defineProperty(window, 'queueMicrotask', {
        configurable: true,
        writable: true,
        value: previousQueueMicrotask,
      });
    });

    it('runs animations to completion and pauses them when freezing', async () => {
      window.history.replaceState(
        {},
        '',
        '/iframe.html?id=example--story&viewMode=story&freeze=finished'
      );

      const channel = createChannel();
      expect(setupStoryFreezer(channel)).toBe(true);

      channel.emit(STORY_RENDER_PHASE_CHANGED, { newPhase: 'finished', storyId: 'example--story' });
      await Promise.resolve();

      expect(getAnimations).toHaveBeenCalledWith();
      expect(finish).toHaveBeenCalledTimes(1);
      expect(pause).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onFrozen after freeze completes', async () => {
    window.history.replaceState(
      {},
      '',
      '/iframe.html?id=example--story&viewMode=story&freeze=finished'
    );

    const channel = createChannel();
    const onFrozen = vi.fn();
    expect(setupStoryFreezer(channel, { onFrozen })).toBe(true);

    channel.emit(STORY_RENDER_PHASE_CHANGED, { newPhase: 'finished', storyId: 'example--story' });
    await vi.waitFor(() => {
      expect(onFrozen).toHaveBeenCalledTimes(1);
    });
  });
});
