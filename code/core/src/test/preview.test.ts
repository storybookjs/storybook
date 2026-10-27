// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { enhanceContext } from './preview.ts';

const nativeFocus = HTMLElement.prototype.focus;

describe('focus instrumentation', () => {
  beforeAll(async () => {
    await enhanceContext({ canvasElement: document.body } as any);
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
