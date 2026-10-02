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

describe('lazy userEvent initialization', () => {
  it('defines userEvent as a non-enumerable getter property on context', async () => {
    const context = {
      canvasElement: document.body,
      parameters: {},
    } as any;

    await enhanceContext(context);

    const descriptor = Object.getOwnPropertyDescriptor(context, 'userEvent');
    expect(descriptor).toBeDefined();
    expect(descriptor?.enumerable).toBe(false);
    expect(typeof descriptor?.get).toBe('function');
    expect(typeof descriptor?.set).toBe('function');

    // Object spread (e.g. React renderer <Story {...storyContext} />) must not invoke the getter or include userEvent
    const spread = { ...context };
    expect(spread.userEvent).toBeUndefined();
  });

  it('instantiates userEvent and caches the instance upon first access', async () => {
    const context = {
      canvasElement: document.body,
      parameters: {},
    } as any;

    await enhanceContext(context);

    const userEvent = context.userEvent;
    expect(userEvent).toBeDefined();
    expect(typeof userEvent.click).toBe('function');

    const userEventSecond = context.userEvent;
    expect(userEventSecond).toBe(userEvent);
  });

  it('allows setting userEvent manually', async () => {
    const context = {
      canvasElement: document.body,
      parameters: {},
    } as any;

    await enhanceContext(context);

    const customUserEvent = { click: vi.fn() };
    context.userEvent = customUserEvent;

    expect(context.userEvent).toBe(customUserEvent);
  });
});
