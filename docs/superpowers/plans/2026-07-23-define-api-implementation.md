# `defineApi` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the direct OSA-to-CLI capability contract with a small `defineApi` public
capability layer while retaining OSA for genuine internal state and synchronization.

**Architecture:** `storybook/public-api` defines, registers, validates, and invokes explicit public
capabilities. Docs, stories, and test become API definitions over existing logic. Review keeps a
stateful OSA service and adds a one-shot API definition. `generateCLI` consumes API definitions only.

**Tech Stack:** TypeScript, Standard Schema, Valibot, Vitest, Commander, Storybook OSA

## Global Constraints

- Do not update tracking issue #35526.
- Do not migrate production MCP adapters.
- Do not expose production `storybook tools` commands.
- Do not merge PR #35516.
- API methods contain only `schema`, `description`, and `handler`.
- API methods return Markdown by default and structured data with `json: true`.
- Only `review.create` uses `consumer: 'cli' | 'mcp'`.
- Format with `cd code && yarn fmt:write` after editing.

---

### Task 1: Add the public API definition and registry

**Files:**

- Create: `code/core/src/shared/public-api/definition.ts`
- Create: `code/core/src/shared/public-api/registry.ts`
- Create: `code/core/src/shared/public-api/index.ts`
- Create: `code/core/src/shared/public-api/definition.test-d.ts`
- Create: `code/core/src/shared/public-api/registry.test.ts`
- Modify: `code/core/package.json`
- Modify: `code/core/build-config.ts`

**Interfaces:**

- Produces: `defineApi`, `registerPublicApi`, `publicApi`, `invokeApi`, `clearPublicApiRegistry`
- Produces: `ApiDefinition`, `AnyApiDefinition`, `ApiConsumer`, `ApiInvocationContext`
- Consumes: Standard Schema validation through the existing open-service validation utility or an
  equivalent private helper

- [ ] **Step 1: Write failing type and runtime tests**

```ts
const exampleApi = defineApi({
  id: 'example',
  description: 'Example API',
  methods: {
    greet: {
      description: 'Greets a person.',
      schema: v.object({ name: v.string() }),
      handler: async ({ name }) => `Hello ${name}`,
    },
  },
});

registerPublicApi([exampleApi]);
await expect(invokeApi(exampleApi, 'greet', { name: 42 })).rejects.toThrow();
await expect(invokeApi(exampleApi, 'greet', { name: 'Ada' })).resolves.toBe('Hello Ada');
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
yarn test public-api
```

Expected: failure because `storybook/public-api` and its implementation do not exist.

- [ ] **Step 3: Implement the minimal deep module**

`defineApi` must preserve each method schema's parsed input type in its handler. `invokeApi` must
validate input before calling the handler, pass `{ consumer }`, and propagate handler errors.
Registration must reject duplicate API ids while allowing idempotent registration of the same
definition.

- [ ] **Step 4: Export the package entry and run tests**

Run:

```bash
yarn test public-api
yarn nx check core
```

Expected: public API tests pass and core type checking succeeds.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/public-api code/core/package.json code/core/build-config.ts
git commit -m "Add defineApi public capability seam"
```

### Task 2: Move docs capability to `defineApi`

**Files:**

- Modify: `code/core/src/shared/open-service/services/docs/definition.ts`
- Modify: `code/core/src/shared/open-service/services/docs/server.ts`
- Modify: `code/core/src/shared/open-service/services/docs/runtime.ts`
- Create: `code/core/src/shared/open-service/services/docs/format.ts`
- Modify: `code/core/src/shared/open-service/services/docs/runtime.test.ts`
- Create or modify: `code/core/src/shared/open-service/services/docs/api.test.ts`
- Modify: `code/addons/docs/src/docs-service/server.ts`
- Modify: `code/core/src/shared/open-service/core-service-types.ts`
- Modify: `code/core/src/shared/open-service/services/capability-services.test.ts`
- Modify: `code/core/src/server-errors.ts`

**Interfaces:**

- Produces: `docsApi`
- Consumes: `getService<DocgenService>('core/docgen')`
- Consumes: `getService<StoryDocsService>('core/story-docs')`
- Consumes: existing `classifyIndex`, `mapDocsList`, `mapDocsShow`, `mapDocsShowStory`

- [ ] **Step 1: Write API behavior tests**

Tests must invoke `docsApi` through `invokeApi`, assert Markdown by default, structured output with
`json: true`, and prove that mocked internal OSA services are called through `.loaded()`.

- [ ] **Step 2: Run docs tests to verify failure**

Run:

```bash
yarn test docs/api docs/map
```

Expected: API test fails while mapper regressions remain green.

- [ ] **Step 3: Rewrite the definition as an async API**

Each method should classify the index in request-local variables, await required OSA queries,
derive one structured result with existing mappers, and select structured or Markdown output:

```ts
return input.json ? data : formatDocsList(data);
```

Remove `DocsServiceState`, `_setClassification`, cache keys, store/restore helpers, and docs-specific
OSA classification errors.

- [ ] **Step 4: Register `docsApi` from addon-docs**

`registerDocsApi({ getIndex })` registers a definition whose handler closes over `getIndex`.
Registration must no longer call `registerService`.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
yarn test docs/api docs/map capability-services
```

