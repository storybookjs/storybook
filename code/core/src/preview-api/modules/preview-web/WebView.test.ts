// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebView } from './WebView.ts';

const makeStory = (parameters: Record<string, any> = {}) => ({ parameters }) as any;

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

describe('WebView scrollToAnchor', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="storybook-root"></div>
      <div id="storybook-docs">
        <h2 id="a-heading"></h2>
        <h2 id="2-column--basic"></h2>
        <h2 id="a heading"></h2>
      </div>
    `;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('scrolls to the element named by the hash', () => {
    const heading = document.getElementById('a-heading')!;
    const scrollIntoView = vi.spyOn(heading, 'scrollIntoView');

    new WebView().scrollToAnchor('#a-heading');

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('decodes a percent-encoded hash before looking the element up', () => {
    const heading = document.getElementById('a heading')!;
    const scrollIntoView = vi.spyOn(heading, 'scrollIntoView');

    new WebView().scrollToAnchor('#a%20heading');

    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it('resolves an id that is not a valid CSS selector', () => {
    const heading = document.getElementById('2-column--basic')!;
    const scrollIntoView = vi.spyOn(heading, 'scrollIntoView');

    new WebView().scrollToAnchor('#2-column--basic');

    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it('does nothing when no element matches the hash', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');

    expect(() => new WebView().scrollToAnchor('#no-such-heading')).not.toThrow();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls instantly when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const heading = document.getElementById('a-heading')!;
    const scrollIntoView = vi.spyOn(heading, 'scrollIntoView');

    new WebView().scrollToAnchor('#a-heading');

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant' });
  });

  it('scrolls smoothly when the user expresses no motion preference', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    const heading = document.getElementById('a-heading')!;
    const scrollIntoView = vi.spyOn(heading, 'scrollIntoView');

    new WebView().scrollToAnchor('#a-heading');

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('scrolls smoothly when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const heading = document.getElementById('a-heading')!;
    const scrollIntoView = vi.spyOn(heading, 'scrollIntoView');

    new WebView().scrollToAnchor('#a-heading');

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});
