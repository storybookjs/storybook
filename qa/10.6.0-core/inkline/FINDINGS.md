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
- **existing report search:** **Related, but not exact.** No open exact duplicate.
  - [#35415](https://github.com/storybookjs/storybook/pull/35415) (merged): init/addon-vitest honor
    pnpm catalogs — not `upgrade` rewriting `catalog:` Storybook keys.
  - [#31557](https://github.com/storybookjs/storybook/pull/31557) / [#31517](https://github.com/storybookjs/storybook/issues/31517):
    broader monorepo upgrade work; not catalog protocol.

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
- **existing report search:** **Related, but not exact.** No open exact duplicate for **doctor** +
  nested pnpm workspace.
  - Historical **upgrade** (not doctor) version mis-detect under `pnpm dlx` / `pnpx`:
    [#25734](https://github.com/storybookjs/storybook/issues/25734),
    [#32211](https://github.com/storybookjs/storybook/issues/32211),
    [#33141](https://github.com/storybookjs/storybook/pull/33141).

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
  - Weak adjacent only: [#35345](https://github.com/storybookjs/storybook/pull/35345) (merged) —
    pnpm path hygiene in `framework.name`, not wrong addon version fields.

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
- **existing report search:** **No existing report found** for gitignored (or generated) story dirs
  that match the stories glob: cold start indexes existing files, add/delete does not until restart,
  HMR of already-known files works.

---

## F5 — `storybook add @storybook/addon-vitest` overwrites `preview.ts` parameters

- **sev:** S3
- **project/version/env:** same; preview previously exported `{ parameters: sharedParameters }` plus `setFramework("vue")`
- **expected:** Addon install merges a11y test config into existing preview parameters.
- **actual:** Preview reduced to only `parameters.a11y.test = "todo"`, dropping `sharedParameters` (layout/controls matchers). Manual merge restored both (`ui/vue/.storybook/preview.ts`).
- **repro:** `cd ui/vue && pnpm dlx storybook@next add @storybook/addon-vitest --yes`
- **logs:** `logs/13-addon-vitest-add.log`; diff in `logs/99-final-git-diff.patch`
- **class:** Storybook CLI addon-add gap
- **existing report search:** **Related, but not exact.**
  - [#32647](https://github.com/storybookjs/storybook/issues/32647) /
    [#32728](https://github.com/storybookjs/storybook/pull/32728): `storybook add` mutating
    `preview.ts` for CSF-factory addon sync — different symptom than overwriting
    `parameters` / `sharedParameters`.

---

## F6 — Dead `createRequire` left by `fix-faux-esm-require` automigration

- **sev:** S4
- **expected:** Automigration only rewrites when `require` is used, or removes unused helpers.
- **actual:** `ui/vue/.storybook/main.ts` gained unused `createRequire` / `const require = createRequire(import.meta.url)` while config still uses ESM imports only.
- **logs:** `logs/04-vue-main-after.txt`
- **class:** Storybook automigration noise
- **existing report search:** **Related, but not exact** (residual gap in same automigration).
  - [#32598](https://github.com/storybookjs/storybook/issues/32598) / [#32606](https://github.com/storybookjs/storybook/pull/32606):
    duplicate banners when `createRequire` already exists.
  - [#32694](https://github.com/storybookjs/storybook/pull/32694): conditional banner from
    `require` / `__dirname` usage — does not cover inserting dead helpers when no `require` call
    exists.

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
