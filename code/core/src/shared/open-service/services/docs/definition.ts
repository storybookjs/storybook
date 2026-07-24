import * as v from 'valibot';

import { MDX_SERVICE_ID } from '../../../../core-server/utils/manifests/mdx-manifest.ts';
import { defineApi, type ApiCtx } from '../../../public-api/index.ts';
import type { DocgenService } from '../docgen/definition.ts';
import type { StoryDocsService } from '../story-docs/definition.ts';
import { classifyServices } from './classify-services.ts';
import { formatDocsList, formatDocsShow, formatDocsShowStory } from './format.ts';
import {
  mapDocsList,
  mapDocsShow,
  mapDocsShowStory,
  type DocsShowResult,
  type MdxPayload,
} from './map.ts';

type MdxService = {
  queries: {
    mdxForAllComponents: {
      loaded: () => Promise<Record<string, MdxPayload | undefined>>;
    };
  };
};

function getMdxService(ctx: ApiCtx): MdxService | undefined {
  try {
    return ctx.getService<MdxService>(MDX_SERVICE_ID);
  } catch {
    return undefined;
  }
}

async function loadDocsServices(ctx: ApiCtx) {
  const docgen = ctx.getService<DocgenService>('core/docgen');
  const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');
  const mdx = getMdxService(ctx);
  const [allDocgen, allStoryDocs, allMdx] = await Promise.all([
    docgen.queries.docgenForAllComponents.loaded(),
    storyDocs.queries.storyDocsForAllComponents.loaded(),
    mdx?.queries.mdxForAllComponents.loaded() ?? {},
  ]);

  return {
    allDocgen,
    allStoryDocs,
    allMdx,
    classification: classifyServices({ allDocgen, allStoryDocs, allMdx }),
  };
}

async function loadShow(id: string, ctx: ApiCtx): Promise<DocsShowResult> {
  const { classification, allDocgen, allStoryDocs, allMdx } = await loadDocsServices(ctx);

  return mapDocsShow({
    id,
    classification,
    docgen: allDocgen[id],
    storyDocs: allStoryDocs[id],
    mdx: allMdx[id],
  });
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
        const { classification, allDocgen, allStoryDocs, allMdx } = await loadDocsServices(ctx);
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
        const data = await loadShow(input.id, ctx);
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
        const show = await loadShow(input.componentId, ctx);
        const data = mapDocsShowStory({
          componentId: input.componentId,
          storyName: input.storyName,
          show,
        });

        return input.json ? data : formatDocsShowStory(data);
      },
    },
  },
});

export type DocsApi = typeof docsApi;
