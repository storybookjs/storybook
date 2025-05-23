// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import type { RenderContext } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { addons } from '../addons';
import { PreviewWeb } from './PreviewWeb';
import {
  componentOneExports,
  emitter,
  getProjectAnnotations,
  importFn,
  mockChannel,
  storyIndex as mockStoryIndex,
  projectAnnotations,
  waitForRender,
} from './PreviewWeb.mockdata';
import { WebView } from './WebView';

// PreviewWeb.test mocks out all rendering
//   - ie. from`renderToCanvas()` (stories) or`ReactDOM.render()` (docs) in.
// This file lets them rip.

vi.mock('storybook/internal/channels', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/channels')>()),
    createBrowserChannel: () => mockChannel,
  };
});
vi.mock('@storybook/addon-docs/blocks', async () => {
  const { CodeOrSourceMdx } = await import('../../../../../addons/docs/src/blocks/blocks/mdx');
  return {
    Docs: vi.fn(() => 'Docs'),
    CodeOrSourceMdx: CodeOrSourceMdx,
    AnchorMdx: vi.fn(() => 'AnchorMdx'),
    HeadersMdx: vi.fn(() => 'HeadersMdx'),
  };
});
vi.mock('storybook/internal/client-logger');
vi.mock('storybook/internal/components');

vi.mock('storybook/internal/channels', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/channels')>()),
    createBrowserChannel: () => mockChannel,
  };
});
vi.mock('storybook/internal/client-logger', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/client-logger')>()),
    createBrowserChannel: () => mockChannel,
  };
});
vi.mock('storybook/internal/components', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/components')>()),
    createBrowserChannel: () => mockChannel,
  };
});

vi.mock('./WebView');

const { document } = global;
vi.mock('@storybook/global', () => ({
  global: {
    ...globalThis,
    history: { replaceState: vi.fn() },
    document: {
      createElement: globalThis.document.createElement.bind(globalThis.document),
      location: {
        pathname: 'pathname',
        search: '?id=*',
      },
    },
    fetch: async () => ({ status: 200, json: async () => mockStoryIndex }),
  },
}));

beforeEach(() => {
  document.location.search = '';
  mockChannel.emit.mockClear();
  emitter.removeAllListeners();
  componentOneExports.default.loaders[0].mockReset().mockImplementation(async () => ({ l: 7 }));
  componentOneExports.default.parameters.docs.container.mockClear();
  componentOneExports.a.play.mockReset();
  projectAnnotations.renderToCanvas.mockReset();
  projectAnnotations.render.mockClear();
  projectAnnotations.decorators[0].mockClear();

  // We need to import DocsRenderer async because MDX2 is ESM-only so we inline
  // this in each of the async tests below to get it working in Jest
  // projectAnnotations.parameters.docs.renderer = () => new DocsRenderer() as any;

  addons.setChannel(mockChannel as any);

  vi.mocked(WebView.prototype).prepareForDocs.mockReturnValue('docs-element' as any);
  vi.mocked(WebView.prototype).prepareForStory.mockReturnValue('story-element' as any);
});

/**
 * Skipping this test, because it causes a cyclical dependency error, where core depends on docs &
 * blocks This was done to avoid a conflict in the CPC work, we should revisit this.
 */
describe('PreviewWeb', { skip: true }, () => {
  describe('initial render', () => {
    it('renders story mode through the stack', async () => {
      const { DocsRenderer } = await import('../../../../../addons/docs/src/index');
      projectAnnotations.parameters.docs.renderer = () => new DocsRenderer() as any;

      projectAnnotations.renderToCanvas.mockImplementationOnce(({ storyFn }: RenderContext<any>) =>
        storyFn()
      );
      document.location.search = '?id=component-one--a';
      await new PreviewWeb(importFn, getProjectAnnotations).ready();

      await waitForRender();

      await vi.waitFor(() => {
        expect(projectAnnotations.decorators[0]).toHaveBeenCalled();
        expect(projectAnnotations.render).toHaveBeenCalled();
      });
    });

    it('renders docs mode through docs page', async () => {
      const { DocsRenderer } = await import('../../../../../addons/docs/src/index');
      projectAnnotations.parameters.docs.renderer = () => new DocsRenderer() as any;

      document.location.search = '?id=component-one--docs&viewMode=docs';
      const preview = new PreviewWeb(importFn, getProjectAnnotations);

      const docsRoot = document.createElement('div');
      vi.mocked(preview.view.prepareForDocs).mockReturnValue(docsRoot as any);
      componentOneExports.default.parameters.docs.container.mockImplementationOnce(() =>
        React.createElement('div', {}, 'INSIDE')
      );

      await preview.ready();

      await vi.waitFor(
        () => {
          if (docsRoot.outerHTML !== '<div><div>INSIDE</div></div>') {
            throw new Error('DocsRoot not ready yet');
          }
        },
        {
          timeout: 2000,
        }
      );

      expect(docsRoot.outerHTML).toMatchInlineSnapshot('"<div><div>INSIDE</div></div>"');

      // Extended timeout to try and avoid
      // Error: Event was not emitted in time: storyRendered,docsRendered,storyThrewException,storyErrored,storyMissing
    }, 10_000);

    it('sends docs rendering exceptions to showException', async () => {
      const { DocsRenderer } = await import('../../../../../addons/docs/src/index');
      projectAnnotations.parameters.docs.renderer = () => new DocsRenderer() as any;

      document.location.search = '?id=component-one--docs&viewMode=docs';
      const preview = new PreviewWeb(importFn, getProjectAnnotations);

      const docsRoot = document.createElement('div');
      vi.mocked(preview.view.prepareForDocs).mockReturnValue(docsRoot as any);
      componentOneExports.default.parameters.docs.container.mockImplementation(() => {
        throw new Error('Docs rendering error');
      });

      vi.mocked(preview.view.showErrorDisplay).mockClear();

      await preview.ready();

      await vi.waitFor(
        () => {
          expect(preview.view.showErrorDisplay).toHaveBeenCalled();
        },
        {
          timeout: 2000,
        }
      );
    });
  });

  describe('onGetGlobalMeta changed (HMR)', () => {
    const newGlobalDecorator = vi.fn((s) => s());
    const newGetProjectAnnotations = () => {
      return {
        ...projectAnnotations,
        args: { a: 'second' },
        globals: { a: 'second' },
        decorators: [newGlobalDecorator],
      };
    };

    it('renders story mode through the updated stack', async () => {
      const { DocsRenderer } = await import('../../../../../addons/docs/src/index');
      projectAnnotations.parameters.docs.renderer = () => new DocsRenderer() as any;

      document.location.search = '?id=component-one--a';
      const preview = new PreviewWeb(importFn, getProjectAnnotations);
      await preview.ready();
      await waitForRender();

      projectAnnotations.renderToCanvas.mockImplementationOnce(({ storyFn }: RenderContext<any>) =>
        storyFn()
      );
      projectAnnotations.decorators[0].mockClear();
      mockChannel.emit.mockClear();
      preview.onGetProjectAnnotationsChanged({ getProjectAnnotations: newGetProjectAnnotations });

      await vi.waitFor(() => {
        expect(projectAnnotations.decorators[0]).not.toHaveBeenCalled();
        expect(newGlobalDecorator).toHaveBeenCalled();
        expect(projectAnnotations.render).toHaveBeenCalled();
      });
    });
  });
});
