import * as v from 'valibot';

import {
  type SnippetTemplate,
  getPrintHole,
  isSnippetTemplate,
} from '../../../../docs-tools/snippetTemplate.ts';

import { defineService } from 'storybook/open-service';
import type { ServiceInstanceOf } from '../../types.ts';
import type { StoryDocsPayload } from './types.ts';
import { selectLiveSnippetForStory } from './live-snippet.ts';
import { storyDocsQueryStaticPath } from './paths.ts';

const storyDocsInputSchema = v.object({ id: v.string() });

const argsSchema = v.record(v.string(), v.unknown());

const liveSnippetInputSchema = v.object({
  storyId: v.string(),
  args: v.pipe(argsSchema, v.description('The args to show in the snippet.')),
  initialArgs: v.optional(
    v.pipe(
      argsSchema,
      v.description(
        'The args the story is written with, as the preview holds them. Leave it out to fill only the args in `args`: every other arg keeps its text from the static snippet.'
      )
    )
  ),
});

const liveSnippetOutputSchema = v.object({
  snippet: v.optional(v.string()),
  warning: v.optional(v.string()),
});

const storyDocsErrorSchema = v.object({
  name: v.string(),
  message: v.string(),
});

// A `SnippetTemplate`: code, and holes whose place only its renderer reads.
const snippetTemplateSchema = v.custom<SnippetTemplate>(
  isSnippetTemplate,
  'Expected a snippet template: code and holes'
);

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
  template: v.optional(snippetTemplateSchema),
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
  internal: true,
  description: 'Story documentation (snippets, descriptions, imports) keyed by component id.',
  initialState: { components: {} } as StoryDocsServiceState,
  queries: {
    storyDocs: {
      description:
        'Returns the story-docs payload for one component id, or undefined when not loaded.',
      input: storyDocsInputSchema,
      output: storyDocsOutputSchema,
      // Reads the entry before `Object.hasOwn`, which is not tracked, so a subscription made before
      // the entry is stored still updates once it is.
      handler: (input, ctx) => {
        const entry = ctx.self.state.components[input.id];
        return Object.hasOwn(ctx.self.state.components, input.id) ? entry : undefined;
      },
      load: async (input, ctx) => {
        await ctx.self.commands.extractStoryDocs(input);
      },
      staticPath: (input) => storyDocsQueryStaticPath(input.id),
    },
    liveSnippet: {
      description:
        "Returns one story's snippet with `args` filled into its template by the renderer's hole printer, or its static snippet, with a warning when that does not follow `args`.",
      input: liveSnippetInputSchema,
      output: liveSnippetOutputSchema,
      // No load of its own: each new `args` would be a new load key, and a load would extract the
      // story docs again.
      handler: (input, ctx) =>
        selectLiveSnippetForStory(
          ctx.self.queries.storyDocs.get({ id: input.storyId.split('--')[0]! }),
          input.storyId,
          { unmappedArgs: input.args, initialArgs: input.initialArgs ?? {} },
          getPrintHole()
        ),
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
