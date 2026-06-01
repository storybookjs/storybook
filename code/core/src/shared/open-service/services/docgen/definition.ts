import * as v from 'valibot';

import { defineService } from '../../service-definition.ts';
import type { DocgenPayload } from './types.ts';

const docgenInputSchema = v.object({ componentId: v.string() });

export type DocgenServiceState = {
  /** Extracted docgen keyed by componentId. Populated by the `extractDocgen` command. */
  components: Record<string, DocgenPayload | undefined>;
};

const docgenErrorSchema = v.object({
  name: v.string(),
  message: v.string(),
});

const docgenJsDocTagsSchema = v.record(v.string(), v.array(v.string()));

// Props are deliberately untyped: their shape is integration-specific (react-docgen-typescript,
// vue-docgen, etc. all differ). See DocgenPayload in ./types.ts for the rationale.
const docgenPropsSchema = v.array(v.unknown());

const docgenStorySchema = v.object({
  id: v.string(),
  name: v.string(),
  snippet: v.optional(v.string()),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(docgenErrorSchema),
});

const docgenSubcomponentSchema = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  jsDocTags: v.optional(docgenJsDocTagsSchema),
  props: docgenPropsSchema,
  error: v.optional(docgenErrorSchema),
});

const docgenPayloadSchema = v.object({
  componentId: v.string(),
  name: v.string(),
  description: v.string(),
  summary: v.optional(v.string()),
  jsDocTags: v.optional(docgenJsDocTagsSchema),
  props: docgenPropsSchema,
  subcomponents: v.optional(v.record(v.string(), docgenSubcomponentSchema)),
  stories: v.optional(v.array(docgenStorySchema)),
  error: v.optional(docgenErrorSchema),
});

const docgenOutputSchema = v.optional(docgenPayloadSchema);

/**
 * Definition for the `core/docgen` open service.
 *
 * The query is a thin synchronous read of `state.components[componentId]` — it returns undefined
 * when nothing has been extracted yet rather than throwing, matching the open-service convention
 * for sync reads. The real work — story index lookup, provider invocation, error handling —
 * lives in the `extractDocgen` command, whose body is supplied at registration time because it
 * needs to close over the server-only story index and the composed `experimental_docgenProvider`
 * chain. The query's `load` hook (also supplied at registration) just calls `extractDocgen`, so
 * `getDocgen.loaded()` is the awaitable form and surfaces extraction errors.
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
      staticPath: (input) => `${input.componentId}.json`,
    },
  },
  commands: {
    extractDocgen: {
      description:
        'Resolves the story entry for a componentId, runs the registered provider chain, writes the result into state, and returns it (or undefined when no provider produced docgen).',
      input: docgenInputSchema,
      output: docgenOutputSchema,
      // Handler is supplied at registration time so it can close over the story index and the
      // composed experimental_docgenProvider chain.
    },
  },
});
