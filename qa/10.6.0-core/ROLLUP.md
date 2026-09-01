# 10.6.0 core QA rollup — Bitwarden + Inkline

Target: **`storybook@next` = 10.6.0-beta.0**  
Date: 2026-09-01  
Yarn PnP: not tested (out of scope).

## Verdict

**Conditional go** for these two stacks: core manager/preview (sidebar, stories, docs, controls, measure/outline/grid) works after upgrade. **Not a clean go** until the S2 CLI upgrade gaps are understood — they do not block viewing stories, but they leave mixed versions and satellite addons broken.

No S1.

> [!NOTE]
> **Revised after a spot-check of the Bitwarden HMR screenshots.** Those screenshots showed a
> spinner, so the HMR results were re-audited. The original PASS marks for add/rename/new-file HMR
> were based on `document.title` and `/index.json` only, not on a rendered canvas. They were re-run
> properly and pass. Finding F4 was withdrawn as a QA probe defect. Reporting `PASS` from an index or
> title signal alone is the process gap to avoid in the next round.

## Lane results

### Bitwarden (`bitwarden/clients` @ `e8bc60e`) — Angular webpack / npm / Node 24

- Reports: [`bitwarden/SUCCESS.md`](./bitwarden/SUCCESS.md), [`bitwarden/FINDINGS.md`](./bitwarden/FINDINGS.md)
- Demo: [`bitwarden_static_core_qa_success.mp4`](./bitwarden/bitwarden_static_core_qa_success.mp4) (static :6008)
- Core UI: **PASS** (dev + static)
- HMR: **PASS**, re-verified with rendered canvas (~8s per case)
- Findings: S2×1, S3×2, S4×1, **1 withdrawn (F4)**

Highest: upgrade rewrites `@storybook/addon-designs` from **11.1.3 → 11.0.0-next.0**, doctor flags incompatibility, addon is skipped at boot. Same peer hole makes `storybook add @storybook/addon-vitest` fail with npm ERESOLVE instead of Angular/webpack “unsupported” guidance. `-y` upgrade detects `angular-to-angular-vite` but only applies `addon-mcp`.

The originally filed `index.json` 500 during MDX `of={}` HMR is **withdrawn**: it came from a
defective QA probe (a rename that left a dangling `...Default` spread), and a controlled re-test
showed correct Storybook behavior with a clear canvas error and 20s recovery.

### Inkline (`inkline/inkline` @ `b5ce93e7`) — Vue 3 Vite + vite-plus/rolldown / pnpm catalog

- Reports: [`inkline/SUCCESS.md`](./inkline/SUCCESS.md), [`inkline/FINDINGS.md`](./inkline/FINDINGS.md)
- Core Vue UI: **PASS**; vite-plus/rolldown **OK**
- Test widget: **PASS** (53 tests) after `addon-vitest` add (preview.ts clobber recovered manually)
- Composition: Vue child **PASS**; other children not started (expected); port 6006 polluted by Bitwarden during first run
- Findings: S2×1, S3×4, S4×1

Highest: `storybook upgrade` does **not** bump pnpm `catalog:` Storybook keys (stay `^10.4.4`); only `ui/vue` pinned to beta. Doctor-before cannot determine version. Telemetry/metadata still lists some addons as 10.4.4. New stories under gitignored `.inkline/` not indexed. `fix-faux-esm-require` leaves unused `createRequire`.

Inkline evidence is the [`screenshots/`](./inkline/screenshots/) set. Its two recording
attempts showed the wrong app or no interaction, so they are not included.

## Cross-cutting

| Theme | Bitwarden | Inkline |
| --- | --- | --- |
| Upgrade reaches 10.6.0-beta.0 for the consumed package | Yes | Yes (Vue only) |
| Workspace / satellite versions fully updated | addon-designs wrong next | catalog + other frameworks stay 10.4.4 |
| Doctor | Flags designs | Fails before upgrade; mismatch after |
| Core canvas | Pass | Pass |
| Storybook Test | Not supported; add fails poorly | Works after add |
| Static build | Pass | Pass after project dist build |

## Skips (intentional)

- Yarn PnP, Bun, empty-dir create, VS Code Vitest, VTA onboarding, Slack/GitHub filing
- Chromatic (private; replaced by Bitwarden)
- Inkline seven-framework matrix; Bitwarden Lit autofill optional skip
- Save-from-controls (not enabled on either project)

## Environment notes

QA clones under `/tmp/qa-10.6` were wiped when workers died; Bitwarden was restored for static build. Inkline Vue/composition tmux sessions from the first run are gone. Static Bitwarden remains: tmux `bw-static` → http://127.0.0.1:6008
