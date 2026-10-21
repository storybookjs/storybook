// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import type { StoryContext } from 'storybook/internal/types';

import { applyOutline } from './applyOutline.ts';

const OUTLINE_STYLE_ID = 'addon-outline';

const runBeforeEach = (context: Partial<StoryContext>) =>
  applyOutline({
    viewMode: 'story',
    id: 'test--story',
    globals: {},
    parameters: {},
    ...context,
  } as StoryContext) as (() => void) | undefined;

const outlineStyles = () => document.querySelectorAll(`[id="${OUTLINE_STYLE_ID}"]`);

describe('applyOutline', () => {
  afterEach(() => {
    document.getElementById(OUTLINE_STYLE_ID)?.remove();
    document.body.className = '';
  });

  it('applies outline styles when the outline global is enabled', () => {
    runBeforeEach({ globals: { outline: true } });
    expect(document.getElementById(OUTLINE_STYLE_ID)).not.toBeNull();
  });

  it('does not apply outline styles when disabled via parameters, even if the global is on', () => {
    runBeforeEach({
      globals: { outline: true },
      parameters: { outline: { disable: true } },
    });
    expect(document.getElementById(OUTLINE_STYLE_ID)).toBeNull();
  });

  it('outlines the elements in the body of the story it shows', () => {
    document.body.className = 'sb-show-main';
    document.body.innerHTML = '<div id="component"></div>';
    runBeforeEach({ globals: { outline: true } });

    expect(document.getElementById(OUTLINE_STYLE_ID)?.textContent).toContain('.sb-show-main div');
    expect(getComputedStyle(document.getElementById('component')!).outline).toContain('solid');
  });

  it('outlines a story with layout document, whose body has no class, also after it is replaced', () => {
    runBeforeEach({ globals: { outline: true }, parameters: { layout: 'document' } });

    const body = document.createElement('body');
    body.innerHTML = '<div id="page"></div>';
    document.documentElement.replaceChild(body, document.body);
    document.head.replaceChildren();

    expect(outlineStyles()).toHaveLength(1);
    expect(document.getElementById(OUTLINE_STYLE_ID)?.parentElement).toBe(document.documentElement);
    expect(getComputedStyle(document.getElementById('page')!).outline).toContain('solid');
  });

  it('adds its style again on the next render when a render removed it', () => {
    runBeforeEach({ globals: { outline: true }, parameters: { layout: 'document' } });
    document.getElementById(OUTLINE_STYLE_ID)!.remove();

    runBeforeEach({ globals: { outline: true }, parameters: { layout: 'document' } });

    expect(outlineStyles()).toHaveLength(1);
  });

  it('removes its style when the outline global is turned off on a rerender', () => {
    runBeforeEach({ globals: { outline: true } });
    runBeforeEach({ globals: { outline: false } });

    expect(document.getElementById(OUTLINE_STYLE_ID)).toBeNull();
  });

  it('removes its style in its cleanup, on either kind of story', () => {
    for (const layout of [undefined, 'document' as const]) {
      const cleanup = runBeforeEach({ globals: { outline: true }, parameters: { layout } });
      expect(outlineStyles()).toHaveLength(1);

      cleanup?.();
      expect(document.getElementById(OUTLINE_STYLE_ID)).toBeNull();
    }
  });

  it('removes the style of a story in a docs page in its cleanup', () => {
    const cleanup = runBeforeEach({ globals: { outline: true }, viewMode: 'docs' });
    expect(document.getElementById('addon-outline-docs-test--story')).not.toBeNull();

    cleanup?.();
    expect(document.getElementById('addon-outline-docs-test--story')).toBeNull();
  });
});
