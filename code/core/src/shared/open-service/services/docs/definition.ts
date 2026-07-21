import * as v from 'valibot';

import { MDX_SERVICE_ID } from '../../../../core-server/utils/manifests/mdx-manifest.ts';
import { defineService } from '../../service-definition.ts';
import type { ServiceInstanceOf } from '../../types.ts';
import type { DocgenService } from '../docgen/definition.ts';
import type { StoryDocsService } from '../story-docs/definition.ts';
import { mapDocsList, mapDocsShow, mapDocsShowStory, type MdxPayload } from './map.ts';
import { getDocsClassification, loadDocsClassification } from './runtime.ts';

const manifestErrorSchema = v.object({
  name: v.string(),
  message: v.string(),
});

const docsListComponentSchema = v.object({
  id: v.string(),
  name: v.string(),
  summary: v.optional(v.string()),
  storyIds: v.optional(v.array(v.string())),
});

const docsListDocSchema = v.object({
  id: v.string(),
  name: v.string(),
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
});

const docsListOutputSchema = v.object({
  components: v.array(docsListComponentSchema),
  docs: v.array(docsListDocSchema),
});

const docsStorySchema = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  snippet: v.optional(v.string()),
  error: v.optional(manifestErrorSchema),
});

const docsAttachedDocSchema = v.object({
  id: v.string(),
  name: v.string(),
  title: v.optional(v.string()),
  path: v.optional(v.string()),
  content: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(manifestErrorSchema),
});

const docsComponentSchema = v.object({
  kind: v.literal('component'),
  id: v.string(),
  name: v.string(),
  path: v.optional(v.string()),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  import: v.optional(v.string()),
  jsDocTags: v.optional(v.record(v.string(), v.array(v.string()))),
  reactDocgen: v.optional(v.any()),
  reactDocgenTypescript: v.optional(v.any()),
  reactComponentMeta: v.optional(v.any()),
  stories: v.optional(v.array(docsStorySchema)),
  subcomponents: v.optional(v.record(v.string(), v.any())),
  docs: v.optional(v.record(v.string(), docsAttachedDocSchema)),
  error: v.optional(manifestErrorSchema),
});

const docsStandaloneSchema = v.object({
  kind: v.literal('docs'),
  id: v.string(),
  name: v.string(),
  title: v.optional(v.string()),
  path: v.optional(v.string()),
  content: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(manifestErrorSchema),
});

const docsNotFoundSchema = v.object({
  kind: v.literal('not-found'),
  id: v.string(),
});

const docsShowOutputSchema = v.variant('kind', [
  docsComponentSchema,
  docsStandaloneSchema,
  docsNotFoundSchema,
]);

const docsShowStoryOutputSchema = v.variant('kind', [
  v.object({
    kind: v.literal('story'),
    component: v.object({
      id: v.string(),
      name: v.string(),
      import: v.optional(v.string()),
    }),
    story: docsStorySchema,
  }),
  v.object({
    kind: v.literal('component-not-found'),
    componentId: v.string(),
  }),
  v.object({
    kind: v.literal('story-not-found'),
    componentId: v.string(),
    storyName: v.string(),
    availableStoryNames: v.array(v.string()),
  }),
]);

type MdxService = {
  queries: {
    mdxForComponent: {
      get: (input: { id: string }) => MdxPayload | undefined;
      loaded: (input: { id: string }) => Promise<MdxPayload | undefined>;
    };
    mdxForAllComponents: {
      get: () => Record<string, MdxPayload>;
      loaded: () => Promise<Record<string, MdxPayload>>;
    };
  };
};

function tryGetMdxService(getService: (id: string) => unknown): MdxService | undefined {
  try {
    return getService(MDX_SERVICE_ID) as MdxService;
  } catch {
    return undefined;
  }
}

export type DocsServiceState = Record<string, never>;

/**
 * Transport-neutral documentation capability (`docs.list` / `docs.show` / `docs.showStory`).
 *
 * Composes `core/docgen`, `core/story-docs`, and addon-docs MDX data. Markdown formatting,
 * multi-source selection, and MCP envelopes stay in adapters.
 */
