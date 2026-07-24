import * as v from 'valibot';

import { OpenServiceMissingServiceError } from '../../../server-errors.ts';
import { defineApi, type ApiCtx } from '../index.ts';
import type { DocgenService } from '../../open-service/services/docgen/definition.ts';
import type { StoryDocsService } from '../../open-service/services/story-docs/definition.ts';
import { classifyServices } from './classify-services.ts';
import { formatDocsList, formatDocsShow, formatDocsShowStory } from './format.ts';
import { mapDocsList, mapDocsShow, mapDocsShowStory, type MdxPayload } from './map.ts';

/** Stable addon-docs MDX service id. Kept local so the public docs API does not import core-server. */
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

function tryGetService<T>(ctx: ApiCtx, serviceId: string): T | undefined {
  try {
    return ctx.getService<T>(serviceId as never);
  } catch (error) {
    if (error instanceof OpenServiceMissingServiceError) {
      return undefined;
    }
    throw error;
  }
}

async function loadDocsListServices(ctx: ApiCtx) {
  const docgen = ctx.getService<DocgenService>('core/docgen');
  const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');
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

export const docsApi = defineApi({
  id: 'docs',
  description: 'Storybook component and docs documentation.',
  methods: {
    list: {
      schema: v.object({
        withStoryIds: v.optional(
          v.pipe(v.boolean(), v.description('When true, include story ids under each component.')),
          false
        ),
        json: v.optional(
          v.pipe(
            v.boolean(),
            v.description('When true, return structured JSON instead of Markdown.')
          ),
          false
        ),
      }),
      description:
        'Lists components and standalone docs entries. Optionally includes story ids per component.',
      handler: async (input, ctx) => {
        const { classification, allDocgen, allStoryDocs, allMdx } = await loadDocsListServices(ctx);
        const data = mapDocsList({
          classification,
          allDocgen,
          allStoryDocs,
          allMdx,
          withStoryIds: input.withStoryIds,
        });

        return input.json ? data : formatDocsList(data);
      },
    },
    show: {
      schema: v.object({
        id: v.pipe(v.string(), v.description('Component or docs entry id.')),
        json: v.optional(
          v.pipe(
            v.boolean(),
            v.description('When true, return structured JSON instead of Markdown.')
          ),
          false
        ),
      }),
      description: 'Returns documentation for one component or standalone docs entry by id.',
      handler: async (input, ctx) => {
        const docgen = ctx.getService<DocgenService>('core/docgen');
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');
        const mdx = tryGetService<MdxService>(ctx, MDX_SERVICE_ID);
        const [docgenPayload, storyDocsPayload, mdxPayload] = await Promise.all([
          docgen.queries.docgen.loaded({ id: input.id }),
          storyDocs.queries.storyDocs.loaded({ id: input.id }),
          mdx?.queries.mdxForComponent.loaded({ id: input.id }) ?? Promise.resolve(undefined),
        ]);

        const classification = classifyServices({
          allDocgen: docgenPayload ? { [input.id]: docgenPayload } : {},
          allStoryDocs: storyDocsPayload ? { [input.id]: storyDocsPayload } : {},
          allMdx: mdxPayload ? { [input.id]: mdxPayload } : {},
        });

        const data = mapDocsShow({
          id: input.id,
          classification,
          docgen: docgenPayload,
          storyDocs: storyDocsPayload,
          mdx: mdxPayload,
        });
        return input.json ? data : formatDocsShow(data);
      },
    },
    showStory: {
      schema: v.object({
        componentId: v.pipe(v.string(), v.description('Component id.')),
        storyName: v.pipe(v.string(), v.description('Story display name (not story id).')),
        json: v.optional(
          v.pipe(
            v.boolean(),
            v.description('When true, return structured JSON instead of Markdown.')
          ),
          false
        ),
      }),
      description: 'Returns documentation for one story of a component.',
      handler: async (input, ctx) => {
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');
        const docgen = ctx.getService<DocgenService>('core/docgen');
        const [storyDocsPayload, docgenPayload] = await Promise.all([
          storyDocs.queries.storyDocs.loaded({ id: input.componentId }),
          docgen.queries.docgen.loaded({ id: input.componentId }),
        ]);

        if (!storyDocsPayload && !docgenPayload) {
          const data = mapDocsShowStory({
            componentId: input.componentId,
            storyName: input.storyName,
            show: { kind: 'not-found', id: input.componentId },
          });
          return input.json ? data : formatDocsShowStory(data);
        }

        const stories = storyDocsPayload?.stories
          ? Object.values(storyDocsPayload.stories).map((story) => ({
              ...(story.id !== undefined ? { id: story.id } : {}),
              name: story.name,
              ...(story.description !== undefined ? { description: story.description } : {}),
              ...(story.summary !== undefined ? { summary: story.summary } : {}),
              ...(story.snippet !== undefined ? { snippet: story.snippet } : {}),
              ...(story.error !== undefined ? { error: story.error } : {}),
            }))
          : [];

        const importStatement =
          typeof storyDocsPayload?.import === 'string'
            ? storyDocsPayload.import
            : typeof docgenPayload?.import === 'string'
              ? docgenPayload.import
              : undefined;

        const data = mapDocsShowStory({
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

        return input.json ? data : formatDocsShowStory(data);
      },
    },
  },
});

export type DocsApi = typeof docsApi;
