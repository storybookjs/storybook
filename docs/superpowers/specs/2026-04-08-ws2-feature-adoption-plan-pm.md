# WS2: Feature Adoption Tracking — PM Overview

> **Status**: Ready for review
> **Design doc**: `docs/superpowers/specs/2026-04-07-telemetry-enhancements-design.md`
> **Companion engineer plan**: `docs/superpowers/specs/2026-04-08-ws2-feature-adoption-plan-engineer.md`

## Goal

Ship a single PR that gives us per-story and per-file feature adoption data in every `dev` and `build` telemetry event, plus sanitized addon names on the wire. After this, Metabase dashboards can answer: "What % of stories use decorators?", "How many projects configure layout in their preview?", "Which addon categories are most popular?" — all without leaking community addon identities.

---

## Change 1: Extend `IndexInputStats` with per-story ownership and meta fields

### What changes
In `code/core/src/types/modules/indexer.ts`, add new boolean fields to the `IndexInputStats` interface: `complete`, `ownDecorators`, `ownLoaders`, `ownArgTypes`, `ownParameters`, `ownLayout`, `ownViewport`, `ownGlobals`, `ownTags`, `usesActionImport`, `usesFnImport`, `metaDecorators`, `metaLoaders`, `metaArgTypes`, `metaParameters`, `metaLayout`, `metaViewport`, `metaGlobals`, `metaTags`, `metaRender`.

### Why this change
Today `IndexInputStats` only tracks whether an annotation exists on the story OR the meta (merged together). We can't distinguish "the story defined its own decorators" from "it inherited decorators from the meta". This distinction is critical for measuring feature adoption depth — a project where every meta has decorators but no story does tells a very different story than one where individual stories customize behavior.

The `complete` flag lets us distinguish stories produced by our full-fidelity parser (CsfFile) from those produced by third-party indexers (svelte-csf, nuxt-csf) that won't populate the new fields. Metabase queries can then compute adoption rates over only the stories where we have full data.

### Why this implementation
The `IndexInputStats` interface is the typed contract between indexers and the summary pipeline. Adding optional boolean fields preserves backward compatibility — third-party indexers that don't know about these fields simply leave them undefined. The `complete` marker follows the established pattern of per-entry metadata flags.

### Files touched
- `code/core/src/types/modules/indexer.ts` (add ~20 fields to `IndexInputStats`)

---

## Change 2: Enrich `CsfFile.parse()` to populate the new stats fields

### What changes
In `code/core/src/csf-tools/CsfFile.ts`, modify the post-processing loop (around lines 927-949) that populates `__stats`. Split the current merged annotation check into separate story-level (`ownXxx`) and meta-level (`metaXxx`) fields. Add textual scans for `action(` and `fn(` in story body text. Detect `parameters.layout` and `parameters.viewport` sub-keys from object literals. Set `complete: true` on every story processed by CsfFile.

### Why this change
The existing OR-merge (`!!storyAnnotations[x] || !!self._metaAnnotations[x]`) loses origin information. By checking story annotations and meta annotations separately, we preserve attribution. The textual scans (`usesActionImport`, `usesFnImport`) detect patterns that can't be seen from AST annotation names alone — they indicate whether a story is using the testing-oriented `fn()` or the legacy `action()` pattern.

### Why this implementation
The spike script (`scripts/spike-extract-features.ts`) proved this extraction adds only ~38ms to a 505-file codebase (0.07ms/file). The AST is already fully parsed by this point — we're just reading more nodes from it. No new parsing pass is needed. The `parameters.layout` / `parameters.viewport` detection uses `getFieldNode` on the existing parsed config, matching the same pattern used in `storybook-metadata.ts` for `usesGlobals`.

### Files touched
- `code/core/src/csf-tools/CsfFile.ts` (~30 lines changed in the post-processing loop)
- `code/core/src/csf-tools/CsfFile.test.ts` (new test cases for ownership fields, textual scan, parameters sub-keys)

---

## Change 3: Expand `summarizeStats` with coverage tracking

