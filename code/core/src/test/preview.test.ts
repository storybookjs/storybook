// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { enhanceContext } from './preview.ts';

const nativeFocus = HTMLElement.prototype.focus;

describe('focus instrumentation', () => {
  beforeAll(async () => {
    // Runs the loader once to install the `focus` accessor on HTMLElement.prototype.
    await enhanceContext({ canvasElement: document.body } as any);
  });

  afterEach(() => {
    // The accessor stays installed for the whole process; its setter routes assignments to the
    // underlying method, so this resets whatever a test wrapped.
    HTMLElement.prototype.focus = nativeFocus;
    document.body.innerHTML = '';
  });

  it('hands back the current focus method when read off the prototype', () => {
    // Reading through the prototype must return whatever method is currently installed — not a
    // no-op — so libraries capturing the method to wrap it get a working one. In real browsers
    // the pre-fix behavior was worse: the getter touched `this.ownerDocument` with the prototype
    // as receiver, which native brand checks reject with "Illegal invocation".
    const marker = function focusMarker(this: HTMLElement) {};
    HTMLElement.prototype.focus = marker;

    expect(HTMLElement.prototype.focus).toBe(marker);
  });

  it('supports the capture-and-wrap pattern used by focus-management libraries', () => {
    // react-aria's setupGlobalFocusEvents and Zag's focus-visible both capture the method off the
    // prototype, then reassign a wrapper that delegates to the captured method.
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
