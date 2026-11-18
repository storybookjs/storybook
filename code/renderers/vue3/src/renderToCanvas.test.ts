// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { RenderContext } from 'storybook/internal/types';

import { defineComponent, h } from 'vue';

import { renderToCanvas } from './render.ts';
import type { VueRenderer } from './types.ts';

const makeRenderContext = ({
  storyFn,
  showMain,
  showException,
}: {
  storyFn: RenderContext<VueRenderer>['storyFn'];
  showMain: RenderContext<VueRenderer>['showMain'];
  showException: RenderContext<VueRenderer>['showException'];
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
  // A story that throws must not also report success: the docs Story block clears its error
  // state when showMain arrives, which would erase the error. Vue hands setup/render throws
  // to config.errorHandler without making mount fail, so the renderer tracks that itself.
  it.each([
    [
      'setup()',
      () =>
        defineComponent({
          setup() {
            throw new Error('Story did something wrong in setup');
          },
          render: () => h('div'),
        }),
    ],
    [
      'render()',
      () =>
        defineComponent({
          render() {
            throw new Error('Story did something wrong in render');
          },
        }),
    ],
  ])('does not send showMain after the story failed in %s', async (_phase, storyFn) => {
    const showMain = vi.fn();
    const showException = vi.fn();

    const teardown = await renderToCanvas(
      makeRenderContext({ storyFn, showMain, showException }),
      document.createElement('div')
    );
    teardown();

    expect(showException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Story did something wrong'),
      })
    );
    expect(showMain).not.toHaveBeenCalled();
  });
});
