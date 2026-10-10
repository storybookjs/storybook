import { definePreviewAddon } from 'storybook/internal/csf';

import { createDocsRenderer } from '@storybook/nextjs-vite-rsc/internal/docs-renderer';

import { importForHost } from 'vitest-plugin-rsc/nextjs/internal';

import { tagsExcludedFromDocs } from '../storybook-internals.ts';

// What `@storybook/addon-docs` and its preview annotations are in the preview, see the preset. The
// preview is the rsc layer, which has no React DOM, so the docs page is code of the browser layer:
// docs-renderer.tsx and MDX files are `host.ui.files` of vitest-plugin-rsc. In the preview their
// exports are stand-ins, which `importForHost()` turns into the exports of a module graph that
// lives as long as the document, not as long as the page of a story.

type Story = { tags?: string[]; parameters: { docs?: { disable?: boolean } } };
type Renderer = Pick<Awaited<ReturnType<typeof createDocsRenderer>>, 'render' | 'unmount'>;

async function docsRendererOfTheBrowserLayer(): Promise<Renderer> {
  const renderer = await (await importForHost(createDocsRenderer))();
  // Storybook takes `render` off the renderer. The page and the container of the docs parameters,
  // the page of an MDX file or an export of a file with "use client", are the browser layer's too.
  return {
    render: async (context, { page, container, ...docsParameter }, element) =>
      renderer.render(
        context,
        {
          ...docsParameter,
          page: await importForHost(page),
          container: await importForHost(container),
        },
        element
      ),
    unmount: (element) => renderer.unmount(element),
  };
}

let renderer: Promise<Renderer> | undefined;

function docsRenderer(): Promise<Renderer> {
  if (!renderer) {
    renderer = docsRendererOfTheBrowserLayer();
    // One that failed to load, like while a dev server restarted, loads anew for the next docs page
    renderer.catch(() => (renderer = undefined));
  }
  return renderer;
}

const excludeTags = tagsExcludedFromDocs();

export const parameters = {
  docs: {
    renderer: docsRenderer,
    stories: {
      filter: (story: Story) =>
        !(story.tags ?? []).some((tag) => excludeTags.has(tag)) && !story.parameters.docs?.disable,
    },
  },
};

// `addonDocs()` of CSF Next
export default () => definePreviewAddon({ parameters });

export class DocsRenderer {
  constructor() {
    throw new Error(
      '@storybook/nextjs-vite-rsc: DocsRenderer of @storybook/addon-docs renders with React ' +
        'DOM, which the preview, the rsc layer of the app, does not have. The framework renders ' +
        'the docs pages in the browser layer itself: leave `parameters.docs.renderer` as it is.'
    );
  }
}
