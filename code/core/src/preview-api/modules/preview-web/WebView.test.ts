// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

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
