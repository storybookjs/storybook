// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { RenderContext } from 'storybook/internal/types';

import { defineComponent, h } from 'vue';

import { renderToCanvas } from './render.ts';
import type { VueRenderer } from './types.ts';

const makeRenderContext = ({
  storyFn,
  showMain = vi.fn(),
  showException = vi.fn(),
}: {
  storyFn: RenderContext<VueRenderer>['storyFn'];
  showMain?: RenderContext<VueRenderer>['showMain'];
  showException?: RenderContext<VueRenderer>['showException'];
}) =>
  ({
    storyFn,
    forceRemount: true,
    showMain,
    showError: vi.fn(),
    showException,
    id: 'docs-error-story--primary',
    storyContext: { args: {}, globals: {} },
  }) as unknown as RenderContext<VueRenderer>;

describe('renderToCanvas', () => {
  // Regression test for the vue3-vite---typescript---dev daily CI failure: the docs Story
  // block (code/addons/docs/src/blocks/components/Story.tsx) clears its error state when
  // showMain arrives, so a showMain sent after showException erases the error from the page.
  // Vue hands setup/render throws to config.errorHandler without making mount fail, so the
  // renderer must not report success afterwards.
  it('does not send showMain after the story failed to mount', async () => {
    const showMain = vi.fn();
    const showException = vi.fn();

    const storyFn = () =>
      defineComponent({
        setup() {
          throw new Error('Story did something wrong');
        },
        render: () => h('div'),
      });

    await renderToCanvas(
      makeRenderContext({ storyFn, showMain, showException }),
      document.createElement('div')
    );

    expect(showException).toHaveBeenCalled();
    expect(showMain).not.toHaveBeenCalled();
  });
});
