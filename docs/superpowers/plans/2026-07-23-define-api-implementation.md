# `defineApi` Milestone 2 Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align PR #35516 with the July 23 update to tracking issue #35526 by making `defineApi` a
minimal definition helper with explicit adapter composition and no registry or CLI implementation.

**Architecture:** Every API handler receives one required `ApiCtx` containing `consumer`, `origin`,
and typed server `getService`. Docs and review are plain definitions; stories and test are factories
over direct boot-time dependencies. OSA remains internal, with only review retaining synchronized
state.

**Tech Stack:** TypeScript, Standard Schema, Valibot, Storybook OSA, Vitest, Storybook story tests.

## Global Constraints

- Do not update tracking issue #35526.
- Do not migrate production MCP adapters.
- Do not implement or expose `storybook tools`; CLI generation is Milestone 5.
- Do not add a public API registry, invocation helper, middleware, SDK, HTTP adapter, or lifecycle.
- Preserve the stateful `core/review` OSA service and the legacy `PUSH_REVIEW` compatibility path.
- Method handlers return Markdown by default and structured data when their schema's `json` field is
  true.
- Run `yarn fmt:write` from `code/` after editing.
- Do not merge PR #35516.

---

### Task 1: Reduce `storybook/public-api` to the definition contract

**Files:**

- Modify: `code/core/src/shared/public-api/definition.ts`
- Modify: `code/core/src/shared/public-api/definition.test-d.ts`
- Modify: `code/core/src/shared/public-api/index.ts`
- Delete: `code/core/src/shared/public-api/registry.ts`
- Delete: `code/core/src/shared/public-api/registry.test.ts`

**Interfaces:**

- Produces: `ApiCtx`, `ApiMethod`, `ApiDefinition`, `AnyApiDefinition`, and `defineApi`.
- Consumes: `TypedGetService<ServerCoreServices>` from
  `code/core/src/shared/open-service/core-service-types.ts`.

- [ ] **Step 1: Rewrite the type test to require the complete context**

Use a `review.create` fixture whose handler proves all context fields and typed service access:

```ts
const reviewApi = defineApi({
  id: 'review',
  description: 'Create a review',
  methods: {
    create: {
      description: 'Create a review',
      schema: v.object({ title: v.string() }),
      handler: async (input, ctx) => {
        expectTypeOf(input.title).toEqualTypeOf<string>();
        expectTypeOf(ctx.consumer).toEqualTypeOf<'cli' | 'mcp'>();
        expectTypeOf(ctx.origin).toEqualTypeOf<string>();
        expectTypeOf(ctx.getService('core/review')).not.toBeAny();
        return input.title;
      },
    },
  },
});
```

Remove expectations that `consumer` is optional and remove registry-related type fixtures.

- [ ] **Step 2: Run the core check and verify the type test fails**

Run:

```bash
yarn nx check core
```

Expected: failure because `ApiCtx` does not yet provide `origin` or `getService`.

- [ ] **Step 3: Implement the minimal definition-only module**

Replace `ApiInvocationContext` with:

```ts
import type { ServerCoreServices, TypedGetService } from '../open-service/core-service-types.ts';

export type ApiConsumer = 'cli' | 'mcp';

export type ApiCtx = {
  consumer: ApiConsumer;
  origin: string;
  getService: TypedGetService<ServerCoreServices>;
};
```

Change `ApiMethod.handler` to:

```ts
handler: (input: StandardSchemaV1.InferOutput<TSchema>, context: ApiCtx) => unknown;
```

Keep `defineApi` as an identity function preserving literal ids and inferred schemas. Change
`index.ts` to export only:

```ts
export { defineApi } from './definition.ts';
export type {
  AnyApiDefinition,
  ApiConsumer,
  ApiCtx,
  ApiDefinition,
  ApiMethod,
} from './definition.ts';
```

Delete the registry implementation and tests.

- [ ] **Step 4: Run the core check**

Run:

```bash
yarn nx check core
```

