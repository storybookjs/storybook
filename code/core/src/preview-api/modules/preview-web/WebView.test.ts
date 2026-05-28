// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebView } from './WebView.ts';

vi.mock('storybook/internal/client-logger', () => ({
  logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

const setupPreviewRoots = () => {
  document.body.className = '';
  document.body.innerHTML = '<div id="storybook-root"></div><div id="storybook-docs"></div>';
};

const setScrollPosition = (element: Element) => {
  element.scrollTop = 100;
  element.scrollLeft = 50;
};

const expectScrollReset = (element: Element) => {
  expect(element.scrollTop).toBe(0);
  expect(element.scrollLeft).toBe(0);
};

describe('WebView', () => {
  beforeEach(() => {
    setupPreviewRoots();
  });

  describe('prepareForDocs', () => {
    it('resets the document and docs root scroll positions', () => {
      const docsRoot = document.getElementById('storybook-docs')!;
      setScrollPosition(document.documentElement);
      setScrollPosition(document.body);
      setScrollPosition(docsRoot);

      const root = new WebView().prepareForDocs();

      expect(root).toBe(docsRoot);
      expectScrollReset(document.documentElement);
      expectScrollReset(document.body);
      expectScrollReset(docsRoot);
    });
  });

  describe('prepareForStory', () => {
    it('resets the document and story root scroll positions', () => {
      const storyRoot = document.getElementById('storybook-root')!;
      setScrollPosition(document.documentElement);
      setScrollPosition(document.body);
      setScrollPosition(storyRoot);

      const root = new WebView().prepareForStory({
        parameters: { layout: 'padded' },
      } as Parameters<WebView['prepareForStory']>[0]);

      expect(root).toBe(storyRoot);
      expectScrollReset(document.documentElement);
      expectScrollReset(document.body);
      expectScrollReset(storyRoot);
    });
  });
});
