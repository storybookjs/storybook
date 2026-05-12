# Patches for `yann/story-review-analysis`

These patches are improvements / fixes I made to the addon-before-after PR while investigating it. They're captured here as patch files so they can be applied (or committed) on the merged `yann/story-review-analysis` branch.

> **Note:** the older `01-build-config-fix.patch` (which removed an orphan reference to a deleted `before-server-subprocess.ts`) is no longer needed — the build now works on a fresh checkout of this branch. It has been deleted.

| Patch | What it does | Status |
|---|---|---|
| `02-changes-page-hmr-fix.patch` | Switches `ChangesPage.tsx` from `experimental_useStatusStore` (with an unstable selector) to a direct `experimental_getStatusStore(...).onAllStatusChange` subscription, plus defensive 50/200/500ms retry-reads to handle UniversalStore async hydration timing. **Verified live**: post-reload page shows `Changes (110)` immediately, no `(0)` transition. | Full fix — root cause was the UniversalStore follower's `EXISTING_STATE_RESPONSE` arriving during a React StrictMode unsubscribe gap. The retry timers self-heal within ~500ms in adversarial timing. |
| `03-preset-probe-plugin.patch` | Wires a new Vite plugin into the addon's `viteFinal` that exposes `/_status_/change-detection` for external tooling. | Required for `scripts/eval/inner-loop/run.ts` to read live change-detection state without DevTools probes |
| `04-status-probe-plugin.ts.new` | The new file `code/addons/before-after/src/node/status-probe-plugin.ts` — must be copied alongside patch 03. | Goes with patch 03 |

## Apply

From repo root, on `yann/story-review-analysis`:

```bash
git apply project-documents/questions/appendix/patches/02-changes-page-hmr-fix.patch
git apply project-documents/questions/appendix/patches/03-preset-probe-plugin.patch
cp project-documents/questions/appendix/patches/04-status-probe-plugin.ts.new \
   code/addons/before-after/src/node/status-probe-plugin.ts

yarn install
yarn nx compile addon-before-after
cd code && yarn storybook:ui
```

After this, `curl http://localhost:6006/_status_/change-detection` returns the live status snapshot, and `scripts/eval/inner-loop/run.ts` works against it without the manual DevTools probe.

## Why these aren't already in the PR

Patches 02 and 03/04 are net-new improvements that should land on the addon-before-after PR. Both were verified live against the dogfood Storybook UI:

- **02** — `Changes (110)` appears immediately after page reload (no `(0)` transition) even after HMR storms. Verified by 7-sample timeline poll over 6s post-reload — every sample showed correct count.
- **03/04** — `curl http://localhost:6006/_status_/change-detection` returns the live status snapshot; consumed by `scripts/eval/inner-loop/run.ts`.
