import * as v from 'valibot';

import { defineService } from 'storybook/open-service';
import type { DocgenPayload } from './types.ts';
import { docgenQueryStaticPath } from './paths.ts';

const docgenInputSchema = v.object({ id: v.string() });

export type DocgenServiceState = {
  /** Extracted docgen keyed by component id. Populated by the `extractDocgen` command. */
  components: Record<string, DocgenPayload>;
};

const docgenErrorSchema = v.object({
  name: v.string(),
  message: v.string(),
});

const docgenJsDocTagsSchema = v.record(v.string(), v.array(v.string()));

const docgenStorySchema = v.object({
  id: v.string(),
  name: v.string(),
  snippet: v.optional(v.string()),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(docgenErrorSchema),
});

/** Shared docgen fields on component and subcomponent docgen entries. */
const docgenEntryBaseFields = {
  name: v.string(),
  path: v.string(),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  import: v.optional(v.string()),
  jsDocTags: docgenJsDocTagsSchema,
  error: v.optional(docgenErrorSchema),
};

/**
 * Subcomponent docgen schema.
 *
 * Uses {@link v.looseObject} so provider-specific docgen engine output (for example
 * `reactComponentMeta`) validates without listing every framework integration field in core.
 */
const docgenSubcomponentSchema = v.looseObject(docgenEntryBaseFields);

/**
 * Top-level component docgen payload schema.
 *
 * Uses {@link v.looseObject} for the same reason as {@link docgenSubcomponentSchema}: the open
 * service owns the portable manifest contract while renderers attach engine-specific keys.
 */
const docgenPayloadSchema = v.looseObject({
  id: v.string(),
  ...docgenEntryBaseFields,
  subcomponents: v.optional(v.record(v.string(), docgenSubcomponentSchema)),
  stories: v.array(docgenStorySchema),
});

const docgenOutputSchema = v.optional(docgenPayloadSchema);

/**
 * Definition for the `core/docgen` open service.
 *
 * The query is a thin synchronous read of `state.components[id]` — it returns undefined when
 * nothing has been extracted yet rather than throwing, matching the open-service convention for
 * sync reads. The real work — story index lookup, provider invocation, error handling — lives in
 * the `extractDocgen` command, whose body is supplied at registration time because it needs to
 * close over the server-only story index and the composed `experimental_docgenProvider` chain.
 * The query's `load` hook calls `extractDocgen`, so `getDocgen.loaded()` is the awaitable form and
 * surfaces extraction errors. `getDocgenForAllComponents` delegates to the `extractAllDocgen`
 * command, whose handler is supplied at registration because it needs the story index.
 */
export const docgenServiceDef = defineService({
  id: 'core/docgen',
  description:
    'Component documentation (name, description, props, JSDoc tags) keyed by component id.',
  initialState: { components: {} } as DocgenServiceState,
  queries: {
    getDocgen: {
      description: 'Returns the docgen payload for one component id, or undefined when not loaded.',
      input: docgenInputSchema,
      output: docgenOutputSchema,
      handler: (input, ctx) =>
        input.id in ctx.self.state.components ? ctx.self.state.components[input.id] : undefined,
      load: async (input, ctx) => {
        await ctx.self.commands.extractDocgen(input);
      },
      staticPath: (input) => docgenQueryStaticPath(input.id),
    },
    getDocgenForAllComponents: {
      description: 'Returns docgen payloads for every component in the story index.',
      input: v.void(),
      output: v.record(v.string(), docgenPayloadSchema),
      handler: (_input, ctx) => ctx.self.state.components,
      load: async (_input, ctx) => {
        await ctx.self.commands.extractAllDocgen(undefined);
      },
    },
  },
  commands: {
    extractDocgen: {
      description:
        'Resolves the story entry for a component id, runs the registered provider chain, writes the result into state, and returns it (or undefined when no provider produced docgen).',
      input: docgenInputSchema,
      output: docgenOutputSchema,
      // Handler is supplied at registration time so it can close over the story index and the
      // composed experimental_docgenProvider chain.
    },
    extractAllDocgen: {
      description:
        'Extracts docgen for every component id in the story index by invoking `extractDocgen` for each.',
      input: v.undefined(),
      output: v.void(),
      // Handler is supplied at registration time so it can close over the story index.
    },
  },
});
