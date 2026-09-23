# Who outside the repo uses UniversalStore and the status and test-provider store APIs?

Linear: SB-2110. Researched 2026-09-23 against `origin/next` at `6d3aa36dc2d`.

## Question

The OSA migration may change or remove public store APIs, and it deletes `UniversalStore` at the end. Who breaks, where do they call the APIs, and what does each call site assume?

## Short answer

- **One consumer that matters: `@chromatic-com/storybook`** (3.44 M downloads/week, about the same as `@storybook/addon-vitest`). It uses only the status store and the test-provider store. It does not use `UniversalStore`. It makes one module-scope `experimental_getStatusStore` call. It writes `unset()` then `set()` back to back, so it needs writes applied in order. It never reads its own write back.
- **Two more public addons with real reach:** `@percy/storybook` (69 k/wk; `getStatusStore` + `set`/`unset` in a `useEffect`) and `storybook-addon-tag-badges` (283 k/wk; read-only `experimental_useStatusStore`).
- **`experimental_UniversalStore`, `experimental_useUniversalStore` and `experimental_MockUniversalStore` have one real external user:** an unpublished, 0-star addon (`lmestel/storybook-addon-markup-snapshots`). All other GitHub hits are committed `storybook-static` builds, `.d.ts` copies or forks of the Storybook monorepo. Deleting `UniversalStore` breaks almost no one.
- **No consumer reads a store right after writing to it.** Every write is fire-and-forget. Async writes are therefore safe **if they stay FIFO per store**.
- **Three consumers call `experimental_get*Store` at module scope** (Chromatic, AccessLint, storyproof). The getters must return a handle that resolves lazily.
- **Storybook's `docs/` folder does not document any of these APIs.** The only prose is one MIGRATION.md section (SB 9), and it is wrong about `storybook/preview-api`.

## 1. `@chromatic-com/storybook` (addon-visual-tests)