export const docsServiceDef = defineService({
  id: 'core/docs',
  description: 'Storybook component and docs documentation.',
  initialState: {} as DocsServiceState,
  queries: {
    list: {
      description:
        'Lists components and standalone docs entries. Optionally includes story ids per component.',
      input: v.object({
        withStoryIds: v.optional(
          v.pipe(v.boolean(), v.description('When true, include story ids under each component.')),
          false
        ),
      }),
      output: docsListOutputSchema,
      load: async (input, ctx) => {
        const classification = await loadDocsClassification();
        const docgen = ctx.getService<DocgenService>('core/docgen');
        await docgen.queries.docgenForAllComponents.loaded();

        if (input.withStoryIds) {
          const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');
          await Promise.all(
            [...classification.storyBasedIds].map((id) =>
              storyDocs.queries.storyDocs.loaded({ id })
            )
          );
        }

        const mdx = tryGetMdxService(ctx.getService);
        if (mdx && classification.unattachedDocs.size > 0) {
          await mdx.queries.mdxForAllComponents.loaded();
        }
      },
      handler: (input, ctx) => {
        const classification = getDocsClassification();
        const docgen = ctx.getService<DocgenService>('core/docgen');
        const allDocgen = docgen.queries.docgenForAllComponents.get();
        const allStoryDocs = input.withStoryIds
          ? Object.fromEntries(
              [...classification.storyBasedIds].map((id) => [
                id,
                ctx.getService<StoryDocsService>('core/story-docs').queries.storyDocs.get({ id }),
              ])
            )
          : {};
        const mdx = tryGetMdxService(ctx.getService);
        const allMdx = mdx ? mdx.queries.mdxForAllComponents.get() : {};

        return mapDocsList({
          classification,
          allDocgen,
          allStoryDocs,
          allMdx,
          withStoryIds: input.withStoryIds ?? false,
        });
      },
    },
    show: {
      description: 'Returns documentation for one component or standalone docs entry by id.',
      input: v.object({
        id: v.pipe(v.string(), v.description('Component or docs entry id.')),
      }),
      output: docsShowOutputSchema,
      load: async (input, ctx) => {
        const classification = await loadDocsClassification();

        if (classification.unattachedDocs.has(input.id)) {
          const mdx = tryGetMdxService(ctx.getService);
          if (mdx) {
            await mdx.queries.mdxForComponent.loaded({ id: input.id });
          }
          return;
        }

        if (!classification.componentIds.includes(input.id)) {
          return;
        }

        const docgen = ctx.getService<DocgenService>('core/docgen');
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');
        await Promise.all([
          docgen.queries.docgen.loaded({ id: input.id }),
          storyDocs.queries.storyDocs.loaded({ id: input.id }),
        ]);

        const attached = classification.attachedDocsByComponent.get(input.id) ?? [];
        if (attached.length > 0) {
          const mdx = tryGetMdxService(ctx.getService);
          if (mdx) {
            await mdx.queries.mdxForComponent.loaded({ id: input.id });
          }
        }
      },
      handler: (input, ctx) => {
        const classification = getDocsClassification();
        const docgen = ctx.getService<DocgenService>('core/docgen');
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');
        const mdx = tryGetMdxService(ctx.getService);

        return mapDocsShow({
          id: input.id,
          classification,
          docgen: docgen.queries.docgen.get({ id: input.id }),
          storyDocs: storyDocs.queries.storyDocs.get({ id: input.id }),
          mdx: mdx?.queries.mdxForComponent.get({ id: input.id }),
        });
      },
    },
    showStory: {
      description: 'Returns documentation for one story of a component.',
      input: v.object({
        componentId: v.pipe(v.string(), v.description('Component id.')),
        storyName: v.pipe(v.string(), v.description('Story display name (not story id).')),
      }),
      output: docsShowStoryOutputSchema,
      load: async (input, ctx) => {
        await ctx.self.queries.show.loaded({ id: input.componentId });
      },
      handler: (input, ctx) => {
        const show = ctx.self.queries.show.get({ id: input.componentId });
        return mapDocsShowStory({
          componentId: input.componentId,
          storyName: input.storyName,
          show,
        });
      },
    },
  },
  commands: {},
});

export type DocsService = ServiceInstanceOf<typeof docsServiceDef>;
