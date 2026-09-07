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
import {
  buildComponentsRefManifest,
  toComponentManifestIndexEntries,
} from '../../../../core-server/utils/manifests/components-ref-manifest.ts';
import { createManifestDocsAccess } from './access-manifest.ts';
import { createProviderDocsAccess } from './access-provider.ts';
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

// Angular-shaped: the framework authors its own Markdown rather than shipping a `react*` payload.
const apiDescription = [
  '## Inputs',
  '',
  '```',
  'export type ButtonInputs = {',
  '  variant?: string;',
  '}',
  '```',
  '',
  '## Outputs',
  '',
  '```',
  'export type ButtonOutputs = {',
  '  clicked: (e: Event) => void;',
  '}',
  '```',
].join('\n');

const docgenPayload = {
  id: 'button',
  name: 'Button',
  path: './src/Button.tsx',
  description: 'A button',
  summary: 'Clickable',
  props: [{ name: 'variant', type: 'string', required: false, description: 'Visual style' }],
  apiDescription,
  renderer: 'angular',
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
              apiDescription,
              renderer: 'angular',
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

  it('show button carries the framework-authored api sections in both modes', async () => {
    for (const toolset of [serviceToolset(), manifestToolset()]) {
      const markdown = await renderShow(toolset, 'button');
      expect(markdown).toContain('## Inputs');
      expect(markdown).toContain('## Outputs');
    }
  });

  it.each([{ componentId: 'button', storyName: 'Primary' }, { storyId: 'button--primary' }])(
    'showStory %o',
    async (input) => {
      const render = async (toolset: ReturnType<typeof createDocsToolset>) =>
        (await toolset.methods.showStory.handler(input, ctx)).markdown;

      expect(await render(serviceToolset())).toBe(await render(manifestToolset()));
    }
  );

  it('showStory answers a story id and the matching name pair identically', async () => {
    const toolset = manifestToolset();
    const render = async (input: Record<string, string>) =>
      (await toolset.methods.showStory.handler(input, ctx)).markdown;

    expect(await render({ storyId: 'button--primary' })).toBe(
      await render({ componentId: 'button', storyName: 'Primary' })
    );
  });
});

/**
 * The same parity, for the third way these tools are served: a built Storybook read over the
 * manifest files, which is what `@storybook/mcp` does.
 *
 * Componentless stories are the case where the two legs used to disagree — the built index dropped
 * the story-docs reference for any component docgen produced nothing for, so a hosted Storybook
 * answered as if those stories did not exist.
 */
describe('docs tools render the same text in dev and from a built Storybook', () => {
  const componentId = 'abstractions-billboard';

  const componentlessIndex = {
    v: 5,
    entries: {
      [`${componentId}--default`]: {
        id: `${componentId}--default`,
        title: 'Abstractions/Billboard',
        name: 'Default',
        importPath: './src/abstractions/billboard.stories.ts',
        type: 'story',
        subtype: 'story',
        tags: [Tag.MANIFEST],
      },
      [`${componentId}--text`]: {
        id: `${componentId}--text`,
        title: 'Abstractions/Billboard',
        name: 'Text',
        importPath: './src/abstractions/billboard.stories.ts',
        type: 'story',
        subtype: 'story',
        tags: [Tag.MANIFEST],
      },
    },
  } as unknown as StoryIndex;

  const componentlessStoryDocs = {
    id: componentId,
    name: 'Billboard',
    path: './src/abstractions/billboard.stories.ts',
    stories: {
      [`${componentId}--default`]: { id: `${componentId}--default`, name: 'Default' },
      [`${componentId}--text`]: { id: `${componentId}--text`, name: 'Text' },
    },
  };

  /** The project as the dev server's open services expose it: no docgen, stories with no snippet. */
  function devAccess() {
    const services: Record<string, unknown> = {
      'core/docgen': {
        queries: {
          docgenForAllComponents: { loaded: async () => ({}) },
          docgen: { loaded: async () => undefined },
        },
      },
      'core/story-docs': {
        queries: {
          storyDocsForAllComponents: {
            loaded: async () => ({ [componentId]: componentlessStoryDocs }),
          },
          storyDocs: {
            loaded: async ({ id }: { id: string }) =>
              id === componentId ? componentlessStoryDocs : undefined,
          },
        },
      },
    };

    return createServiceDocsAccess({
      storyIndex: { getIndex: async () => componentlessIndex },
      getService: ((id: string) => services[id]) as never,
    });
  }

  function devToolset() {
    return createDocsToolset({ docsAccess: devAccess() });
  }

  /** The same project as a static build writes it, served back over a manifest provider. */
  function staticAccess() {
    const files: Record<string, unknown> = {
      './manifests/components.json': buildComponentsRefManifest(
        toComponentManifestIndexEntries(
          [componentId],
          {},
          { [componentId]: componentlessStoryDocs }
        )
      ),
      [`./services/core/story-docs/${componentId}.json`]: {
        components: { [componentId]: componentlessStoryDocs },
      },
    };

    return createProviderDocsAccess({
      manifestProvider: async (_request, path) => {
        const file = files[path];
        if (!file) {
          throw new Error(`404 ${path}`);
        }
        return JSON.stringify(file);
      },
    });
  }

  function staticToolset() {
    return createDocsToolset({ docsAccess: staticAccess() });
  }

  it.each([false, true])('list with withStoryIds=%s', async (withStoryIds) => {
    const dev = await renderList(devToolset(), withStoryIds);

    expect(dev).toContain(`- ${componentId} (${componentId})`);
    expect(await renderList(staticToolset(), withStoryIds)).toBe(dev);
  });

  it('show names the stories of a componentless component in both', async () => {
    const dev = await renderShow(devToolset(), componentId);

    expect(dev).toContain(`- Default (${componentId}--default)`);
    expect(dev).toContain(`- Text (${componentId}--text)`);
    expect(await renderShow(staticToolset(), componentId)).toBe(dev);
  });

  it.each([{ componentId, storyName: 'Default' }, { storyId: `${componentId}--default` }])(
    'showStory answers for a story with no snippet in both (%o)',
    async (input) => {
      const render = async (toolset: ReturnType<typeof createDocsToolset>) =>
        (await toolset.methods.showStory.handler(input, ctx)).markdown;

      const dev = await render(devToolset());

      expect(dev).toContain(`Story ID: ${componentId}--default`);
      expect(await render(staticToolset())).toBe(dev);
    }
  );

  it('lists the real stories when asked for one that does not exist', async () => {
    const render = async (toolset: ReturnType<typeof createDocsToolset>) =>
      (await toolset.methods.showStory.handler({ componentId, storyName: 'Nope' }, ctx)).markdown;

    const dev = await render(devToolset());

    expect(dev).toContain(
      `Available stories: Default (${componentId}--default), Text (${componentId}--text)`
    );
    expect(await render(staticToolset())).toBe(dev);
  });
});
