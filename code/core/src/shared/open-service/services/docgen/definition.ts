import * as v from 'valibot';

import { defineService } from 'storybook/open-service';
import type { DocgenPayload } from './types.ts';

/** Caller-facing input to the `getDocgen` query and the `extractDocgen` command. */
export const docgenInputSchema = v.object({ componentId: v.string() });

/**
 * Phase-1 docgen payload schema.
 *
 * `props` is intentionally a permissive `array(unknown)` slot so the service can ship before its
 * real shape is designed in phase 3 (RCM-backed extraction).
 */
export const docgenPayloadSchema = v.object({
  componentId: v.string(),
  name: v.string(),
  description: v.string(),
  props: v.array(v.unknown()),
});

/** Output of `getDocgen` — undefined when the component has not been extracted yet. */
export const docgenOutputSchema = v.optional(docgenPayloadSchema);

// Compile-time guard that the schema's inferred output matches the published DocgenPayload type.
// If a future schema change diverges from the public type the file will fail typecheck here, so
// the two definitions stay in lockstep without a runtime duplication.
type _DocgenPayloadShapeMatches =
  DocgenPayload extends v.InferOutput<typeof docgenPayloadSchema>
    ? v.InferOutput<typeof docgenPayloadSchema> extends DocgenPayload
      ? true
      : never
    : never;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _assertDocgenPayloadShapeMatches: _DocgenPayloadShapeMatches = true;

export type DocgenServiceState = {
  /** Extracted docgen keyed by componentId. Populated by the `extractDocgen` command. */
  components: Record<string, DocgenPayload | undefined>;
};

/**
 * Definition for the `core/docgen` open service.
 *
 * The query is a thin synchronous read of `state.components[componentId]` — it returns undefined
 * when nothing has been extracted yet rather than throwing, matching the open-service convention
 * for sync reads. The real work — story index lookup, extractor invocation, error handling —
 * lives in the `extractDocgen` command, whose body is supplied at registration time because it
 * needs to close over the server-only story index and the composed `experimental_docgenProvider`
 * chain. The query's `load` hook calls `extractDocgen`, so `getDocgen.loaded()` is the awaitable
 * form and surfaces extraction errors.
 */
export const docgenServiceDef = defineService({
  id: 'core/docgen',
  description:
    'Component documentation (name, description, props, JSDoc tags) keyed by componentId.',
  initialState: { components: {} } as DocgenServiceState,
  queries: {
    getDocgen: {
      description: 'Returns the docgen payload for one componentId, or undefined when not loaded.',
      input: docgenInputSchema,
      output: docgenOutputSchema,
      handler: (input, ctx) => ctx.self.state.components[input.componentId],
      load: async (input, ctx) => {
        await ctx.self.commands.extractDocgen(input);
      },
      staticPath: (input) => `${input.componentId}.json`,
    },
  },
  commands: {
    extractDocgen: {
      description:
        'Resolves story entries for a componentId, runs the registered provider chain, writes the result into state, and returns it (or undefined when no provider produced docgen).',
      input: docgenInputSchema,
      output: docgenOutputSchema,
      // Handler is supplied at registration time so it can close over the story index and the
      // composed experimental_docgenProvider chain.
    },
  },
});
