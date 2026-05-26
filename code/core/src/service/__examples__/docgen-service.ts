/**
 * Worked example: a docgen-shaped service.
 *
 * Demonstrates the canonical authoring shape:
 *  - A query keyed by `componentId` (`getComponentDocgenInfo`) with `preload`, `inputs`, and
 *    `path` for the static build.
 *  - A no-input selector-only query (`somethingElse`) — no static-build fields; just a
 *    reactive read.
 *  - An **abstract** command (`generateDocgen`) — `handler` omitted from the definition. Each
 *    runtime supplies the body at registration time. A runtime without a handler throws when
 *    that command is called (until cross-runtime routing lands).
 *  - A **concrete** command (`modifySomethingElse`) — `handler` is inline; registration
 *    cannot override.
 *
 * This file lives under `__examples__` and is NOT exported from the package entry. It exists
 * so the public API is exercised by a realistic-shaped service that type-checks.
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

// Placeholder for the build-time component-id enumeration. Real callers would scan the
// project's stories.
async function listAllComponentIds(): Promise<readonly string[]> {
  return [];
}

/**
 * Environment-agnostic definition. Same module imported into manager, preview, and server.
 *
 * - `getComponentDocgenInfo` is a static-build query — its `preload` calls the abstract
 *   `generateDocgen` command. That command's body lives wherever docgen analysis can run
 *   (typically the server build), supplied via `registerService` in that environment.
 * - `modifySomethingElse` is concrete — its body is shared across all environments.
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
  },

  commands: {
    // Abstract: no `handler` on the definition. A registration MUST supply one for the
    // command to be callable in this runtime.
    generateDocgen: command({
      input: z.string(),
      output: z.void(),
    }),

    // Concrete: inline `handler`. Registration cannot override.
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
 * Example consumer (server-side): registers with the abstract command body that calls the
 * real docgen analyser.
 */
export function registerServerSideDocgen() {
  return registerService(DocgenService, {
    commands: {
      generateDocgen: async (componentId, ctx) => {
        // Real call would invoke the analyser; the stub here just writes a placeholder.
        ctx.self.setState((draft) => {
          draft.byComponentId[componentId] = {
            description: `Docgen for ${componentId}`,
            props: {},
          };
        });
      },
    },
  });
}
