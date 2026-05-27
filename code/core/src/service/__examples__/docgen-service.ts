/**
 * Worked example: a docgen-shaped service.
 *
 * Demonstrates:
 *  - A query keyed by `componentId` (`getComponentDocgenInfo`) with `preload`, `inputs`, and `path`
 *    for the static build.
 *  - A no-input query without preload (`somethingElse`) — no static-build fields; just a reactive read.
 *  - Two concrete commands with inline handlers.
 *
 * This file lives under `__examples__` and is NOT exported from the package entry. It exists
 * so the public API is exercised by a realistic-shaped service that type-checks.
 *
 * (Abstract commands — definitions without `handler` that registration supplies — arrive in a
 * follow-up stage. Today both commands here are concrete.)
 */

import { z } from 'zod';

import { defineService } from '../define-service.ts';
import { createService } from '../service-runtime.ts';

const componentDocgenSchema = z.object({
  description: z.string(),
  props: z.record(z.string(), z.unknown()),
});

interface DocgenState {
  byComponentId: Record<string, z.infer<typeof componentDocgenSchema>>;
  somethingElse: number;
}

// Placeholder for the build-time component-id enumeration.
async function listAllComponentIds(): Promise<readonly string[]> {
  return [];
}

/**
 * Environment-agnostic definition.
 *
 * `defineService<DocgenState>()(({ query, command }) => …)` — state on the generic; schemas
 * and handlers infer from the callback.
 */
export const DocgenService = defineService<DocgenState>()(({ query, command }) => ({
  id: 'core/docgen',

  state: {
    byComponentId: {},
    somethingElse: 42,
  },

  queries: {
    getComponentDocgenInfo: query({
      input: z.string(),
      output: componentDocgenSchema.nullable(),
      handler: (state, componentId) => state.byComponentId[componentId] ?? null,
      preload: async (componentId, ctx) => {
        // Stage 1: the handler lives inline on `generateDocgen`. Once abstract commands land,
        // this preload will call the abstract command and registration will supply the body
        // per environment.
        await ctx.self.commands.generateDocgen(componentId);
      },
      inputs: async () => listAllComponentIds(),
      path: (_ctx, componentId) => `docgen-${componentId}.json`,
    }),

    somethingElse: query({
      input: z.void(),
      output: z.number(),
      handler: (state) => state.somethingElse,
    }),
  },

  commands: {
    generateDocgen: command({
      input: z.string(),
      output: z.void(),
      handler: async (componentId, ctx) => {
        ctx.self.setState((draft) => {
          draft.byComponentId[componentId] = {
            description: `Docgen for ${componentId}`,
            props: {},
          };
        });
      },
    }),

    modifySomethingElse: command({
      input: z.void(),
      output: z.void(),
      handler: (ctx) => {
        ctx.self.setState((draft) => {
          draft.somethingElse = Math.floor(Math.random() * 100);
        });
      },
    }),
  },
}));

/** Example consumer: build a fresh instance. */
export function createDocgenService() {
  return createService(DocgenService);
}
