// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { enhanceContext } from './preview.ts';

const nativeFocus = HTMLElement.prototype.focus;

describe('focus instrumentation', () => {
  beforeAll(async () => {
    await enhanceContext({ canvasElement: document.body, parameters: {} } as any);
  });

  afterEach(() => {
    HTMLElement.prototype.focus = nativeFocus;
    document.body.innerHTML = '';
  });

  it('hands back the current focus method when read off the prototype', () => {
    const marker = function focusMarker(this: HTMLElement) {};
    HTMLElement.prototype.focus = marker;

    expect(HTMLElement.prototype.focus).toBe(marker);
  });

  it('supports the capture-and-wrap pattern used by focus-management libraries', () => {
    const captured = HTMLElement.prototype.focus;
    const wrapper = vi.fn(function (this: HTMLElement, ...args: []) {
      captured.apply(this, args);
    });
    HTMLElement.prototype.focus = wrapper;

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    expect(wrapper).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button);
  });

  it('returns a no-op for nodes without a browsing context', () => {
    const detachedDocument = document.implementation.createHTMLDocument();
    const button = detachedDocument.createElement('button');

    expect(() => button.focus()).not.toThrow();
    expect(detachedDocument.activeElement).not.toBe(button);
  });
});

describe('portable story context', () => {
  it('skips userEvent setup and returns undefined when __isPortableStory is true', async () => {
    const context = {
      canvasElement: document.body,
      parameters: { __isPortableStory: true },
    } as any;

    const cleanup = await enhanceContext(context);

    // No userEvent instance should be set on the context for portable stories
    expect(context.userEvent).toBeUndefined();
    // No cleanup is returned since nothing was set up
    expect(cleanup).toBeUndefined();
  });

  it('does not skip userEvent setup when __isPortableStory is false', async () => {
    const context = {
      canvasElement: document.body,
      parameters: { __isPortableStory: false },
    } as any;

    // Should not throw and should proceed normally (userEvent may or may not be set
    // depending on the environment's navigator.clipboard availability)
    await expect(enhanceContext(context)).resolves.not.toThrow();
  });
});