Expected: remaining failures are limited to capability handlers and tests that still use the old
optional context or `invokeApi`.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/public-api
git commit -m "Reduce defineApi to explicit definitions"
```

---

### Task 2: Make docs a plain context-composed API

**Files:**

- Modify: `code/core/src/shared/open-service/services/docs/definition.ts`
- Modify: `code/core/src/shared/open-service/services/docs/api.test.ts`
- Create: `code/core/src/shared/open-service/services/docs/classify-services.ts`
- Create: `code/core/src/shared/open-service/services/docs/classify-services.test.ts`
- Delete: `code/core/src/shared/open-service/services/docs/api.ts`
- Delete: `code/addons/docs/src/docs-service/server.ts`
- Modify: `code/addons/docs/src/preset.ts`

**Interfaces:**

- Produces: `docsApi`.
- Consumes: `ctx.getService('core/docgen')`, `ctx.getService('core/story-docs')`, and optional
  `ctx.getService(MDX_SERVICE_ID)`.

- [ ] **Step 1: Add failing service-classification tests**

Test that `classifyServices` derives:

```ts
expect(
  classifyServices({
    allDocgen: { button: { type: 'component', name: 'Button' } },
    allStoryDocs: { button: storyDocsPayload },
    allMdx: {
      button: attachedMdxPayload,
      introduction: unattachedMdxPayload,
    },
  }),
).toMatchObject({
  componentIds: ['button'],
  storyBasedIds: new Set(['button']),
  unattachedDocs: new Map([
    ['introduction', expect.objectContaining({ id: 'introduction', name: 'Introduction' })],
  ]),
});
```

Also assert that attached MDX entries populate `attachedDocsByComponent`.

- [ ] **Step 2: Run the classifier test and verify it fails**

Run:

```bash
yarn test classify-services
```

Expected: failure because `classifyServices` does not exist.

- [ ] **Step 3: Implement classification from OSA payload maps**

Add:

```ts
export function classifyServices({
  allDocgen,
  allStoryDocs,
  allMdx,
}: {
  allDocgen: Record<string, DocgenPayload | undefined>;
  allStoryDocs: Record<string, StoryDocsPayload | undefined>;
  allMdx: Record<string, MdxPayload | undefined>;
}): IndexClassification {
  const storyBasedIds = new Set(Object.keys(allStoryDocs));
  const unattachedDocs = new Map<string, DocsIndexEntry>();
  const attachedDocsByComponent = new Map<string, DocsIndexEntry[]>();
  const componentIds = new Set([...Object.keys(allDocgen), ...Object.keys(allStoryDocs)]);

  for (const [id, payload] of Object.entries(allMdx)) {
    if (!payload) {
      continue;
    }
    if (payload.docs[id]) {
      unattachedDocs.set(id, toDocsIndexEntry(id, payload.docs[id].name));
      continue;
    }
    componentIds.add(id);
    attachedDocsByComponent.set(
      id,
      Object.entries(payload.docs).map(([docsId, docs]) => toDocsIndexEntry(docsId, docs.name)),
    );
  }

  return {
    componentIds: [...componentIds].sort(),
    storyBasedIds,
    unattachedDocs,
    attachedDocsByComponent,
  };
}
```

`toDocsIndexEntry` must construct the exact `DocsIndexEntry` fields required by `map.ts`, using
empty `importPath` and `tags` only when those fields are required by the existing type.

- [ ] **Step 4: Rewrite docs API tests around direct handlers**

Create a complete context in `beforeEach`:

```ts
const ctx: ApiCtx = {
  consumer: 'cli',
  origin: 'http://localhost:6006',
  getService: vi.fn((id) => services[id]) as ApiCtx['getService'],
};
```

Parse each input with `v.parse(method.schema, rawInput)` and call:

```ts
await docsApi.methods.list.handler(v.parse(docsApi.methods.list.schema, input), ctx);
```

Assert Markdown, structured output, not-found behavior, and that service lookup happens through
`ctx.getService`. Keep mock implementations in `beforeEach`.

- [ ] **Step 5: Replace the factory with `docsApi`**

Remove `getIndex`, module-global `getService`, `createDocsApi`, and registration. Each handler must
load its required aggregate payloads through `ctx.getService`, derive classification with
`classifyServices`, call the existing `mapDocs*` function, and then return structured data or the
existing formatter result.

For optional MDX:

```ts
function getMdxService(ctx: ApiCtx): MdxService | undefined {
  try {
    return ctx.getService<MdxService>(MDX_SERVICE_ID);
  } catch {
    return undefined;
  }
}
```

Export:

```ts
export const docsApi = defineApi({ id: 'docs', description, methods });
export type DocsApi = typeof docsApi;
```

Remove public API registration from addon-docs while preserving MDX service registration.

- [ ] **Step 6: Run focused docs tests**

```bash
yarn test docs/api classify-services docs/map
```

Expected: all focused docs tests pass.

- [ ] **Step 7: Commit**

```bash
git add code/addons/docs/src code/core/src/shared/open-service/services/docs
git commit -m "Compose docs API through invocation context"
```

---

### Task 3: Narrow stories and test factories to boot-time dependencies

**Files:**

- Modify: `code/core/src/shared/open-service/services/stories/definition.ts`
- Modify: `code/core/src/shared/open-service/services/stories/api.test.ts`
- Create: `code/core/src/shared/open-service/services/stories/resolve-component-matches.ts`
- Create: `code/core/src/shared/open-service/services/stories/resolve-component-matches.test.ts`
- Create: `code/core/src/shared/open-service/services/stories/detect-unreachable-files.ts`
- Create: `code/core/src/shared/open-service/services/stories/detect-unreachable-files.test.ts`
- Delete: `code/core/src/shared/open-service/services/stories/api.ts`
- Modify: `code/core/src/shared/open-service/services/test/definition.ts`
- Modify: `code/core/src/shared/open-service/services/test/api.test.ts`
- Delete: `code/core/src/shared/open-service/services/test/api.ts`

**Interfaces:**

- Produces: `createStoriesApi({ storyIndex, git })` and
  `createTestApi({ channel, storyIndex })`.
- Consumes: `ctx.origin` and `ctx.getService('core/module-graph')`.

- [ ] **Step 1: Rewrite stories API tests for the target dependencies**

Use:

```ts
const storyIndex = { getIndex: vi.fn(async () => index) };
const git = {
  getChangedFiles: vi.fn(async () => ({
    changed: new Set(['src/Button.tsx']),
    new: new Set<string>(),
  })),
};
const ctx: ApiCtx = {
  consumer: 'cli',
  origin: 'http://localhost:6006',
  getService: vi.fn(() => moduleGraph) as ApiCtx['getService'],
};
```

Assert preview reads `ctx.origin`, changed reads git and module graph, and find-by-component resolves
through `ctx.getService`.

- [ ] **Step 2: Add failing graph helper tests**

For `resolveComponentMatches`, cover existing files, missing paths, shortest-depth deduplication,
and module-graph errors. For `detectUnreachableFiles`, cover ready and unavailable graph states and
return only changed files whose `storiesForFiles` result is empty.

- [ ] **Step 3: Run focused stories tests and verify failures**

```bash
yarn test stories/api resolve-component-matches detect-unreachable-files
```

Expected: failures from missing helpers and old factory options.

- [ ] **Step 4: Implement the target stories factory**

Define:

```ts
export type StoryIndexAccess = {
  getIndex: () => Promise<StoryIndex>;
};

