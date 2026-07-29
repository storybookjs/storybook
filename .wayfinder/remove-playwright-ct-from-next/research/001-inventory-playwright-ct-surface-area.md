# Inventory: Playwright CT surface area

Research for wayfinder map **Remove Playwright CT from next** (ticket 001).

**Scope boundary:** Remove only Playwright **Component Testing (CT)** integration — the experimental `@storybook/*/experimental-playwright` export and `createPlaywrightTest` / `createTest` API that wraps `@playwright/experimental-ct-*`. Keep portable stories core (`composeStories`, `composeStory`, `setProjectAnnotations`) for Vitest/Jest; keep Playwright **E2E** (`@playwright/test`, test-runner, repo sandbox E2E).

**Search method:** `rg` across the repo (excluding `.wayfinder/`, `CHANGELOG*`, `.yarn/`) on 2026-07-29. Primary patterns: `createPlaywrightTest`, `experimental-playwright`, `experimental-ct`, `playwright-ct`, `portable-stories-playwright`, `__pw_type`, `__pwUnwrapObject`.

---

## Summary

| Category | CT-only items | Shared (partial CT removal) |
|----------|---------------|----------------------------|
| Core API | `createPlaywrightTest` + Playwright-specific types/globals | `portable-stories.ts` (rest of file) |
| Renderer packages | 3× `src/playwright.ts`, 3× export/build entries | `portable-stories.ts` (Vue comment only) |
| Docs | 1 page, 3 snippets, 1 asset, 2 cross-links | — |
| test-storybooks | ~20 files across react/vue3/svelte (+ stubs in nextjs/svelte) | E2E configs, Vitest browser-playwright |
| CI/NX | `playwright-ct` target, CI step | `playwright-e2e`, `e2e-ui`, repo E2E |
| Dependencies | `@playwright/experimental-ct-{react,vue,svelte}` | `@playwright/test`, `@vitest/browser-playwright` |

**Public API naming:**

- **Core export:** `createPlaywrightTest` from `storybook/preview-api` (and `storybook/internal/preview-api`).
- **User-facing export:** `createTest` from `@storybook/{react,vue3,svelte}/experimental-playwright` (re-export alias).

**No unit tests** cover `createPlaywrightTest`; behavior is validated only by kitchen-sink CT fixtures. **No sandbox templates** outside `test-storybooks/` reference CT. **No MIGRATION.md entry** exists yet for this removal.

---

## CT-only files (remove entirely)

### Core API

| Path | What it is | Removal action |
|------|------------|----------------|
| `code/core/src/preview-api/modules/store/csf/portable-stories.ts` (lines 306–375) | `createPlaywrightTest`, `WrappedStoryRef` / `__pw_type` types, `__pwUnwrapObject` global declare, CT error message linking to docs | Delete function + CT-only types/globals; keep `composeStory`, `composeStories`, `setProjectAnnotations`, `runStory`, etc. |

### Renderer re-exports

| Path | What it is | Removal action |
|------|------------|----------------|
| `code/renderers/react/src/playwright.ts` | Re-exports `createPlaywrightTest as createTest` | Delete file |
| `code/renderers/vue3/src/playwright.ts` | Same | Delete file |
| `code/renderers/svelte/src/playwright.ts` | Same | Delete file |

### Built artifacts (regenerated after source removal)

After recompile, these dist outputs should disappear:

- `code/renderers/react/dist/playwright.js`, `playwright.d.ts`
- `code/renderers/vue3/dist/playwright.js`, `playwright.d.ts`
- `code/renderers/svelte/dist/playwright.js`, `playwright.d.ts`

### Docs — pages, snippets, assets

| Path | What it is | Removal action |
|------|------------|----------------|
| `docs/api/portable-stories/portable-stories-playwright.mdx` | Full Playwright CT portable-stories API page (`createTest`, `setProjectAnnotations` in CT context, story pipeline diagram) | Delete page |
| `docs/_snippets/portable-stories-playwright-ct.md` | Example tests using `createTest` + `@playwright/experimental-ct-*` | Delete |
| `docs/_snippets/portable-stories-playwright-ct-compose-stories.md` | `playwright/index.tsx` setup for CT | Delete |
| `docs/_snippets/portable-stories-playwright-ct-override-globals.md` | Globals override examples for CT portable stories | Delete |
| `docs/_assets/api/story-pipeline-playwright.png` | Story pipeline diagram used only on CT docs page | Delete |

### test-storybooks — active CT fixtures (react, vue3)