### What changes
In `code/core/src/core-server/utils/summarizeStats.ts`, extend `IndexStatsSummary` with `storiesTotal` and `storiesWithCompleteStats`. Update `addStats` and `summarizeStats` to only count new boolean fields when `complete === true`.

### Why this change
Without coverage tracking, adoption percentages would be skewed by third-party indexer entries that have all new fields as `undefined` (which counts as `false`). By tracking how many stories have `complete: true`, Metabase can compute `ownDecorators / storiesWithCompleteStats` instead of `ownDecorators / storiesTotal`, giving accurate adoption rates even in mixed-indexer projects.

### Why this implementation
`summarizeStats` is already a simple reduce-and-count function. Adding a coverage gate is 5-6 lines of logic. The existing fields (`loaders`, `play`, etc.) continue to count all stories (backward compatible). Only the new `own*`/`meta*` fields are gated on `complete`.

### Files touched
- `code/core/src/core-server/utils/summarizeStats.ts` (~15 lines)
- `code/core/src/core-server/utils/summarizeStats.test.ts` (new test cases)

---

## Change 4: Add `metaStats` to `summarizeIndex`

### What changes
In `code/core/src/core-server/utils/summarizeIndex.ts`, add a per-file iteration that produces `metaStats` — file-level meta feature counts deduplicated by component title.

### Why this change
`summarizeStats` gives per-story counts. But for meta-level features (decorators in the default export, loaders in the meta), we need per-file counts deduplicated by component title (since every story in a file shares the same meta). Without deduplication, a file with 20 stories and meta-level decorators would count as 20 stories with `metaDecorators`, inflating the metric.

### Why this implementation
`summarizeIndex` already iterates all entries and tracks unique titles (for `componentCount`). Adding a `Set<string>` per meta field that records which titles have it, then counting the set sizes at the end, is a natural extension of the existing loop. This produces `metaStats.filesWithMetaDecorators`, etc.

### Files touched
- `code/core/src/core-server/utils/summarizeIndex.ts` (~30 lines)
- `code/core/src/core-server/utils/summarizeIndex.test.ts` (new test cases)

---

## Change 5: Deeper preview.ts parsing in `storybook-metadata.ts`

### What changes
Extend the existing `usesGlobals` extraction block (lines 247-258) in `code/core/src/telemetry/storybook-metadata.ts` to also extract: `hasDecorators`, `decoratorCount`, `hasLoaders`, `loaderCount`, `hasParameters`, `hasLayout`, `hasViewport`, `hasArgTypes`, `argTypesCount`, `hasTags`, `hasBeforeAll`, `hasInitialGlobals`, `isCsfFactory`, and `featuresEncountered`.

### Why this change
The preview config is the project's global baseline — decorators, loaders, and parameters defined here apply to every story. Today we only extract `usesGlobals`. Knowing how many projects configure global decorators, loaders, or layout gives us a picture of feature adoption at the project level, complementing the per-story data from Change 2.

### Why this implementation
The `readConfig` / `getFieldNode` pattern is already established for `usesGlobals`. We extend it to check more field names. For array fields (decorators, loaders), we additionally check if the node is an `ArrayExpression` and read its `.elements.length` to get counts. For `parameters`, we check sub-keys (`layout`, `viewport`) by drilling into the object literal. All new fields are `undefined` when preview.ts can't be read or parsed — preserving the absence-vs-zero distinction so Metabase knows "we couldn't parse it" vs "it has zero decorators".

### Files touched
- `code/core/src/telemetry/storybook-metadata.ts` (~30 lines in the preview extraction block)
- `code/core/src/telemetry/storybook-metadata.test.ts` (new test cases)

---

## Change 6: Addon sanitization at the wire layer

### What changes
Create `code/core/src/telemetry/sanitize-addons.ts` — a function that transforms `metadata.addons` before sending. First-party addons (matching `isCorePackage()` or `isSatelliteAddon()`) keep their names. Community addons get hashed names (`hashed:<prefix>`). Also compute `metadata.addonCategories` by reading each community addon's `package.json.keywords` and bucketing them into a fixed allowlist of categories.

Apply the sanitizer in `code/core/src/telemetry/index.ts` between building `TelemetryData` and calling `sendTelemetry`.

