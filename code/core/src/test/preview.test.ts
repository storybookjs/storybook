// @vitest-environment happy-dom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import testPreview from './preview.ts';

describe('focus instrumentation', () => {
  const NativeHTMLElement = HTMLElement;
  class TestHTMLElement extends NativeHTMLElement {}

  beforeAll(async () => {
    customElements.define('test-focus-element', TestHTMLElement);
    const windowWithClipboard = Object.create(window);
    Object.defineProperty(windowWithClipboard, 'navigator', {
      value: { clipboard: {} },
    });
    vi.stubGlobal('window', windowWithClipboard);
    vi.stubGlobal('HTMLElement', TestHTMLElement);

    const loaders = testPreview().loaders;
    const enhanceContext = Array.isArray(loaders) ? loaders.at(-1) : loaders;
    await enhanceContext?.({
      canvasElement: document.body,
      initialArgs: {},
      parameters: {},
    } as never);

    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'focus')?.get).toBeTypeOf(
      'function'
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('allows tooling to read focus from HTMLElement.prototype', () => {
    Object.defineProperty(HTMLElement.prototype, 'ownerDocument', {
      configurable: true,
      get: () => {
        throw new TypeError('Illegal invocation');
      },
    });

    try {
      expect(() => HTMLElement.prototype.focus).not.toThrow();
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'ownerDocument');
    }
  });

  it('uses an assigned focus method for element instances', () => {
    const assignedFocus = vi.fn(function (this: HTMLElement) {});
    HTMLElement.prototype.focus = assignedFocus;

    const element = document.createElement('test-focus-element');
    element.focus();

    expect(assignedFocus).toHaveBeenCalledOnce();
    expect(assignedFocus.mock.instances[0]).toBe(element);
  });
});
