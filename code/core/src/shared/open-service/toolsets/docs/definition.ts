import * as v from 'valibot';

import {
  OpenServiceDocgenMissingComponentError,
  OpenServiceMissingServiceError,
} from '../../../../server-errors.ts';
import type { DocgenService } from '../../services/docgen/definition.ts';
import type { StoryDocsService } from '../../services/story-docs/definition.ts';
import { defineToolset, type ToolsetCtx } from '../../toolset-definition.ts';
import { classifyServices } from './classify-services.ts';
import {
  adaptCoreComponent,
  adaptCoreDoc,
  adaptCoreStories,
} from './manifest-formatter/adapt-core-manifest.ts';
import type {
  AllManifests,
  ComponentManifestV1,
  DocV1,
} from './manifest-formatter/manifest-types.ts';
import {
  formatComponentManifest,
  formatDocsManifest,
  formatManifestsToLists,
  formatStoryDocumentation,
} from './manifest-formatter/markdown.ts';
import {
  mapDocsList,
  mapDocsShow,
  mapDocsShowStory,
  mapStoryDocsEntries,
  resolveImportStatement,
  selectAttachedDocs,
  type MdxPayload,
} from './map.ts';

/** Stable addon-docs MDX service id. Kept local so the docs toolset does not import core-server. */
const MDX_SERVICE_ID = 'addon-docs/mdx';

type MdxService = {
  queries: {
    mdxForAllComponents: {
      loaded: () => Promise<Record<string, MdxPayload | undefined>>;
    };
    mdxForComponent: {
      loaded: (input: { id: string }) => Promise<MdxPayload | undefined>;
    };
  };
};

