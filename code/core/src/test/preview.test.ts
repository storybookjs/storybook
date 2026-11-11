// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { enhanceContext } from './preview.ts';

describe('focus guard', () => {
  let guardedFocus: typeof HTMLElement.prototype.focus;

  beforeAll(async () => {
    await enhanceContext({ canvasElement: document.body } as any);
    guardedFocus = HTMLElement.prototype.focus;
  });

  afterEach(() => {
    HTMLElement.prototype.focus = guardedFocus;
    document.body.innerHTML = '';
  });

  it('keeps focus a writable data property on the prototype', () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'focus');

    expect(descriptor?.writable).toBe(true);
    expect(descriptor?.get).toBeUndefined();
  });

  it('scopes an instance assignment to that element', () => {
    const a = document.createElement('button');
    const b = document.createElement('button');
    document.body.append(a, b);
    const ownFocus = vi.fn();
    a.focus = ownFocus;

    b.focus();

    expect(Object.hasOwn(a, 'focus')).toBe(true);
    expect(document.activeElement).toBe(b);
    expect(ownFocus).not.toHaveBeenCalled();
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

  it('skips focus for nodes without a browsing context', () => {
    const detachedDocument = document.implementation.createHTMLDocument();
    const button = detachedDocument.createElement('button');

    expect(() => button.focus()).not.toThrow();
    expect(detachedDocument.activeElement).not.toBe(button);
  });
});
