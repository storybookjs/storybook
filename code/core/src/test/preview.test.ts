// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { within } from 'storybook/test';

import { enhanceContext } from './preview.ts';

vi.mock('storybook/test', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/test')>();
  return { ...actual, within: vi.fn(actual.within) };
});

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

describe('canvas', () => {
  const originalBody = document.body;

  afterEach(() => {
    if (document.body !== originalBody) {
      document.body.replaceWith(originalBody);
    }
    document.body.innerHTML = '';
  });

  const element = (html: string) => {
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    return container;
  };

  it('queries the canvasElement a renderer sets after the loaders ran', async () => {
    const context = { canvasElement: element('<button>Loading</button>') } as any;
    await enhanceContext(context);
    const { canvas } = context;

    context.canvasElement = element('<button>Rendered</button>');

    expect(canvas.getByRole('button').textContent).toBe('Rendered');
  });

  it('queries the body of the document when the body is replaced after the render', async () => {
    const context = { canvasElement: document.body } as any;
    await enhanceContext(context);
    const { canvas } = context;

    const nextBody = document.createElement('body');
    nextBody.innerHTML = '<h1>Next page</h1>';
    document.body.replaceWith(nextBody);

    expect(canvas.getByRole('heading').textContent).toBe('Next page');
  });

  it('does not call within() again while canvasElement stays the same', async () => {
    const context = { canvasElement: element('<button>Save</button>') } as any;
    await enhanceContext(context);
    const { canvas } = context;
    vi.mocked(within).mockClear();

    canvas.getByRole('button');
    canvas.queryByText('Save');

    expect(within).not.toHaveBeenCalled();
  });
});