Expected: all selected tests pass.

```bash
git add code/addons/docs code/core/src/shared/open-service/services/docs \
  code/core/src/shared/open-service/core-service-types.ts code/core/src/server-errors.ts
git commit -m "Move docs capability to defineApi"
```

### Task 3: Move stories capability to `defineApi`

**Files:**

- Modify: `code/core/src/shared/open-service/services/stories/definition.ts`
- Modify: `code/core/src/shared/open-service/services/stories/server.ts`
- Create: `code/core/src/shared/open-service/services/stories/format.ts`
- Create or modify: `code/core/src/shared/open-service/services/stories/api.test.ts`
- Modify: `code/core/src/core-server/presets/common-preset.ts`
- Modify: `code/core/src/shared/open-service/core-service-types.ts`

**Interfaces:**

- Produces: `createStoriesApi(options)`
- Consumes: `previewStories`, `getChangedStories`, `findStoriesByComponent`
- Consumes: existing `RegisterStoriesServiceOptions` dependencies, renamed for API registration

- [ ] **Step 1: Write representative API tests**

Cover `preview` Markdown and JSON results, plus one method using injected dependencies.

- [ ] **Step 2: Run stories API test to verify failure**

Run:

```bash
yarn test stories/api
```

Expected: failure because the definition still exposes an OSA service.

- [ ] **Step 3: Implement and register the API factory**

Add `json` to every method schema. Keep existing structured helper outputs and add compact Markdown
formatters. Replace `registerStoriesService` with `registerStoriesApi`.

- [ ] **Step 4: Run regressions and commit**

Run:

```bash
yarn test find-story-ids preview.test changed.test find-by-component stories/api
```

Expected: all selected tests pass.

```bash
git add code/core/src/shared/open-service/services/stories \
  code/core/src/core-server/presets/common-preset.ts \
  code/core/src/shared/open-service/core-service-types.ts
git commit -m "Move stories capability to defineApi"
```

### Task 4: Move test capability to `defineApi`

**Files:**

- Modify: `code/core/src/shared/open-service/services/test/definition.ts`
- Modify: `code/core/src/shared/open-service/services/test/server.ts`
- Create: `code/core/src/shared/open-service/services/test/format.ts`
- Create or modify: `code/core/src/shared/open-service/services/test/api.test.ts`
- Modify: `code/addons/vitest/src/preset.ts`
- Modify: `code/core/src/shared/open-service/core-service-types.ts`

**Interfaces:**

- Produces: `createTestApi({ channel, getIndex })`
- Consumes: `createAsyncQueue`, `runStoryTests`

- [ ] **Step 1: Write API tests**

Assert the queue-backed handler returns formatted Markdown by default and the existing
`TestRunOutput` object with `json: true`.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
yarn test test/api
```

- [ ] **Step 3: Implement and register the API**

Keep the queue in the factory closure. Replace `registerTestService` with `registerTestApi`.

- [ ] **Step 4: Run regressions and commit**

Run:

```bash
yarn test test/run test/api
```

```bash
git add code/core/src/shared/open-service/services/test code/addons/vitest/src/preset.ts \
  code/core/src/shared/open-service/core-service-types.ts
git commit -m "Move test capability to defineApi"
```

### Task 5: Split review state service from review API

**Files:**

- Modify: `code/core/src/shared/open-service/services/review/definition.ts`
- Modify: `code/core/src/shared/open-service/services/review/server.ts`
- Create: `code/core/src/shared/open-service/services/review/api.ts`
- Create: `code/core/src/shared/open-service/services/review/manager.tsx`
- Modify: `code/core/src/shared/open-service/services/review/server.test.ts`
- Create: `code/core/src/shared/open-service/services/review/api.test.ts`
- Modify: `code/core/src/core-server/server-channel/review-channel.ts`
- Modify: `code/core/src/core-server/server-channel/review-channel.test.ts`
- Modify: `code/core/src/core-server/presets/common-preset.ts`
- Modify: `code/core/src/core-server/presets/common-manager.ts`
- Modify: `code/core/src/shared/open-service/core-service-types.ts`
- Modify: `code/core/src/manager/components/review/components/ReviewProvider.tsx`
- Modify: `code/core/src/manager/components/review/review-actions.ts`

**Interfaces:**

- Produces: genuine `reviewServiceDef` with current state, a current-state query, and state commands
- Produces: `createReviewApi({ getIndex, getOrigin })`
- Preserves: legacy `PUSH_REVIEW` as an adapter into `reviewServiceDef`

- [ ] **Step 1: Write state service and API tests**

Verify `setReview` updates query state, `createReviewApi` validates ids and calls the OSA command,
`consumer: 'mcp'` changes only the Markdown instruction suffix, and `json: true` returns
`{ reviewUrl }`.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
yarn test review/server review/api review-channel
```

