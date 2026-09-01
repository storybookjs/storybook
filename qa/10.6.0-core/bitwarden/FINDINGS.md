# FINDINGS — Bitwarden / Storybook 10.6.0-beta.0 QA

## Summary

| Sev | Count |
| --- | --- |
| S1 | 0 |
| S2 | 1 |
| S3 | 2 |
| S4 | 1 |
| Withdrawn | 1 (F4) |

> [!IMPORTANT]
> **Revision after spot-check.** F4 is withdrawn: it was caused by a defective QA probe, not by
> Storybook. In the same review, the HMR add/rename/new-file checks were found to have been marked
> PASS on `document.title` and `/index.json` alone. They have been re-run with canvas assertions and
> genuinely pass. See the correction note in [`SUCCESS.md`](./SUCCESS.md).

---

## F1 — `storybook upgrade` rewrites `@storybook/addon-designs` to an incompatible `11.0.0-next.0`

- **sev:** S2
- **project/version/env:** bitwarden/clients `@ e8bc60e`; Node 24.20.0; npm 11.19.0; `storybook@10.6.0-beta.0`
- **expected:** Third-party addons stay on a compatible published range, or doctor/upgrade leaves a working designs addon. Baseline was `@storybook/addon-designs@11.1.3`.
- **actual:** Upgrade set designs to `11.0.0-next.0`. Doctor reports incompatible with 10.6.0-beta.0 (`peer ^10.0.0 || ^10.0.0-0`). Dev boot skips the addon: `Could not resolve addon .../@storybook/addon-designs`. Designs toolbar did not appear.
- **repro:** Clone clients at SHA; `npm ci`; `npx storybook@next upgrade -y --package-manager npm`; inspect `package.json` and `npx storybook doctor`; `npm run storybook`.
- **logs:** `logs/00-baseline-env.txt`, `logs/03-upgrade.txt`, `logs/04-resolved-versions.txt`, `logs/05-doctor-after.txt`, `logs/06-version-mismatch-warning.txt`
- **class:** Storybook upgrade + satellite peer-range gap (also blocks other `npm install -D` later)
- **likely source:** CLI package bump map for `@storybook/addon-designs`; addon-designs peer range vs 10.6 beta
- **existing report search:** **Related, but not exact.** No open exact duplicate.
  - [#31314](https://github.com/storybookjs/storybook/issues/31314) (closed) and
    [#31356](https://github.com/storybookjs/storybook/pull/31356) (merged) cover upgrade pinning
    satellite packages (incl. designs) to `@next` and then rejecting them as incompatible. Closest
    historical match; not this stable `11.1.3` → `11.0.0-next.0` downgrade under 10.6 beta.
  - [#36010](https://github.com/storybookjs/storybook/issues/36010) (closed) explains why designs is
    skipped (`getAbsolutePath` / exports map), not the version rewrite.

---

## F2 — `storybook add @storybook/addon-vitest` on Angular webpack fails with npm ERESOLVE, not unsupported-builder guidance

- **sev:** S3
- **expected:** Clear “not supported on Angular webpack” (or similar) without mutating the tree.
- **actual:** CLI starts install of `@storybook/addon-vitest@10.6.0-beta.0` then `SB_CLI_INIT_0011 PackageInstallDependencyConflictError` because `@storybook/addon-designs@11.0.0-next.0` cannot peer-resolve `@storybook/addon-docs@10.6.0-beta.0`. No Angular/webpack capability message. Git reverted after probe.
- **repro:** After F1 upgrade: `npx storybook@next add @storybook/addon-vitest --yes`
- **logs:** `logs/20-addon-vitest-add.txt`, `logs/20-addon-vitest-summary.txt`
- **class:** Storybook CLI gap (wrong failure mode) aggravated by F1
- **existing report search:** **No existing report found** for this failure mode.
  - Closest peer-conflict noise:
    [#32803](https://github.com/storybookjs/storybook/issues/32803) (closed) — Vitest 4 peers, not
    designs, and not missing Angular/webpack unsupported guidance.

---

## F3 — Detected `angular-to-angular-vite` / `enable-experimental-review` automigrations not applied under `-y`

- **sev:** S3
- **expected:** `-y` either applies all detected automigrations or states why some are skipped.
- **actual:** UI lists three detections. “Running all detected automigrations” only executes `addon-mcp`. Framework remains `@storybook/angular` + webpack (`logs/04-main-diff.txt`).
- **repro:** `npx storybook@next upgrade -y --package-manager npm` on this repo.
- **logs:** `logs/03-upgrade.txt`, `logs/04-automigration-notes.txt`, `logs/22-upgrade-restore.log`
- **class:** Storybook automigration UX / `-y` selection gap. May be **intentional** (see related PRs);
  still opaque to users who see three detections and only one run.
- **existing report search:** **Related; may be by design, not a bug.** No exact open report of this
  opacity.
  - [#35417](https://github.com/storybookjs/storybook/pull/35417) (merged): `--yes` skips
    experimental automigrations (covers `enable-experimental-review`).
  - [#35215](https://github.com/storybookjs/storybook/pull/35215) (merged): `addon-mcp` is the
    agent-oriented migration expected to run in `-y` flows.
  - [#36009](https://github.com/storybookjs/storybook/issues/36009) (open): config loss *after*
    `angular-to-angular-vite` runs — different symptom.

---

## F4 — WITHDRAWN — `index.json` 500 during HMR did not reproduce

- **sev:** ~~S3~~ → **withdrawn, not reproducible**
- **originally reported:** `GET /index.json` returned 500 (`Unable to index ./libs/components/src/button/button.mdx` / `Could not find or load CSF file at path "./button.stories"`) after story-file HMR, leaving a spinner and an "Oh no! Something went wrong" sidebar.
- **why it was withdrawn:** The trigger was a defective QA probe, not a Storybook defect. The rename probe renamed `export const Default` (line 95 of `button.stories.ts`) while line 270 still spread `...Default`, so the file stopped compiling (`error TS2304: Cannot find name 'Default'`). `button.mdx` references that CSF file through `of={stories}`, so the docs entry legitimately could not be indexed.
- **controlled re-test:** Same clone, same dev server, renaming only the line 95 declaration to leave `...Default` dangling:
  - `/index.json` stayed healthy at `OK_1116` for the full **300s** budget. It never returned 500.
  - The canvas showed a clear, correct error: **`Default is not defined`** with a `ReferenceError` stack pointing at `button.stories.ts`.
  - The sidebar kept its story tree (no "Something went wrong").
  - Restoring the file recovered the canvas in **20s with no restart**.
- **repro of the corrected behavior:** Dev on :6006 (bind is IPv6 `localhost`, not `127.0.0.1`); rename `export const Default: Story` → `DefaultRenamed` in `libs/components/src/button/button.stories.ts`; observe canvas error and healthy index; restore and observe recovery.
- **logs:** `logs/24-f4-reverify.log`, `logs/24-f4-reverify-results.json`; screenshots `27-broken-csf-shows-clear-error.png`, `28-recovered-after-fix.png`. Original observation retained in `logs/16-index-500-body.txt`.
- **residual suspicion (not filed):** The first run issued overlapping add/rename/create/delete edits while webpack was still rebuilding, and `logs/16-after-restore.txt` shows repeated `Change detection failed: Unable to index`. A rapid-overlapping-edit race may exist, but it did not reproduce with a single edit and is not filed without a reliable repro.
- **class:** QA probe defect, not a Storybook regression
- **existing report search:** **Related, but not exact.**
  - [#24155](https://github.com/storybookjs/storybook/issues/24155) (closed) has the same MDX
    `of={}` → missing CSF failure after a story-file error during development. That report does not
    recover after the source is fixed; this QA case recovered after the temporary edit was reverted.
  - [#22619](https://github.com/storybookjs/storybook/issues/22619) covers the same misleading
    missing-CSF error, but under Vite rather than an Angular/webpack HMR race.

---

## F5 — Upgrade downgrades `addon-designs` from 11.1.3 to 11.0.0-next.0

- **sev:** S4 (same incident as F1; recorded for the version direction)
- **actual:** Semver went backwards from a stable 11.1.3 to an older next tag.
- **logs:** `logs/00-baseline-env.txt` vs `logs/04-resolved-versions.txt`
- **class:** Storybook upgrade version-selection bug for satellite packages
- **existing report search:** Same as F1 — related via
  [#31314](https://github.com/storybookjs/storybook/issues/31314) /
  [#31356](https://github.com/storybookjs/storybook/pull/31356); no exact open report of this
  stable → older `@next` downgrade.

---

## Non-findings

- Core canvas/sidebar/search/controls/measure/outline/grid/docs/show-code: pass on 10.6.0-beta.0 Angular webpack.
- **HMR (all cases): pass, re-verified with rendered canvas.** Adding a story export ~7.8s, new story file ~8.2s, delete de-index ~3.6s. No hang.
- A broken CSF file surfaces a clear `Default is not defined` canvas error and recovers ~20s after the source is fixed, without a restart.
- Save-from-controls skipped (not enabled).
- Telemetry disabled as configured.
- First worker environment died during static build; not a Storybook regression by itself.
- The dev server binds IPv6 `localhost`; `127.0.0.1` is refused. This cost 400s of false "not ready" polling in this environment and is worth knowing for future harnesses, but it is standard Node listen behavior, not a defect.