| Path | What it is | Removal action |
|------|------------|----------------|
| `test-storybooks/portable-stories-kitchen-sink/react/playwright-ct.config.ts` | CT config (`@playwright/experimental-ct-react`) | Delete |
| `test-storybooks/portable-stories-kitchen-sink/react/stories/Button.playwright.tsx` | CT tests using `createTest` | Delete |
| `test-storybooks/portable-stories-kitchen-sink/react/stories/Button.stories.playwright.ts` | Composed stories for CT browser context | Delete |
| `test-storybooks/portable-stories-kitchen-sink/react/playwright/index.ts` | CT setup (`setProjectAnnotations`) | Delete |
| `test-storybooks/portable-stories-kitchen-sink/react/playwright/index.html` | CT HTML shell | Delete |
| `test-storybooks/portable-stories-kitchen-sink/vue3/playwright.config.ts` | CT config (`@playwright/experimental-ct-vue`) | Delete |
| `test-storybooks/portable-stories-kitchen-sink/vue3/stories/Button.playwright.tsx` | CT tests | Delete |
| `test-storybooks/portable-stories-kitchen-sink/vue3/stories/Button.stories.portable.ts` | Composed stories for CT (vue3 naming) | Delete |
| `test-storybooks/portable-stories-kitchen-sink/vue3/playwright/index.ts` | CT setup | Delete |
| `test-storybooks/portable-stories-kitchen-sink/vue3/playwright/index.html` | CT HTML shell | Delete |

### test-storybooks — partial / stub CT fixtures (svelte)

Svelte has CT scaffolding but CI runs a no-op script today. Still CT-specific and should be removed:

| Path | What it is | Removal action |
|------|------------|----------------|
| `test-storybooks/portable-stories-kitchen-sink/svelte/playwright.config.ts` | CT config (`@playwright/experimental-ct-svelte`) | Delete |
| `test-storybooks/portable-stories-kitchen-sink/svelte/stories/Button.playwright.ts` | Skipped CT test | Delete |
| `test-storybooks/portable-stories-kitchen-sink/svelte/stories/Button.stories.playwright.tsx` | Composed stories for CT | Delete |

---

## Shared files — CT-specific parts to remove vs keep

### Core exports

| Path | Remove (CT) | Keep (shared) |
|------|-------------|---------------|
| `code/core/src/preview-api/index.ts` | `createPlaywrightTest` from line 71 export | All other preview-api exports |
| `code/core/package.json` | — (no separate export path; `createPlaywrightTest` is part of `./preview-api`) | `./preview-api`, `./internal/preview-api` entries unchanged except dropped symbol in types |

### Renderer build config & package exports

| Path | Remove (CT) | Keep (shared) |
|------|-------------|---------------|
| `code/renderers/react/build-config.ts` | `exportEntries: ['./experimental-playwright']` block (lines 34–37) | All other browser/node entries |
| `code/renderers/react/package.json` | `"./experimental-playwright"` export (lines 33–37) | `.`, `./preview`, presets, etc. |
| `code/renderers/vue3/build-config.ts` | `./experimental-playwright` entry | Rest |
| `code/renderers/vue3/package.json` | `"./experimental-playwright"` export | Rest |
| `code/renderers/svelte/build-config.ts` | `./experimental-playwright` entry | Rest |
| `code/renderers/svelte/package.json` | `"./experimental-playwright"` export | Rest |

### Renderer portable-stories (shared — mostly keep)

| Path | Remove (CT) | Keep (shared) |
|------|-------------|---------------|
| `code/renderers/vue3/src/portable-stories.ts` | Comment on line 121 mentioning "Playwright CT" (optional cleanup) | `composeStory`, `composeStories`, `setProjectAnnotations`, JSX-able wrapper for Testing Library / Vitest |
| `code/renderers/react/src/portable-stories.ts` | — | Entire file (no CT-specific code) |
| `code/renderers/svelte/src/portable-stories.ts` | — | Entire file |

### test-storybooks package.json scripts & deps

| Path | Remove (CT) | Keep (shared) |
|------|-------------|---------------|
| `test-storybooks/portable-stories-kitchen-sink/react/package.json` | `"playwright-ct"` script; devDependency `@playwright/experimental-ct-react` | `playwright-e2e`, `@playwright/test`, `@vitest/browser-playwright`, jest/vitest/cypress |
| `test-storybooks/portable-stories-kitchen-sink/vue3/package.json` | `"playwright-ct"` script; devDependency `@playwright/experimental-ct-vue` | cypress, storybook, etc. |
| `test-storybooks/portable-stories-kitchen-sink/svelte/package.json` | `"playwright-ct"` no-op script; devDependency `@playwright/experimental-ct-svelte` | vitest, cypress stub, etc. |
| `test-storybooks/portable-stories-kitchen-sink/nextjs/package.json` | `"playwright-ct"` no-op script | jest, storybook, etc. |
| `test-storybooks/portable-stories-kitchen-sink/react/tsconfig.json` | `"playwright"` from `include` if directory removed | `stories`, `e2e-tests`, `cypress` |
| `test-storybooks/portable-stories-kitchen-sink/vue3/tsconfig.json` | `"playwright"` from `include` if directory removed | Rest |

