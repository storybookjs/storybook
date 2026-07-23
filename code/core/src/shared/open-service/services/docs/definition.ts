import type { StoryIndex } from 'storybook/internal/types';

import * as v from 'valibot';

import { MDX_SERVICE_ID } from '../../../../core-server/utils/manifests/mdx-manifest.ts';
import { defineApi } from '../../../public-api/index.ts';
import { getService } from '../../server.ts';
import type { DocgenService } from '../docgen/definition.ts';
import type { StoryDocsService } from '../story-docs/definition.ts';
import { classifyIndex } from './classify-index.ts';
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
    mdxForComponent: {
      loaded: (input: { id: string }) => Promise<MdxPayload | undefined>;
    };
    mdxForAllComponents: {
      loaded: () => Promise<Record<string, MdxPayload | undefined>>;
    };
  };
};

export type CreateDocsApiOptions = {
  getIndex: () => Promise<StoryIndex>;
};

function tryGetMdxService(): MdxService | undefined {
  try {
    return getService(MDX_SERVICE_ID) as MdxService;
  } catch {
    return undefined;
  }
}

/**
 * Creates the public docs API with request-local access to the live story index.
 *
 * The API composes the docgen, story-docs, and addon-docs MDX open services without exposing a
 * stateless `core/docs` service facade.
 */
export function createDocsApi({ getIndex }: CreateDocsApiOptions) {
  const loadShow = async (id: string): Promise<DocsShowResult> => {
    const classification = classifyIndex(await getIndex());

    if (classification.unattachedDocs.has(id)) {
      const mdx = tryGetMdxService();
      return mapDocsShow({
        id,
        classification,
        mdx: await mdx?.queries.mdxForComponent.loaded({ id }),
      });
    }

    if (!classification.componentIds.includes(id)) {
      return mapDocsShow({ id, classification });
    }

    const docgen = getService<DocgenService>('core/docgen');
    const storyDocs = getService<StoryDocsService>('core/story-docs');
    const mdx = tryGetMdxService();
    const hasAttachedDocs = (classification.attachedDocsByComponent.get(id)?.length ?? 0) > 0;
    const [docgenResult, storyDocsResult, mdxResult] = await Promise.all([
      docgen.queries.docgen.loaded({ id }),
      storyDocs.queries.storyDocs.loaded({ id }),
      hasAttachedDocs ? mdx?.queries.mdxForComponent.loaded({ id }) : undefined,
    ]);

    return mapDocsShow({
      id,
      classification,
      docgen: docgenResult,
      storyDocs: storyDocsResult,
      mdx: mdxResult,
    });
  };

  return defineApi({
    id: 'docs',
    description: 'Storybook component and docs documentation.',
    methods: {
      list: {
        schema: v.object({
          withStoryIds: v.optional(
            v.pipe(
              v.boolean(),
              v.description('When true, include story ids under each component.')
            ),
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
        handler: async (input) => {
          const classification = classifyIndex(await getIndex());
          const docgen = getService<DocgenService>('core/docgen');
          const allDocgen = await docgen.queries.docgenForAllComponents.loaded();
          const allStoryDocs = input.withStoryIds
            ? Object.fromEntries(
                await Promise.all(
                  [...classification.storyBasedIds].map(async (id) => [
                    id,
                    await getService<StoryDocsService>('core/story-docs').queries.storyDocs.loaded({
                      id,
                    }),
                  ])
                )
              )
            : {};
          const mdx = tryGetMdxService();
          const allMdx =
            mdx && classification.unattachedDocs.size > 0
              ? await mdx.queries.mdxForAllComponents.loaded()
              : {};
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
        handler: async (input) => {
          const data = await loadShow(input.id);
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
        handler: async (input) => {
          const show = await loadShow(input.componentId);
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
}

export type DocsApi = ReturnType<typeof createDocsApi>;
