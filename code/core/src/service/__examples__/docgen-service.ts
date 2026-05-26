/**
 * Worked example: the DocgenService from the architecture conversation.
 *
 * Demonstrates:
 *  - A query keyed by `componentId` (`getComponentDocgenInfo`) with `preload`, `inputs`, and `path`
 *    for the static build.
 *  - A no-input selector-only query (`somethingElse`) — no static-build fields; just a reactive read.
 *  - An **abstract** command (`generateDocgen`) — declared without `handler`, implemented at registration.
 *  - A **concrete** command (`modifySomethingElse`) — local state mutation, identical everywhere.
 *
 * Note that this file lives under `__examples__` and is NOT exported from the package entry. It
 * exists so the public API is exercised by a realistic-shaped service that type-checks.
 */

import { z } from 'zod';

import { defineService } from '../define-service.ts';
import { registerService } from '../register-service.ts';

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
 * `defineService<DocgenState>()(({ query, command }) => …)` — pass state on the generic; schemas
 * and registration handlers infer from the callback (including `componentId` on abstract commands).
 */
// Curried `defineService<State>()(setup)` preserves command schemas for registration inference.
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
      select: (state, componentId) => state.byComponentId[componentId] ?? null,
      preload: async (componentId, ctx) => {
        await ctx.self.commands.generateDocgen(componentId);
      },
      inputs: async () => listAllComponentIds(),
      path: (_ctx, componentId) => `docgen-${componentId}.json`,
    }),

    somethingElse: query({
      input: z.void(),
      output: z.number(),
      select: (state) => state.somethingElse,
    }),

    // example of a query without factory function
    aThirdThing: {
      input: z.string(),
      output: z.string(),
      select: (state: DocgenState, input: string) => state.byComponentId[input] ?? null,
    },
  },

  commands: {
    generateDocgen: command({
      input: z.string(),
      output: z.void(),
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

/**
 * Example registration. Each environment can register the same `DocgenService` definition
 * with its own `generateDocgen` body — e.g. in the server it'd run `react-component-meta`
 * against the component source. Here we just stub it so the example runs.
 */
export function registerDocgenServiceWithStubAnalyzer() {
  return registerService(DocgenService, {
    commands: {
      generateDocgen: async (componentId, ctx) => {
        ctx.self.setState((draft) => {
          draft.byComponentId[componentId] = {
            description: `Docgen for ${componentId}`,
            props: {},
          };
        });
      },
      // Note: `modifySomethingElse` is concrete (its definition has a `handler`), so it
      // is intentionally excluded from `CommandOverrides` — attempting to override it
      // here would be rejected by the type system and by the runtime.
    },
  });
}
