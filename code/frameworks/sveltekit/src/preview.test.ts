// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SvelteKitMockParametersRemovedError } from 'storybook/internal/preview-errors';

// @ts-expect-error no declaration file for this JS module
import { navigating, page, updated } from '@storybook/sveltekit/internal/mocks/app/state.svelte.js';
import { link } from '@storybook/sveltekit/navigation.mock';

import { beforeEach as svelteKitBeforeEach } from './preview.ts';

// The cleanups of the stories that are set up and not yet torn down
const storyCleanups: Array<() => void> = [];

const runStoryBeforeEach = (context: {
  parameters?: Record<string, unknown>;
  canvasElement?: HTMLElement | null;
  viewMode?: string;
}) => {
  const result = (svelteKitBeforeEach as (context: unknown) => unknown)({
    parameters: {},
    canvasElement: document.body,
    viewMode: 'story',
    ...context,
  });
  const cleanup = typeof result === 'function' ? (result as () => void) : () => {};
  storyCleanups.push(cleanup);
  return cleanup;
};

const runBeforeEach = (parameters: Record<string, unknown> = {}) =>
  runStoryBeforeEach({ parameters });

afterEach(() => {
  storyCleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.innerHTML = '';
  link.mockClear();
});

describe('parameters.sveltekit_experimental', () => {
  it('throws an error that names the keys a story still sets', () => {
    const run = () =>
      runBeforeEach({
        sveltekit_experimental: {
          state: { page: { data: {} }, updated: { current: true } },
          navigation: { goto: () => {}, afterNavigate: { type: 'link' } },
          hrefs: { '/a': () => {}, '^/b': { callback: () => {}, asRegex: true } },
          forms: { enhance: () => {} },
        },
      });

    expect(run).toThrowError(SvelteKitMockParametersRemovedError);
    expect(run).toThrowError(
      '`state.page`, `state.updated`, `navigation.goto`, `navigation.afterNavigate`, `hrefs`, `forms.enhance`'
    );
    expect(run).toThrowError('MIGRATION.md#sveltekit-sveltekit_experimental-parameters-removed');
    expect(run).toThrowError(
      'storybook.js.org/docs/get-started/frameworks/sveltekit?ref=error#how-to-mock'
    );
  });

  it('throws for an empty object too', () => {
    expect(() => runBeforeEach({ sveltekit_experimental: {} })).toThrowError(
      /this story still sets it: `sveltekit_experimental`/
    );
  });

  it('does not throw without the parameter', () => {
    expect(() => runBeforeEach({ layout: 'centered' })).not.toThrow();
  });
});

describe('$app/state', () => {
  it('resets page, navigating and updated before every story', () => {
    page.data = { user: 'Ada' };
    page.status = 404;
    page.url = new URL('https://svelte.dev/docs');
    navigating.type = 'link';
    updated.current = true;

    runBeforeEach();

    expect(page.data).toEqual({});
    expect(page.status).toBe(-1);
    expect(page.url.href).toBe(new URL(location.origin).href);
    expect(navigating.type).toBeNull();
    expect(updated.current).toBe(false);
  });

  it('gives every story its own default objects', () => {
    runBeforeEach();
    page.data.user = 'Ada';

    runBeforeEach();

    expect(page.data).toEqual({});
  });
});

describe('link clicks', () => {
  const clickLink = (html: string) => {
    document.body.innerHTML = html;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
    document.querySelector('[data-click]')!.dispatchEvent(event);
    return event;
  };

  it.each([
    ['a reload link', '<a data-click href="/reload" data-sveltekit-reload>Reload</a>', '/reload'],
    ['a target of _self', '<a data-click href="/self" target="_self">Self</a>', '/self'],
    ['a target of _top', '<a data-click href="/top" target="_top">Top</a>', '/top'],
    ['a target of _parent', '<a data-click href="/up" target="_PARENT">Up</a>', '/up'],
    ['an element in a link', '<a href="/nested"><span data-click>Nested</span></a>', '/nested'],
    ['an SVG link', '<svg><a href="/svg"><rect data-click /></a></svg>', '/svg'],
  ])('sends %s to the link spy instead of navigating', (_, html, href) => {
    runBeforeEach();

    const event = clickLink(html);

    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveBeenCalledWith(href, event);
  });

  it.each([
    ['a download', '<a data-click href="/file.pdf" download>Download</a>'],
    ['a named window', '<a data-click href="/help" target="help">Help</a>'],
    ['an anchor without href', '<a data-click>No href</a>'],
    ['an element outside a link', '<button data-click>Button</button>'],
  ])('leaves %s to the browser', (_, html) => {
    runBeforeEach();

    const event = clickLink(html);

    expect(event.defaultPrevented).toBe(false);
    expect(link).not.toHaveBeenCalled();
  });

  it.each([['ctrlKey'], ['metaKey'], ['shiftKey'], ['altKey'], ['button']])(
    'leaves a click with %s to the browser',
    (key) => {
      runBeforeEach();
      document.body.innerHTML = '<a href="/tab">Tab</a>';
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ...(key === 'button' ? { button: 1 } : { [key]: true }),
      });

      document.querySelector('a')!.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(link).not.toHaveBeenCalled();
    }
  );

  it('leaves clicks that a component already handled', () => {
    runBeforeEach();
    document.body.innerHTML = '<a href="/handled">Handled</a>';
    const anchor = document.querySelector('a')!;
    anchor.addEventListener('click', (event) => event.preventDefault());

    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(link).not.toHaveBeenCalled();
  });

  it('stops after the story', () => {
    runBeforeEach()();

    const event = clickLink('<a data-click href="/settings">Settings</a>');

    expect(event.defaultPrevented).toBe(false);
    expect(link).not.toHaveBeenCalled();
  });

  it('works without a canvas, as in the load() of a portable story', () => {
    runStoryBeforeEach({ canvasElement: null });

    const event = clickLink('<a data-click href="/settings">Settings</a>');

    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveBeenCalledWith('/settings', event);
  });

  describe('in docs mode', () => {
    const click = (element: Element) => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
      element.dispatchEvent(event);
      return event;
    };

    let canvases: HTMLElement[];
    let cleanups: (() => void)[];

    beforeEach(() => {
      document.body.innerHTML = `
        <a id="docs-link" href="?path=/docs/other">Docs page link</a>
        <div id="a"><a href="/a">A</a></div>
        <div id="b"><a href="/b">B</a></div>`;
      canvases = [document.querySelector('#a')!, document.querySelector('#b')!];
      cleanups = canvases.map((canvasElement) =>
        runStoryBeforeEach({ canvasElement, viewMode: 'docs' })!
      );
    });

    it('reports a click in a story once', () => {
      click(canvases[1].querySelector('a')!);

      expect(link).toHaveBeenCalledTimes(1);
      expect(link).toHaveBeenCalledWith('/b', expect.any(MouseEvent));
    });

    it('leaves the links of the docs page to the browser', () => {
      const event = click(document.querySelector('#docs-link')!);

      expect(event.defaultPrevented).toBe(false);
      expect(link).not.toHaveBeenCalled();
    });

    it('keeps intercepting a story after another story is torn down', () => {
      cleanups[0]();

      const event = click(canvases[1].querySelector('a')!);

      expect(event.defaultPrevented).toBe(true);
      expect(link).toHaveBeenCalledWith('/b', expect.any(MouseEvent));
    });
  });
});
