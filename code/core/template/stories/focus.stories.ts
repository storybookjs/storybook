import type { StoryContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

import { expect, fn } from 'storybook/test';

/**
 * The test addon wraps `HTMLElement.prototype.focus` after `userEvent.setup()` patches it. These
 * stories pin the contract focus-management libraries rely on: the prototype method stays a plain
 * writable data property, so capture-and-wrap, prototype replacement, and per-element assignment
 * all keep native semantics.
 */
export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: { label: 'Focus probe' },
};

export const PrototypeFocusIsWritable = {
  play: async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'focus');
    await expect(descriptor?.writable).toBe(true);
    await expect(descriptor?.get).toBeUndefined();
  },
};

export const InstanceAssignmentIsScopedToThatElement = {
  play: async ({ canvasElement }: StoryContext) => {
    const a = document.createElement('button');
    const b = document.createElement('button');
    canvasElement.append(a, b);

    const ownFocus = fn();
    a.focus = ownFocus;

    await expect(Object.hasOwn(a, 'focus')).toBe(true);

    b.focus();
    await expect(document.activeElement).toBe(b);
    await expect(ownFocus).not.toHaveBeenCalled();

    a.focus();
    await expect(ownFocus).toHaveBeenCalledTimes(1);
  },
};

export const CaptureAndWrapOnThePrototype = {
  play: async ({ canvasElement }: StoryContext) => {
    const button = document.createElement('button');
    canvasElement.append(button);

    const captured = HTMLElement.prototype.focus;
    const wrapper = fn(function (this: HTMLElement, ...args: [FocusOptions?]) {
      return captured.apply(this, args);
    });
    HTMLElement.prototype.focus = wrapper;
    try {
      button.focus();
      await expect(wrapper).toHaveBeenCalledTimes(1);
      await expect(document.activeElement).toBe(button);
    } finally {
      HTMLElement.prototype.focus = captured;
    }
  },
};

export const InstanceWrapperDelegatingToThePrototype = {
  play: async ({ canvasElement }: StoryContext) => {
    const button = document.createElement('button');
    canvasElement.append(button);

    button.focus = function (this: HTMLElement, options?: FocusOptions) {
      return HTMLElement.prototype.focus.call(this, options);
    };

    button.focus();
    await expect(document.activeElement).toBe(button);
  },
};

export const NodeInRemovedIframeDoesNotThrow = {
  play: async ({ canvasElement }: StoryContext) => {
    const iframe = document.createElement('iframe');
    canvasElement.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const adoptedButton = document.createElement('button');
    frameDocument.body.append(adoptedButton);
    // user-event only takes its synthetic focus path, the one that throws, for a hidden document.
    Object.defineProperty(frameDocument, 'visibilityState', { value: 'hidden' });
    iframe.remove();

    await expect(adoptedButton.ownerDocument).toBe(frameDocument);
    await expect(adoptedButton.ownerDocument.defaultView).toBeNull();
    await expect(() => adoptedButton.focus()).not.toThrow();
  },
};
