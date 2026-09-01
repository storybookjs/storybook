# FINDINGS — Inkline / Storybook 10.6.0-beta.0 QA

## Summary

| Sev | Count |
| --- | --- |
| S1 | 0 |
| S2 | 1 |
| S3 | 4 |
| S4 | 1 |

Classifications below separate **Storybook regressions / CLI gaps**, **project/dependency setup**, and **environment** issues.

---

## F1 — `storybook upgrade` does not update pnpm catalog Storybook entries

- **sev:** S2
- **project/version/env:** Inkline monorepo @ `b5ce93e7`; `storybook@next` = `10.6.0-beta.0`; Node 22.22.3; pnpm 11.6.0; catalog in `pnpm-workspace.yaml`
- **expected:** After `pnpm dlx storybook@next upgrade`, all Storybook catalog entries (`storybook`, `@storybook/vue3-vite`, `@storybook/addon-docs`, `@storybook/addon-a11y`, `@storybook/react-vite`, etc.) and lock resolutions reach exact next (`10.6.0-beta.0`).
- **actual:** Catalog left at `^10.4.4` (lock still has widespread `10.4.4`). Only `ui/vue/package.json` was rewritten to exact `10.6.0-beta.0`. `@inkline/storybook-app` and other frameworks remain on catalog → **10.4.4**. Doctor after upgrade reports mismatching versions. Contrast: `storybook add @storybook/addon-vitest` **did** add `'@storybook/addon-vitest': 10.6.0-beta.0` to the catalog.
- **repro (clean clone):**
  1. Clone Inkline; `corepack enable && pnpm install`
  2. Build `@inkline/storybook` so `main.ts` evaluates
  3. `cd ui/vue && pnpm dlx storybook@next upgrade -y --package-manager pnpm --config-dir .storybook`
  4. Inspect `pnpm-workspace.yaml` catalog Storybook keys vs `ui/vue/package.json`
