// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WebView } from './WebView.ts';

const makeStory = (parameters: Record<string, any> = {}) => ({ parameters }) as any;

// happy-dom has no popover API: an element is open from showPopover() until hidePopover() or
// until it leaves the document, as in a browser.
const openPopovers = new WeakSet<Element>();
const isOpen = (element: Element) => {
  if (!element.isConnected) {
    openPopovers.delete(element);
  }
  return openPopovers.has(element);
};
HTMLElement.prototype.showPopover = function () {
  if (!this.isConnected || isOpen(this)) {
    throw new DOMException('Invalid state', 'InvalidStateError');
  }
  openPopovers.add(this);
};
HTMLElement.prototype.hidePopover = function () {
  if (!isOpen(this)) {
    throw new DOMException('Invalid state', 'InvalidStateError');
  }
  openPopovers.delete(this);
};
const { matches } = Element.prototype;
Element.prototype.matches = function (this: Element, selector: string) {
  return selector === ':popover-open' ? isOpen(this) : matches.call(this, selector);
} as typeof matches;

afterEach(() => {
  document.querySelectorAll('sb-preview').forEach((host) => host.remove());
});

const host = () => document.querySelector('sb-preview')!;

describe('WebView htmlLang', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="storybook-root"></div><div id="storybook-docs"></div>';
    document.documentElement.lang = 'en';
  });

  it('sets lang on the story root from the story htmlLang parameter when preparing a story', () => {
    const view = new WebView();
    view.prepareForStory(makeStory({ htmlLang: 'ja' }));
    expect(document.getElementById('storybook-root')).toHaveAttribute('lang', 'ja');
  });

  it('leaves the shared document root untouched so sibling stories are not polluted', () => {
    const view = new WebView();
    view.prepareForStory(makeStory({ htmlLang: 'ja' }));
    expect(document.documentElement.lang).toBe('en');
  });

  it('removes lang from the story root when a story has no htmlLang parameter', () => {
    const view = new WebView();
    const storyRoot = document.getElementById('storybook-root')!;
    storyRoot.setAttribute('lang', 'ja');
    view.prepareForStory(makeStory({}));
    expect(storyRoot).not.toHaveAttribute('lang');
  });

  it('does not modify the document language when preparing docs', () => {
    const view = new WebView();
    view.prepareForDocs();
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('WebView in a document whose body a story replaced', () => {
  let view: WebView;

  const replaceBody = () => {
    document.body.replaceChildren();
    document.body.getAttributeNames().forEach((name) => document.body.removeAttribute(name));
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="storybook-root"></div><div id="storybook-docs"></div>';
    view = new WebView();
    view.prepareForStory(makeStory());
    replaceBody();
  });

  it('shows the error display with its message, outside the body', () => {
    view.showErrorDisplay({ message: 'Boom', stack: 'at Story' });

    expect(host()).toHaveTextContent('Boom');
    expect(host()).toHaveTextContent('at Story');
    expect(host().parentElement).toBe(document.documentElement);
    expect(host().previousElementSibling).toBe(document.body);
    expect(document.body).not.toHaveTextContent('Boom');
    expect(isOpen(host())).toBe(true);
  });

  it('shows the error display without the body classes', () => {
    document.head.innerHTML = readFileSync(
      `${import.meta.dirname}/../../../../assets/server/base-preview-head.html`,
      'utf8'
    );

    view.showErrorDisplay({ message: 'Boom' });
    document.body.removeAttribute('class');

    expect(document.querySelector('.sb-errordisplay')).toBeVisible();
  });

  it('returns a story root that is in the document', () => {
    const root = view.prepareForStory(makeStory());

    expect(root).toBe(view.storyRoot());
    expect(root.isConnected).toBe(true);
    expect(root).not.toHaveAttribute('hidden');
  });

  it('returns a docs root that is in the document', () => {
    const root = view.prepareForDocs();

    expect(root.isConnected).toBe(true);
    expect(root).not.toHaveAttribute('hidden');
  });

  it('shows "no preview"', () => {
    view.showNoPreview();

    expect(host().querySelector('.sb-nopreview')).toBeInTheDocument();
    expect(host()).toHaveAttribute('data-mode', 'nopreview');
  });

  it('shows the preparing state', () => {
    view.showPreparingStory({ immediate: true });

    expect(host().querySelector('.sb-preparing-story')).toBeInTheDocument();
    expect(host()).toHaveAttribute('data-mode', 'preparing-story');
    expect(isOpen(host())).toBe(true);
  });

  it('takes its host out of the document when the story is shown again', () => {
    view.showErrorDisplay({ message: 'Boom' });
    const shown = host();
    view.showPreparingStory({ immediate: true });
    view.showMain();

    expect(document.querySelector('sb-preview')).toBeNull();
    expect(isOpen(shown)).toBe(false);
  });

  it('shows the error display after a render replaced the <body> element', () => {
    view.showPreparingStory({ immediate: true });
    const body = document.createElement('body');
    document.documentElement.replaceChild(body, document.body);

    view.showErrorDisplay({ message: 'Boom' });

    expect(host()).toHaveTextContent('Boom');
    expect(host().previousElementSibling).toBe(body);
    expect(isOpen(host())).toBe(true);
  });

  it('shows the error display after a render replaced every child of <html>', () => {
    view.showPreparingStory({ immediate: true });
    const shown = host();
    document.documentElement.replaceChildren(
      document.createElement('head'),
      document.createElement('body')
    );
    expect(isOpen(shown)).toBe(false);

    view.showMain();
    view.showErrorDisplay({ message: 'Boom' });

    expect(host()).toHaveTextContent('Boom');
    expect(host().previousElementSibling).toBe(document.body);
    expect(isOpen(host())).toBe(true);
  });

  it('attaches its host again, open, after a render removed it', () => {
    view.showPreparingStory({ immediate: true });
    host().remove();

    view.showErrorDisplay({ message: 'Boom' });

    expect(host()).toHaveTextContent('Boom');
    expect(isOpen(host())).toBe(true);
    expect(document.querySelectorAll('sb-preview')).toHaveLength(1);
  });

  it('attaches nothing to the document to show the story', () => {
    view.showMain();

    expect(document.querySelector('sb-preview')).toBeNull();
  });

  it('never reads its mode from the body', () => {
    view.showErrorDisplay({ message: 'Boom' });
    document.body.className = 'sb-show-main';

    view.showErrorDisplay({ message: 'Again' });

    expect(host()).toHaveTextContent('Again');
    expect(isOpen(host())).toBe(true);
    expect(document.body).toHaveClass('sb-show-errordisplay');
    expect(document.body).not.toHaveClass('sb-show-main');
  });
});

describe('WebView body classes', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="storybook-root"></div><div id="storybook-docs"></div>';
    document.body.removeAttribute('class');
  });

  it('projects the mode and the layout onto the body for stories and addons that read them', () => {
    const view = new WebView();
    view.prepareForStory(makeStory({ layout: 'centered' }));
    view.showMain();

    expect(document.body).toHaveClass('sb-show-main', 'sb-main-centered');

    view.showErrorDisplay({ message: 'Boom' });

    expect(document.body).toHaveClass('sb-show-errordisplay');
    expect(document.body).not.toHaveClass('sb-show-main');
  });
});
