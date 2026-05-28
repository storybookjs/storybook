// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';
import { global as globalRef } from '@storybook/global';

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

describe('setupStoryFreezer', () => {
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

  it('runs animations to completion and pauses them when freezing', async () => {
    window.history.replaceState(
      {},
      '',
      '/iframe.html?id=example--story&viewMode=story&freeze=finished'
    );

    const finish = vi.fn();
    const pause = vi.fn();
    const getAnimations = vi.fn(() => [{ finish, pause } as unknown as Animation]);
    const storyDocument = globalRef.document as Document & {
      getAnimations?: (options?: { subtree?: boolean }) => Animation[];
    };
    const previousGetAnimations = storyDocument.getAnimations;
    storyDocument.getAnimations = getAnimations;
    const previousQueueMicrotask = window.queueMicrotask;
    Object.defineProperty(window, 'queueMicrotask', {
      configurable: true,
      writable: true,
      value: (callback: VoidFunction) => callback(),
    });

    try {
      const channel = createChannel();
      expect(setupStoryFreezer(channel)).toBe(true);

      channel.emit(STORY_RENDER_PHASE_CHANGED, { newPhase: 'finished', storyId: 'example--story' });
      await Promise.resolve();

      expect(getAnimations).toHaveBeenCalledWith();
      expect(finish).toHaveBeenCalledTimes(1);
      expect(pause).toHaveBeenCalledTimes(1);
    } finally {
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
    }
  });
});
