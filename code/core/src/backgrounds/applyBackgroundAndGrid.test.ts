// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import type { StoryContext } from 'storybook/internal/types';

import { applyBackgroundAndGrid } from './applyBackgroundAndGrid.ts';

const BACKGROUND_STYLE_ID = 'addon-backgrounds-color';
const GRID_STYLE_ID = 'addon-backgrounds-grid';

const parameters = {
  backgrounds: { options: { dark: { name: 'Dark', value: 'rgb(0, 0, 0)' } } },
};
const globals = { backgrounds: { value: 'dark', grid: true } };

const runBeforeEach = (context: Partial<StoryContext>) =>
  applyBackgroundAndGrid({
    viewMode: 'story',
    id: 'test--story',
    globals,
    parameters,
    ...context,
  } as StoryContext) as () => void;

const addonStyles = () =>
  document.querySelectorAll(`[id="${BACKGROUND_STYLE_ID}"], [id="${GRID_STYLE_ID}"]`);

describe('applyBackgroundAndGrid', () => {
  afterEach(() => {
    addonStyles().forEach((style) => style.remove());
    document.body.className = '';
  });

  it('styles the body of a component story through its class, the grid after the background', () => {
    document.body.className = 'sb-show-main';
    runBeforeEach({});

    const [background, grid] = addonStyles();
    expect(background.id).toBe(BACKGROUND_STYLE_ID);
    expect(grid.id).toBe(GRID_STYLE_ID);
    expect(background.textContent).toContain('.sb-show-main {');
    expect(grid.textContent).toContain('.sb-show-main {');
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(0, 0, 0)');
  });

  it('styles the body of a story with layout document, also after it is replaced', () => {
    runBeforeEach({ parameters: { ...parameters, layout: 'document' } });

    const body = document.createElement('body');
    document.documentElement.replaceChild(body, document.body);
    document.head.replaceChildren();

    expect(addonStyles()).toHaveLength(2);
    addonStyles().forEach((style) => {
      expect(style.parentElement).toBe(document.documentElement);
      expect(style.textContent).toContain('body {');
    });
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(0, 0, 0)');
    // A story with layout document has no padding to offset the grid by.
    expect(document.getElementById(GRID_STYLE_ID)?.textContent).toContain(
      'background-position: 0px 0px'
    );
  });

  it('shows no background when disabled via parameters', () => {
    runBeforeEach({ parameters: { backgrounds: { ...parameters.backgrounds, disable: true } } });

    expect(document.getElementById(BACKGROUND_STYLE_ID)).toBeNull();
  });

  it('removes the styles the globals no longer ask for on a rerender', () => {
    runBeforeEach({});
    runBeforeEach({ globals: { backgrounds: { value: undefined, grid: false } } });

    expect(addonStyles()).toHaveLength(0);
  });

  it('adds its styles again on the next render when a render removed them', () => {
    runBeforeEach({ parameters: { ...parameters, layout: 'document' } });
    addonStyles().forEach((style) => style.remove());

    runBeforeEach({ parameters: { ...parameters, layout: 'document' } });

    expect(addonStyles()).toHaveLength(2);
  });

  it('fades only a change of the background it shows', () => {
    const options = { ...parameters.backgrounds.options, light: { name: 'Light', value: '#fff' } };
    runBeforeEach({ parameters: { backgrounds: { options } } });
    expect(document.getElementById(BACKGROUND_STYLE_ID)?.textContent).not.toContain('transition');

    runBeforeEach({
      parameters: { backgrounds: { options } },
      globals: { backgrounds: { value: 'light' } },
    });
    expect(document.getElementById(BACKGROUND_STYLE_ID)?.textContent).toContain(
      'transition: background-color'
    );
  });

  it('removes its styles in its cleanup, on either kind of story', () => {
    for (const layout of [undefined, 'document' as const]) {
      const cleanup = runBeforeEach({ parameters: { ...parameters, layout } });
      expect(addonStyles()).toHaveLength(2);

      cleanup();
      expect(addonStyles()).toHaveLength(0);
    }
  });

  it('removes the styles of a story in a docs page in its cleanup', () => {
    const ids = ['addon-backgrounds-docs-test--story', 'addon-backgrounds-grid-docs-test--story'];
    const cleanup = runBeforeEach({ viewMode: 'docs' });
    expect(ids.map((id) => document.getElementById(id))).not.toContain(null);

    cleanup();
    expect(ids.map((id) => document.getElementById(id))).toEqual([null, null]);
  });
});
