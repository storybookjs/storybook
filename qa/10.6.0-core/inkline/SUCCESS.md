# Inkline lane — Storybook 10.6.0 core QA

## Verdict

Lane completed. Vue Storybook on `storybook@10.6.0-beta.0` boots and core UI flows work with vite-plus/rolldown. Several upgrade/catalog/monorepo mismatches and project-setup caveats are documented in `FINDINGS.md`.

## Exact environment

| Item | Value |
| --- | --- |
| `storybook@next` resolved | **10.6.0-beta.0** |
| Clone | `/tmp/qa-10.6/inkline` |
| Git SHA | `b5ce93e7dbbe97905fe03fec1b941dd8605c188d` |
| Node | `v22.22.3` |
| pnpm | `11.6.0` (corepack; `packageManager` field) |
| Framework | `@storybook/vue3-vite@10.6.0-beta.0` |
| Builder | `@storybook/builder-vite` (via vite-plus / Rolldown) |
| Renderer | `@storybook/vue3` |
| Addons (Vue resolved) | `@storybook/addon-a11y@10.6.0-beta.0`, `@storybook/addon-docs@10.6.0-beta.0`, `@storybook/addon-mcp@10.6.0-beta.0`, `@storybook/addon-vitest@10.6.0-beta.0` |
| Baseline | `storybook` / core addons catalog `^10.4.4` → lock `10.4.4` |

Evidence: `logs/00-env-baseline.txt`, `logs/99-final-versions.txt`.

## Doctor

| Phase | Result |
| --- | --- |
| Before upgrade | **Failed to determine Storybook version** (`Unable to determine Storybook version`) from `ui/vue` and root with `--config-dir`. Local `storybook` was installed at `10.4.4`. See `logs/02-doctor-before.log`, `logs/02-doctor-before-retry.log`. |
| After upgrade (Vue) | Completes with **Mismatching Versions** (other workspace packages still on `10.4.4` via untouched catalog). See `logs/05-doctor-after.log`. |

## Upgrade

1. First attempt from monorepo root failed: preset `@inkline/storybook` dist missing (`logs/03-upgrade.log`).
2. Built `@inkline/storybook`, reran from `ui/vue`: **Upgrading from 10.4.4 to 10.6.0-beta.0** (`logs/03-upgrade-retry.log`).
3. Automigrations (with `-y`): `addon-mcp`, `fix-faux-esm-require`, `enable-experimental-review`, `enable-experimental-docgen-server` (last two reported detected; mcp + faux-esm applied to `main.ts`).
4. **Catalog miss:** `pnpm-workspace.yaml` Storybook entries remained `^10.4.4` except later `add` wrote `@storybook/addon-vitest: 10.6.0-beta.0`. Vue package.json pinned exact `10.6.0-beta.0` for core packages. **Finding.**

Choices: non-interactive `-y --package-manager pnpm --config-dir .storybook`.

## Telemetry (`STORYBOOK_TELEMETRY_DEBUG=1`)

One Vue boot with telemetry debug. Event shapes observed (`logs/07-telemetry-events.txt` / `logs/07-vue-storybook-dev.log`):

- `{ eventType: "boot", payload: { eventType: "dev" } }`
- `{ eventType: "version-update", payload: {} }`
- `{ eventType: "dev", payload: { … metadata …, eventType: "upgrade", … } }`

Metadata oddly lists `@storybook/addon-a11y` / `addon-docs` as `10.4.4` while Node resolution in `ui/vue` is `10.6.0-beta.0` (`logs/07-resolved-addon-versions.txt`).

## Checklist

### Vue dev (`pnpm --filter @inkline/vue storybook` → :6007)

