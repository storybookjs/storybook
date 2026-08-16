/**
 * Cross-mode parity for the docs tools.
 *
 * Whether the docgen services registered decides which access the docs toolset runs on (see
 * `createLocalDocsAccess`), and the two build their answers from completely different sources —
 * the open services versus the manifests core builds.
 * Agents must not be able to tell which one served them, so the same project expressed both ways
 * has to render the same text. This is the only mechanical comparison of the two modes; the e2e
 * suite exercises the default mode only.
 */

import type { StoryIndex } from 'storybook/internal/types';
import { describe, expect, it } from 'vitest';

import { Tag } from '../../../constants/tags.ts';
import type { ToolsetCtx } from '../../toolset-definition.ts';
import { createManifestDocsAccess } from './access-manifest.ts';
import { createServiceDocsAccess } from './access-service.ts';
import { createDocsToolset } from './definition.ts';

const ctx: ToolsetCtx = { transport: 'mcp', getService: () => ({}) as never };

const storyIndex = {
  v: 5,
  entries: {
    'button--primary': {
      id: 'button--primary',
      title: 'Button',
      name: 'Primary',
      importPath: './src/Button.stories.tsx',
      type: 'story',
      subtype: 'story',
      componentPath: './src/Button.tsx',
      tags: [Tag.MANIFEST],
    },
    'guide--docs': {
      id: 'guide--docs',
      title: 'Guide',
      name: 'Guide',
      importPath: './src/Guide.mdx',
      type: 'docs',
      tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
    },
  },
} as unknown as StoryIndex;

const docgenPayload = {
  id: 'button',
  name: 'Button',
  path: './src/Button.tsx',
  description: 'A button',
  summary: 'Clickable',
  props: [{ name: 'variant', type: 'string', required: false, description: 'Visual style' }],
};

const storyDocsPayload = {
  id: 'button',
  name: 'Button',
  path: './src/Button.stories.tsx',
  import: "import { Button } from './Button'",
  stories: {
    'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
  },
};

const mdxPayload = {
  id: 'guide--docs',
  name: 'Guide',
  docs: {
    'guide--docs': { id: 'guide--docs', name: 'Guide', summary: 'How to', content: '# Guide' },
  },
};

/** The same project as the open services expose it (docgen-server mode). */
function serviceToolset() {
  const services: Record<string, unknown> = {
    'core/docgen': {
      queries: {
        docgenForAllComponents: { loaded: async () => ({ button: docgenPayload }) },
        docgen: {
          loaded: async ({ id }: { id: string }) => (id === 'button' ? docgenPayload : undefined),
        },
      },
    },
    'core/story-docs': {
      queries: {
        storyDocsForAllComponents: { loaded: async () => ({ button: storyDocsPayload }) },
        storyDocs: {
          loaded: async ({ id }: { id: string }) =>
            id === 'button' ? storyDocsPayload : undefined,
        },
      },
    },
    'addon-docs/mdx': {
      queries: {
        mdxForAllComponents: { loaded: async () => ({ 'guide--docs': mdxPayload }) },
        mdxForComponent: {
          loaded: async ({ id }: { id: string }) => (id === 'guide--docs' ? mdxPayload : undefined),
        },
      },
    },
  };

  return createDocsToolset({
    docsAccess: createServiceDocsAccess({
      storyIndex: { getIndex: async () => storyIndex },
      getService: ((id: string) => services[id]) as never,
    }),
  });
}

/** The same project as core's manifest builder emits it (the default mode). */
function manifestToolset() {
  return createDocsToolset({
    docsAccess: createManifestDocsAccess({
      getManifests: async () => ({
        components: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              description: 'A button',
              summary: 'Clickable',
              props: docgenPayload.props,
              import: storyDocsPayload.import,
              stories: [{ id: 'button--primary', name: 'Primary', snippet: '<Button />' }],
            },
          },
        },
        docs: {
          v: 0,
          docs: {
            'guide--docs': {
              id: 'guide--docs',
              name: 'Guide',
              summary: 'How to',
              content: '# Guide',
            },
          },
        },
      }),
    }),
  });
}

async function renderList(toolset: ReturnType<typeof createDocsToolset>, withStoryIds: boolean) {
  return (await toolset.methods.list.handler({ withStoryIds }, ctx)).markdown;
}

async function renderShow(toolset: ReturnType<typeof createDocsToolset>, id: string) {
  return (await toolset.methods.show.handler({ id }, ctx)).markdown;
}

describe('docs tools render the same text in both docgen modes', () => {
  it.each([false, true])('list with withStoryIds=%s', async (withStoryIds) => {
    expect(await renderList(serviceToolset(), withStoryIds)).toBe(
      await renderList(manifestToolset(), withStoryIds)
    );
  });

  it.each(['button', 'guide--docs', 'unknown-id'])('show %s', async (id) => {
    expect(await renderShow(serviceToolset(), id)).toBe(await renderShow(manifestToolset(), id));
  });

  it('showStory', async () => {
    const render = async (toolset: ReturnType<typeof createDocsToolset>) =>
      (
        await toolset.methods.showStory.handler(
          { componentId: 'button', storyName: 'Primary' },
          ctx
        )
      ).markdown;

    expect(await render(serviceToolset())).toBe(await render(manifestToolset()));
  });
});