export type StoriesGitAccess = {
  getChangedFiles: () => Promise<{
    changed: Set<string>;
    new: Set<string>;
  }>;
};

export type CreateStoriesApiOptions = {
  storyIndex: StoryIndexAccess;
  git: StoriesGitAccess;
};
```

The handlers must:

- use `ctx.origin` plus `storyIndex.getIndex()` for preview;
- read change statuses from `getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID)`;
- pass git's changed and new files through `detectUnreachableFiles`;
- use `ctx.getService('core/module-graph')` in changed and find-by-component;
- call the existing pure mapping and formatting helpers.

Move the current component-path resolver from `common-preset.ts` into
`resolve-component-matches.ts`. Do not add barrel-file behavior beyond the current contract.

- [ ] **Step 5: Rewrite test API tests and factory**

Change its options to:

```ts
export type CreateTestApiOptions = {
  channel: TestChannel;
  storyIndex: StoryIndexAccess;
};
```

Pass `storyIndex.getIndex` to `runStoryTests`. Tests must parse input and call
`createTestApi(...).methods.run.handler(input, ctx)` directly while preserving queue coverage.

- [ ] **Step 6: Run focused tests**

```bash
yarn test stories/api resolve-component-matches detect-unreachable-files test/api test/run
```

Expected: all focused stories and test capability tests pass.

- [ ] **Step 7: Commit**

```bash
git add code/core/src/shared/open-service/services/stories \
  code/core/src/shared/open-service/services/test