| Item | Status | Notes / evidence |
| --- | --- | --- |
| Prepare components (prestorybook/compiler) | **PASS** | Built compiler/cli/core; `inkline compile … --target vue` → 8 story files (`logs/06-*.log`) |
| Boot Vue only (not all 7 frameworks) | **PASS** | tmux `inkline-vue-sb`, http://127.0.0.1:6007 |
| Sidebar browse / groups | **PASS** | Components tree; story IDs e.g. `components-actions-button--default` |
| Sidebar search | **PASS** | `screenshots/02-sidebar-search-button.png` |
| Tags filter | **PASS** | Tag filters UI present (`screenshots/03-tag-filters.png`); story tags `dev/test/manifest` |
| Story switch | **PASS** | Button ↔ Badge (`screenshots/14-badge-default.png`) |
| Representative Vue story | **PASS** | `components-actions-button--default` renders Button |
| Docs (default project config) | **SKIP** | No autodocs tags / `docs.autodocs`; 0 docs entries in `index.json` |
| Docs after temporary `tags: ['autodocs']` probe | **PASS** | Docs render, Show code, Args table; then reverted (`screenshots/12-docs-autodocs-probe.png`, `logs/10-docs-snapshot.txt`) |
| Docs HMR | **PASS** | Preview edit enabling autodocs refreshed index (8 docs entries) |
| HMR story edit | **PASS** | Label → `HMR Button` (`screenshots/11-hmr-story-edit.png`) |
| HMR preview edit | **PASS** | preview.ts change applied |
| HMR add/rename story in same file | **PASS** | `QaProbe` appeared in index; reverted |
| HMR add/delete new story file | **FAIL** | New `.stories.ts` under gitignored `.inkline/` never indexed (see FINDINGS) |
| Measure (story) | **PASS** | `globals=measureEnabled:!true` (`screenshots/07-measure-on.png`) |
| Outline (story) | **PASS** | `globals=outline:!true` (`screenshots/08-outline-on.png`) |
| Outline/Measure on docs | **SKIP** | No default docs page |
| Backgrounds / grid (story) | **PASS** | Grid + backgrounds menu (`screenshots/09-grid-on.png`, `screenshots/10-backgrounds-menu.png`) |
| Backgrounds/grid on docs | **SKIP** | No default docs |
| Controls change / reset / URL args | **PASS** | `args=label:QA+Label`; reset clears (`screenshots/05-controls-label-change.png`, `screenshots/06-controls-reset.png`) |
| Controls HMR | **PASS** | Story arg HMR updated control default |
| Save-from-controls | **SKIP** | No Save/Update story control UI enabled |
| File writes from controls | **SKIP** | Not enabled / not observed |
| A11y panel | **PASS** | Accessibility tab; passes/violations UI (`screenshots/15-a11y-panel.png`) |
| Browser console (dev) | **PASS** | 0 errors; warning: PopoverProvider `ariaLabel` Storybook 11 notice (`logs/11-console.txt`) |
| vite-plus / Rolldown | **PASS** | Dev server healthy; Vite logs reference Rolldown; no blocker for core UI |

### Composition (`pnpm --filter @inkline/storybook-app storybook` → :6100)

| Item | Status | Notes |
| --- | --- | --- |
| App boot with Vue child only | **PASS** | tmux `inkline-sb-app`; Vue ref loads |
| Refs/config | **PASS** | `apps/storybook/.storybook/main.ts` refs ports 6006–6012; Vue → 6007 |
| Composed Vue story render | **PASS** | `/story/vue_components-actions-button--default` title/story OK (`screenshots/17-composition-vue-button.png`, `screenshots/24-demo-composition.png`) |
| Missing other children | **Expected setup** | 6008–6012 connection refused; not started by design |
| Port 6006 pollution | **Environment** | Unrelated Bitwarden Storybook on 6006 (`bw-storybook-dev`); CORS errors for React ref — not an Inkline/SB regression |
| App Storybook version | **Mismatch** | App still **10.4.4** via catalog (`logs/12-composition-vue-story.txt`, `logs/12-composition-snapshot.txt`) — catalog miss finding |

### Storybook Test (Vue)

