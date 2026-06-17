import * as v from 'valibot';

import { defineService } from 'storybook/open-service';
import type { ServiceInstanceOf } from '../../types.ts';
import type { StoryDocsPayload } from './types.ts';
import { storyDocsQueryStaticPath } from './paths.ts';

const storyDocsInputSchema = v.object({ id: v.string() });

const storyDocsErrorSchema = v.object({
  name: v.string(),
  message: v.string(),
});

const storyDocSchema = v.object({
  id: v.string(),
  name: v.string(),
  snippet: v.optional(v.string()),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(storyDocsErrorSchema),
});

const storyDocsPayloadSchema = v.object({
  id: v.string(),
  name: v.string(),
  path: v.string(),
  import: v.optional(v.string()),
  stories: v.record(v.string(), storyDocSchema),
  error: v.optional(storyDocsErrorSchema),
});

const storyDocsOutputSchema = v.optional(storyDocsPayloadSchema);

export type StoryDocsServiceState = {
  /** Extracted story docs keyed by component id. Populated by the `extractStoryDocs` command. */
  components: Record<string, StoryDocsPayload>;
};

/**
 * Definition for the `core/story-docs` open service.
 *
 * Carries per-story snippets, descriptions, and file-level import statements keyed by component
 * id. Component prop docgen lives in `core/docgen`.
 */
export const storyDocsServiceDef = defineService({
  id: 'core/story-docs',
  description: 'Story documentation (snippets, descriptions, imports) keyed by component id.',
  initialState: { components: {} } as StoryDocsServiceState,
  queries: {
    getStoryDocs: {
      description:
        'Returns the story-docs payload for one component id, or undefined when not loaded.',
      input: storyDocsInputSchema,
      output: storyDocsOutputSchema,
      handler: (input, ctx) =>
        Object.hasOwn(ctx.self.state.components, input.id)
          ? ctx.self.state.components[input.id]
          : undefined,
      load: async (input, ctx) => {
        await ctx.self.commands.extractStoryDocs(input);
      },
      staticPath: (input) => storyDocsQueryStaticPath(input.id),
    },
    getStoryDocsForAllComponents: {
      description: 'Returns story-docs payloads for every component in the story index.',
      input: v.void(),
      output: v.record(v.string(), storyDocsPayloadSchema),
      handler: (_input, ctx) => ctx.self.state.components,
      load: async (_input, ctx) => {
        await ctx.self.commands.extractAllStoryDocs(undefined);
      },
    },
  },
  commands: {
    extractStoryDocs: {
      description:
        'Resolves the story entry for a component id, runs the registered provider chain, writes the result into state, and returns it (or undefined when no provider produced story docs).',
      input: storyDocsInputSchema,
      output: storyDocsOutputSchema,
    },
    extractAllStoryDocs: {
      description:
        'Extracts story docs for every component id in the story index by invoking `extractStoryDocs` for each.',
      input: v.undefined(),
      output: v.void(),
    },
  },
});

export type StoryDocsService = ServiceInstanceOf<typeof storyDocsServiceDef>;
