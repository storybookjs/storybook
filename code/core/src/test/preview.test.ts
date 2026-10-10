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

  it('keeps an instance-level focus assignment scoped to that element', () => {
    const custom = vi.fn(function (this: HTMLElement) {});
    const overridden = document.createElement('input');
    const untouched = document.createElement('input');
    document.body.append(overridden, untouched);

    overridden.focus = custom;

    // Native semantics: the assignment creates an own property on the element,
    // it must not replace the focus method shared through the prototype.
    expect(Object.prototype.hasOwnProperty.call(overridden, 'focus')).toBe(true);

    untouched.focus();

    expect(custom).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(untouched);

    overridden.focus();

    expect(custom).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(untouched);
  });

  it('does not let an instance-level focus assignment leak to elements created later', () => {
    const custom = vi.fn(function (this: HTMLElement) {});
    const overridden = document.createElement('input');
    document.body.appendChild(overridden);
    overridden.focus = custom;

    const later = document.createElement('input');
    document.body.appendChild(later);
    later.focus();

    expect(custom).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(later);
  });

  it('keeps a subclass prototype focus assignment scoped to that subclass', () => {
    class Widget extends HTMLElement {}
    const custom = function (this: HTMLElement) {};

    Widget.prototype.focus = custom;

    expect(Object.prototype.hasOwnProperty.call(Widget.prototype, 'focus')).toBe(true);

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    expect(document.activeElement).toBe(button);
  });

  it('returns a no-op for nodes without a browsing context', () => {
    const detachedDocument = document.implementation.createHTMLDocument();
    const button = detachedDocument.createElement('button');

    expect(() => button.focus()).not.toThrow();
    expect(detachedDocument.activeElement).not.toBe(button);
  });
});
