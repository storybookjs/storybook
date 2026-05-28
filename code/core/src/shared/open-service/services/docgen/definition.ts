import * as v from 'valibot';

import { defineService } from '../../service-definition.ts';
import type { DocgenPayload } from './types.ts';

const docgenInputSchema = v.object({ componentId: v.string() });

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
      output: v.optional(
        v.object({
          componentId: v.string(),
          name: v.string(),
          description: v.string(),
          props: v.array(v.unknown()),
        })
      ),
      handler: (input, ctx) => ctx.self.state.components[input.componentId],
    },
  },
  commands: {
    extractDocgen: {
      description:
        'Resolves story entries for a componentId, runs the registered extractor chain, and writes the result into state.',
      input: docgenInputSchema,
      output: v.void(),
      // Handler is supplied at registration time so it can close over the story index and the
      // composed experimental_docgenProvider chain.
    },
  },
});