Versions checked: 5.0.1 (`~/dev/chromaui/chromatic/node_modules`), 5.1.2 (this repo's `node_modules`), **5.3.1 (npm `latest`)** and 5.4.0-next.1 (npm `next`), all from `npm pack`. All four versions have the same set of calls. Source line numbers below come from [chromaui/addon-visual-tests@2d77a0d](https://github.com/chromaui/addon-visual-tests/tree/2d77a0d7cfb2ad73cc42ba06fa50e08c10431b30) (the commit tagged by the 5.3.2 canary). The 5.3.1 `dist/manager.mjs` and `dist/preset.js` contain the same calls in minified form.

The Chromatic app repo (`~/dev/chromaui/chromatic`) has no direct calls outside `node_modules`.

| # | File:line | API | Where it runs | What it does | Assumption |
|---|---|---|---|---|---|
| C1 | `src/Panel.tsx:60` | `experimental_getStatusStore(ADDON_ID)` | **Manager, module scope** (evaluated at bundle import, before `addons.register`) | Gets the handle once. | The getter works at import time and returns a stable handle. **Needs lazy resolution.** |
| C2 | `src/Panel.tsx:116-119` | `statusStore.unset(); statusStore.set(statuses)` | Manager, React `useCallback`, called from a `useEffect` in `VisualTests.tsx:289` | Replaces all of the addon's statuses with the latest build's. | **The writes apply in call order** (unset before set). No read after the write. |
| C3 | `src/components/FooterMenu.tsx:16,74` | `experimental_getStatusStore(ADDON_ID)` in the render body, then `.unset()` on "Log out" | Manager, React render + click handler | Clears statuses on logout. | Fire-and-forget. The getter must be cheap to call on every render. |
| C4 | `src/manager.tsx:105-116` | `experimental_getStatusStore(ADDON_ID)`, `.onSelect(...)`, `.unset()` in the test provider's `clear` | Manager, inside `addons.register`, only if `CONFIG_TYPE === 'DEVELOPMENT'` | Opens the panel when the user selects a status; clears on "Clear all". | The listener is registered synchronously. `unset` is fire-and-forget. |
| C5 | `src/TestProviderRender.tsx:74-79` | `experimental_useStatusStore(selector)` | Manager, React hook | Counts `status-value:warning` for this addon. | Read-only subscription with a selector. |
| C6 | `src/TestProviderRender.tsx:98-100` | `experimental_useTestProviderStore(s => s[ID] ?? 'test-provider-state:pending')` | Manager, React hook | Reads its own provider state. | Tolerates `undefined` (it defaults to pending), so a late first value is fine. |
| C7 | `src/TestProviderRender.tsx:123-126` | `experimental_getTestProviderStore(ID).onRunAll(cb)` in `useEffect`, with the returned unsubscribe as cleanup | Manager, React effect | Starts a build when the user clicks "Run all". | `onRunAll` returns an unsubscribe function. The listener only fires while mounted. |
| C8 | `src/preset.ts:8,190` | `experimental_getTestProviderStore` from **`storybook/internal/core-server`** | **Server**, inside `experimental_serverChannel` | Gets the handle. | Server-side store exists when `experimental_serverChannel` runs. |
| C9 | `src/preset.ts:235-243` | `testProviderStore.runWithState(async () => runChromaticBuild(...))` | Server, `START_BUILD` channel handler | Sets running, then succeeded or crashed. | Does not await the returned promise. |
| C10 | `src/preset.ts:245-248` | `testProviderStore.setState('test-provider-state:succeeded')` | Server, `STOP_BUILD` handler | Marks the provider done when the user stops. | Fire-and-forget. May race with C9's final `succeeded`/`crashed`; either order ends in a terminal state. |

Chromatic does **not** use `experimental_UniversalStore`, `useUniversalStore`, `MockUniversalStore`, `internal_*` stores, `getAll` or `getState`. Its `SharedState` / `useSharedState` is its own channel helper, not Storybook's `UniversalStore`. Its tests mock `storybook/manager-api` and `storybook/internal/core-server` with `vi.mock` (`src/manager.test.ts`, `src/Panel.test.tsx`, `src/preset.share.test.ts`).

## 2. Other public consumers

Method: `gh search code` for each of `experimental_UniversalStore`, `experimental_useUniversalStore`, `experimental_MockUniversalStore`, `experimental_getStatusStore`, `experimental_useStatusStore`, `experimental_getTestProviderStore`, `experimental_useTestProviderStore`, plus `useStatusStore`, `useTestProviderStore`, `getStatusStore`, `getTestProviderStore` and `onRunAll`. Each ran unfiltered and with `--extension ts|tsx|jsx|js`. I dropped `storybookjs/storybook` and its forks (`CloudAEye/storybook-example`, `mfrancime/trident-archive`, `ncsound919/Environmental-Initiatives-`). I also dropped committed build output (`storybook-static/`, `sb-manager/`, `*.github.io`, `dist/`, `assets/`), which makes up most raw hits because the manager globals list names every export. Plain `useStatusStore` hits are mostly unrelated app stores. GitHub caps each query at 100 results, so treat this list as a lower bound. Download counts are from `api.npmjs.org`, week 2026-09-15 to 2026-09-21. I confirmed the published tarballs with `npm pack`.

| Consumer (npm, downloads/wk, GitHub stars) | Call sites | APIs | Where / how | Assumption |
|---|---|---|---|---|
| **`@percy/storybook`** 10.0.3, **69,435/wk**, 154★ ([ReviewPage.jsx@824922f](https://github.com/percy/percy-storybook/blob/824922f565/src/components/ReviewPage.jsx#L126-L170)) | `:129`, `:157`, `:166` | `experimental_getStatusStore`, `set`, `unset(storyIds)` | Manager, inside `useEffect` (lazy chunk) | Fire-and-forget. Cleanup `unset` runs after the next `set`, so it needs in-order writes. Note: it passes `status: 'success'`, not `value`, so its statuses do not match the current `Status` type. |
| **`storybook-addon-tag-badges`** 3.1.0, **282,667/wk**, 73★ ([renderLabel.tsx@2c900a5](https://github.com/Sidnioulz/storybook-addon-tag-badges/blob/2c900a51cc/src/renderLabel.tsx#L22)) | `:22` | `experimental_useStatusStore(all => all[item.id])` | Manager, React hook inside the sidebar `renderLabel` | Read-only. |
| `@accesslint/storybook-addon` 0.8.13, 23/wk, 13★ ([manager.tsx@a839ea7](https://github.com/AccessLint/accesslint/blob/a839ea7274/storybook-addon/src/manager.tsx#L15-L30)) | `:15-29`, `:122`, `:147`, `:171` | `getStatusStore`, `getTestProviderStore`, `useTestProviderStore`, `onClearAll`, `onSelect`, `set`, `setState` | **Module scope** getters **and a module-scope `onClearAll` subscription**. Writes in a `useChannel` handler. Feature-detects the exports with `(managerApi as any).experimental_*`. | Module-scope handles and listeners. The `setState('succeeded')` guard reads `providerState` from the hook, not from a fresh read after a write. |
| `storyproof` 0.1.0-next.2, 106/wk, 1★ ([manager.tsx@67a7275](https://github.com/leon0399/storyproof/blob/67a7275885/packages/storyproof/src/manager.tsx#L29-L78), [channel.ts](https://github.com/leon0399/storyproof/blob/67a7275885/packages/storyproof/src/manager/channel.ts#L23-L96)) | `manager.tsx:29-30,49-58,65,76`; `channel.ts:56-57` | `getStatusStore`, `getTestProviderStore`, `unset`+`set`, `setState`, `onSelect`, `onRunAll`, `onClearAll` | **Module scope** getters. Writes from channel events. | In-order `unset` then `set`. **It retries writes that throw `Cannot set state before store is ready`** (`createRetryingProjection`), so the "not ready" error is already a problem for addon authors. |
| `@techsio/storybook-better-a11y` 0.1.3, 48/wk, 0★ ([A11yContext.tsx@d0ecf76](https://github.com/TechsioCZ/storybook-addons/blob/d0ecf76a2d/packages/addon-a11y-apca/src/components/A11yContext.tsx#L125-L140)) | `:125`, `:130` | `useStatusStore`, `getStatusStore('storybook/component-test').onAllStatusChange` | Manager, React hook + `useEffect` | Read-only. Copy of `@storybook/addon-a11y`'s `A11yContext`. It reads **another addon's** type ID. |
| `@testingbot/storybook` 0.1.0, not on npm, 0★ ([test-provider.tsx@5a16115](https://github.com/testingbot/storybook/blob/5a16115197/src/test-provider.tsx#L60-L90), [test-provider-core.ts](https://github.com/testingbot/storybook/blob/5a16115197/src/test-provider-core.ts#L102-L160)) | `test-provider.tsx:78-88`; `core.ts:109-158` | `getStatusStore`, `getTestProviderStore`, `useTestProviderStore`, `set`, `unset`, `setState`, `onRunAll`, `onClearAll` | Manager, inside a register function, driven by channel events | Fire-and-forget. `unset` then `setState` in the same handler. |
| `@surfnet/curve-storybook-config` 0.5.1, not on npm, 2★ ([a11y-status.ts@fc32203](https://github.com/SURFnet/DesignSystem/blob/fc322031ad/packages/storybook-config/src/a11y-status.ts#L17-L57)) | `:19`, `:53` | `getStatusStore`, `set` | Manager, inside `addons.register`. **Writes synchronously during register** and on `SET_INDEX`. | The store is writable during `addons.register`. |
| `lmestel/storybook-addon-markup-snapshots` (`@kickstartds/storybook-addon-markup` 0.0.1, not on npm), 0★ ([manager.tsx@84b7208](https://github.com/lmestel/storybook-addon-markup-snapshots/blob/84b7208560/src/addon/manager.tsx#L17-L55), [preset.ts](https://github.com/lmestel/storybook-addon-markup-snapshots/blob/84b7208560/src/addon/preset.ts#L1-L22)) | manager, preset, `TestProviderRender.tsx:51-52`, `MarkupPanel.tsx:383,475,506,604` | **`experimental_UniversalStore.create`** (server leader + manager follower), **`experimental_useUniversalStore`**, `getStatusStore`, `useTestProviderStore`, **`internal_fullTestProviderStore.runAll()`**, and a **private `store.channel.emit('UNIVERSAL_STORE:storybook/test', ...)`** hack | Manager register + server `experimental_serverChannel` | Defers `statusStore.set` with `setTimeout(..., 0)` inside `onStateChange` to avoid a re-entrant write. The only real external `UniversalStore` user found. Last pushed 2025-08. |
| `storybook-addon-decision-records`, 1/wk | – | Commented out | – | Not a consumer. |

Nobody found outside the monorepo uses `experimental_MockUniversalStore`, apart from its forks and `.d.ts` copies.

## 3. What Storybook's docs say today

- **`docs/`**: no page mentions `experimental_getStatusStore`, `experimental_getTestProviderStore`, their hooks, `UniversalStore`, `experimental_TEST_PROVIDER`, `onRunAll` or `runWithState`. I grepped `docs/**/*.{md,mdx,ts,tsx,js}` for `StatusStore|TestProviderStore|UniversalStore|test ?provider|TEST_PROVIDER|experimental_updateStatus`. The only hits are unrelated uses of the word "universal".
- **`MIGRATION.md:1787-1810`** ("Experimental Status API has turned into a Status Store", in *From version 8.x to 9.0.0*). It says `experimental_getStatusStore` can be imported from `storybook/internal/core-server`, `storybook/manager-api` **or `storybook/preview-api`**. **The last one is false.** `code/core/src/preview-api/index.ts:30-38` has the preview exports commented out, with the note "Universal Stores are disabled in the preview, until we get automatic leader negotiation in place". The example also calls `experimental_getStatusStore` **at module scope**, outside `addons.register`, which teaches the pattern that now needs lazy resolution.
- **In-code docs**: `code/core/src/shared/universal-store/README.md`, plus JSDoc on `TestProviderStoreById` (`code/core/src/shared/test-provider-store/index.ts`). The JSDoc example uses `runWithState` and `setState`.
- **Current exports** (`origin/next`):
  - `storybook/manager-api` (`code/core/src/manager-api/index.ts:3-18`): `experimental_UniversalStore`, `experimental_useUniversalStore`, `experimental_MockUniversalStore`, `experimental_getStatusStore`, `experimental_useStatusStore`, `experimental_getTestProviderStore`, `experimental_useTestProviderStore`, and the `internal_full*` / `internal_universal*` stores.
  - `storybook/internal/core-server` (`code/core/src/core-server/index.ts:86-126`): `experimental_UniversalStore`, `experimental_MockUniversalStore`, `experimental_getStatusStore`, `experimental_getTestProviderStore`, `internal_full*` / `internal_universal*`, and `prepareHeadlessUniversalStores`.

## 4. What the migration guide must say

1. **`experimental_UniversalStore`, `experimental_useUniversalStore` and `experimental_MockUniversalStore` are removed** from `storybook/manager-api` and `storybook/internal/core-server`. Say what replaces them for addon-owned cross-environment state (the OSA service API). Tell addon authors to use channel events or `useAddonState` for simple manager-only state.
2. **Status and test-provider writes are asynchronous.** `set`, `unset`, `setState` and `runWithState` still return immediately and apply in call order per store. State that the new value is visible to hooks and `onAllStatusChange` listeners only after it round-trips, so code must not call `getAll()` or `getState()` right after a write and expect the new value. (No known consumer does this today.)
3. **Getter handles resolve lazily.** `experimental_getStatusStore(id)` and `experimental_getTestProviderStore(id)` may be called at module scope. Writes made before the service is ready are queued, not thrown. Remove the "Cannot set state before store is ready" error from the addon-facing path; storyproof works around it today.
4. **`internal_fullStatusStore`, `internal_fullTestProviderStore`, `internal_universalStatusStore` and `internal_universalTestProviderStore` are removed or unsupported.** Only one unpublished addon uses `internal_fullTestProviderStore.runAll()`.
5. **Correct the SB 9 entry.** The status store is not exported from `storybook/preview-api`. Either fix the old section or add a note in the SB 11 section.
6. List the unchanged surface explicitly (see the recommendation below), so authors of Chromatic, Percy and tag-badges know they need no changes.

## 5. Recommendation: which APIs to keep as adapters

| API | Keep as adapter? | Why |
|---|---|---|
| `experimental_getStatusStore(typeId)` → `set`, `unset`, `onSelect`, `onAllStatusChange`, `getAll` (manager + core-server) | **Yes** | Chromatic, Percy, AccessLint, storyproof, testingbot, SURFnet, techsio. Make the handle lazy (module-scope callers). Keep writes FIFO per store (Chromatic, Percy and storyproof all do `unset` then `set`). Keep the `onSelect` / `onAllStatusChange` unsubscribe return value. |
| `experimental_useStatusStore(selector)` (manager) | **Yes** | Chromatic, tag-badges (283 k/wk), techsio. Read-only. A thin hook over the service is enough. |
| `experimental_getTestProviderStore(id)` → `onRunAll`, `onClearAll`, `setState`, `runWithState`, `getState`, `settingsChanged` (manager + core-server) | **Yes** | Chromatic (manager `onRunAll`; server `runWithState` + `setState`), AccessLint, storyproof, testingbot. Keep the unsubscribe return value of `onRunAll`/`onClearAll` (Chromatic uses it as `useEffect` cleanup). `runWithState` keeps returning a promise. No caller awaits it. |
| `experimental_useTestProviderStore(selector)` (manager) | **Yes** | Chromatic, AccessLint, testingbot. It must tolerate a missing first value; Chromatic defaults to `pending`. |
| `experimental_UniversalStore`, `experimental_useUniversalStore`, `experimental_MockUniversalStore` | **No, delete** | One 0-star, unpublished addon that also depends on private channel internals. |
| `internal_full*Store`, `internal_universal*Store` | **No** | Internal by name. One unpublished user. |
| `storybook/preview-api` status exports | **No** (they never shipped) | Fix the docs instead. |

Suggested order of work: build the lazy, FIFO status and test-provider adapters first, and test them against `@chromatic-com/storybook` 5.3.1 (C1–C10 above) and `storybook-addon-tag-badges`. Delete `UniversalStore` and the `internal_*` exports last. Tell the Chromatic addon team early, although their code should need no changes if the adapters keep the contracts above.

## Sources

- npm: `npm view @chromatic-com/storybook` (latest 5.3.1, next 5.4.0-next.1), `npm pack` of each package named above, `https://api.npmjs.org/downloads/point/last-week/<pkg>`.
- GitHub code search via `gh search code` on 2026-09-23. Repo links above are pinned to commit SHAs.
- Storybook `origin/next` 6d3aa36dc2d: `MIGRATION.md:1787-1810`, `code/core/src/preview-api/index.ts:30-38`, `code/core/src/manager-api/index.ts:3-18`, `code/core/src/core-server/index.ts:86-126`, `code/core/src/shared/universal-store/index.ts:407-425` (the not-ready error), `code/core/src/shared/status-store/index.ts:114-125`, `code/core/src/shared/test-provider-store/index.ts`.
