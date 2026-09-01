# Bitwarden lane — Storybook 10.6.0 core QA

## Verdict

Lane completed. Angular/webpack Storybook on `storybook@10.6.0-beta.0` boots, core UI works, and static build serves on :6008. CLI/peer/HMR-index issues are in `FINDINGS.md`.

## Exact environment

| Item | Value |
| --- | --- |
| `storybook@next` resolved | **10.6.0-beta.0** |
| Clone | `/tmp/qa-10.6/bitwarden` |
| Git SHA | `e8bc60e5ba3725ed098cc0019def98462cd4432e` |
| Node | `v24.20.0` |
| npm | `11.19.0` |
| Framework | `@storybook/angular@10.6.0-beta.0` (webpack builder) |
| Addons after upgrade | a11y, docs, links, themes, mcp `10.6.0-beta.0`; designs `11.0.0-next.0` (incompatible / skipped at boot) |
| Baseline | Storybook packages `10.3.6`; designs `11.1.3` |
| Telemetry | `core.disableTelemetry: true` |

Evidence: `logs/00-baseline-env.txt`, `logs/04-resolved-versions.txt`.

## Doctor

| Phase | Result |
| --- | --- |
| Before upgrade | Project looks good (`logs/02-doctor-before.txt`) |
| After upgrade | Incompatible `@storybook/addon-designs@11.0.0-next.0` vs Storybook 10.6.0-beta.0 (`logs/05-doctor-after.txt`) |

## Upgrade

- `npx storybook@next upgrade -y --package-manager npm` — **10.3.6 → 10.6.0-beta.0** (`logs/03-upgrade.txt`, restore `logs/22-upgrade-restore.log`)
- Detected automigrations: `angular-to-angular-vite`, `addon-mcp`, `enable-experimental-review`
- **Actually run:** only `addon-mcp` (added to `.storybook/main.ts`). Framework stayed `@storybook/angular` webpack.
- Deduped npm tree; upgrade exit 0.

## Checklist

### Dev (`npm run storybook` → :6006)

| Item | Status | Notes / evidence |
| --- | --- | --- |
| Boot | **PASS** | tmux `bw-storybook-dev` (first run); index served (`logs/06-index.json`) |
| Sidebar browse / groups | **PASS** | Component Library tree |
| Sidebar search | **PASS** | Badge (`screenshots/03-search-badge.png`) |
| Tags filter | **PASS** | UI present (`screenshots/11-tag-filters.png`); no custom story tags |
| Story switch | **PASS** | Button → Badge (`screenshots/02`, `04`) |
| Representative Angular story | **PASS** | `component-library-button--default` |
| MDX / docs entry | **PASS** | `documentation-introduction--docs`; Button docs (`screenshots/05-06`, `12`) |
| HMR existing story | **PASS** | label `Button` → `HMR Button Label` (`screenshots/13-hmr-story-edit.png`) |
| HMR preview | **PASS** | preview.tsx outline class (`screenshots/14-hmr-preview.png`) |
| HMR add/rename in same file | **PASS** | HmrProbe / LoadingRenamed; reverted (`logs/17-hmr-summary.txt`) |
| HMR add/delete new story file | **PASS** | `Button HMR Temp` indexed then deleted (`logs/17-hmr4-*.txt`) |
| Transient indexer error | **FAIL** | `index.json` 500 while MDX `of={}` lost CSF mid-HMR (`logs/16-index-500-body.txt`) — recovered after revert |
| Measure | **PASS** | toolbar switch (`screenshots/09-measure-on.png`) |
| Outline story | **PASS** | `screenshots/10-outline-on.png` |
| Outline/Measure docs | **PASS** | toolbar present on docs; grid docs `screenshots/20-grid-on-docs.png` |
| Backgrounds / grid story | **PASS** | grid `screenshots/19-grid-on-story.png` |
| Controls change / reset | **PASS** | primary then reset (`screenshots/07-08`) |
| Save-from-controls | **SKIP** | No Save/Update story bar (`logs/18-save-from-controls.txt`) |
| File writes from controls | **SKIP** | Not enabled |
| Docs Show code | **PASS** | Button docs (`screenshots/21-docs-show-code.png`, `logs/19-show-code-retry.txt`) |
| Browser console | **PASS** | 0 errors on Button story (`logs/19-console-errors.txt`) |
| Telemetry prompts | **PASS** | `disableTelemetry: true`; no prompts (`logs/18-telemetry-config.txt`) |
| `storybook add @storybook/addon-vitest` | **FAIL (wrong shape)** | Expected clear Angular/webpack unsupported guidance. Actual: npm `ERESOLVE` via addon-designs peers (`logs/20-addon-vitest-add.txt`). Reverted. |
| Autofill Lit Storybook | **SKIP** | Optional; primary not fully green on CLI extras |

### Static build + serve (:6008)

| Item | Status | Notes |
| --- | --- | --- |
| `npm run build-storybook` | **PASS** | Restored clone after worker death; `ng run components:build-storybook` exit 0 → `/tmp/qa-10.6/bitwarden/storybook-static` |
| http-server :6008 | **PASS** | tmux `bw-static`; `index.json` 1116 entries |
| Sidebar / story / docs / toolbar | **PASS** | Button + Badge + Button docs; outline/measure (`screenshots/22-static-button.png`, `23-static-docs.png`; `/opt/cursor/artifacts/bitwarden_static_core_qa_success.mp4`) |
| Testing widget absent in prod | **PASS** | No Run tests UI |

## Story IDs exercised

- `component-library-button--default` / `--docs`
- `component-library-badge--default`
- `documentation-introduction--docs`

## Evidence

- Logs: [`logs/`](./logs/)
- Screenshots: [`screenshots/`](./screenshots/)
- Demo video: [`bitwarden_static_core_qa_success.mp4`](./bitwarden_static_core_qa_success.mp4)
- Findings: [`FINDINGS.md`](./FINDINGS.md)

## Running servers (left up)

| tmux session | URL |
| --- | --- |
| `bw-static` | http://127.0.0.1:6008 |

## Intentional leftover install changes

Upgrade only under `/tmp/qa-10.6/bitwarden` (no commit/push): `.storybook/main.ts` (addon-mcp), `package.json` / lock Storybook 10.6.0-beta.0. HMR probes reverted. No `/workspace` changes.
