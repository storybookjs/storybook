# Recipe Authoring Guide (for LLM recipe-author agents)

This file is the **authoring contract** for agent-generated Playwright recipes in `.verify-recipes/`. The `verify-recipe-author` skill includes this guide verbatim in the prompt; the runner executes the committed spec via `bun x playwright test`.

> **Audience:** an LLM that writes a single `.spec.ts` file for one PR. The output must match the contract below exactly — no exceptions.

---

## 1. Output contract

Emit **one file** at the path specified by the skill: `.verify-recipes/pr-<#>.spec.ts`.

Required shape:

```ts
import { RecipePage, expect, filterPageErrors, test } from './_util.ts';

test('<short imperative description>', async ({ page }, testInfo) => {
  // ... see rules below ...
});
```

Hard requirements:

- **Imports**: ONLY `./_util.ts` (which re-exports `expect`, `filterPageErrors`, and a `test` extended with the harness's auto-failure-capture fixture — captures the preview iframe accessibility snapshot to `iframe-snapshot.md` so the retry loop can feed it back to the next author dispatch). Nothing else. No `node:*`, no `child_process`, no `fs`, no `@storybook/*`, no relative imports outside `.verify-recipes/`. Do not import `test` or `expect` directly from `@playwright/test`; that bypasses the failure-capture fixture.
- **Exactly one `test(...)` call.** No `describe`, no `test.skip`, no `test.only`, no `beforeEach`/`afterEach`.
- **`.ts` extension on relative imports** (`./_util.ts`, not `./_util`).
- **No top-level side effects** — everything inside the `test(...)` callback.

Output is wrapped between fenced markers `<<<SPEC_START>>>` and `<<<SPEC_END>>>` (the skill strips these and writes the body).

---

## 2. Listener-before-goto rule (HARD GATE — AC-V3-3)

`page.on('pageerror', ...)` and `page.on('console', ...)` listeners MUST be registered **before** the first `page.goto(...)` call. The skill's post-write regex check enforces this; if you call `page.goto` first, the spec is rejected.

Canonical pattern:

```ts
test('my recipe', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  // Listeners FIRST. Always.
  page.on('pageerror', (err) => {
    pageErrors.push(err.stack ?? err.message ?? String(err));
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const baseURL =
    process.env.STORYBOOK_URL ?? testInfo.project.use.baseURL ?? 'http://localhost:6006';

  // Now (and only now) navigate.
  await page.goto(`${baseURL}/?path=/story/example-button--primary`);
  // ...
});
```

Never call `page.goto` (or `page.waitForURL`, or any other navigation primitive) before the listeners are attached.

---

## 3. Attach pattern (HARD GATE — AC-V3-4)

The runner harvests `pageErrors` and `consoleErrors` from test attachments. You MUST attach both in a `finally` block (so attachments land even on assertion failure):

```ts
try {
  // ...goto + assertions...
} finally {
  await testInfo.attach('pageErrors', {
    body: JSON.stringify(pageErrors),
    contentType: 'application/json',
  });
  await testInfo.attach('consoleErrors', {
    body: JSON.stringify(consoleErrors),
    contentType: 'application/json',
  });
}
```

Attachment names are exactly `pageErrors` and `consoleErrors`. The body is JSON-stringified array of strings (already accumulated by the listeners).

### Filtering known low-signal pageErrors

When you assert `pageErrors` at the end of the recipe, wrap the array in
`filterPageErrors(...)` from `./_util.ts`:

```ts
expect(filterPageErrors(pageErrors)).toEqual([]);
```

`filterPageErrors` drops upstream-known noise — currently the cross-origin
`SecurityError: Failed to read the 'sessionStorage' property from 'Window'`
that `@storybook/addon-mcp` emits on every internal-ui boot when its
composed-ref auth probe touches chromatic-hosted iframes. The runner's
`computeVerdict` applies the same filter on the attachment side, so
**`filterPageErrors(pageErrors)` keeps the local assertion in sync with the
runner's verdict logic** and prevents a "regression" verdict driven entirely
by environmental noise. Never assert on the raw `pageErrors` array.

---

## 4. `RecipePage` API (the only helper)

From `./_util.ts`:

```ts
new RecipePage(page, expect).waitUntilLoaded(): Promise<void>
new RecipePage(page, expect).previewIframe(): FrameLocator
new RecipePage(page, expect).previewRoot(): Locator
new RecipePage(page, expect).waitForStoryLoaded(): Promise<void>
new RecipePage(page, expect).scratchDir: string
new RecipePage(page, expect).writeFixture(relPath: string, contents: string): string
```

- `waitUntilLoaded()` injects a session-storage layout, disables transitions, waits for `.sb-preparing-story` / `.sb-preparing-docs` to vanish, then for the story root to be attached.
- `previewIframe()` returns `page.frameLocator('#storybook-preview-iframe')` — use for any preview-frame assertions.
- `previewRoot()` returns the visible `#storybook-root` (or `#storybook-docs`) inside the preview iframe.
- `scratchDir` is the absolute path of `$PR_HEAD_DIR/.verify-scratch` — the **only** sanctioned on-disk write location for recipes.
- `writeFixture(relPath, contents)` writes a file under `scratchDir` (parent dirs auto-created) and returns its absolute path. `relPath` must be relative and stay inside the scratch dir.

Call `waitUntilLoaded()` immediately after `page.goto(...)`.

### Writing fixtures to disk (non-visual recipes)

Most recipes only drive the browser and never touch the filesystem. A
non-visual recipe (behavioral / pure-fn / type-only / build-config) that must
write a fixture or config to exercise a code path **must** use
`writeFixture()` / `scratchDir` — never write elsewhere.

The harness runs recipes inside an `srt` jail. `$GITHUB_WORKSPACE` and `.git`
are **denyWrite**; `$PR_HEAD_DIR` (which contains `.verify-scratch`) is
**allowWrite**. The scratch dir is pre-created by the prepare composite and
gitignored. Do not attempt to widen the jail or write to the repo checkout —
a recipe that does will fail at runtime, not be granted access.

```ts
const sb = new RecipePage(page, expect);
const cfgPath = sb.writeFixture('preview-head.html', '<meta name="x" content="1">');
// hand cfgPath to the code under test, then assert on the resulting behavior
```

---

## 5. Selectors and locators

Preferred (in priority order):

1. `page.getByRole(...)` — accessibility-tree queries, most stable
2. `page.getByTestId(...)` / `data-testid` selectors
3. ID selectors (`#storybook-preview-iframe`, `#sb-errordisplay`, `#storybook-root`)
4. Class selectors that look stable (`.sb-preparing-story` etc.)

Avoid:

- `:nth-child(N)` chains — break on layout shifts
- Brittle class chains (`.foo .bar .baz > div`)
- Free-text matches without `i18n` context
- `setTimeout` / `page.waitForTimeout` for synchronization — use Playwright web-first assertions or `RecipePage.waitUntilLoaded()`

---

## 6. Story URL routing

- Story: `?path=/story/<kind-id>--<story-id>` (e.g., `/?path=/story/example-button--primary`)
- Docs: `?path=/docs/<kind-id>--<story-id>` (e.g., `/?path=/docs/example-button--docs`)
- Manager only (no story): omit the `path` param or use `?path=/`

**Use the routes the harness pre-computes for you.** The prompt bundle contains a "Story routes (computed deterministically by the harness)" section that lists, for each `*.stories.{ts,tsx,mdx}` file referenced by the diff (or imported by a sibling of a touched non-stories source file), the canonical title, the per-export `storyId`, and the matching `storyUrl` / `docsUrl`. These come from Storybook's own auto-title + `toId` algorithms, so they match what the indexer would emit at runtime.

Past dispatches that hand-derived kebab-case kind-ids (`addons-controls-object--basic`, `addons-controls-basics--docs`, …) have 404'd because Storybook's auto-title pipeline mangles paths differently than a naive kebabify (leaf/dir dedupe, `index.stories.ts` collapsing, `titlePrefix` interplay, etc). Always prefer the routes the harness emits.

If the section is absent (because the diff doesn't touch any code under `code/` or because no sibling story imports the changed module), fall back to the manager-only route `?path=/` and rely on sidebar-driven navigation. Do not invent a URL.

---

## 7. Frame access

- Manager DOM (toolbar, sidebar, addon panels): use `page` directly.
- Preview iframe DOM (the story itself): use `page.frameLocator('#storybook-preview-iframe')` or `recipe.previewIframe()`.

Example:

```ts
const recipe = new RecipePage(page, expect);
await recipe.waitUntilLoaded();

const previewIframe = recipe.previewIframe();
const button = previewIframe.getByRole('button', { name: /primary/i });
await expect(button).toBeVisible();
```

---

## 8. Assertions — what counts as a meaningful recipe

A **smoke-shaped recipe** is the minimum: navigate to a story, wait until loaded, assert preview-root has children, `#sb-errordisplay` is hidden, screenshot the iframe, attach errors. See `example-smoke.spec.ts` for the canonical form.

A **targeted recipe** goes further. Examples per change type:

| Diff touches | Recipe should additionally |
|---|---|
| `code/addons/<name>/**` | Open the addon panel (`recipe.previewIframe()` may be irrelevant; manager queries needed); assert addon-tab present; trigger the addon's primary interaction |
| `code/core/src/manager/**` | Assert sidebar entries render; navigate between two stories; assert URL update |
| `code/core/src/manager-api/**` | Assert at least one channel-bound UI element responds (e.g., theme toggle, tab switch) |
| `code/core/src/csf-tools/**` | Open a story whose CSF the PR touches; assert it indexes (visible in sidebar tree) |
| `code/core/src/preview-api/**` | Open a story with args/decorators in scope; assert `previewRoot()` rendered without errordisplay |
| `code/frameworks/<name>/**` | Use the framework's reference template story (e.g., svelte → svelte-vite default story); confirm SSR/CSR hydration shape if applicable |
| `code/builders/**` | Assert preview-iframe loads at all (builder errors surface here); navigate to a story; confirm HMR not needed for static load |

Pick the assertion shape that most directly observes the changed code path. Prefer 1-3 focused assertions over a long list — the runner harvests pageerrors/consoleerrors orthogonally.

---

## 8.1 Evidence requirement (HARD GATE for single-round CI)

In single-round CI mode the assertions + screenshots ARE the evidence the harness reports as "verified". A smoke recipe that asserts unrelated story behaviour is technically passable but **does not verify the diff** — the PR comment will mislead reviewers. Treat this section as a hard authoring gate.

Before emitting the spec, work through the following four questions explicitly:

1. **What does this PR visibly or behaviourally change?** Read the diff carefully. Icon swap, text change, conditional render branch, focus / hover / dark-mode state, addon panel content, sidebar tree, URL params, computed style — all qualify.
2. **What UI state is required to see the change?** Common gates:
   - **Conditional render** — e.g. `if (newCount === 0 && modifiedCount === 0) return null`. The element only mounts when its predicate is true. Identify the predicate's inputs and either set them via `page.evaluate(...)` against the manager-api / universal store, set localStorage / sessionStorage keys, or navigate to a route that produces the required state.
   - **Feature flags** — `globalThis.FEATURES.changeDetection` and similar flags are **enabled by default** in the internal-ui Storybook. The diff itself is the only authoritative source for whether a new flag must be set.
   - **Theme / dark-mode** — pass `?globals=theme:dark` in the URL or set the theme via `manager-api` once the manager mounts.
   - **Focus / hover / keyboard-only states** — use `.focus()`, `.hover()`, `page.keyboard.press('Tab')`. Many a11y-related PRs only render their change in these states.
   - **Specific story route** — when the diff names a specific component, navigate to the story that mounts it, not the generic `example-button--primary`.
3. **Before deciding the trigger state is unreachable, walk through every affordance listed in the next subsection.** For each one, decide whether it applies to this diff. Most "I can't do this without `fs.*`" assumptions turn out to be wrong because Storybook's own in-app machinery exposes a path: Save from Controls writes story files via csf-tools, `page.evaluate` reaches manager-api setters, URL globals flip theme/args, and so on. **Only after explicitly considering each affordance and rejecting it with a one-sentence reason** may you fall back to: render the surrounding container, assert `#sb-errordisplay` is hidden, assert `expect(filterPageErrors(pageErrors)).toEqual([])`. The bare phrase "working-tree mutation required" is **not** a valid fallback justification — Save from Controls satisfies that exact need without ever touching `fs.*`. The fallback is reserved for cases where (a) the diff is non-visual at all (pure type/logic refactor), or (b) the visible effect depends on env state outside the runner's reach. Either way, state the rejected affordances in the spec comment so a reviewer can audit the reasoning.
4. **Screenshot the region containing the changed UI**, not the whole page. Use `locator.screenshot({ path: testInfo.outputPath('<name>.png') })` against the parent of the changed element (e.g. `.sidebar-container` for sidebar diffs, the addon-panel locator for addon panels, the docs `[role="table"]` for ArgsTable changes). Full-page or generic preview screenshots are acceptable only for layout-wide changes. The PR comment renders every screenshot you attach inline — reviewers should see the change in the image.

### Affordances Playwright recipes have for setting up trigger state

The deny-regex blocks `fs.*` and `child_process` inside the spec body. That does **not** mean the test cannot reach state that lives on disk — Storybook's own in-app machinery exposes plenty of paths. Before declaring a trigger state unreachable, consider:

- **URL params for navigation, theme, args, globals, and docs vs story modes.**
  - `?path=/story/<kind-id>--<story-id>` and `?path=/docs/<kind-id>--<story-id>` for story / docs routes.
  - `?globals=theme:dark` (or whatever global the renderer exposes) to flip dark-mode and other globals without clicking the toolbar.
  - `?args=name:Hello` to seed initial arg values for a story.
- **`page.evaluate(...)` against the manager-api.** Storybook exposes its manager-api on `window` once the manager mounts — useful when a feature has a public toggle / setter that recipes can call directly. Inspect the diff for an `experimental_*` or `api.*` setter the change relies on and call it from the recipe.
- **Save from Controls (csf-tools write-back) for change-detection-style features.** The Controls addon's save button is enabled by default. The recipe opens a story (e.g. `example-button--primary`), clicks the Controls tab (`getByRole('tab', { name: /controls/i })`), edits a control value (e.g. the `label` input), and clicks **`Save changes to story`** (aria-label) / **`Update story`** (visible text) — i.e. `getByRole('button', { name: /save changes to story|update story/i })`. Storybook's csf-tools writes the modified args back to the underlying `*.stories.tsx` file on the runner's PR-head workspace. The change-detection scanner reads uncommitted working-tree state, so the Save-driven edit flips the story's status to MOD and surfaces change-detection UI (e.g. `ReviewChangesButton`'s clear button) in the sidebar. The recipe never touches `fs.*` directly — Storybook does the write.
- **Keyboard / focus / hover.** `.focus()`, `.hover()`, `page.keyboard.press('Tab')`, `page.keyboard.press('Escape')`. Many a11y / interaction PRs only render their change in these states.
- **localStorage / sessionStorage / cookies.** Read or write via `page.evaluate(...)` when the change depends on persisted UI state (e.g. sidebar collapse, recently-viewed list).
- **Manager-side state via `__STORYBOOK_*` globals.** When the diff touches preview-api or manager-api code that exposes a development hook on `globalThis`, prefer `page.evaluate(() => globalThis.__STORYBOOK_*…)` over reverse-engineering a click sequence.

Only fall back to the §8.1.3 "trigger state is genuinely unreachable" path after walking through the affordances above and confirming none apply to the diff at hand. If none apply, say so explicitly in a single-line comment in the spec body and limit the assertions to module-resolution + pageerror — the harness's evidence-check will report the gap honestly to reviewers.

### Worked example — focus ring on a selected sidebar item

```ts
await page.goto(`${baseURL}/?path=/story/example-button--primary`);
await new RecipePage(page, expect).waitUntilLoaded();

const selected = page.locator(
  '[data-item-id="example-button--primary"][data-selected="true"]',
);
await selected.focus(); // trigger the focus-ring state

await expect(selected).toHaveCSS('box-shadow', /inset.+2px/i);

// Screenshot the sidebar region — the focus ring is visible here:
await page.locator('.sidebar-container').screenshot({
  path: testInfo.outputPath('sidebar-focus-ring.png'),
});
```

### Worked example — icon swap inside a conditionally-rendered, change-detection-gated button

`ReviewChangesButton` (and its clear button containing the icon under test) only renders when at least one story has status NEW or MOD. We use **Save from Controls** to mutate a story file on the working tree; the change-detection scanner picks the uncommitted edit up and flips the story's status, which causes `ReviewChangesButton` to mount. The recipe never calls `fs.*` directly — Storybook's csf-tools does the write.

```ts
await page.goto(`${baseURL}/?path=/story/example-button--primary`);
const recipe = new RecipePage(page, expect);
await recipe.waitUntilLoaded();

// 1. Open the Controls panel and edit a control value.
const controlsTab = page.getByRole('tab', { name: /controls/i });
await controlsTab.click();
const labelInput = page.locator('input[name="label"], textarea[name="label"]').first();
await labelInput.fill('Verify harness saved this');

// 2. Save from Controls — csf-tools writes the edit back to the story file on
//    the runner's working tree. The button in this Storybook is
//    aria-labelled "Save changes to story" with visible text "Update story";
//    match on either to stay robust across label drift.
const saveButton = page.getByRole('button', { name: /save changes to story|update story/i });
await expect(saveButton).toBeVisible({ timeout: 10000 });
await saveButton.click();

// 3. Change-detection now sees the story as MOD; the review toggle mounts.
//    NOTE: it is rendered as an aria `switch`, NOT a `button`. Match accordingly.
const reviewToggle = page.getByRole('switch', { name: /review.+stories/i });
await expect(reviewToggle).toBeVisible({ timeout: 15000 });

// 4. Activate review mode so the *clear* button (which carries the diff's icon) renders.
await reviewToggle.click();
const clearButton = page.getByRole('button', { name: /^clear$/i });
await expect(clearButton).toBeVisible({ timeout: 10000 });

// 5. Screenshot the sidebar region — the new UndoIcon is inside the clear button.
await page.locator('.sidebar-container').screenshot({
  path: testInfo.outputPath('sidebar-with-clear-button.png'),
});
```

This pattern (Save from Controls → wait for status flip → screenshot the now-visible UI) is the canonical answer for any diff that touches change-detection-gated UI. The closing `expect(filterPageErrors(pageErrors)).toEqual([])` in the standard footer covers module-resolution as a free bonus.

---

## 9. What to AVOID (skill's deny-regex enforces several of these)

| Pattern | Why |
|---|---|
| `import ... from 'child_process'` / `require('child_process')` | Recipes never spawn subprocesses |
| `fs.unlink`, `fs.rm`, `fs.rmdir`, `fsp.unlink`, etc. | Recipes never delete files |
| `process.exit(...)` | Playwright handles test exit codes; never short-circuit |
| `eval(...)` | Never. Use `page.evaluate(...)` if you need in-browser execution |
| `import 'node:...'` (Node-only modules) | Recipes are Playwright-test files, not orchestration scripts |
| `@storybook/...` direct imports | Adds the non-erasable TS-enum chain that breaks under bun's strip-types path |
| `page.waitForTimeout(N)` | Always avoid time-based waits; use web-first assertions |
| `test.only`, `test.skip`, `describe.only` | Single test only; no skipping |
| Network calls (`fetch`, `axios`, etc.) inside the spec body | Storybook is local; no external endpoints |

---

## 10. Header comment provenance (the skill prepends this)

After you emit your spec body, the `verify-recipe-author` skill prepends a block comment with `{ generatedAt, agentModel, prNumber, referenceSpecs, triageGlobs }`. Do NOT emit this yourself — the skill owns it.

---

## 11. Worked example (reference shape)

See `.verify-recipes/example-smoke.spec.ts` for the canonical minimum. Your output should look structurally similar: listeners → goto → `waitUntilLoaded` → assertions → `finally` attach → `expect(filterPageErrors(pageErrors)).toEqual([])`.

---

## 12. Target selection (v6)

Pick one of two execution targets via a single-line header comment as
the **first non-empty line** of the spec:

```ts
// @verify-target: internal-ui
// or:
// @verify-target: sandbox:react-vite/default-ts
```

| Target | What the harness boots | Pick when |
|---|---|---|
| `internal-ui` (default if header absent) | `code/storybook-static/` served via `http-server`. Built once from the PR-head monorepo. | The diff touches a package that the internal Storybook UI exercises (manager, manager-api, channels, core-server, addons, csf-tools, preview-api). This is the right answer for ~all PRs. |
| `sandbox:<template>` | `yarn task sandbox --template <template>` + `code/core/dist` symlinked into the sandbox's `node_modules/storybook`. | The diff is template-specific (frameworks/builders/renderers) AND the regression is only reproducible inside a generated sandbox. |

**Strong sandbox-target signals (pick `sandbox:<template>` when):**
- Diff touches `code/renderers/<r>/template/cli/**` or `code/frameworks/<r>/template/cli/**` — these files only exist inside generated sandboxes; internal-ui never imports them.
- Diff touches build/runtime code of a non-react renderer or framework (`code/renderers/vue3/src/**`, `code/frameworks/svelte-vite/src/**`, `code/frameworks/nextjs/src/**`, `code/frameworks/nextjs-vite/src/**`, …) where internal-ui has no equivalent story.

Pick the matching template:
- `code/renderers/vue3/**` or `code/frameworks/vue3-vite/**` → `sandbox:vue3-vite/default-ts`
- `code/renderers/svelte/**` or `code/frameworks/svelte-vite/**` → `sandbox:svelte-vite/default-ts`
- `code/frameworks/nextjs-vite/**` → `sandbox:nextjs-vite/default-ts` (Vite-based Next.js builder; **do NOT pick `sandbox:nextjs/default-ts` for nextjs-vite changes** — the webpack-based nextjs sandbox compile-fails on nextjs-vite-specific code paths)
- `code/frameworks/nextjs/**` → `sandbox:nextjs/default-ts` (webpack-based Next.js; reserve for changes scoped to the webpack framework only)
- `code/renderers/react/**` only when internal-ui can't reach the change → `sandbox:react-vite/default-ts`

If you choose `sandbox:<template>`, use a template the repo lists in
`code/lib/cli-storybook/src/sandbox-templates.ts`. The workflow allowlists:
`react-vite/default-ts`, `react-webpack/default-ts`,
`vue3-vite/default-ts`, `svelte-vite/default-ts`,
`angular-cli/default-ts`, `nextjs/default-ts`,
`nextjs-vite/default-ts`.

### Triage rule for nextjs vs nextjs-vite (HARD GATE)

`code/frameworks/nextjs/` (webpack-based) and `code/frameworks/nextjs-vite/`
(Vite-based) are **separate packages** with **incompatible builders**.
A spec that targets `sandbox:nextjs/default-ts` for a diff that only touches
`code/frameworks/nextjs-vite/**` will compile-fail mid-boot inside Webpack
and produce a misleading regression verdict.

Before emitting the spec target:

1. If **any** changed path matches `code/frameworks/nextjs-vite/**`, the
   target MUST be `sandbox:nextjs-vite/default-ts`. The Vite framework
   has its own builder pipeline, runtime shims, and `next/*` mocks that
   the webpack framework does not exercise.
2. If **only** `code/frameworks/nextjs/**` paths change (webpack-only),
   the target is `sandbox:nextjs/default-ts`.
3. If both change, prefer `sandbox:nextjs-vite/default-ts` (it is the
   forward-going framework) and call out the dual-touch in the diff
   coverage comment.

The header must appear before the first `import` statement. The
parser scans the first 30 lines; an absent or unrecognised header
falls back to `internal-ui`.

### Triage rule for addon-docs / Controls / Stories-block changes (HARD GATE)

Internal-ui does NOT render every addon-docs surface. Diffs that touch:

- `code/addons/docs/src/blocks/**` (Stories, Controls, ArgsTable, Source, Canvas blocks)
- `code/core/src/preview-api/modules/preview-web/docs-context/**`

require a **sandbox** target so the docs page renders end-to-end via the
MDX pipeline. Use `sandbox:react-vite/default-ts` by default for these.

Symptom of the wrong target: recipe hits
`TimeoutError: locator.waitFor: ... '#storybook-preview-iframe').contentFrame().locator('#storybook-root:visible, #storybook-docs:visible')`
because internal-ui never reached the docs page for that addon block.

### Triage rule for ActionBar / Canvas action buttons (HARD GATE)

ActionBar lives **inside** a story Canvas. Its action buttons (Show code,
Zoom in/out, Reset) only appear after the user hovers the Canvas. Recipes
testing ActionBar focus / aria / variants must:

1. Use a **sandbox** target (`// @verify-target: sandbox:react-vite/default-ts`).
   ActionBar renders on the docs page; internal-ui does not mount addon-docs
   Canvas reliably for arbitrary stories.
2. Navigate to the docs page that mounts a Canvas (a story with
   `tags: ['autodocs']` or `parameters.docs.canvas`).
3. **Scope to the Canvas first, then hover it**, then locate the toolbar.
   The action buttons are absolutely-positioned and `opacity:0` until the
   Canvas (`.docs-story` / `[class*="docs-story"]`) is hovered:

```ts
const canvas = recipe.previewRoot().locator('.docs-story, [class*="docs-story"]').first();
await canvas.scrollIntoViewIfNeeded();
await canvas.hover();
const toolbar = canvas.getByRole('toolbar');
await expect(toolbar).toBeVisible();
const showCode = toolbar.getByRole('button', { name: /show code/i });
await expect(showCode).toBeVisible();
```

HARD prohibitions (each produced a false regression in eval):
- Do NOT `getByRole('button', { name: /show code/i })` at iframe root —
  also matches every `<Source>` block's own Show-code and resolves to a
  hidden one with `.first()`.
- Do NOT chain `.docs-story.first().getByRole('button', …).first()`
  WITHOUT a `hover()` first — buttons stay `opacity:0`, `toBeVisible()`
  times out.
- Do NOT assert the toolbar/buttons without `scrollIntoViewIfNeeded()` —
  off-screen Canvas keeps the ActionBar unrendered.

Symptom of the wrong approach:
`expect(locator).toBeVisible() failed Locator: ... .docs-story').first().getByRole('button', { name: /show code/i }).first()`
— Canvas not hovered / not scrolled into view.

### Triage rule for sidebar item interactions (HARD GATE)

Sidebar items use a tree structure. Leaf items (`[data-nodetype="story"]`,
`[data-nodetype="component"]`) start collapsed under their parent group.
Recipes asserting a leaf is visible must FIRST expand the parent:

```ts
// expand the group before asserting the leaf
await this.page.locator('[data-item-id="example"]').click();
await expect(this.page.locator('[data-item-id="example-button"]')).toBeVisible();
```

Symptom of skipping the expand step:
`expect(locator).toBeVisible() failed … 14 × locator resolved to <div data-selected="false" data-parent-id="example" data-highlightable="true" …>`
— the element exists in DOM but stays hidden under the collapsed parent.

### Triage rule for `.first()` on iframe locators (HARD GATE)

Many Storybook DOM trees have BOTH an `aria-hidden="true"` placeholder
element AND the real visible element with the same tag/role. Calling
`.first()` selects the hidden placeholder and times out.

Replace `.first()` with one of:

- `.locator(':visible')` — Playwright filters to visible elements before `.first()`.
- `:not([aria-hidden="true"])` CSS filter — `locator('table:not([aria-hidden])').first()`.
- `getByRole(...)` (which already excludes aria-hidden by default).

Symptom of `.first()`-on-hidden:
`expect(locator).toBeVisible() failed … 19 × locator resolved to <table aria-hidden="true" class="sb-…">`

## 12.5 Mode selection — visual vs behavioral (HARD GATE)

Orthogonal to `@verify-target` (WHERE it runs), `@verify-mode` picks the
verdict STRATEGY. Second single-line header, after `@verify-target`:

```ts
// @verify-target: internal-ui
// @verify-mode: behavioral
```

| Mode | Pick when | Verdict basis |
|---|---|---|
| `visual` (default if header absent) | The change is **something you can see** — a new icon, label text, focus ring, color/theme, layout, an added panel item. | Playwright run **+ vision evidence-check** on a screenshot (§8.1 applies — you MUST capture a screenshot of the changed state). |
| `behavioral` | The change has **no visible surface** — ARIA/role/`aria-*` attributes, screen-reader semantics, event-handler wiring, console-error-free boot, XSS/escaping/sanitization, focus management, keyboard nav, network/request behavior. | Playwright DOM/ARIA/console assertions **only**. Vision is **skipped** — there is nothing to screenshot. §8.1's screenshot requirement is replaced by concrete `expect(...)` assertions on the DOM/attributes/console. |

**HARD GATE — pick `behavioral` when the diff is any of:**
- adds/changes `aria-*`, `role`, `tabindex`, `alt`, `title`, label associations, or other accessibility attributes with no visual delta;
- changes escaping/sanitization/`dangerouslySetInnerHTML`/XSS handling — assert the payload is **inert** in the DOM (e.g. text content present but no injected `<script>` / no executed handler), not a screenshot;
- changes an event handler, focus order, keyboard interaction, or console-error behavior with identical pixels.

A `visual` recipe for an aria/XSS/behavioral diff will produce a screenshot
that looks identical before and after → vision returns `undetermined` → weak
or wrong verdict. That is exactly the gap `behavioral` closes.

**Do NOT use `pure-fn` or `build-config` yet.** The parser accepts them but
the orchestrator is not wired for them — a recipe with those modes is
reported `skipped` and **never executed**. Until they ship, a pure-logic /
module-internal change still goes through `behavioral`.

**HARD GATE — never reach the changed module directly.** A `behavioral`
recipe asserts the change's *observable effect* through the real running
Storybook UI. It must NOT, inside `page.evaluate()` or anywhere:

- `import()` / dynamic-import a `dist`, `node_modules`, or source module
  (e.g. `import('/node_modules/@storybook/addon-a11y/dist/a11yRunner.mjs')`);
- monkeypatch module internals, stub `axe`/globals, or `eval` arbitrary code
  to invoke the changed function.

The deny-regex gate rejects these patterns **before any Playwright run** —
the recipe never executes and the PR gets *no verdict*. This is the #1
behavioral foot-gun for pure-logic diffs.

Instead: drive the feature through its **public UI path** so the changed
code runs as a side effect, then assert what the user/DOM/console observes
(e.g. for an a11y-runner change: open the a11y addon panel on a story and
assert the violations/rules it surfaces; for a sanitizer change: render the
untrusted input through the real component and assert the DOM is inert). If
the change has **no reachable UI path at all**, fall back to
`@verify-mode: visual` with a smoke recipe + `filterPageErrors(...)` console
assertion — a weak signal beats a deny-regex no-verdict. Do **not** fabricate
a module import to force coverage.

`as any` is allowed and expected when reaching runtime globals inside
`page.evaluate()` (`(window as any).__STORYBOOK_ADDONS_MANAGER`, the
manager-api singleton, `__STORYBOOK_ADDONS_CHANNEL__`). The recipe ESLint
config disables `no-explicit-any` — do not waste retries trying to type these;
just cast and assert the observable effect.

### Worked example — aria-label added to a toolbar button (behavioral)

```ts
// @verify-target: internal-ui
// @verify-mode: behavioral
import { RecipePage, expect, filterPageErrors, test } from './_util.ts';

test('toolbar zoom-in button exposes the new aria-label', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.stack ?? e.message ?? String(e)));

  const baseURL =
    process.env.STORYBOOK_URL ?? testInfo.project.use.baseURL ?? 'http://localhost:6006';
  try {
    await page.goto(`${baseURL}/?path=/story/example-button--primary`);
    const sb = new RecipePage(page, expect);
    await sb.waitUntilLoaded();

    // The change has no visible delta — assert the accessibility attribute
    // directly. No screenshot: this is a behavioral recipe.
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    await expect(zoomIn).toBeVisible();
    await expect(zoomIn).toHaveAttribute('aria-label', 'Zoom in');
  } finally {
    await testInfo.attach('pageErrors', {
      body: JSON.stringify(pageErrors),
      contentType: 'application/json',
    });
  }
  expect(filterPageErrors(pageErrors)).toEqual([]);
});
```

## 13. Output budget

- One file, typically 30-80 lines.
- One test, typically 3-8 assertions (counting `await expect(...)` calls).
- No comments except for the section banner the skill prepends and any single-line comment explaining a non-obvious assertion.

If a recipe needs more than ~120 lines, the diff is probably too broad — fall back to the smoke pattern + one targeted assertion.
