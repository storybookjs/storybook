import * as v from 'valibot';

import { defineService } from '../../service-definition.ts';
import type { ModuleGraphServiceState } from './types.ts';

/** Input to the `resolveAffectedComponents` command: absolute, normalized story-file paths. */
export const resolveAffectedComponentsInputSchema = v.object({
  storyFiles: v.array(v.string()),
});

/** Output of `resolveAffectedComponents` and the shape stored in `lastAffected`. */
export const moduleGraphInvalidationSchema = v.object({
  revision: v.number(),
  componentIds: v.array(v.string()),
});

/** Input to the `getLastAffected` query — no parameters. */
export const getLastAffectedInputSchema = v.optional(v.object({}));

/**
 * Definition for the `core/module-graph` open service.
 *
 * A thin facade over the change-detection dependency graph. It does not own file watching or the
 * reverse index (those stay in `code/core/src/core-server/change-detection/`); instead it is fed a
 * batch of affected story files and translates them into the component ids that consumers like
 * `core/docgen` (and, later, a story-snippet service) care about.
 *
 * The `resolveAffectedComponents` handler is supplied at registration time because it needs to
 * close over the server-only story index and working directory. `getLastAffected` is a thin
 * subscribable read of the last recorded invalidation — unused in the first slice, but the seam a
 * future snippet service can subscribe to.
 */
export const moduleGraphServiceDef = defineService({
  id: 'core/module-graph',
  description:
    'Maps changed source files to the component ids they affect, backed by the change-detection dependency graph.',
  initialState: {
    lastAffected: { revision: 0, componentIds: [] },
  } as ModuleGraphServiceState,
  queries: {
    getLastAffected: {
      description: 'Returns the most recent invalidation (revision + affected component ids).',
      input: getLastAffectedInputSchema,
      output: moduleGraphInvalidationSchema,
      handler: (_input, ctx) => ctx.self.state.lastAffected,
    },
  },
  commands: {
    resolveAffectedComponents: {
      description:
        'Translates a batch of affected story files into affected component ids, records them as the latest invalidation, and returns them.',
      input: resolveAffectedComponentsInputSchema,
      output: moduleGraphInvalidationSchema,
      // Handler is supplied at registration time so it can close over the story index and the
      // working directory used to resolve absolute story-file paths back to index entries.
    },
  },
});