### Why this change
Today every community addon name is sent verbatim in telemetry. This is a privacy concern — addon names can reveal project intent, internal tools, or company names. Hashing preserves cardinality (we can still count unique community addons) while removing identifiable information. The `addonCategories` bucketing gives us aggregate "what kinds of addons do projects use" data without needing to know specific names.

### Why this implementation
- Sanitize at the wire layer (not in-memory) so that internal code paths that need addon names still work normally.
- Use the existing `oneWayHash` function (already in `storybook/internal/telemetry`) for consistency.
- Read `package.json.keywords` at runtime via `getActualPackageJson` (already used elsewhere in the metadata pipeline). Most projects have <10 addons, so the I/O cost is negligible.
- The keyword allowlist (`code/core/src/telemetry/addon-keyword-buckets.ts`) is a simple hardcoded array: `['code', 'data', 'state', 'test', 'style', 'design', 'appearance', 'organize', 'mocking']`. Only keywords matching this list are counted.

### Files touched
- `code/core/src/telemetry/sanitize-addons.ts` (NEW — ~60 lines)
- `code/core/src/telemetry/sanitize-addons.test.ts` (NEW)
- `code/core/src/telemetry/addon-keyword-buckets.ts` (NEW — ~10 lines, the allowlist)
- `code/core/src/telemetry/index.ts` (add sanitizer call between build and send, ~5 lines)

---

## Change 7: Delete the spike script

### What changes
Delete `scripts/spike-extract-features.ts`.

### Why this change
The spike served its purpose (proved full extraction is feasible at ~38ms marginal cost). It's throwaway code that shouldn't stay in the repo.

### Why this implementation
Just `git rm`.

### Files touched
- `scripts/spike-extract-features.ts` (DELETE)

---

## Summary of all files changed

| File | Change type |
|---|---|
| `code/core/src/types/modules/indexer.ts` | Modify (extend `IndexInputStats`) |
| `code/core/src/csf-tools/CsfFile.ts` | Modify (enrich `__stats` population) |
| `code/core/src/csf-tools/CsfFile.test.ts` | Modify (new test cases) |
| `code/core/src/core-server/utils/summarizeStats.ts` | Modify (coverage tracking) |
| `code/core/src/core-server/utils/summarizeStats.test.ts` | Modify (new test cases) |
| `code/core/src/core-server/utils/summarizeIndex.ts` | Modify (add `metaStats`) |
| `code/core/src/core-server/utils/summarizeIndex.test.ts` | Modify (new test cases) |
| `code/core/src/telemetry/storybook-metadata.ts` | Modify (deeper preview parsing) |
| `code/core/src/telemetry/storybook-metadata.test.ts` | Modify (new test cases) |
| `code/core/src/telemetry/sanitize-addons.ts` | New (wire-layer addon sanitizer) |
| `code/core/src/telemetry/sanitize-addons.test.ts` | New (tests) |
| `code/core/src/telemetry/addon-keyword-buckets.ts` | New (keyword allowlist) |
| `code/core/src/telemetry/index.ts` | Modify (apply sanitizer in pipeline) |
| `scripts/spike-extract-features.ts` | Delete |

## Risks

| Risk | Mitigation |
|---|---|
| Third-party indexers won't populate new `IndexInputStats` fields | `complete` flag distinguishes full-fidelity entries; Metabase queries filter on it |
| `parameters.layout` not detectable for dynamic values (variable references, function calls) | Known limitation; `complete` stays `true` because parse succeeded |
| `package.json.keywords` reads add I/O for each community addon | Most projects have <10 addons; cache results per-process |
| Community addon hashing reduces debugging ability | First-party addons still named; hash is deterministic for correlation |
| `addonCategories` keyword allowlist may not cover all addon purposes | Extensible allowlist; `other` catch-all not needed since we only count known categories |
| Backward compatibility of larger `storyStats` payloads | All new fields are additive; existing queries unaffected |
| `sanitizeAddonsForWire` affects cached events in `lastEvents` | Intentional — sanitized shape is what gets cached, no code reads addon names from cache |
