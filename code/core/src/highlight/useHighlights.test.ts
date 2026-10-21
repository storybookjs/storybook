// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import { HIGHLIGHT } from './constants.ts';
import { useHighlights } from './useHighlights.ts';

// happy-dom has no popover API, and its ResizeObserver never calls back. As in a browser, an element
// out of the document cannot be shown as a popover, and the observer calls back after it starts to
// observe an element.
HTMLElement.prototype.showPopover = function () {
  if (!this.isConnected) {
    throw new DOMException('Invalid on disconnected popover elements', 'InvalidStateError');
  }
};
HTMLElement.prototype.hidePopover = () => {};
vi.stubGlobal(
  'ResizeObserver',
  class {
    constructor(private callback: ResizeObserverCallback) {}
    observe() {
      this.callback([], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
);

const channel = new Channel({});

const root = () => document.getElementById('storybook-highlights-root');
const roots = () => document.querySelectorAll('#storybook-highlights-root');

// A story renders into #storybook-root. A story with layout 'document' may replace the <body>, which
// is its root, or render into the document, which clears <html> of all but <head> and <body>.
const renderStory = (html: string, { replaceBody = false, clearHtml = false } = {}) => {
  channel.emit(STORY_RENDER_PHASE_CHANGED, { newPhase: 'loading' });
  if (clearHtml) {
    document.documentElement.replaceChildren(document.head, document.body);
  }
  if (replaceBody) {
    const body = document.createElement('body');
    body.id = 'storybook-root';
    body.innerHTML = html;
    document.documentElement.replaceChild(body, document.body);
  } else {
    document.body.removeAttribute('id');
    document.getElementById('storybook-root')?.remove();
    const storyRoot = document.createElement('div');
    storyRoot.id = 'storybook-root';
    storyRoot.innerHTML = html;
    document.body.prepend(storyRoot);
  }
  channel.emit(STORY_RENDER_PHASE_CHANGED, { newPhase: 'rendering' });
};

const highlight = (selector: string) =>
  channel.emit(HIGHLIGHT, {
    id: 'test',
    selectors: [selector],
    hoverStyles: { outlineColor: 'red' },
    menu: [],
  });

const boxes = () => root()?.querySelectorAll('[data-highlight-dimensions]') ?? [];

describe('useHighlights', () => {
  beforeAll(() => {
    useHighlights(channel);
  });

  beforeEach(() => {
    renderStory('<button id="button">Button</button>');
  });

  it('highlights the elements of a story', async () => {
    highlight('#button');

    await vi.waitFor(() => expect(boxes()).toHaveLength(1));
    expect(root()?.isConnected).toBe(true);
  });

  it('keeps one root with one menu across stories that replace the body', async () => {
    highlight('#button');
    renderStory('<main id="first">Document</main>', { replaceBody: true });
    highlight('#first');
    renderStory('<main id="second">Document</main>', { replaceBody: true });
    highlight('#second');
    await vi.waitFor(() => expect(boxes()).toHaveLength(1));

    expect(roots()).toHaveLength(1);
    expect(root()?.isConnected).toBe(true);
    expect(root()?.querySelectorAll('#storybook-highlights-menu')).toHaveLength(1);
    expect(root()?.querySelectorAll('style')).toHaveLength(1);
  });

  it('keeps the root out of the story root of a story that replaces the body', async () => {
    renderStory('<div id="document">Document</div>', { replaceBody: true });
    highlight('div');

    await vi.waitFor(() => expect(boxes()).toHaveLength(1));
    expect(document.body.contains(root())).toBe(false);
  });

  it('highlights a story after a story that replaced the body', async () => {
    renderStory('<main id="document">Document</main>', { replaceBody: true });
    highlight('#document');
    renderStory('<button id="after">Button</button>');
    highlight('#after');

    await vi.waitFor(() => expect(boxes()).toHaveLength(1));
    expect(root()?.isConnected).toBe(true);
  });

  it('hovers a highlight after a story that replaced the body', async () => {
    renderStory('<main id="document">Document</main>', { replaceBody: true });
    highlight('#document');
    await vi.waitFor(() => expect(boxes()).toHaveLength(1));

    document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

    await vi.waitFor(() => expect((boxes()[0] as HTMLElement).style.outlineColor).toBe('red'));
  });

  it('attaches the root again after a render clears <html>', async () => {
    highlight('#button');
    await vi.waitFor(() => expect(boxes()).toHaveLength(1));

    renderStory('<main id="document">Document</main>', { replaceBody: true, clearHtml: true });
    highlight('#document');

    await vi.waitFor(() => expect(boxes()).toHaveLength(1));
    expect(roots()).toHaveLength(1);
  });
});
