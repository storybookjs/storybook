// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { WebView } from './WebView.ts';

const makeStory = (parameters: Record<string, any> = {}) => ({ parameters }) as any;

describe('WebView htmlLang', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="storybook-root"></div><div id="storybook-docs"></div>';
    document.documentElement.lang = 'en';
  });

  it('sets <html lang> from the story htmlLang parameter when preparing a story', () => {
    const view = new WebView();
    view.prepareForStory(makeStory({ htmlLang: 'ja' }));
    expect(document.documentElement.lang).toBe('ja');
  });

  it('defaults <html lang> to en when a story has no htmlLang parameter', () => {
    const view = new WebView();
    document.documentElement.lang = 'ja';
    view.prepareForStory(makeStory({}));
    expect(document.documentElement.lang).toBe('en');
  });

  it('resets <html lang> to en when preparing docs', () => {
    const view = new WebView();
    document.documentElement.lang = 'ja';
    view.prepareForDocs();
    expect(document.documentElement.lang).toBe('en');
  });
});