- [ ] **Step 3: Implement the stateful service and compatibility bridge**

Move the authoritative review cache and stale flag into OSA state. Keep channel listeners required
by the unchanged production MCP, but make them call OSA commands instead of maintaining another
cache.

- [ ] **Step 4: Register the manager service and subscribe in `ReviewProvider`**

Register `reviewServiceDef` in manager and server realms. Use OSA query state as the payload source,
while retaining `reviewStore` for route, pending-review, transition, and derived UI state.

- [ ] **Step 5: Run review checks and commit**

Run:

```bash
yarn test review/server review/api review-channel review-store
yarn storybook:vitest ReviewPage ReviewWidget
```

```bash
git add code/core/src/shared/open-service/services/review \
  code/core/src/core-server/server-channel/review-channel.ts \
  code/core/src/core-server/server-channel/review-channel.test.ts \
  code/core/src/core-server/presets/common-preset.ts \
  code/core/src/core-server/presets/common-manager.ts \
  code/core/src/shared/open-service/core-service-types.ts \
  code/core/src/manager/components/review
git commit -m "Split review state from public API"
```

### Task 6: Refactor CLI generation and repository guidance

**Files:**

- Modify: `code/core/src/cli/tools/generate-cli.ts`
- Modify: `code/core/src/cli/tools/generate-cli.test.ts`
- Modify: `code/core/src/shared/open-service/service-registry.ts`
- Modify: `code/core/src/shared/open-service/service-registration.test.ts`
- Modify: `code/core/src/server-errors.ts`
- Modify: `AGENTS.md`

**Interfaces:**

- `generateCLI(toolsCommand, apiDefinitions, options)` consumes `AnyApiDefinition[]`
- Uses `invokeApi`, never `getService` or `AnyServiceDefinition`

- [ ] **Step 1: Rewrite CLI tests against `defineApi`**

Cover explicit API selection, deterministic command ordering, validation, Markdown output, JSON
output, `beforeRun`, error propagation, and normalized-name collisions.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
yarn test generate-cli service-registration
```

- [ ] **Step 3: Implement the adapter and remove CLI-only OSA invariants**

Remove query/command collision enforcement from OSA registration. Add API or CLI namespace
invariants where they are now relevant.

- [ ] **Step 4: Update `AGENTS.md`**

Document the OSA, `defineApi`, adapter split and unchanged Milestone 4 and 5 scope.

- [ ] **Step 5: Run tests and commit**

```bash
yarn test generate-cli service-registration public-api
git add code/core/src/cli/tools code/core/src/shared/open-service \
  code/core/src/server-errors.ts AGENTS.md
git commit -m "Generate CLI from defineApi definitions"
```

### Task 7: Format, verify, push, and update PR

**Files:**

- Modify if needed: all touched files after formatting
- External update: PR #35516 title and body

**Interfaces:**

- Consumes: all prior tasks
- Produces: pushed branch and accurate PR metadata

- [ ] **Step 1: Format**

Run:

```bash
cd code && yarn fmt:write
```

- [ ] **Step 2: Run focused runtime tests**

Run:

```bash
yarn test capability-services docs/map find-story-ids preview.test changed.test \
  find-by-component review/server test/run generate-cli public-api
```

Expected: zero failures.

- [ ] **Step 3: Run type and lint checks**

Run:

```bash
yarn nx check core
yarn --cwd code lint:js:cmd core/src/shared/public-api core/src/shared/open-service/services \
  core/src/cli/tools addons/docs/src addons/vitest/src --fix
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 4: Review the complete branch diff**

Confirm production MCP and CLI wiring remain unchanged, no generated files changed accidentally,
and issue #35526 was not edited.

- [ ] **Step 5: Commit formatting or verification fixes**

```bash
git add AGENTS.md code docs/superpowers
git commit -m "Finalize defineApi capability migration"
```

- [ ] **Step 6: Push and update PR**

```bash
git push origin osa-generated-tools-cli
gh pr edit 35516 --repo storybookjs/storybook \
  --title "Core: Define shared public API for CLI and MCP" \
  --body-file /tmp/pr-35516-body.md
```

- [ ] **Step 7: Start babysitting**

Invoke the Cursor babysit workflow for PR #35516. Do not merge the PR.
