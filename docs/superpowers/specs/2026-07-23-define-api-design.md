# `defineApi` Architecture Design

## Status

This design implements the updated Milestone 2 direction from tracking issue #35526. The public
surface is still experimental and remains subject to confirmation before Milestones 4 and 5 expose
it through production MCP and CLI adapters.

## Goal

Separate Storybook's internal Open Service Architecture from its public capability contract:

```text
Internal OSA services
        ↓
Public capability logic defined with defineApi
        ↓
CLI adapter / MCP adapter / future adapters
```

OSA remains responsible for state, synchronization, commands, queries, loading, and service
composition. `defineApi` owns the public capability names, method schemas, descriptions, and
handlers.

## Confirmed Decisions

- The new construct is named `defineApi`, replacing the earlier `defineTransporter` name.
- An API has an identifier, description, and one method namespace.
- Each method has only `schema`, `description`, and `handler`.
- Method handlers return agent-facing Markdown by default and structured data when `json: true`.
- The `json` property is part of each method schema, so CLI and MCP derive the same input contract.
- Runtime dependencies that are not OSA services are closed over when an API definition is created.
- Only `review.create` receives invocation context in v1, containing
  `consumer: 'cli' | 'mcp'`.
- API exposure is explicit through registration.
- Production MCP migration remains Milestone 4.
- Production `storybook tools` wiring remains Milestone 5.

## Public API Module

Add a transport-independent `storybook/public-api` module. Its public surface contains:

- `defineApi`, which preserves method and schema inference.
- `registerPublicApi`, which registers fully constructed definitions and rejects duplicate API ids.
- `publicApi`, which resolves a registered API through a typed definition reference.
- `invokeApi`, which validates raw input with Standard Schema before calling the handler.
- Definition, method, consumer context, and inference types.

The registry stores only explicitly registered API definitions. It does not discover OSA services
or expose service registry contents. API invocation propagates handler errors unchanged after input
validation.

One API has one method namespace. JavaScript object keys provide method-name uniqueness.
Transport adapters additionally reject collisions introduced by their name normalization, such as
two method names mapping to the same CLI subcommand.

## Capability Boundaries

### Docs

Remove the `core/docs` OSA wrapper. `docsApi` directly composes the genuine internal OSA services
`core/docgen`, `core/story-docs`, and addon-docs MDX through typed `getService` calls.

The existing index classification and structured mapping functions remain plain capability logic.
The OSA-only classification state and `_setClassification` command are removed because an async API
handler can keep request-local classification without shared state.

Methods:

- `list`
- `show`
- `showStory`

### Stories

Remove the empty-state `core/stories` OSA wrapper. `createStoriesApi` closes over the story index,
origin, status store, change detection, and module-graph lookup dependencies currently passed to
`registerStoriesService`.

Methods:

- `preview`
- `changed`
- `findByComponent`

Existing structured discovery functions remain the business logic.

### Test

Remove the empty-state `core/test` OSA wrapper. `createTestApi` closes over the addon-vitest channel
and story index. Its registration retains the per-registration async queue because addon-vitest
supports one active run.

Method:

- `run`

### Review

Keep `core/review`, but change it into a genuine OSA state service. It owns current review state and
server-authoritative staleness. The manager registers the service and subscribes through an OSA
query instead of receiving review state through custom display events.

`createReviewApi` is separate. It validates story ids, calls the internal review service command,
and returns the review URL as Markdown or structured data.

Method:

- `create`

The existing `PUSH_REVIEW` channel event remains as a temporary compatibility adapter for the
unchanged production MCP implementation. It forwards into the OSA service instead of owning a
second cache. MCP registration itself is not migrated in this PR.

## Output Semantics

Each capability computes structured data once. A colocated formatter converts that data to the
default Markdown response. `json: true` returns the structured value.

CLI and MCP therefore share method names, schemas, validation, business logic, and structured
semantics. Presentation may use `consumer` only for `review.create`, where the MCP response must
tell the agent to show the URL to the user. Broader consumer-specific branching is excluded from
v1.

## CLI Adapter

Refactor `generateCLI` to accept selected API definitions rather than OSA service definitions.

For every selected API:

- API id becomes the command group.
- Method name becomes a kebab-case subcommand.
- Method description becomes help text.
- Existing structured argument parsing produces raw input.
- `invokeApi` performs schema validation and calls the handler with `consumer: 'cli'`.
- String results are printed directly. Structured results are serialized as formatted JSON.

The adapter imports no OSA service definitions, runtime service types, or `getService`. It does not
register production `storybook tools` commands in this milestone.

## Testing

Primary contract tests cover:

- `defineApi` schema and handler type inference.
- Explicit registration and duplicate-id rejection.
- Input validation before handler invocation.
- Handler error propagation.
- Typed invocation context.
- CLI command generation, normalization collision detection, Markdown output, and JSON output.
- Docs composition over internal OSA services.
- Representative methods from docs, stories, test, and review.
- Review state synchronization path and legacy `PUSH_REVIEW` compatibility.

Existing mapper, story discovery, test runner, and review regression tests remain where they still
test observable behavior. Tests that only assert the removed OSA query/command split are deleted or
rewritten at the API boundary.

## Deferred Work

- Production MCP consumes the registered APIs in Milestone 4.
- Production CLI startup, running-server targeting, no-server project loading, telemetry, and root
  aliases remain Milestone 5.
- Hosted/static MCP remains on its static asset path until its separate compatibility design is
  implemented.
- HTTP verbs, SDK generation, middleware, lifecycle hooks, and generic transport infrastructure
  are excluded until a real consumer requires them.

## Scope

This PR does not update issue #35526, migrate production MCP, expose production CLI commands,
redesign OSA, or merge the pull request.
