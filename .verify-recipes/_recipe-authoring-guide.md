# Recipe Authoring Guide (for LLM recipe-author agents)

This file is the **authoring contract** for agent-generated Playwright recipes in `.verify-recipes/`. The `verify-recipe-author` skill includes this guide verbatim in the prompt; the runner executes the committed spec via `bun x playwright test`.

> **Audience:** an LLM that writes a single `.spec.ts` file for one PR. The output must match the contract below exactly — no exceptions.

---

## 1. Output contract

Emit **one file** at the path specified by the skill: `.verify-recipes/pr-<#>.spec.ts`.

Required shape:

```ts
import { expect, test } from '@playwright/test';

import { RecipePage } from './_util.ts';

test('<short imperative description>', async ({ page }, testInfo) => {
  // ... see rules below ...
});
```

Hard requirements:

- **Imports**: ONLY `@playwright/test` and `./_util.ts`. Nothing else. No `node:*`, no `child_process`, no `fs`, no `@storybook/*`, no relative imports outside `.verify-recipes/`.
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

---

## 4. `RecipePage` API (the only helper)

From `./_util.ts`:

```ts
new RecipePage(page, expect).waitUntilLoaded(): Promise<void>
new RecipePage(page, expect).previewIframe(): FrameLocator
new RecipePage(page, expect).previewRoot(): Locator
new RecipePage(page, expect).waitForStoryLoaded(): Promise<void>
```

- `waitUntilLoaded()` injects a session-storage layout, disables transitions, waits for `.sb-preparing-story` / `.sb-preparing-docs` to vanish, then for the story root to be attached.
- `previewIframe()` returns `page.frameLocator('#storybook-preview-iframe')` — use for any preview-frame assertions.
- `previewRoot()` returns the visible `#storybook-root` (or `#storybook-docs`) inside the preview iframe.

Call `waitUntilLoaded()` immediately after `page.goto(...)`.

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

Kind-ids are kebab-case from the story `title` field; story-ids are kebab-case from the export name. When the PR diff names a `*.stories.tsx` file, derive the kind-id from the file path or the `title:` line in the diff.

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

See `.verify-recipes/example-smoke.spec.ts` for the canonical minimum. Your output should look structurally similar: listeners → goto → `waitUntilLoaded` → assertions → `finally` attach → `expect(pageErrors).toEqual([])`.

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
| `sandbox:<template>` | `yarn task sandbox --template <template>` + `code/core/dist` symlinked into the sandbox's `node_modules/storybook`. | The diff is template-specific (frameworks/builders/renderers) AND the regression is only reproducible inside a generated sandbox. Rare. |

If you choose `sandbox:<template>`, use a template the repo lists in
`code/lib/cli-storybook/src/sandbox-templates.ts` — typically
`react-vite/default-ts`, `react-webpack/default-ts`,
`vue3-vite/default-ts`, or `nextjs/default-ts`.

The header must appear before the first `import` statement. The
parser scans the first 30 lines; an absent or unrecognised header
falls back to `internal-ui`.

## 13. Output budget

- One file, typically 30-80 lines.
- One test, typically 3-8 assertions (counting `await expect(...)` calls).
- No comments except for the section banner the skill prepends and any single-line comment explaining a non-obvious assertion.

If a recipe needs more than ~120 lines, the diff is probably too broad — fall back to the smoke pattern + one targeted assertion.
