import * as v from 'valibot';

import { type SnippetTemplate, isSnippetTemplate } from '../../../../docs-tools/snippetTemplate.ts';

import { defineService } from 'storybook/open-service';
import type { ServiceInstanceOf } from '../../types.ts';
import { readComponent } from '../component-state-key.ts';
import type { StoryDocsById, StoryDocsPayload } from './types.ts';
import { storyDocsQueryStaticPath } from './paths.ts';

// Which stories a `storyDocs` read returns: `all` for the Storybook UI, which shows every story, and
// `manifest` for the docs tools, the MCP and the components manifest, which show only the stories
// tagged `manifest`. Required, so that a new reader cannot leak stories by leaving it out.
const storyDocsScopeSchema = v.picklist(['all', 'manifest']);
export type StoryDocsScope = v.InferOutput<typeof storyDocsScopeSchema>;

const storyDocsQueryInputSchema = v.object({ id: v.string(), scope: storyDocsScopeSchema });
const storyDocsCommandInputSchema = v.object({ id: v.string() });

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
  /**
   * Extracted story docs keyed by component id, with only the stories tagged `manifest`. The
   * components manifest points here. Code that reads the state, such as a query handler or a
   * reader of the static snapshot, gets a scope's stories through `readStoryDocs`.
   */
  components: Record<string, StoryDocsPayload>;
  /** The stories each component leaves out of the manifests, keyed by component id, then story id. */
  nonManifestStories: Record<string, StoryDocsById>;
};

const storyDocsServiceStateSchema = v.object({
  components: v.record(v.string(), storyDocsPayloadSchema),
  nonManifestStories: v.record(v.string(), v.record(v.string(), storyDocSchema)),
});

/** Whether a value, such as a static snapshot read from disk, has the shape of the service state. */
export function isStoryDocsServiceState(value: unknown): value is StoryDocsServiceState {
  return v.is(storyDocsServiceStateSchema, value);
}

/**
 * A stored payload as the manifests show it. A component in the manifests only through its attached
 * docs has no manifest stories, so it gets nothing: no stories and no import.
 */
export function toManifestStoryDocs(
  payload: StoryDocsPayload | undefined
): StoryDocsPayload | undefined {
  return payload && Object.keys(payload.stories).length > 0 ? payload : undefined;
}

/**
 * Reads one component's story docs from the service state, as the `storyDocs` query and a build's
 * snapshot reader both do.
 */
export function readStoryDocs(
  state: StoryDocsServiceState,
  id: string,
  scope: StoryDocsScope
): StoryDocsPayload | undefined {
  const storyDocs = readComponent(state.components, id);
  if (!storyDocs) {
    return undefined;
  }
  switch (scope) {
    case 'manifest':
      return toManifestStoryDocs(storyDocs);
    case 'all': {
      const nonManifestStories = readComponent(state.nonManifestStories, id);
      return nonManifestStories
        ? { ...storyDocs, stories: { ...storyDocs.stories, ...nonManifestStories } }
        : storyDocs;
    }
    default:
      return scope satisfies never;
  }
}

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
  initialState: { components: {}, nonManifestStories: {} } as StoryDocsServiceState,
  queries: {
    storyDocs: {
      description:
        'Returns the story-docs payload for one component id, or undefined when not loaded. `scope` picks every story or only those in the manifests.',
      input: storyDocsQueryInputSchema,
      output: storyDocsOutputSchema,
      handler: ({ id, scope }, ctx) => readStoryDocs(ctx.self.state, id, scope),
      load: async ({ id }, ctx) => {
        await ctx.self.commands.extractStoryDocs({ id });
      },
      // Both scopes read the same state, so they share one file.
      staticPath: (input) => storyDocsQueryStaticPath(input.id),
    },
    storyDocsForAllComponents: {
      description:
        'Returns the story-docs payload of every extracted component, with only its stories in the manifests, also for a component with none. A manifest reader passes each payload through `toManifestStoryDocs`.',
      input: v.void(),
      output: v.record(v.string(), storyDocsPayloadSchema),
      // Every stored component, also one with no manifest stories: the extraction service reads
      // these keys to find the components it extracts again after a file changes.
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
      input: storyDocsCommandInputSchema,
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
