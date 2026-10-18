// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
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

  it('shows the error display with its message', () => {
    view.showErrorDisplay({ message: 'Boom', stack: 'at Story' });

    expect(document.body).toHaveTextContent('Boom');
    expect(document.body).toHaveTextContent('at Story');
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

    expect(document.querySelector('.sb-nopreview')).toBeInTheDocument();
  });

  it('shows the preparing state', () => {
    view.showPreparingStory({ immediate: true });

    expect(document.querySelector('.sb-preparing-story')).toBeInTheDocument();
  });

  it('removes its blocks when the story is shown again', () => {
    view.showErrorDisplay({ message: 'Boom' });
    view.showPreparingStory({ immediate: true });
    view.showMain();

    expect(document.querySelector('.sb-errordisplay')).not.toBeInTheDocument();
    expect(document.querySelector('.sb-preparing-story')).not.toBeInTheDocument();
  });
});