git commit -m "Narrow capability factories to runtime dependencies"
```

---

### Task 4: Make review API context-only and keep validation internal

**Files:**

- Modify: `code/core/src/shared/open-service/services/review/api.ts`
- Modify: `code/core/src/shared/open-service/services/review/api.test.ts`
- Modify: `code/core/src/shared/open-service/services/review/server.ts`
- Modify: `code/core/src/shared/open-service/services/review/server.test.ts`

**Interfaces:**

- Produces: plain `reviewApi`.
- Consumes: `ctx.origin` and `ctx.getService('core/review')`.

- [ ] **Step 1: Rewrite review API tests for a plain definition**

Call `reviewApi.methods.create.handler` with parsed input and a full context. Assert:

- empty origin throws `OpenServiceMissingOriginError`;
- service errors propagate unchanged;
- CLI Markdown has no MCP instruction;
- MCP Markdown includes the instruction;
- `json: true` returns `{ reviewUrl }`;
- `ctx.getService('core/review').commands.setReview` receives the review without `json`.

- [ ] **Step 2: Add a failing server validation test**

Register the review service with:

```ts
const getIndex = vi.fn(async () => ({
  v: 5,
  entries: { 'button--primary': storyEntry },
}));
```

Assert unknown story ids throw `OpenServiceUnknownStoryIdsError` and known ids update state.

- [ ] **Step 3: Run focused tests and verify failures**

```bash
yarn test review/api review/server
```

Expected: failures because review remains a factory and validation still lives in the API handler.

- [ ] **Step 4: Move validation into the stateful service**

Change registration to:

```ts
export function registerReviewService({
  getIndex,
}: {
  getIndex: () => Promise<StoryIndex>;
}) {
```

Before setting state, collect unique story ids, compare them against `await getIndex()`, and throw
`OpenServiceUnknownStoryIdsError` for unknown ids. Preserve server-authoritative `createdAt`,
staleness guards, and dismissal behavior.

- [ ] **Step 5: Export plain `reviewApi`**

Remove `CreateReviewApiOptions`, `createReviewApi`, `registerReviewApi`, module-global `getService`,
and `getOrigin`. Use:

```ts
handler: async ({ json, ...review }, ctx) => {
  if (!ctx.origin) {
    throw new OpenServiceMissingOriginError({
      serviceId: 'review',
      operationName: 'create',
    });
  }
  await ctx.getService('core/review').commands.setReview(review);
  const reviewUrl = `${ctx.origin.replace(/\/$/, '')}/?path=/review/`;
  if (json) {
    return { reviewUrl };
  }
  const markdown = `Review created: ${reviewUrl}`;
  return ctx.consumer === 'mcp'
    ? `${markdown}\n\nShow this review URL to the user in your final response.`
    : markdown;
};
```

- [ ] **Step 6: Run review tests**

```bash
yarn test review/api review/server review-channel review-actions
```

Expected: all review API, OSA, compatibility, and action tests pass.

- [ ] **Step 7: Commit**

```bash
git add code/core/src/shared/open-service/services/review
git commit -m "Compose review API through OSA context"
```

---

### Task 5: Remove registration side effects and Milestone 5 CLI work

**Files:**

- Modify: `code/core/src/core-server/presets/common-preset.ts`
- Modify: `code/addons/vitest/src/preset.ts`
- Delete: `code/core/src/cli/tools/generate-cli.ts`
- Delete: `code/core/src/cli/tools/generate-cli.test.ts`
- Modify: `code/core/src/cli/ai/mcp/tool-args.ts`
- Modify: `code/core/src/cli/ai/mcp/tool-args.test.ts`
- Modify: `code/core/src/shared/open-service/service-registry.ts`
- Modify: `code/core/src/shared/open-service/service-registration.test.ts`
- Modify: `code/core/src/server-errors.ts`

**Interfaces:**

- Produces: no runtime public API exposure in Milestone 2.
- Preserves: review OSA registration and legacy review channel.

- [ ] **Step 1: Remove all public API startup registration**

From `common-preset.ts`, remove stories and review API registration plus the inline component graph
resolver. Keep module graph registration. Pass the index dependency to:

```ts
registerReviewService({
  getIndex: () => storyIndexGenerator.getIndex(),
});
```

Keep `initReviewChannel`. Remove test API registration from addon-vitest and docs API registration
from addon-docs. Delete the thin registration modules.

- [ ] **Step 2: Delete CLI generator files**

Delete `generate-cli.ts` and its test. Verify:

```bash
rg "generateCLI|generate-cli" code
```

Expected: no production or test references.

- [ ] **Step 3: Revert only the `rawObjectFlag` argument-parser changes**

Restore the two-argument signature:

```ts
export const parseToolArgs = (
  tokens: string[],
  base: Record<string, unknown> = {}
): ParseResult => {
```

Restore `--json` as the raw object escape and remove only the relocated `--input` tests. Keep
unrelated target-option fixes.

- [ ] **Step 4: Restore OSA's operation-name invariant**

Restore `OpenServiceOperationNameCollisionError`, the service-registry assertion that a query and
command cannot share a name, and its regression test. This returns OSA to its base-branch behavior
after removing the CLI-specific rationale for changing it.

- [ ] **Step 5: Run focused infrastructure tests**

```bash
yarn test tool-args service-registration capability-services
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add code/addons/docs/src code/addons/vitest/src \
  code/core/src/cli code/core/src/core-server/presets/common-preset.ts \
  code/core/src/server-errors.ts code/core/src/shared/open-service
git commit -m "Remove registry and CLI runtime wiring"
```

---

### Task 6: Update guidance, verify the branch, and refresh the PR

**Files:**

- Modify: `AGENTS.md`
- Modify: `.superpowers/sdd/pr-35516-body.md`

**Interfaces:**

- Produces: an accurately documented and verified PR.

- [ ] **Step 1: Update repository guidance**

Document that `defineApi` is definition-only, handlers receive required `ApiCtx`, adapters receive
explicit arrays, MCP migration is Milestone 4, and CLI generation is Milestone 5. Remove wording
that claims `generateCLI` exists in Milestone 2.

- [ ] **Step 2: Format**

```bash
cd code && yarn fmt:write
```

Expected: formatter exits successfully.

- [ ] **Step 3: Run focused unit and contract tests**

```bash
yarn test public-api docs/api classify-services docs/map stories/api \
  resolve-component-matches detect-unreachable-files test/api test/run \
  review/api review/server review-channel review-actions capability-services \
  tool-args service-registration
```

Expected: all selected tests pass.

- [ ] **Step 4: Run component story tests affected by review state**

```bash
cd code
yarn vitest run --config vitest.config.storybook.ts \
  core/src/manager/components/review/ReviewPage.stories.tsx \
  core/src/manager/index.stories.tsx
```

Expected: all selected stories pass.

- [ ] **Step 5: Run type checking and lint**

```bash
yarn nx check core
yarn --cwd code lint:js:cmd \
  core/src/shared/public-api \
  core/src/shared/open-service/services/docs \
  core/src/shared/open-service/services/stories \
  core/src/shared/open-service/services/test \
  core/src/shared/open-service/services/review
```

Expected: both commands pass.

- [ ] **Step 6: Check the diff**

```bash
git diff --check
git status --short
git diff --stat origin/next...HEAD
```

Expected: no whitespace errors; unrelated `kozijnen-chat-history.md` remains untracked and is not
staged.

- [ ] **Step 7: Update the PR description**

The PR body must state:

- no registry and explicit-array exposure;
- required `ApiCtx`;
- plain docs and review APIs;
- stories and test boot-time dependency factories;
- review as the only retained OSA capability service;
- CLI moved to Milestone 5 and MCP kept for Milestone 4;
- exact verification commands and results;
- any output-ordering difference caused by service-derived docs classification.

- [ ] **Step 8: Commit documentation, push, and update PR**

```bash
git add AGENTS.md .superpowers/sdd/pr-35516-body.md
git commit -m "Document explicit defineApi composition"
git push origin osa-generated-tools-cli
gh pr edit 35516 --repo storybookjs/storybook \
  --title "Core: Define shared public API capabilities" \
  --body-file .superpowers/sdd/pr-35516-body.md
```

- [ ] **Step 9: Monitor without merging**

```bash
gh pr checks 35516 --repo storybookjs/storybook --watch --interval 30
```

Fix deterministic in-scope failures, push follow-up commits, and continue monitoring. Do not merge.
