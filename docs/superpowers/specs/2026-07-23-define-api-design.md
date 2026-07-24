# `defineApi` Architecture Design

## Status

This design follows the July 23 Milestone 2 update in tracking issue #35526. The API remains
experimental until the architecture is confirmed before Milestones 4 and 5 expose it through MCP
and CLI adapters.

## Goal

Separate Storybook's internal Open Service Architecture from its public capability contract:

```text
Internal OSA services
        ↓
Public capability logic defined with defineApi
        ↓
CLI adapter / MCP adapter
```

OSA owns state, synchronization, commands, queries, loading, and service composition. `defineApi`
owns only public capability names, method schemas, descriptions, and handlers.

## Public API Contract

`storybook/public-api` exports `defineApi` and the types needed to describe an API definition. An
API has an `id`, a description, and one method namespace. Each method has exactly three fields:

- `schema`
- `description`
- `handler`

Every handler receives `(input, ctx)`. The context contains only values that every server runtime
provides:

```ts
type ApiCtx = {
  consumer: 'cli' | 'mcp';
  origin: string;
  getService: TypedGetService<ServerCoreServices>;
};
```

Capability-specific dependencies are captured by plain factories. They do not become context
fields.

There is no public API registry, registration lifecycle, discovery mechanism, or generic invocation
helper. An adapter receives an explicit array of API definitions. That array is the complete
exposure boundary.

## Capability Boundaries

### Docs

`docsApi` is a plain definition. Its handlers compose `core/docgen`, `core/story-docs`, and the MDX
service through `ctx.getService`. It has no capability-specific dependency factory and no
`core/docs` OSA facade.

Methods:

- `list`
- `show`
- `showStory`

### Stories

`createStoriesApi({ storyIndex, git })` captures boot-time story-index and git dependencies. Its
handlers use `ctx.origin` for preview URLs and `ctx.getService('core/module-graph')` for graph
queries. It has no `core/stories` OSA facade.

Methods:

- `preview`
- `changed`
- `findByComponent`

### Test

`createTestApi({ channel, storyIndex })` captures the addon-vitest channel and story index. The
factory owns the single-run queue because the channel supports one active run. It has no
`core/test` OSA facade.

Method:

- `run`

### Review

`core/review` remains a real OSA state service because the review UI subscribes to synchronized
state. `reviewApi` is a separate plain API definition. `review.create` calls the service through
`ctx.getService`, builds its URL from `ctx.origin`, and uses `ctx.consumer` only for the MCP
presentation hint.

Method:

- `create`

The existing `PUSH_REVIEW` channel event remains a temporary adapter for the unchanged production
MCP implementation. It forwards into the OSA service instead of maintaining separate state.

## Data and Output Semantics

Each method schema includes `json`. Handlers return agent-facing Markdown by default and structured
data when `json: true`. Capability code computes structured data once and formats that result, so
future adapters share schemas and semantics without duplicating business logic.

Adapters are responsible for validating transport input against the method schema before calling
the handler. `defineApi` itself only preserves TypeScript inference and returns the supplied
definition.

## Runtime Composition

Milestone 2 exports definitions and factories but does not register them globally or wire a
production adapter. Future runtimes construct the required definitions where their dependencies
exist and pass an explicit array to an adapter:

```ts
const publicApis = [
  docsApi,
  createStoriesApi({ storyIndex, git }),
  createTestApi({ channel, storyIndex }),
  reviewApi,
];
```

Milestone 4 maps existing MCP tools onto these definitions. Milestone 5 implements
`generateCLI(publicApis)` and production `storybook tools` wiring.

## Testing

Primary contract tests cover:

- `defineApi` schema, handler, and context inference.
- The required `ApiCtx` fields.
- Method schemas with representative valid and invalid inputs.
- Direct handler behavior with a complete test context.
- Error propagation from handlers and composed OSA services.
- Representative Markdown and structured output for docs, stories, test, and review.
- Proof that docs, stories, and review compose OSA services through `ctx.getService`.
- Review state synchronization and legacy `PUSH_REVIEW` compatibility.

Existing mapper, story-discovery, test-runner, and review regression tests remain where they protect
observable behavior.

## Removed From This Milestone

- The realm-global public API registry and registration wrappers.
- `publicApi`, `invokeApi`, and registry-clearing helpers.
- Runtime side-effect registration from presets and addons.
- `generateCLI`, its tests, and CLI argument-parser changes.

## Deferred Work

- Production MCP migration remains Milestone 4.
- CLI generation, validation, help, telemetry, aliases, and running-server behavior remain
  Milestone 5.
- Hosted/static MCP remains on its compatibility path.
- HTTP, SDK, middleware, lifecycle, plugin, and generic transport infrastructure remain excluded.

## Scope

This PR does not update issue #35526, migrate production MCP, ship CLI commands, redesign OSA, or
merge the pull request.