| Item | Status | Notes |
| --- | --- | --- |
| Already configured? | No | Added via `pnpm dlx storybook@next add @storybook/addon-vitest --yes` |
| CLI/config judgment | **PASS w/ caveats** | Wrote vitest plugin into `vite.config.ts`, addon in `main.ts`, catalog entry exact `10.6.0-beta.0`, `vitest.shims.d.ts`. **Clobbered `preview.ts`** (dropped `sharedParameters`); manually merged a11y + sharedParameters (preserved intentional install). |
| Testing module visible in dev | **PASS** | Component tests panel; Run tests (`screenshots/18-vue-with-vitest-addon.png`, `screenshots/19-tests-result.png`, `screenshots/20-tests-complete.png`) |
| Testing module absent in static | **PASS** | `document` check false on :6009 (`logs/16-static-testing-absent.txt`) |
| Run / stop tests | **PASS** | Run → **53 passed** (`logs/14-watch-final.txt`, `logs/13-addon-vitest-add.log`) |
| Focused story/component/group | **PASS** | Suite ran story files; UI supports focus (not exhaustively clicked every focus mode) |
| Watch mode UI | **PASS** | Watch switch present after run |
| Watch trigger on story edit | **INCONCLUSIVE** | Server entered `PASS Waiting for file changes…`; UI click on Watch flaky (overlay intercept); story edit while probing did not clearly log a dedicated rerun of WatchTrigger |
| Watch on component edit | **SKIP** | Not separately exercised beyond story file |
| A11y checkbox / global / deeplink / highlight | **PARTIAL** | Accessibility checkbox in testing module present; full deeplink/highlight not fully exercised |
| VS Code / VTA / Bootcamp / empty-dir | **SKIP** | Per instructions |

### Static build + serve (:6009)

| Item | Status | Notes |
| --- | --- | --- |
| `storybook build` / package command | **PASS** (after `pnpm --filter @inkline/vue build`) | First attempt failed resolving `@inkline/vue` in PRODUCTION (no dist / no alias) — **project setup**, not SB regression. Retry OK with `--stats-json` → `preview-stats.json` (`logs/15-static-build-retry2.log`) |
| Serve output | **PASS** | `npx http-server -p 6009` tmux `inkline-static` |
| Sidebar / story / controls | **PASS** | `screenshots/21-static-button.png`, `screenshots/22-static-badge.png` |
| Docs | **SKIP** | No autodocs in project |
| Testing widget absent | **PASS** | Confirmed |

## Commands used (high level)

```bash
corepack prepare pnpm@11.6.0 --activate
pnpm install
pnpm --filter @inkline/storybook build   # and compiler/cli/core as needed
pnpm dlx storybook@next doctor --config-dir .storybook   # before/after from ui/vue
pnpm dlx storybook@next upgrade -y --package-manager pnpm --config-dir .storybook
pnpm --filter @inkline/components exec inkline compile 'src/**/*.ink.tsx' --config inkline.config.ts --target vue
STORYBOOK_TELEMETRY_DEBUG=1 pnpm --filter @inkline/vue storybook   # :6007
pnpm --filter @inkline/storybook-app storybook                     # :6100
pnpm dlx storybook@next add @storybook/addon-vitest --yes
pnpm --filter @inkline/vue build
pnpm exec storybook build -o storybook-static --stats-json         # in ui/vue
npx http-server -p 6009 -c-1 .                                     # storybook-static
```

## Story IDs exercised

- `components-actions-button--default` (+ block/colors/docs-when-enabled)
- `components-feedback-badge--default`
- Composition: `vue_components-actions-button--default`
- App local: `welcome--overview`

## Evidence

- Logs: [`logs/`](./logs/)
- Screenshots: [`screenshots/`](./screenshots/)
- Findings: [`FINDINGS.md`](./FINDINGS.md)
- Final git: `logs/99-final-git-status.txt`, `logs/99-final-git-diff.patch`

## Running servers (left up)

| tmux session | URL |
| --- | --- |
| `inkline-vue-sb` | http://127.0.0.1:6007 |
| `inkline-sb-app` | http://127.0.0.1:6100 |
| `inkline-static` | http://127.0.0.1:6009 |
| `bw-storybook-dev` (pre-existing env) | http://127.0.0.1:6006 (unrelated) |

## Intentional leftover install changes (not reverted)

Upgrade + vitest addon installation under `/tmp/qa-10.6/inkline` (no commit/push):

- `ui/vue/package.json` pinned to `10.6.0-beta.0` + vitest deps
- `ui/vue/.storybook/main.ts` (mcp, vitest, ESM require shim)
- `ui/vue/.storybook/preview.ts` (sharedParameters + a11y test todo)
- `ui/vue/vite.config.ts` (storybookTest project)
- `ui/vue/vitest.shims.d.ts`
- `pnpm-workspace.yaml` catalog `addon-vitest: 10.6.0-beta.0` only
- `pnpm-lock.yaml`

Temporary HMR/docs probes reverted. No `/workspace` changes.