### CI / NX (partial)

| Path | Remove (CT) | Keep (shared) |
|------|-------------|---------------|
| `scripts/ci/test-storybooks.ts` | Step "Run Playwright CT tests" (`yarn playwright-ct`, lines 54–59) | Jest, Vitest, Cypress steps; Playwright **E2E** step when `playwright-e2e` script exists |
| `nx.json` | `targetDefaults.playwright-ct` block (lines 169–177) | `playwright-e2e` N/A at root; `e2e-ui`, `e2e-tests`, etc. |
| `.github/workflows/nx.yml` | `playwright-ct` in `ALL_TASKS` env (line 31) | All other tasks |
| `test-storybooks/portable-stories-kitchen-sink/vue3/project.json` | `"playwright-ct": {}` target | jest, vitest, cypress |
| `test-storybooks/portable-stories-kitchen-sink/svelte/project.json` | `"playwright-ct": {}` | vitest, etc. |
| `test-storybooks/portable-stories-kitchen-sink/nextjs/project.json` | `"playwright-ct": {}` | jest, etc. |
| `test-storybooks/portable-stories-kitchen-sink/react/project.json` | — (no `playwright-ct` target today; CI invokes script directly) | jest, vitest, cypress, e2e-ui |

---

## Doc cross-links (update or remove)

| Source file | Link / reference | Action |
|-------------|------------------|--------|
| `docs/writing-tests/snapshot-testing.mdx:15` | `[Playwright CT](../api/portable-stories/portable-stories-playwright.mdx)` in portable-stories list | Remove bullet |
| `docs/writing-tests/snapshot-testing.mdx:33` | `[Playwright CT](../api/portable-stories/portable-stories-playwright.mdx#1-apply-project-level-annotations)` in "Get started" list | Remove bullet |
| `code/core/src/preview-api/modules/store/csf/portable-stories.ts:344` | Hard-coded docs URL in CT error message | Removed with function |
| `docs/api/portable-stories/portable-stories-playwright.mdx` | Sidebar entry `sidebar.title: Playwright`, `order: 3` under portable-stories | Page deleted |

**Docs checked with no CT-specific links (keep as-is):**

- `docs/writing-tests/integrations/stories-in-end-to-end-tests.mdx` — Playwright **E2E** via iframe URL (`component-playwright-test.md`), not CT
- `docs/writing-tests/integrations/test-runner.mdx` — jest-playwright / test-runner
- `docs/writing-tests/integrations/vitest-addon/*` — Vitest browser mode uses Playwright as provider, not CT
- `docs/writing-tests/integrations/stories-in-unit-tests.mdx` — generic Playwright mention
- `docs/api/csf/csf-next.mdx` — links to Vitest portable stories only
- `docs/api/portable-stories/portable-stories-vitest.mdx`, `portable-stories-jest.mdx` — separate integrations

---

## CI / NX targets

| Target / job | Location | CT? | Notes |
|--------------|----------|-----|-------|
| `playwright-ct` | `nx.json` `targetDefaults` | **Yes — remove** | Runs `yarn playwright-ct` in project root |
| `playwright-ct` | `test-storybooks/.../vue3|svelte|nextjs/project.json` | **Yes — remove** | Inherits nx default |
| `test-storybooks-portable-{react,vue3,svelte,nextjs}` | `scripts/ci/test-storybooks.ts` | **Partial** | Remove CT step only; job stays for jest/vitest/cypress/e2e |
| `playwright-e2e` | react + react-vitest-3 kitchen sinks | **No — keep** | `@playwright/test` against running Storybook |
| `e2e-ui` | react kitchen sink `project.json` | **No — keep** | NX target for playwright-e2e |
| `e2e-tests`, `e2e-tests-dev`, `test-runner` | `nx.json` | **No — keep** | Sandbox/template E2E |
| `code/playwright.config.ts`, `code/e2e-sandbox/`, `code/e2e-internal/` | Repo E2E suite | **No — keep** | Standard `@playwright/test` |

---

## Dependencies to drop

### CT-only npm packages (remove from kitchen-sink devDependencies)

| Package | Used in |
|---------|---------|
| `@playwright/experimental-ct-react@1.58.2` | `test-storybooks/portable-stories-kitchen-sink/react/package.json` |
| `@playwright/experimental-ct-vue@1.58.2` | `test-storybooks/portable-stories-kitchen-sink/vue3/package.json` |
| `@playwright/experimental-ct-svelte@1.58.2` | `test-storybooks/portable-stories-kitchen-sink/svelte/package.json` |

### Dependencies to **keep** (shared Playwright / portable stories — NOT CT)

