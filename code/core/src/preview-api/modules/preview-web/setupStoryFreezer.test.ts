// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { STORY_FINISHED } from 'storybook/internal/core-events';

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
    channel.emit(STORY_FINISHED, { storyId: 'example--story', status: 'success', reporters: [] });
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
});
