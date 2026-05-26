/**
 * Worked example: the DocgenService from the architecture conversation.
 *
 * Demonstrates:
 *  - A query keyed by `componentId` (`getComponentDocgenInfo`) declared via `defineQuery` with
 *    a `preload`, an `inputs` enumeration, and a `path` callback for the static build.
 *  - A no-input selector-only query (`somethingElse`) — `defineQuery({ select })` with no
 *    static-build fields. No persistence, no load-on-subscribe; just a reactive read.
 *  - An **abstract** command (`generateDocgen`) — declared in the shared definition but implemented
 *    at registration time. Different environments (server, manager, preview) can provide different
 *    bodies for the same command without forking the definition.
 *  - A **concrete** command (`modifySomethingElse`) — local state mutation, no preload, identical
 *    behaviour everywhere.
 *
 * Note that this file lives under `__examples__` and is NOT exported from the package entry. It
 * exists so the public API is exercised by a realistic-shaped service that type-checks.
 */

import { defineCommand, defineQuery, defineService } from '../define-service.ts';
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
 * the `state` argument of every query and the `ctx` argument of every command/preload are
 * inferred as `DocgenState` / `ServiceCtx<DocgenState>`. The `draft` argument of `setState`
 * still needs an annotation — see the comment on `modifySomethingElse` for why.
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
    // Selector + preload + inputs + path live together inside `defineQuery`. The preload calls
    // a command that populates the relevant slice of state; the static build runs this preload
    // for every enumerated input and writes per-input JSON files at `path(input)`.
    getComponentDocgenInfo: defineQuery({
      select: (state, componentId: string) => state.byComponentId[componentId],
      preload: async (componentId: string, ctx) => {
        await ctx.self.commands.generateDocgen(componentId);
      },
      inputs: async () => listAllComponentIds(),
      path: (_ctx, componentId: string) => `docgen-${componentId}.json`,
    }),

    // Selector-only query. No `preload`, so no static-build artifact and no load-on-subscribe
    // behaviour — just a reactive read of `state.somethingElse`.
    somethingElse: defineQuery({
      select: (state) => state.somethingElse,
    }),
  },
  commands: {
    // Abstract: signature declared here, implementation supplied at registration.
    generateDocgen: defineCommand<string>(),

    // Concrete: pure local mutation. `ctx` is inferred as `ServiceCtx<DocgenState>` via the
    // curried form. `draft` needs an annotation because TypeScript won't propagate the bound
    // generic through the command type's overloaded function shape to a nested function-typed
    // parameter — ctx works because it's at the top level; draft is one level deeper.
    modifySomethingElse: (ctx) => {
      ctx.self.setState((draft: DocgenState) => {
        draft.somethingElse = Math.floor(Math.random() * 100);
      });
    },
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
