import * as v from 'valibot';

import { type SnippetTemplate, isSnippetTemplate } from '../../../../docs-tools/snippetTemplate.ts';

import { defineService } from 'storybook/open-service';
import type { ServiceInstanceOf } from '../../types.ts';
import type { StoryDocsPayload, StoryTemplatesPayload } from './types.ts';
import { storyDocsQueryStaticPath, storyTemplatesQueryStaticPath } from './paths.ts';

const storyDocsInputSchema = v.object({ id: v.string() });

const storyDocsErrorSchema = v.object({
  name: v.string(),
  message: v.string(),
});

// The query output is parsed with these schemas, which drop every key they don't list; the type
// test next to this file keeps them equal to the hand-written types in `types.ts`.
const storyDocSchema = v.object({
  id: v.string(),
  name: v.string(),
  snippet: v.optional(v.string()),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  warning: v.optional(v.string()),
  error: v.optional(storyDocsErrorSchema),
});

// A `SnippetTemplate`: code, and holes whose place only its renderer reads.
const snippetTemplateSchema = v.custom<SnippetTemplate>(
  isSnippetTemplate,
  'Expected a snippet template: code and holes'
);

const storyDocsPayloadSchema = v.object({
  id: v.string(),
  name: v.string(),
  path: v.string(),
  import: v.optional(v.string()),
  stories: v.record(v.string(), storyDocSchema),
  error: v.optional(storyDocsErrorSchema),
});

const storyDocsOutputSchema = v.optional(storyDocsPayloadSchema);

const storyTemplatesOutputSchema = v.optional(
  v.object({ stories: v.record(v.string(), snippetTemplateSchema) })
);

export type StoryDocsServiceState = {
  /** Extracted story docs keyed by component id. Populated by the `extractStoryDocs` command. */
  components: Record<string, StoryDocsPayload>;
  /**
   * The templates of the same extraction, keyed by component id. Kept apart from `components`, which
   * agents and the components manifest read, so a static build writes them to a file of their own
   * that the preview fetches only once a story's args change.
   */
  templates: Record<string, StoryTemplatesPayload>;
};

/**
 * Definition for the `core/story-docs` open service.
 *
 * Carries per-story snippets, descriptions, and file-level import statements keyed by component
 * id. Component prop docgen lives in `core/docgen`.
 */
export const storyDocsServiceDef = defineService({
  id: 'core/story-docs',
  internal: true,
  description: 'Story documentation (snippets, descriptions, imports) keyed by component id.',
  initialState: { components: {}, templates: {} } as StoryDocsServiceState,
  queries: {
    storyDocs: {
      description:
        'Returns the story-docs payload for one component id, or undefined when not loaded.',
      input: storyDocsInputSchema,
      output: storyDocsOutputSchema,
      handler: (input, ctx) => entryOf(ctx.self.state.components, input.id),
      load: async (input, ctx) => {
        await ctx.self.commands.extractStoryDocs(input);
      },
      staticPath: (input) => storyDocsQueryStaticPath(input.id),
      // One extraction fills both queries; a static build writes each its own file.
      staticSnapshots: (state, input) => ({
        storyDocs: { components: pick(state.components, input.id) },
        storyTemplates: { templates: pick(state.templates, input.id) },
      }),
    },
    storyTemplates: {
      description:
        "Returns the templates of one component id's stories, which the preview fills with changed args, or undefined when not loaded.",
      input: storyDocsInputSchema,
      output: storyTemplatesOutputSchema,
      handler: (input, ctx) => entryOf(ctx.self.state.templates, input.id),
      // The extraction that loads the story docs stores the templates too, so this joins a load of
      // the story docs already in flight instead of extracting again.
      load: async (input, ctx) => {
        await ctx.self.queries.storyDocs.loaded(input);
      },
      // Built by the `storyDocs` query's `staticSnapshots`.
      staticPath: (input) => storyTemplatesQueryStaticPath(input.id),
    },
    storyDocsForAllComponents: {
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
        'Resolves the story entry for a component id, runs the registered provider chain, writes the story docs and their templates into state, and returns the story docs (or undefined when no provider produced any).',
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

// Reads the key before `Object.hasOwn`, which is not tracked, so a subscription made before the
// entry is stored still updates once it is.
function entryOf<T>(record: Record<string, T>, id: string): T | undefined {
  const entry = record[id];
  return Object.hasOwn(record, id) ? entry : undefined;
}

// The entry of `id` alone, or none.
const pick = <T>(record: Record<string, T>, id: string): Record<string, T> =>
  Object.hasOwn(record, id) ? { [id]: record[id]! } : {};
