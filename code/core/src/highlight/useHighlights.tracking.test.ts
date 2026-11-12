// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import { HIGHLIGHT, RESET_HIGHLIGHT } from './constants.ts';
import { useHighlights } from './useHighlights.ts';

/** Lets MutationObserver callbacks and animation frames run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const highlightBoxes = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '#storybook-highlights-root > [data-highlight-dimensions]'
    )
  );

describe('useHighlights', () => {
  let storybookRoot: HTMLElement;
  let channel: Channel;

  beforeEach(() => {
    vi.stubGlobal('__STORYBOOK_HIGHLIGHT_INITIALIZED', false);
    // Browsers call a ResizeObserver back once for each observed element; happy-dom never does.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe() {
          queueMicrotask(() => this.callback([], this as unknown as ResizeObserver));
        }
        unobserve() {}
        disconnect() {}
      }
    );
    document.body.innerHTML = '<div id="storybook-root"></div>';
    storybookRoot = document.getElementById('storybook-root')!;
    for (let i = 0; i < 200; i++) {
      storybookRoot.append(document.createElement('div'));
    }
    channel = new Channel({});
    useHighlights(channel);
  });

  afterEach(() => {
    channel.emit(RESET_HIGHLIGHT);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('reads no computed styles on DOM mutations while nothing is highlighted', async () => {
    channel.emit(RESET_HIGHLIGHT);
    await settle();

    const getComputedStyle = vi.spyOn(window, 'getComputedStyle');
    for (let i = 0; i < 5; i++) {
      storybookRoot.append(document.createElement('span'));
      await settle();
    }

    expect(getComputedStyle).not.toHaveBeenCalled();
  });

  it('reads the computed style of highlighted elements only, not of the whole page', async () => {
    storybookRoot.insertAdjacentHTML('beforeend', '<button id="target">Target</button>');
    channel.emit(HIGHLIGHT, { id: 'test', selectors: ['#target'] });
    await settle();
    expect(highlightBoxes()).toHaveLength(1);

    const getComputedStyle = vi.spyOn(window, 'getComputedStyle');
    storybookRoot.append(document.createElement('span'));
    await settle();

    // Measuring and styling the one highlighted box reads its element's style; the other 200+
    // elements on the page are never read.
    expect(getComputedStyle.mock.calls.length).toBeLessThanOrEqual(2);
    expect(getComputedStyle.mock.calls.every(([element]) => element.id === 'target')).toBe(true);
    expect(highlightBoxes()).toHaveLength(1);
  });

  it('tracks elements that a mutation adds or removes', async () => {
    channel.emit(HIGHLIGHT, { id: 'test', selectors: ['.item'] });
    await settle();
    expect(highlightBoxes()).toHaveLength(0);

    storybookRoot.insertAdjacentHTML('beforeend', '<p class="item">One</p><p class="item">Two</p>');
    await settle();
    expect(highlightBoxes()).toHaveLength(2);

    storybookRoot.querySelector('.item')!.remove();
    await settle();
    expect(highlightBoxes()).toHaveLength(1);
  });

  it('moves a box when a mutation moves its element without changing the tracked set', async () => {
    storybookRoot.insertAdjacentHTML('beforeend', '<button id="target">Target</button>');
    const target = document.getElementById('target')!;
    const rect = vi.spyOn(target, 'getBoundingClientRect');
    rect.mockReturnValue(new DOMRect(10, 20, 100, 30));
    channel.emit(HIGHLIGHT, { id: 'test', selectors: ['#target'] });
    await settle();
    expect(highlightBoxes()[0].style.top).toBe('20px');

    rect.mockReturnValue(new DOMRect(10, 60, 100, 30));
    target.before(document.createElement('div'));
    await settle();

    expect(highlightBoxes()[0].style.top).toBe('60px');
  });

  it('updates boxes when a nested scroll container scrolls', async () => {
    storybookRoot.insertAdjacentHTML(
      'beforeend',
      '<div id="scroller" style="overflow: auto; height: 50px"><button id="target">Target</button></div>'
    );
    const target = document.getElementById('target')!;
    const rect = vi.spyOn(target, 'getBoundingClientRect');
    rect.mockReturnValue(new DOMRect(10, 20, 100, 30));
    channel.emit(HIGHLIGHT, { id: 'test', selectors: ['#target'] });
    await settle();
    expect(highlightBoxes()[0].style.top).toBe('20px');

    rect.mockReturnValue(new DOMRect(10, 5, 100, 30));
    document.getElementById('scroller')!.dispatchEvent(new Event('scroll'));
    await settle();

    expect(highlightBoxes()[0].style.top).toBe('5px');
  });

  it('removes boxes when the highlights are reset', async () => {
    storybookRoot.insertAdjacentHTML('beforeend', '<button id="target">Target</button>');
    channel.emit(HIGHLIGHT, { id: 'test', selectors: ['#target'] });
    await settle();
    expect(highlightBoxes()).toHaveLength(1);

    channel.emit(RESET_HIGHLIGHT);
    await settle();

    expect(highlightBoxes()).toHaveLength(0);
  });
});
