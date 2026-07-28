import * as v from 'valibot';

import { defineService } from 'storybook/open-service';
import type { ServiceInstanceOf } from '../../types.ts';
import type { DocgenService } from '../docgen/definition.ts';
import type { StoryDocsService } from '../story-docs/definition.ts';
import { buildDocsList, renderComponentDocs, renderStoryDocs } from './envelope.ts';

const showInputSchema = v.object({ id: v.string() });
const showStoryInputSchema = v.object({ id: v.string(), storyId: v.string() });

const docsListSchema = v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    summary: v.optional(v.string()),
  })
);

/**
 * Definition for the `core/docs` open service.
 */
export const docsServiceDef = defineService({
  id: 'core/docs',
  description:
    'Composes `core/docgen` and `core/story-docs` into rendered Markdown component documentation.',
  initialState: {},
  queries: {
    show: {
      description: 'Returns the full Markdown documentation for one component id.',
      input: showInputSchema,
      output: v.string(),
      handler: (input, ctx) => {
        const docgen = ctx.getService<DocgenService>('core/docgen');
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');

        return renderComponentDocs({
          id: input.id,
          docgen: docgen.queries.docgen.get(input),
          storyDocs: storyDocs.queries.storyDocs.get(input),
        });
      },
      load: async (input, ctx) => {
        await Promise.all([
          ctx.getService<DocgenService>('core/docgen').queries.docgen.loaded(input),
          ctx.getService<StoryDocsService>('core/story-docs').queries.storyDocs.loaded(input),
        ]);
      },
    },
    showStoryDoc: {
      description: 'Returns the full Markdown documentation for one story of a component.',
      input: showStoryInputSchema,
      output: v.string(),
      handler: (input, ctx) => {
        const componentInput = { id: input.id };
        const docgen = ctx.getService<DocgenService>('core/docgen');
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');

        return renderStoryDocs({
          id: input.id,
          storyId: input.storyId,
          docgen: docgen.queries.docgen.get(componentInput),
          storyDocs: storyDocs.queries.storyDocs.get(componentInput),
        });
      },
      load: async (input, ctx) => {
        const componentInput = { id: input.id };
        await Promise.all([
          ctx.getService<DocgenService>('core/docgen').queries.docgen.loaded(componentInput),
          ctx
            .getService<StoryDocsService>('core/story-docs')
            .queries.storyDocs.loaded(componentInput),
        ]);
      },
    },
    list: {
      description: 'Lists every documented component as `{ id, name, summary? }` (no Markdown).',
      input: v.void(),
      output: docsListSchema,
      handler: (_input, ctx) => {
        const docgen = ctx.getService<DocgenService>('core/docgen');
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs');

        return buildDocsList(
          docgen.queries.docgenForAllComponents.get(undefined),
          storyDocs.queries.storyDocsForAllComponents.get(undefined)
        );
      },
      load: async (_input, ctx) => {
        await Promise.all([
          ctx
            .getService<DocgenService>('core/docgen')
            .queries.docgenForAllComponents.loaded(undefined),
          ctx
            .getService<StoryDocsService>('core/story-docs')
            .queries.storyDocsForAllComponents.loaded(undefined),
        ]);
      },
    },
  },
  commands: {},
});

export type DocsService = ServiceInstanceOf<typeof docsServiceDef>;
