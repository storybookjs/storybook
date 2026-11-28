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

describe('context userEvent', () => {
  const clipboard = { readText: vi.fn() };

  it('works in a secure context and keeps the browser clipboard', async () => {
    // Like browsers, put the clipboard on the prototype, not on the navigator itself.
    vi.stubGlobal('navigator', Object.create({ clipboard }));
    const context = { canvasElement: document.body, userEvent: {} } as any;

    await enhanceContext(context);

    expect(context.userEvent.type).toBeTypeOf('function');
    expect(navigator.clipboard).toBe(clipboard);
  });

  it('works in an insecure context, where the browser has no clipboard', async () => {
    // Browsers expose `navigator.clipboard` only in secure contexts (HTTPS or localhost).
    vi.stubGlobal('navigator', {});
    const context = { canvasElement: document.body, userEvent: {} } as any;

    await enhanceContext(context);

    expect(context.userEvent.type).toBeTypeOf('function');
    expect(context.userEvent.click).toBeTypeOf('function');
    expect('clipboard' in navigator).toBe(false);
  });

  it('keeps a clipboard that is already on the navigator', async () => {
    // For example the stub that `userEvent.setup()` attaches when a story calls it.
    vi.stubGlobal('navigator', {});
    Object.defineProperty(navigator, 'clipboard', { get: () => clipboard, configurable: true });
    const context = { canvasElement: document.body, userEvent: {} } as any;

    await enhanceContext(context);

    expect(context.userEvent.type).toBeTypeOf('function');
    expect(navigator.clipboard).toBe(clipboard);
  });

  it('is not set up without a DOM, as in React Native', async () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('HTMLElement', undefined);
    const context = { canvasElement: {}, userEvent: {} } as any;

    await expect(enhanceContext(context)).resolves.toBeUndefined();

    expect(context.userEvent).toEqual({});
  });
});