function tryGetService<T>(ctx: ToolsetCtx, serviceId: string): T | undefined {
  try {
    return ctx.getService<T>(serviceId, { internal: true });
  } catch (error) {
    if (error instanceof OpenServiceMissingServiceError) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Component payload loads throw when an id has no component entry in the index. Standalone docs
 * ids and ids that don't exist at all both land there, and both are answered by absence rather
 * than a failure, so the typed error becomes `undefined`.
 */
async function loadOptionalComponentPayload<T>(
  load: Promise<T | undefined>
): Promise<T | undefined> {
  try {
    return await load;
  } catch (error) {
    if (error instanceof OpenServiceDocgenMissingComponentError) {
      return undefined;
    }
    throw error;
  }
}

async function loadDocsListServices(ctx: ToolsetCtx) {
  const docgen = ctx.getService<DocgenService>('core/docgen', { internal: true });
  const storyDocs = ctx.getService<StoryDocsService>('core/story-docs', { internal: true });
  const mdx = tryGetService<MdxService>(ctx, MDX_SERVICE_ID);
  const [allDocgen, allStoryDocs, allMdx] = await Promise.all([
    docgen.queries.docgenForAllComponents.loaded(),
    storyDocs.queries.storyDocsForAllComponents.loaded(),
    mdx?.queries.mdxForAllComponents.loaded() ??
      Promise.resolve({} as Record<string, MdxPayload | undefined>),
  ]);

  return {
    allDocgen,
    allStoryDocs,
    allMdx,
    classification: classifyServices({ allDocgen, allStoryDocs, allMdx }),
  };
}

/** Not-found message matching `@storybook/mcp`'s `get-documentation` for the MCP consumer. */
function formatEntryNotFound(id: string, ctx: ToolsetCtx): string {
  return ctx.consumer === 'mcp'
    ? `Component or Docs Entry not found: "${id}". Use the list-all-documentation tool to see available components and documentation entries.`
    : `Component or Docs Entry not found: "${id}".`;
}

export const docsToolset = defineToolset({
  id: 'docs',
  description: 'Storybook component and docs documentation.',
  methods: {
    list: {
      schema: v.object({
        withStoryIds: v.optional(
          v.pipe(v.boolean(), v.description('When true, include story ids under each component.')),
          false
        ),
      }),
      description:
        'Lists components and standalone docs entries. Optionally includes story ids per component.',
      handler: async (input, ctx) => {
        const { classification, allDocgen, allStoryDocs, allMdx } = await loadDocsListServices(ctx);

        if (ctx.format === 'json') {
          return mapDocsList({
            classification,
            allDocgen,
            allStoryDocs,
            allMdx,
            withStoryIds: input.withStoryIds,
          });
        }

        // Mirrors the manifest index addon-mcp builds in-process for `list-all-documentation`:
        // shallow component rows, stories inlined only when story ids are requested.
        const components: Record<string, ComponentManifestV1> = {};
        for (const id of classification.componentIds) {
          const payload = allDocgen[id];
          const stories =
            input.withStoryIds && classification.storyBasedIds.has(id)
              ? (adaptCoreStories(allStoryDocs[id]?.stories) ?? [])
              : undefined;
          components[id] = {
            id,
            name: payload?.name ?? id,
            ...(payload?.description !== undefined ? { description: payload.description } : {}),
            ...(payload?.summary !== undefined ? { summary: payload.summary } : {}),
            ...(stories ? { stories } : {}),
          };
        }

        const docs: Record<string, DocV1> = {};
        for (const [docId, name] of classification.unattachedDocs) {
          const payload = allMdx[docId]?.docs?.[docId];
          docs[docId] = {
            id: docId,
            name,
            ...(payload?.summary !== undefined ? { summary: payload.summary } : {}),
          };
        }

        const manifests: AllManifests = {
          componentManifest: { v: 1, components },
          ...(Object.keys(docs).length > 0 ? { docsManifest: { v: 1, docs } } : {}),
        };
        return formatManifestsToLists(manifests, { withStoryIds: input.withStoryIds });
      },
    },
    show: {
      schema: v.object({
        id: v.pipe(v.string(), v.description('Component or docs entry id.')),
      }),
      description: 'Returns documentation for one component or standalone docs entry by id.',
      handler: async (input, ctx) => {
        const docgen = ctx.getService<DocgenService>('core/docgen', { internal: true });
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs', { internal: true });
        const mdx = tryGetService<MdxService>(ctx, MDX_SERVICE_ID);
        const [docgenPayload, storyDocsPayload, mdxPayload] = await Promise.all([
          loadOptionalComponentPayload(docgen.queries.docgen.loaded({ id: input.id })),
          loadOptionalComponentPayload(storyDocs.queries.storyDocs.loaded({ id: input.id })),
          mdx?.queries.mdxForComponent.loaded({ id: input.id }) ?? Promise.resolve(undefined),
        ]);

        const classification = classifyServices({
          allDocgen: docgenPayload ? { [input.id]: docgenPayload } : {},
          allStoryDocs: storyDocsPayload ? { [input.id]: storyDocsPayload } : {},
          allMdx: mdxPayload ? { [input.id]: mdxPayload } : {},
        });

        if (ctx.format === 'json') {
          return mapDocsShow({
            id: input.id,
            classification,
            docgen: docgenPayload,
            storyDocs: storyDocsPayload,
            mdx: mdxPayload,
          });
        }

        // Mirrors addon-mcp's in-process `resolveEntry`: standalone docs render through the docs
        // formatter, components assemble docgen + story-docs + attached MDX.
        if (classification.unattachedDocs.has(input.id)) {
          const doc = mdxPayload?.docs?.[input.id];
          if (!doc) {
            return formatEntryNotFound(input.id, ctx);
          }
          return formatDocsManifest(adaptCoreDoc(doc));
        }

        if (!classification.componentIds.includes(input.id)) {
          return formatEntryNotFound(input.id, ctx);
        }

        const docs = selectAttachedDocs(classification, input.id, mdxPayload);

        return formatComponentManifest(
          adaptCoreComponent({
            ...docgenPayload,
            id: input.id,
            name: docgenPayload?.name ?? input.id,
            ...(storyDocsPayload?.stories ? { stories: storyDocsPayload.stories } : {}),
            ...(storyDocsPayload?.import ? { import: storyDocsPayload.import } : {}),
            ...(docs ? { docs } : {}),
          })
        );
      },
    },
    showStory: {
      schema: v.object({
        componentId: v.pipe(v.string(), v.description('Component id.')),
        storyName: v.pipe(v.string(), v.description('Story display name (not story id).')),
      }),
      description: 'Returns documentation for one story of a component.',
      handler: async (input, ctx) => {
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs', { internal: true });
        const docgen = ctx.getService<DocgenService>('core/docgen', { internal: true });
        const [storyDocsPayload, docgenPayload] = await Promise.all([
          loadOptionalComponentPayload(
            storyDocs.queries.storyDocs.loaded({ id: input.componentId })
          ),
          loadOptionalComponentPayload(docgen.queries.docgen.loaded({ id: input.componentId })),
        ]);

        if (ctx.format === 'json') {
          if (!storyDocsPayload && !docgenPayload) {
            return mapDocsShowStory({
              componentId: input.componentId,
              storyName: input.storyName,
              show: { kind: 'not-found', id: input.componentId },
            });
          }

          const stories = storyDocsPayload?.stories
            ? mapStoryDocsEntries(storyDocsPayload.stories)
            : [];

          const importStatement = resolveImportStatement(storyDocsPayload, docgenPayload);

          return mapDocsShowStory({
            componentId: input.componentId,
            storyName: input.storyName,
            show: {
              kind: 'component',
              id: input.componentId,
              name: docgenPayload?.name ?? storyDocsPayload?.name ?? input.componentId,
              ...(importStatement !== undefined ? { import: importStatement } : {}),
              stories,
            },
          });
        }

        // Mirrors `@storybook/mcp`'s `get-documentation-for-story`, including its miss messages.
        if (!storyDocsPayload && !docgenPayload) {
          return ctx.consumer === 'mcp'
            ? `Component not found: "${input.componentId}". Use the list-all-documentation tool to see available components.`
            : `Component not found: "${input.componentId}".`;
        }

        const component = adaptCoreComponent({
          ...docgenPayload,
          id: input.componentId,
          name: docgenPayload?.name ?? input.componentId,
          ...(storyDocsPayload?.stories ? { stories: storyDocsPayload.stories } : {}),
          ...(storyDocsPayload?.import ? { import: storyDocsPayload.import } : {}),
        });

        const story = component.stories?.find((entry) => entry.name === input.storyName);
        if (!story) {
          const availableStories = component.stories?.map((entry) => entry.name).join(', ');
          return `Story "${input.storyName}" not found for component "${input.componentId}". Available stories: ${availableStories || 'none'}`;
        }

        return formatStoryDocumentation(component, input.storyName);
      },
    },
  },
});

export type DocsToolset = typeof docsToolset;