- **ports/story/files:** N/A; files: `pnpm-workspace.yaml`, `ui/vue/package.json`, `apps/storybook/package.json`
- **logs:** `logs/03-upgrade-retry.log`, `logs/04-post-upgrade-versions.txt`, `logs/05-doctor-after.log`, `logs/99-catalog-final.txt`
- **hypotheses / dead ends:** Upgrade scoped to detected project package.json; does not understand pnpm `catalog:` workspace protocol. Root `--config-dir ui/vue/.storybook` earlier failed on missing preset build / odd `/ui/vue/...` resolution.
- **likely Storybook source:** `@storybook/cli` upgrade package-version rewriter / workspace catalog support
- **class:** Storybook CLI gap (monorepo + pnpm catalog)
- **existing report search:** **No exact report found.**
  - [#31793](https://github.com/storybookjs/storybook/issues/31793) (closed) covers Storybook
    upgrader problems in monorepos.
  - [#32459](https://github.com/storybookjs/storybook/issues/32459) (closed) covers mixed Storybook
    versions after a pnpm monorepo migration.
  - Neither report covers pnpm's `catalog:` protocol or the upgrader leaving catalog keys untouched.

---

## F2 — `storybook doctor` cannot determine version before upgrade (pnpm workspace)

- **sev:** S3
- **project/version/env:** same; baseline `storybook@10.4.4` present under `ui/vue/node_modules`
- **expected:** Doctor reports health for the Vue Storybook project.
- **actual:** `Unable to determine Storybook version so the command will not proceed` even with `--config-dir .storybook`.
- **repro:** `cd ui/vue && pnpm dlx storybook@next doctor --config-dir .storybook`
- **logs:** `logs/02-doctor-before.log`, `logs/02-doctor-before-retry.log`
- **hypotheses:** Version discovery fails with pnpm catalog / nested workspace layout when invoked via `dlx` before upgrade path succeeds.
- **class:** Storybook CLI / doctor gap
- **existing report search:** **Related, but not exact.**
  - [#31891](https://github.com/storybookjs/storybook/issues/31891) (closed) reports doctor finding
    no dependencies when Storybook is not declared in the package it inspects. The Inkline case has
    local dependencies, but doctor still cannot determine their version.
  - [#21806](https://github.com/storybookjs/storybook/issues/21806) (closed) is an older CLI
    version-detection failure for `workspace:*`, not pnpm `catalog:`.

---

## F3 — Telemetry / project metadata reports addon versions as 10.4.4 while resolved packages are 10.6.0-beta.0

- **sev:** S3
- **project/version/env:** Vue SB `10.6.0-beta.0`; resolved `@storybook/addon-a11y` / `addon-docs` = `10.6.0-beta.0` via `require(...)` (`logs/07-resolved-addon-versions.txt`)
- **expected:** Metadata/telemetry addon versions match installed packages.
- **actual:** Boot telemetry and static `project.json` list `"@storybook/addon-a11y": { "version": "10.4.4" }` and same for docs; vitest correctly `10.6.0-beta.0`.
- **repro:** Upgrade Vue only as above; `STORYBOOK_TELEMETRY_DEBUG=1 pnpm --filter @inkline/vue storybook`; inspect telemetry dump / `storybook-static/project.json`.
- **logs:** `logs/07-vue-storybook-dev.log`, static `project.json` excerpt in `logs/15-static-build-retry2.log`
- **hypotheses:** Version collector reads catalog specifier or another workspace package’s resolution instead of the consuming package’s resolved graph.
- **class:** Storybook metadata/telemetry bug (aggravated by F1 mixed versions)
- **existing report search:** **No existing report found.**
  - Searches for telemetry addon versions, `project.json` addon versions, pnpm catalog metadata, and
    mixed workspace versions found no issue describing installed `10.6` addons being reported as
    `10.4.4`.

---

## F4 — New story files under gitignored `.inkline/` are not indexed until restart; edits to known files HMR OK

- **sev:** S3
- **project/version/env:** Vue SB 10.6.0-beta.0; stories glob `../.inkline/**/*.stories.ts`; `ui/vue/.gitignore` contains `.inkline/`
- **expected:** Adding/deleting a matching `*.stories.ts` updates the sidebar/index via watch (or documented limitation).
- **actual:** Creating `ui/vue/.inkline/components/button/stories/QaTemp.stories.ts` never appeared in `/index.json` (10s+). Editing existing `IButton.stories.ts` (args / new export) **did** update. File was HTTP-servable (`200`) but not indexed.
- **repro:** Boot Vue SB after compile; add new stories file under `.inkline/**`; poll `http://localhost:6007/index.json`.
- **ports/story/files:** :6007; `ui/vue/.inkline/**/*.stories.ts`; `ui/vue/.gitignore`
- **logs:** `logs/10-hmr-newfile*.txt`
- **hypotheses:** Watch ignores gitignored paths for *new* files while initial scan still finds existing ones; Vite HMR tracks already-imported modules. May be project+SB interaction rather than pure regression — still user-visible for generated-story workflows.
- **likely Storybook source:** CSF indexer / watcher ignore (gitignore) behavior
- **class:** Storybook ↔ project interaction (gitignored generated stories)
- **existing report search:** **Related, but not exact.**
  - [#33461](https://github.com/storybookjs/storybook/issues/33461) (open) reports that new stories
    are not indexed when their target directory is created after startup. Inkline's `.inkline/`
    directory already existed, but its new gitignored file was still missed.
  - [#22883](https://github.com/storybookjs/storybook/issues/22883) (closed) covers create/edit/delete
    indexing failures caused by a different stories-glob configuration.

---

## F5 — `storybook add @storybook/addon-vitest` overwrites `preview.ts` parameters

- **sev:** S3
- **project/version/env:** same; preview previously exported `{ parameters: sharedParameters }` plus `setFramework("vue")`
- **expected:** Addon install merges a11y test config into existing preview parameters.
- **actual:** Preview reduced to only `parameters.a11y.test = "todo"`, dropping `sharedParameters` (layout/controls matchers). Manual merge restored both (`ui/vue/.storybook/preview.ts`).
- **repro:** `cd ui/vue && pnpm dlx storybook@next add @storybook/addon-vitest --yes`
- **logs:** `logs/13-addon-vitest-add.log`; diff in `logs/99-final-git-diff.patch`
- **class:** Storybook CLI addon-add gap
- **existing report search:** **No exact report found.**
  - [#34317](https://github.com/storybookjs/storybook/issues/34317) (open) and
    [#32372](https://github.com/storybookjs/storybook/issues/32372) (closed) concern runtime
    inheritance/order of preview parameters. They do not report the installer replacing existing
    `preview.ts` parameters.

---

## F6 — Dead `createRequire` left by `fix-faux-esm-require` automigration

- **sev:** S4
- **expected:** Automigration only rewrites when `require` is used, or removes unused helpers.
- **actual:** `ui/vue/.storybook/main.ts` gained unused `createRequire` / `const require = createRequire(import.meta.url)` while config still uses ESM imports only.
- **logs:** `logs/04-vue-main-after.txt`
- **class:** Storybook automigration noise
- **existing report search:** **Related, but not exact.**
  - [#32598](https://github.com/storybookjs/storybook/issues/32598) (closed) reports
    `fix-faux-esm-require` adding redundant helpers when `createRequire` already exists. This case
    starts without a `require` call and receives an entirely unused helper.

---

## Non-findings / classified separately

### Project / dependency (not SB regression)

- **Static build requires `@inkline/vue` dist:** Preset aliases `componentPackage → sourceEntry` only when `configType !== "PRODUCTION"`. Without `pnpm --filter @inkline/vue build`, static build fails with Rolldown unresolved `@inkline/vue`. After building dist, `storybook build -o storybook-static --stats-json` **succeeds**. Dev mode unaffected.
- **No autodocs by default:** Project stories/preview omit autodocs; Docs checklist SKIP unless tags added. Enabling autodocs works.
- **Composition designed for 7 children:** Missing 6008–6012 is expected when only Vue is started; Vue composition still works.

### Environment

- Unrelated **Bitwarden** Storybook on `:6006` (`tmux bw-storybook-dev`) caused React-ref CORS / wrong sidebar content in the composition app. Not Inkline/Storybook 10.6.

### vite-plus / Rolldown compatibility

- **Dev:** PASS — Vue Storybook 10.6.0-beta.0 serves and HMR (existing files) works under vite-plus.
- **Static:** PASS after package dist build; Vite/Rolldown chunk warnings only.
- No dedicated Rolldown blocker beyond normal unresolved-external messaging when dist missing (project alias policy).

---

## Severity counts for parent summary

- **S1:** 0  
- **S2:** 1 (F1 catalog miss on upgrade)  
- **S3:** 4 (F2–F5)  
- **S4:** 1 (F6)
