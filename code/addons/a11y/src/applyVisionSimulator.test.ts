// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import type { StoryContext } from 'storybook/internal/types';

import { applyVisionSimulator } from './applyVisionSimulator.ts';

const FILTER = 'url("#storybook-a11y-vision-deuteranopia")';

const runBeforeEach = (context: Partial<StoryContext>) =>
  applyVisionSimulator({
    viewMode: 'story',
    globals: { vision: 'deuteranopia' },
    parameters: {},
    ...context,
  } as StoryContext) as (() => void) | undefined;

const filterStyles = () => document.querySelectorAll('style#storybook-a11y-vision-style');
const filterDefs = () => document.querySelectorAll('#storybook-a11y-vision-filters');
const bodyFilter = () => getComputedStyle(document.body).filter;

describe('applyVisionSimulator', () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    document.body.className = '';
    document.body.removeAttribute('id');
  });

  it('filters the body of a component story while the preview shows it', () => {
    document.body.className = 'sb-show-main';
    cleanup = runBeforeEach({});

    expect(bodyFilter()).toBe(FILTER);
    expect(filterDefs()).toHaveLength(1);

    document.body.className = 'sb-show-errordisplay';
    expect(bodyFilter()).not.toBe(FILTER);
  });

  it('filters the body of a story with layout document, also after it is replaced', () => {
    cleanup = runBeforeEach({ parameters: { layout: 'document' } });

    const body = document.createElement('body');
    body.id = 'storybook-root';
    document.documentElement.replaceChild(body, document.body);
    document.head.replaceChildren();

    expect(bodyFilter()).toBe(FILTER);
    expect(filterStyles()).toHaveLength(1);
    expect(filterDefs()).toHaveLength(1);
  });

  it('puts nothing into the body of a story with layout document, its story root', () => {
    document.body.id = 'storybook-root';
    cleanup = runBeforeEach({ parameters: { layout: 'document' } });

    expect(filterStyles()[0].parentElement).toBe(document.documentElement);
    expect(filterDefs()[0].parentElement).toBe(document.documentElement);
    expect(document.body.childElementCount).toBe(0);
    expect(document.body.hasAttribute('style')).toBe(false);
  });

  it('leaves the filter definitions a story renders itself', () => {
    document.body.insertAdjacentHTML('beforeend', '<svg id="storybook-a11y-vision-filters"></svg>');
    runBeforeEach({})?.();

    expect(filterDefs()).toHaveLength(1);
    expect(filterDefs()[0].parentElement).toBe(document.body);
    filterDefs()[0].remove();
  });

  it('adds nothing when no vision filter is selected', () => {
    cleanup = runBeforeEach({ globals: {} });

    expect(filterStyles()).toHaveLength(0);
    expect(filterDefs()).toHaveLength(0);
  });

  it('keeps one style and one set of filters across rerenders, and follows the global', () => {
    document.body.className = 'sb-show-main';
    cleanup = runBeforeEach({});
    runBeforeEach({ globals: { vision: 'blurred' } });

    expect(filterStyles()).toHaveLength(1);
    expect(filterDefs()).toHaveLength(1);
    expect(bodyFilter()).toBe('blur(2px)');

    runBeforeEach({ globals: { vision: undefined } });
    expect(filterStyles()).toHaveLength(0);
    expect(filterDefs()).toHaveLength(0);
  });

  it('adds its style and filters again on the next render when a render removed them', () => {
    cleanup = runBeforeEach({ parameters: { layout: 'document' } });
    document.documentElement.replaceChildren(document.head, document.body);

    runBeforeEach({ parameters: { layout: 'document' } });

    expect(filterStyles()).toHaveLength(1);
    expect(filterDefs()).toHaveLength(1);
  });

  it('removes its style and filters in its cleanup, on either kind of story', () => {
    for (const layout of [undefined, 'document' as const]) {
      runBeforeEach({ parameters: { layout } })?.();

      expect(filterStyles()).toHaveLength(0);
      expect(filterDefs()).toHaveLength(0);
      expect(document.body.hasAttribute('style')).toBe(false);
    }
  });
});