| Package | Used for |
|---------|----------|
| `@playwright/test` | E2E tests (kitchen-sink, e2e-internal, e2e-sandbox, sandboxes) |
| `playwright` (browser binary pin) | Resolutions in kitchen-sink fixtures |
| `@vitest/browser-playwright` | Vitest browser mode in react kitchen-sink |
| `eslint-plugin-playwright` | `code/.oxlintrc.json` lint rules for all Playwright test files |

No CT-specific dependencies exist in published `@storybook/react|vue3|svelte` package `dependencies` or `peerDependencies` — only the export surface.

---

## Shared Playwright / portable-stories inventory (explicitly NOT in scope)

These files mention "playwright" but are **not** Playwright CT integration:

### Repo E2E (Playwright test runner against Storybook dev server)

- `code/playwright.config.ts`
- `code/e2e-internal/playwright.config.ts`, `code/e2e-internal/*.spec.ts`, `helpers.ts`
- `code/e2e-sandbox/*.spec.ts`, `storybook.setup.ts`, `util.ts`
- `scripts/tasks/e2e-tests-internal.ts`, `scripts/tasks/e2e-tests-build.ts` (comments only)

### Kitchen-sink Playwright E2E (not CT)

- `test-storybooks/portable-stories-kitchen-sink/react/playwright-e2e.config.ts`
- `test-storybooks/portable-stories-kitchen-sink/react/e2e-tests/*.spec.ts`
- `test-storybooks/portable-stories-kitchen-sink/react-vitest-3/playwright-e2e.config.ts`
- `test-storybooks/portable-stories-kitchen-sink/react-vitest-3/e2e-tests/*.spec.ts`

### Vitest browser provider (Playwright as browser, not CT)

- `test-storybooks/portable-stories-kitchen-sink/react/vite.config.mts` — `@vitest/browser-playwright`
- `test-storybooks/portable-stories-kitchen-sink/react-vitest-3/vitest.workspace.ts` — `provider: "playwright"`

### Portable stories core (Vitest/Jest/Testing Library)

- `code/core/src/preview-api/modules/store/csf/portable-stories.ts` — except CT block
- `code/renderers/*/src/portable-stories.ts`
- `docs/api/portable-stories/portable-stories-vitest.mdx`, `portable-stories-jest.mdx`
- `docs/_snippets/portable-stories-vitest-*.md`, `portable-stories-jest-*.md`

### Test-runner / E2E docs

- `docs/writing-tests/integrations/test-runner.mdx`
- `docs/_snippets/test-runner-*.md`, `test-runner-axe-playwright.md`
- `docs/_snippets/component-playwright-test.md` — E2E iframe navigation

### Lint / telemetry (generic Playwright)

- `code/.oxlintrc.json` — `eslint-plugin-playwright` rules
- `code/core/src/shared/utils/ecosystem-identifier.ts` — `*playwright*`, `@playwright/*` patterns (generic)
- `code/core/src/telemetry/get-known-packages.test.ts` — `playwright` version fixtures

---

## Historical / changelog references (no code action)

| Path | Note |
|------|------|
| `CHANGELOG.md:2446` | PR #27107 added types for `experimental-playwright` exports — historical only |
| `CHANGELOG.prerelease.md` | May contain related entries; no runtime impact |

---

## Removal checklist (for downstream tickets)

1. **Core:** Delete `createPlaywrightTest` + CT types from `portable-stories.ts`; drop export from `preview-api/index.ts`.
2. **Renderers:** Delete `src/playwright.ts`; remove `./experimental-playwright` from `build-config.ts` + `package.json` (react, vue3, svelte).
3. **Compile:** Rebuild renderers + core; verify `dist/playwright.*` gone.
4. **Docs:** Delete CT page, 3 snippets, PNG asset; update `snapshot-testing.mdx` cross-links.
5. **Fixtures:** Remove CT configs, tests, setup dirs, composed-story helper files from kitchen-sink react/vue3/svelte; drop CT scripts/deps from all four package.json files; trim tsconfig `include`.
6. **CI:** Remove CT step from `scripts/ci/test-storybooks.ts`; remove `playwright-ct` from `nx.json`, workflow `ALL_TASKS`, and project.json targets.
7. **Migration:** Add MIGRATION.md entry (ticket 002/006) documenting removal of `@storybook/*/experimental-playwright` and pointing users to Vitest addon or Playwright E2E patterns.

---

## Gaps / open questions

- **Vue `composeStory` JSX wrapper:** The `h(composedStory)` pattern in `vue3/portable-stories.ts` was added partly for CT; it also benefits Testing Library. Keep unless a separate refactor ticket decides otherwise.
- **Telemetry / ecosystem-identifier:** No CT-specific export tracking found; generic `@playwright/*` matching will remain for E2E users.
- **Svelte export surface:** `@storybook/svelte/experimental-playwright` is published but kitchen-sink CT is stubbed/skipped — remove export anyway for consistency with react/vue3.
