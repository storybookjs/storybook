/**
 * Worked example: the DocgenService from the architecture conversation.
 *
 * Demonstrates:
 *  - A query keyed by `componentId` (`getComponentDocgenInfo`) and a no-input query (`somethingElse`).
 *  - An **abstract** command (`generateDocgen`) — declared in the shared definition but implemented
 *    at registration time. Different environments (server, manager, preview) can provide different
 *    bodies for the same command without forking the definition.
 *  - A **concrete** command (`modifySomethingElse`) — local state mutation, no loader, identical
 *    behaviour everywhere.
 *  - A loader keyed by `componentId`, with a `path` callback that controls the per-input JSON file.
 *
 * Note that this file lives under `__examples__` and is NOT exported from the package entry. It
 * exists so the public API is exercised by a realistic-shaped service that type-checks.
 */

import { defineCommand, defineLoader, defineService } from '../define-service.ts';
import { registerService } from '../register-service.ts';

interface ComponentDocgen {
  description: string;
  props: Record<string, unknown>;
}

interface DocgenState {
  byComponentId: Record<string, ComponentDocgen>;
  somethingElse: number;
}

// Placeholder for the build-time component-id enumeration.
async function listAllComponentIds(): Promise<readonly string[]> {
  return [];
}

/**
 * Environment-agnostic definition.
 *
 * The curried `defineService<DocgenState>()(...)` form binds the state interface once. Inside,
 * the `state` argument of every query, the `ctx` argument of every command, and the `draft`
 * argument of every `setState` callback are all inferred as `DocgenState` — no annotations.
 *
 * `generateDocgen` is abstract here: its body depends on environment-specific modules (the AST
 * analyzer in the server, etc.), so we delegate the implementation to the registration step.
 */
export const DocgenService = defineService<DocgenState>()({
  id: 'core/docgen',

  state: {
    byComponentId: {},
    somethingElse: 42,
  },

  queries: {
    getComponentDocgenInfo: (state, componentId: string) => state.byComponentId[componentId],
    somethingElse: (state) => state.somethingElse,
  },

  commands: {
    // Abstract: signature declared here, implementation supplied at registration.
    generateDocgen: defineCommand<string>(),

    // Concrete: pure local mutation, no environment-specific work. Note that `ctx` and `draft`
    // are inferred — no `ServiceCtx<DocgenState>` annotation needed.
    modifySomethingElse: (ctx) => {
      // `ctx` is inferred as ServiceCtx<DocgenState> via the curried form.
      // `draft` requires an annotation because the surrounding command type carries multiple
      // call signatures (1-arg and 2-arg) and TS won't propagate the resolved generic through
      // an overloaded function type to a nested function-typed parameter. ctx works because
      // it's a top-level parameter; draft is one level deeper.
      ctx.self.setState((draft: DocgenState) => {
        draft.somethingElse = Math.floor(Math.random() * 100);
      });
    },
  },

  load: {
    getComponentDocgenInfo: defineLoader<DocgenState, string>(
      async (componentId, ctx) => {
        await ctx.self.commands.generateDocgen(componentId);
      },
      async () => listAllComponentIds(),
      {
        path: (_ctx, componentId) => `docgen-${componentId}.json`,
      }
    ),
  },
});

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
    },
  });
}
