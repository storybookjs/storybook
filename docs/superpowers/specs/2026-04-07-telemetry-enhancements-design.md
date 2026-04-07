# Telemetry Enhancements Design

> **Status**: In progress. Co-design between Steve (user) and Claude.
> **Started**: 2026-04-07
> **Mode**: Co-designing → about to write the implementation plan
> **Resume**: see [§ Resume Tomorrow](#resume-tomorrow) at the bottom

## Resume tomorrow

If you're picking this up fresh:
1. Read this whole document. It captures every decision made so far.
2. **Where we left off**: Section 1 (Overview) was approved. Sections 2–8 are written below but **not yet user-reviewed**. Walk through each section, make changes if needed, then mark them as approved.
3. After all sections are approved: invoke the writing-plans skill (Superpowers) and produce three implementation plans, one per stream (A, B, C).
4. Then begin executing Stream A first.
5. **Spike script**: `scripts/spike-extract-features.ts` — run with `node scripts/spike-extract-features.ts ./code` to reproduce the timing numbers if needed. Delete at end of Stream A.
6. **Outstanding clarifications** (if any) are listed in [§ Open Questions](#open-questions).

---

## Context

### What was asked
The user shared a Notion doc with telemetry goals split into:
- **Goals**: distinguish human/agent/CI-agent users; track `sb ai` usage; measure feature adoption to score "instance quality"
- **New user types**: handle agent-in-CI distinctly from human-in-CI
- **New events**: `sb ai prepare start` + `end`, broader ghost-stories sampling, field-metric collection
- **Prompt traits**: track which prompt sections were used so we can correlate prompt iterations with quality

### Corrections to assumptions in the original plan

These were verified by exploring the codebase before making any plan:

1. **`--agent` CLI flag is NOT on every command**. It exists only on `create-storybook` (`code/lib/create-storybook/src/bin/run.ts:77-78`). It is *not* on `sb ai prepare`, `sb dev`, etc.
   - **User clarified**: They meant agent *detection* on every event (already happens via `std-env` in `code/core/src/telemetry/detect-agent.ts:14-20` and is attached as `context.agent` on every event). Not a CLI flag everywhere. ✓

2. **Telemetry IS sent in CI today** — there is no opt-out based on `CI=true`. What CI does:
   - `inCI: true` is attached to every event's `context`
   - `userSince` is skipped in `metadata.userSince` (`storybook-metadata.ts:116-119`)
   - The interactive crash-report prompt is skipped (`withTelemetry.ts:23`)
   - The true opt-out is `disableTelemetry` (env var or `main.ts`)

3. **Vitest addon detection** is not formally in metadata. Only an inline string match in `ghost-stories-channel.ts:57-61`. Reported by name in `metadata.addons` but no dedicated field.

4. **Story count is NOT in `metadata`** — it's per-event in `dev`/`build` payloads via `summarizeIndex` (`code/core/src/core-server/utils/summarizeIndex.ts:28-116`).

5. **`sb ai init` does not exist** as a subcommand. Only `sb ai prepare`. No `--minimal` flag. React + Vite only (early-exits otherwise at `ai/index.ts:62-73`).
   - **User clarified**: "init" is colloquial — refers to the case where an agent runs `sb init` which calls `sb ai prepare` at the end. We're only implementing telemetry for `sb ai prepare`. ✓

6. **MCP addon CANNOT observe telemetry**. It's not even in the monorepo — it's an external npm package. Its tools (`preview-stories`, `get-storybook-story-instructions`, `list-all-documentation`, `get-documentation`, `run-story-tests`) do not expose telemetry. The internal Storybook UI also has `core.disableTelemetry: true` (`code/.storybook/main.ts:140-142`).

7. **Static Storybook builds send no runtime telemetry from the browser** — `telemetry()` is Node-only. The `preview-first-load` event works in dev because of a server-side channel handler (`telemetry-channel.ts:34-44`). In static builds there's no server.
   - **User decided**: For static builds, ship feature data in the `build` event payload only. No new infrastructure for runtime static telemetry. ✓

8. **`PREVIEW_INITIALIZED` does not re-fire on story HMR** (preview singleton preserved via `window.__STORYBOOK_PREVIEW__ ||`), but DOES re-fire on browser refresh and on `web-components-vite` (which uses `hot.decline()`). Manager has no HMR (esbuild builder), so `useEffect` listeners are stable.

9. **`storybook-metadata.ts` is cached per-process** keyed only on the main config hash (`storybook-metadata.ts:295-310`), so preview.ts edits during a session are invisible to telemetry.
   - **User decided**: Don't invalidate on preview HMR. First measurement is final for this ship. ✓

10. **Existing addon telemetry already sends every addon by full name** (`metadata.addons` in `storybook-metadata.ts:180-218`). `sanitizeAddonName` is a path normalizer, not a privacy filter. Community addons leak verbatim today.
    - **User decided**: Sanitize only at the wire-serialization step inside the telemetry pipeline. Don't modify in-memory data structures. ✓

### Spike: full feature extraction is feasible

Ran `scripts/spike-extract-features.ts` against `./code` (which has 505 indexed story files — Storybook's own internal Storybook is one of the largest in the world).

| Metric | Value |
|---|---|
| Total wall time (best of 3 trials) | **641 ms** |
| Files parsed OK | 505 / 508 (3 edge-case parse failures, all detectable) |
| Total stories extracted | 2,092 |
| Per-file p50 | 0.66 ms |
| Per-file p95 | 3.91 ms |
| Per-file p99 | 8.05 ms |
| Per-file max | 32.37 ms (large file with 63 stories) |
| Read I/O | 112 ms |
| Parse (loadCsf + AST traversal) | 483 ms |
| **Extract (the new work)** | **38 ms** |
| Heap memory delta | 19 MiB |

**Implication**: Full extraction is essentially free. The parse cost is already paid by the existing indexer. We can hook our new annotation tracking into the existing CsfFile.parse() loop for ~zero marginal cost. Sampling, browser introspection, and request/response APIs are all unnecessary.

**Architectural decision**: Extend `CsfFile.parse()` and `IndexInputStats` in place. Both `dev` and `build` events get the enriched payload via the existing `summarizeStats` path. ✓

### Decisions captured in chronological order

1. ✓ **Sequencing**: Three sequential PRs in order A → B → C
2. ✓ **Field-metric collection location**: Originally browser+server hybrid, but the spike showed full server-side extraction is feasible. Now: full extraction inline in CsfFile.parse() and summarizeStats.
3. ✓ **Sample size**: N/A (no sampling needed)
4. ✓ **Visit-tracking**: Deferred. Not part of this iteration.
5. ✓ **Static build handling**: Feature data in `build` event payload only.
6. ✓ **Preview HMR resend**: No, first measurement is final.
7. ✓ **Whole-file telemetry**: When extracting features, return data for the whole file (already happens since we extend the existing per-file parse loop).
8. ✓ **Addon shape**: Sanitize at wire layer only. In-memory `metadata.addons` stays unchanged. Add new `metadata.addonCategories` field (bucket counts).
9. ✓ **Ghost stories trigger**: Replace modal trigger with post-`PREVIEW_INITIALIZED + delay`. Confirmed safe — ghost-stories shares no code with create-new-story flow.
10. ✓ **Ghost stories gate broadening**: Once-per-24h-per-project. Drop the same-init-session check.
11. ✓ **`sb ai prepare` events**: Two events — `ai-prepare` (start) + `ai-prepare-end` (with traits, output mode, duration, success).
12. ✓ **Prompt trait modeling**: Single flat object with enum values (e.g. `{monorepo: 'v1', themes: 'none', csfSyntax: 'factory-v1'}`).
13. ✓ **Agent in CI fix**: `isCI() && !detectAgent() ? undefined : globalSettings()` — drop the CI guard when agent is detected, so `userSince` is preserved for agent-in-CI runs.
14. ✓ **Test strategy**: Unit tests + sandbox smoke verification + full e2e telemetry receiver in CI.
15. ✓ **MCP addon installation**: Add to `react-vite/default-ts` sandbox via `sandbox-templates.ts:382-383` (already partially there — verify wiring and use for our debugging + future e2e).
16. ✓ **Addon keyword allowlist**: Catalog category names directly without synonyms — `code`, `data`, `state`, `test`, `style`, `design`, `appearance`, `organize`, `mocking`. Common-noise keywords (`storybook`, `storybook-addon`, `component`, `react`, etc.) ignored. Anything outside the allowlist dropped (no fingerprinting risk).
17. ✓ **Absence vs zero distinction**: Add `complete?: boolean` marker on `IndexInputStats`. Aggregate to `storiesWithCompleteStats` count at the summary level. Metabase can compute coverage and exclude incomplete projects from averages.
18. ✓ **No `userType` field needed**: `context.agent` already attached to every event. The agent-in-CI fix preserves `userSince` so subsequent runs in the same agent session are correlatable.
19. ✓ **userType is implicit** from `context.agent` × `context.inCI`:
    - `agent` undefined + `inCI` false → human user
    - `agent` undefined + `inCI` true → human in CI (probably build job)
    - `agent` set + `inCI` false → agent on user's machine
    - `agent` set + `inCI` true → agent in CI (e.g. Copilot)

### Local debugging setup (planned)

The user picked: "**Use sandbox + local receiver + MCP**" — but extended with adding addon-mcp to the sandbox-templates so it's wired automatically.

The setup:
1. Generate a `react-vite/default-ts` sandbox with addon-mcp pre-installed (after Stream A includes the sandbox-templates change)
2. Run a small local mock telemetry receiver (~50 LOC Node script) at `http://localhost:6007/event-log` that prints every event and stores them for inspection
3. Point the sandbox at it: `STORYBOOK_TELEMETRY_URL=http://localhost:6007/event-log STORYBOOK_TELEMETRY_DEBUG=1 yarn storybook`
4. Use MCP tools from Claude Code to drive the manager (navigate stories, run tests, request previews) — these trigger telemetry which we observe via the receiver
5. Same setup forms the basis of the Stream-A unit test target and the Stream-everything end-to-end test

The mock receiver will live at `scripts/mock-telemetry-receiver.ts` (small, reusable, kept after the spike).

---

## Section 1: Overview & stream sequencing — APPROVED ✓

Three sequential PRs:

| Stream | Title | Scope |
|---|---|---|
| **A** | Metadata enrichment | Feature extraction in csf-tools, summarizeStats expansion, preview.ts deeper parse, addon allowlist sanitizer at wire layer, agent-in-CI userSince fix, add `@storybook/addon-mcp` to satellite-addons.ts |
| **B** | `sb ai prepare` events | New `ai-prepare` start/end payloads, prompt-trait extraction, optional `--frontmatter` flag for output mode |
| **C** | Ghost-stories broadening | Trigger change to post-`PREVIEW_INITIALIZED + delay`, 24h-per-project gate, manager-side trigger module |

**Out of scope**: browser-side visit-tracking, per-visit feature collection, static-build runtime telemetry, preview HMR resend, A/B serving of prompt traits.

---

## Section 2: Architecture — end-to-end data flow

### Where the new data comes from and where it goes

```
                               ┌────────────────────────────────────┐
                               │       sb dev / sb build process    │
                               └────────────────────────────────────┘
                                                │
        ┌───────────────────────────────────────┼───────────────────────────────────────────┐
        │                                       │                                           │
        ▼                                       ▼                                           ▼
┌───────────────────┐        ┌──────────────────────────────────┐        ┌──────────────────────────────┐
│ StoryIndexGenerator│        │  storybook-metadata.ts          │        │  ai/index.ts (sb ai prepare) │
│  ──────────────── │        │  ──────────────────────         │        │  ─────────────────────────   │
│  loadCsf() per file│        │  parses preview.ts via         │        │  detects traits while        │
│  CsfFile.parse()  │        │  readConfig() (csf-tools)       │        │  building markdown prompt    │
│  ──────────────── │        │  ──────────────────────         │        │  ──────────────────────      │
│  NEW: extracts    │        │  NEW: extracts decoratorCount,  │        │  NEW: extracts traits        │
│  per-story features│        │  loaderCount, hasLayout,       │        │  (monorepo, themes, mocking, │
│  into __stats     │        │  hasViewport, etc. into        │        │  csfSyntax, etc.)            │
│                   │        │  metadata.preview              │        │                              │
└───────────────────┘        └──────────────────────────────────┘        └──────────────────────────────┘
        │                                       │                                           │
        │                                       │                                           │
        ▼                                       ▼                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              telemetry(eventType, payload, options)                              │
│                              code/core/src/telemetry/index.ts:31                                 │
│                              builds TelemetryData = { eventType, payload, metadata }             │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                       ┌───────────────────────────────────────────────────┐
                       │  NEW: sanitizeAddonsForWire(telemetryData)        │
                       │  applies allowlist + hashing + bucketing on        │
                       │  metadata.addons (and parallel addonCategories)    │
                       └───────────────────────────────────────────────────┘
                                                │
                                                ▼
                       ┌───────────────────────────────────────────────────┐
                       │  sendTelemetry(telemetryData, options)            │
                       │  POST to STORYBOOK_TELEMETRY_URL                  │
                       │  cache in lastEvents (anonymized)                 │
                       └───────────────────────────────────────────────────┘
```

### Stream-A specific path: dev event

`doTelemetry` (`code/core/src/core-server/utils/doTelemetry.ts`) already calls:
```ts
const indexAndStats = await generator?.getIndexAndStats();
// ...
storyIndex: summarizeIndex(indexAndStats.storyIndex),
storyStats: indexAndStats.stats,
```

`indexAndStats.stats` is an `IndexStatsSummary` produced by `summarizeStats.ts:5-14` from each story's `__stats`. Today it has counters for `loaders, play, tests, render, storyFn, mount, beforeEach, moduleMock, globals, factory, tags`. We extend `IndexInputStats` (the per-story shape) and `IndexStatsSummary` (the rolled-up shape) with new fields. **No new event fires** — the existing `dev` event payload just grows.

### Stream-B specific path: ai-prepare events

Today, `code/lib/cli-storybook/src/bin/run.ts:326` wraps `aiPrepare()` in `withTelemetry('ai-prepare', ...)`. That sends only the `boot` event. We add:
- An explicit `telemetry('ai-prepare', startPayload)` call at the start of `aiPrepare()`
- An explicit `telemetry('ai-prepare-end', endPayload, { immediate: true })` call after the prompt is written
- A new `traits` accumulator threaded through `prompt.ts` so each conditional trait records its current version
- Optional `--frontmatter` flag that prepends YAML frontmatter with the same trait data + project context, for use with `--output`

### Stream-C specific path: ghost-stories trigger

The current trigger at `CreateNewStoryFileModal.tsx:177-188` (modal `useEffect` → `GHOST_STORIES_REQUEST`) is replaced. New trigger:
- Manager-side singleton React hook at `code/core/src/manager/components/sidebar/useGhostStoriesTrigger.ts` (new file)
- `api.once(PREVIEW_INITIALIZED, ...)` + 5-second `setTimeout` debounce
- Emits `GHOST_STORIES_REQUEST` (same channel event as today)
- Server-side `ghost-stories-channel.ts` is updated:
  - Replace `lastEvents['ghost-stories']` cache key check with a wall-clock timestamp check (24h since last fire)
  - Drop the `lastInit.body.sessionId !== sessionId` check
  - Keep React + Vitest gate

---

## Section 3: Data model — types & event payloads

### 3.1 New per-story stats fields

In `code/core/src/types/modules/indexer.ts`, extend `IndexInputStats`:

```ts
export interface IndexInputStats {
  // EXISTING — kept as-is for backward compatibility
  loaders?: boolean;
  play?: boolean;
  tests?: boolean;
  render?: boolean;
  storyFn?: boolean;
  mount?: boolean;
  beforeEach?: boolean;
  moduleMock?: boolean;
  globals?: boolean;
  factory?: boolean;
  tags?: boolean;

  // NEW — coverage marker
  /**
   * True when this stats entry was produced by a full-fidelity indexer
   * (CsfFile and others that support all fields). Third-party indexers
   * (svelte-csf, nuxt-csf, ...) that don't populate the new fields should
   * leave this undefined or set it to false. Used by summarizeStats to
   * compute coverage so Metabase can exclude incomplete entries from
   * averages.
   */
  complete?: boolean;

  // NEW — per-story ownership flags (defined directly on the story export,
  // not inherited from the meta or the preview)
  ownDecorators?: boolean;
  ownLoaders?: boolean;
  ownArgTypes?: boolean;
  ownParameters?: boolean;
  ownLayout?: boolean;        // from parameters.layout key on the story
  ownViewport?: boolean;      // from parameters.viewport key on the story
  ownGlobals?: boolean;       // top-level `globals` annotation on story
  ownTags?: boolean;
  usesActionImport?: boolean; // story body textually mentions `action(`
  usesFnImport?: boolean;     // story body textually mentions `fn(`

  // NEW — meta-level inheritance (per-story carry, dedupe by component title in summarize)
  metaDecorators?: boolean;
  metaLoaders?: boolean;
  metaArgTypes?: boolean;
  metaParameters?: boolean;
  metaLayout?: boolean;
  metaViewport?: boolean;
  metaGlobals?: boolean;
  metaTags?: boolean;
  metaRender?: boolean;
}
```

### 3.2 New rolled-up summary fields

In `code/core/src/core-server/utils/summarizeStats.ts`, extend `IndexStatsSummary`:

```ts
// IndexStatsSummary stays as Record<keyof IndexInputStats, number>, now with new keys.
// summarizeStats() also gains coverage tracking:
export type IndexStatsSummary = Record<keyof IndexInputStats, number> & {
  // NEW — number of stats entries that had `complete: true`. Other counters
  // include only entries where complete === true. Anything missing complete
  // is excluded from the per-feature counts.
  storiesWithCompleteStats: number;
  storiesTotal: number;
};
```

### 3.3 New file-level meta stats

In `summarizeIndex.ts`, augment the per-file iteration to compute meta-level counts deduplicated by component title:

```ts
// Adds to the existing return shape of summarizeIndex:
{
  // EXISTING fields stay as-is (storyCount, componentCount, ...)

  // NEW — file-level meta feature counts, computed from per-story metaXxx flags
  // and deduped by component title.
  metaStats: {
    filesTotal: number;            // unique component titles (= unique files, roughly)
    filesWithCompleteStats: number;
    filesWithMetaDecorators: number;
    filesWithMetaLoaders: number;
    filesWithMetaArgTypes: number;
    filesWithMetaParameters: number;
    filesWithMetaLayout: number;
    filesWithMetaViewport: number;
    filesWithMetaGlobals: number;
    filesWithMetaTags: number;
    filesWithMetaRender: number;
  };
}
```

### 3.4 New preview-level fields in `metadata.preview`

In `storybook-metadata.ts`, extend the existing `usesGlobals` extraction at lines 247-257:

```ts
metadata.preview = {
  ...metadata.preview,
  // EXISTING
  usesGlobals: boolean,

  // NEW — extracted from preview.ts AST. All fields are undefined when preview.ts
  // could not be read or parsed (preserves the absence-vs-zero distinction).
  hasDecorators?: boolean;
  decoratorCount?: number;       // length of array literal if statically determinable
  hasLoaders?: boolean;
  loaderCount?: number;
  hasParameters?: boolean;
  hasLayout?: boolean;           // parameters.layout exists
  hasViewport?: boolean;         // parameters.viewport exists
  hasArgTypes?: boolean;
  argTypesCount?: number;
  hasTags?: boolean;
  hasBeforeAll?: boolean;
  hasInitialGlobals?: boolean;
  isCsfFactory?: boolean;        // already extractable via existing isCsfFactoryPreview helper
  // The list of feature keys actually present in the preview default export.
  // Useful for "which features are users adopting in their preview?".
  featuresEncountered?: string[];
};
```

### 3.5 New addon shape on the wire

`metadata.addons` stays as `Record<string, {version, options}>` in memory. In the new `sanitizeAddonsForWire(telemetryData)` step (between `telemetry()` building TelemetryData and `sendTelemetry` sending it), we transform it to:

```ts
// On-the-wire shape (replaces in-memory metadata.addons during serialization)
{
  metadata: {
    addons: {
      // First-party addons (allowlist match): named with version
      "@storybook/addon-a11y": { version: "10.4.0-alpha.6" },
      "@storybook/addon-themes": { version: "10.4.0-alpha.6" },
      // Community addons: hashed name prefix only
      "hashed:8f3a9b2c": { version: undefined },
      "hashed:1d4e5f6a": { version: undefined },
    },
    // NEW parallel field
    addonCategories: {
      code: 0,
      data: 1,
      state: 1,
      test: 3,
      style: 2,
      design: 0,
      appearance: 0,
      organize: 1,
      mocking: 1,
    },
  }
}
```

### 3.6 New `ai-prepare` event payloads

```ts
// EXISTING ai-prepare event (sent by withTelemetry's boot wrapper) stays
// unchanged, but we now also fire an explicit one with rich data.

// NEW: explicit ai-prepare start payload
type AiPrepareStartPayload = {
  cliOptions: {
    output?: string;        // file path if --output was used
    configDir: string;
    packageManager?: string;
  };
  project: {
    framework?: string;
    renderer?: string;
    builder?: string;
    language?: 'ts' | 'js';
    monorepo?: 'nx' | 'turbo' | 'lerna' | 'rush' | 'lage' | 'workspaces' | undefined;
    packageManagerName?: 'npm' | 'pnpm' | 'yarn-classic' | 'yarn-berry';
    hasCsfFactoryPreview?: boolean;
  };
};

// NEW ai-prepare-end event payload
type AiPrepareEndPayload = {
  success: boolean;
  durationMs: number;
  outputMode: 'stdout' | 'file';
  outputBytes?: number;     // size of generated prompt
  /**
   * Flat object of trait names → version strings.
   * 'none' means the trait was not active.
   * Otherwise, an enum value like 'v1', 'v2', 'minimal', etc.
   * See § Section 5 for the full trait list.
   */
  traits: Record<string, string>;
  error?: string;           // if success === false
};
```

### 3.7 No `userType` field

Decided: not introducing `userType`. The existing `context.agent` × `context.inCI` is enough to classify users in queries. Documenting it explicitly so we don't lose this:

| `context.agent` | `context.inCI` | Implicit user type |
|---|---|---|
| undefined | false | Human, local |
| undefined | true | Human/automation in CI (existing behavior) |
| `{name: ...}` | false | Agent on user's machine |
| `{name: ...}` | true | Agent in CI (e.g. Copilot) |

The `userSince` value (`metadata.userSince`) is currently dropped in CI to avoid stable identifiers across CI runners. We'll preserve it when an agent is detected so we can correlate multiple runs in the same agent session.

---

## Section 4: Stream A — Metadata enrichment

### 4.1 Files touched

| File | Change |
|---|---|
| `code/core/src/types/modules/indexer.ts` | Extend `IndexInputStats` interface with new ownership/meta/usage fields and `complete?: boolean` |
| `code/core/src/csf-tools/CsfFile.ts` | In `parse()` (around line 928-931): replace the OR-merging loop with explicit story-vs-meta tracking. Add the new annotation keys. Set `complete: true` on every story produced by CsfFile. Add textual `fn(`/`action(` scan inside story body slices. Detect and propagate `parameters.{layout,viewport,actions}` sub-keys from object literals. |
| `code/core/src/core-server/utils/summarizeStats.ts` | Extend `IndexStatsSummary` with `storiesTotal` and `storiesWithCompleteStats`. Update `addStats` and `summarizeStats` to track coverage and only sum boolean fields when `complete === true`. |
| `code/core/src/core-server/utils/summarizeIndex.ts` | Add per-file iteration that produces `metaStats: { filesWithMetaDecorators, ... }` deduped by component title. |
| `code/core/src/telemetry/storybook-metadata.ts` | Extend the existing `usesGlobals` block (lines 247-257) to also extract decoratorCount, loaderCount, layout/viewport presence, argTypes, beforeAll, and other preview-level data via the same `readConfig` path. |
| `code/core/src/telemetry/storybook-metadata.ts` | Drop the CI guard from `userSince` reading: change `isCI() ? undefined : globalSettings()` to `isCI() && !detectAgent() ? undefined : globalSettings()`. |
| `code/core/src/telemetry/sanitize-addons.ts` (NEW) | New `sanitizeAddonsForWire(addons, packageJson)` function. Reads addon allowlist via existing `isCorePackage`/`isSatelliteAddon`, hashes community addon names via existing `oneWayHash`, computes `addonCategories` by reading installed `package.json.keywords` of each addon. |
| `code/core/src/telemetry/addon-keyword-buckets.ts` (NEW) | Hardcoded allowlist: `['code', 'data', 'state', 'test', 'style', 'design', 'appearance', 'organize', 'mocking']`. |
| `code/core/src/common/satellite-addons.ts` | Add `'@storybook/addon-mcp'` to the list. |
| `code/core/src/telemetry/index.ts` | Apply `sanitizeAddonsForWire` to `telemetryData.metadata` between building and sending. Also attach computed `addonCategories`. |
| `code/lib/cli-storybook/src/sandbox-templates.ts` | Verify `@storybook/addon-mcp` is fully wired in the `react-vite/default-ts` template (lines 382-383 already partially do this). |
| `scripts/mock-telemetry-receiver.ts` (NEW) | Small Node http server that logs and stores telemetry events for local debugging and tests. |
| `scripts/spike-extract-features.ts` | DELETE at the end of stream A. |

### 4.2 Tests

Each new piece gets unit coverage:
- `code/core/src/csf-tools/CsfFile.test.ts` — extend with cases for the new ownership fields and the textual scan
- `code/core/src/core-server/utils/summarizeStats.test.ts` — coverage tracking, exclusion of incomplete entries
- `code/core/src/core-server/utils/summarizeIndex.test.ts` — `metaStats` produced correctly, deduped by title
- `code/core/src/telemetry/storybook-metadata.test.ts` — preview-level extraction for layout/viewport/decorators/etc.
- `code/core/src/telemetry/sanitize-addons.test.ts` (NEW) — allowlist matching, hashing, bucketing, edge cases
- `code/core/src/telemetry/storybook-metadata.test.ts` — `userSince` preserved when agent detected in CI

End-to-end:
- Generate the react-vite/default-ts sandbox with addon-mcp wired
- Spin up `scripts/mock-telemetry-receiver.ts` on localhost:6007
- `STORYBOOK_TELEMETRY_URL=http://localhost:6007/event-log yarn storybook` in the sandbox
- Walk through stories via MCP `preview-stories` tool
- Assert the receiver captured `dev` and `boot` events with expected `metadata.preview.{decoratorCount,...}` and `payload.storyStats.{ownDecorators,...}` fields
- One e2e test in `code/e2e-tests/telemetry.spec.ts` (NEW) per stream

### 4.3 Risks

- **Third-party indexers** (svelte-csf, nuxt-csf, future renderers) won't populate the new fields. Their stats will have `complete: undefined`, which is the correct signal — Metabase queries should exclude these from coverage averages. Document this in the field descriptions.
- **`parameters.layout` detection** requires the `parameters` value to be a static object literal (not a variable reference or function call). For dynamic patterns we can't detect specific sub-keys. We log this as a known limitation in the field comment; the `complete` flag is still `true` because the parser worked, we just can't see inside dynamic values.
- **Addon `package.json.keywords` is read at runtime** via `getActualPackageJson` which already resolves installed paths. This adds I/O for each non-allowlisted addon. Cost is negligible (most projects have <10 addons).
- **Sanitization side effects on cached events**. The `event-cache.ts` `lastEvents` write happens inside `sendTelemetry`, after our sanitize step, so the cache contains the sanitized shape. This is intentional (privacy: even if disk cache leaks, community addon names are not there). No breakage expected since the only consumers of `lastEvents` use it for "did this event fire" checks, not name lookups.

---

## Section 5: Stream B — `sb ai prepare` events + prompt traits

### 5.1 Files touched

| File | Change |
|---|---|
| `code/core/src/telemetry/types.ts` | Add `'ai-prepare-end'` to the `EventType` union (line 9-48 area). |
| `code/lib/cli-storybook/src/ai/types.ts` | Add `AiPrepareTraits` flat object type. Extend `AiPrepareOptions` with `frontmatter?: boolean` (CLI flag). |
| `code/lib/cli-storybook/src/ai/prompt.ts` | Refactor `getPrompts` and `getSetupInstructions` to thread a `traits: AiPrepareTraits` accumulator. Each conditional branch records its trait value. Today only `csfSyntax: 'factory-v1' \| 'csf3-v1'` is detectable (the only existing branch). New traits like `themes`, `mocking`, `monorepo` get their initial `'v1'` value when their corresponding sections are added (or wired with `'none'` placeholder for now, ready for future expansion). |
| `code/lib/cli-storybook/src/ai/index.ts` | Fire `telemetry('ai-prepare', startPayload)` at start. Run `aiPrepare`. Fire `telemetry('ai-prepare-end', endPayload, { immediate: true })` at end. Project context (monorepo, packageManager, framework, builder, renderer, language, hasCsfFactoryPreview) is gathered into the start payload. |
| `code/lib/cli-storybook/src/ai/index.ts` | New `--frontmatter` flag handling: when both `--output` and `--frontmatter` are present, prepend YAML frontmatter to the markdown output containing all traits + project context. |
| `code/lib/cli-storybook/src/bin/run.ts` | Add `--frontmatter` option to the `prepare` subcommand. |
| `code/lib/cli-storybook/src/automigrate/helpers/mainConfigFile.ts` | Extend `getStorybookData` to also return monorepo type, package manager name (today only used as the package manager *factory*, not exposed). |
| Tests as in §4.2 |

### 5.2 Initial trait set (Stream B baseline)

These ship with Stream B as version `'v1'` for the active trait, `'none'` for the placeholders:

| Trait name | Stream-B value | Description |
|---|---|---|
| `csfSyntax` | `'factory-v1'` or `'csf3-v1'` | Already has the only existing branch in prompt.ts |
| `setupGenericV1` | `'v1'` | The current overall setup instructions baseline |
| `monorepo` | `'none'` (placeholder, not yet generated) | Reserved for future monorepo-specific instructions |
| `themes` | `'none'` | Reserved |
| `mocking` | `'none'` | Reserved |
| `webpackStyling` | `'none'` | Reserved |
| `cliDiscovery` | `'none'` | Reserved |
| `imports` | `'none'` | Reserved |
| `headTail` | `'none'` | Reserved |
| `autodocsFeature` | `'none'` | Reserved |
| `playFeature` | `'none'` | Reserved |
| `argsFeature` | `'none'` | Reserved |
| `actionsFeature` | `'none'` | Reserved |
| `layoutFeature` | `'none'` | Reserved |
| `loadersFeature` | `'none'` | Reserved |
| `viewportsFeature` | `'none'` | Reserved |
| `globalsFeature` | `'none'` | Reserved |
| `decoratorsFeature` | `'none'` | Reserved |
| `argTypesFeature` | `'none'` | Reserved |
| `docsContent` | `'none'` | Reserved |
| `storyContent` | `'none'` | Reserved |
| `healEmptyRenders` | `'none'` | Reserved |

The point of registering these as `'none'` placeholders is to lock in the schema so future PRs that add prompt sections can simply flip them to `'v1'`/`'v2'`/etc. without telemetry-side migrations.

### 5.3 Frontmatter shape

When `--frontmatter --output prompt.md` is used:

```markdown
---
storybook: 10.4.0-alpha.6
framework: '@storybook/react-vite'
renderer: '@storybook/react'
builder: '@storybook/builder-vite'
language: ts
monorepo: nx
packageManager: pnpm
hasCsfFactoryPreview: true
traits:
  csfSyntax: factory-v1
  setupGenericV1: v1
  themes: none
  mocking: none
---
# Storybook Setup
...
```

Evals can read the frontmatter to compute trait-correlated quality metrics.

### 5.4 Risks

- **`'none'` proliferation**: declaring 20+ reserved traits when only 2 are active feels heavy. Trade-off: schema is locked from day one and analytics is ready.
- **Frontmatter parser conflicts**: agents reading the prompt might misinterpret YAML frontmatter as part of the markdown body. We make `--frontmatter` opt-in for that reason.
- **`ai-prepare-end` may not fire on uncaught exceptions** — we use `immediate: true` and a try/finally pattern but agents that kill the process won't always let us flush. We accept partial data; the existing `withTelemetry` error path catches uncaught throws as `error` events, which we can join in queries.

---

## Section 6: Stream C — Ghost-stories broadening

### 6.1 Files touched

| File | Change |
|---|---|
| `code/core/src/manager/components/sidebar/CreateNewStoryFileModal.tsx` | Remove the `executeGhostStoriesFlow` `useEffect` and `hasRunGhostStoriesFlow` ref. The modal no longer triggers ghost stories. |
| `code/core/src/manager/components/sidebar/Sidebar.tsx` (or new module) | Add a new `useGhostStoriesTrigger()` hook (or render a tiny `<GhostStoriesTrigger />` component in the manager root) that listens to `api.once(PREVIEW_INITIALIZED, ...)` + 5-second debounce, then emits `GHOST_STORIES_REQUEST`. |
| `code/core/src/core-server/server-channel/ghost-stories-channel.ts` | Replace `lastEvents['ghost-stories']` cache key check with `Date.now() - lastFiredAt > 24h` (where `lastFiredAt` is stored in a new dedicated cache key). Remove the `lastInit.body.sessionId !== sessionId` check entirely. Keep React + Vitest gate. |
| `code/core/src/telemetry/event-cache.ts` | Possibly extend with a generic timestamp-cache helper if `ghost-stories-channel.ts` doesn't already have a clean way to read/write a single timestamp. |

### 6.2 24h gate implementation

The cleanest implementation: use the existing `lastEvents['ghost-stories']` body, which is already written by the telemetry pipeline after a successful `telemetry('ghost-stories', ...)` call, and contains a wall-clock timestamp (the receive time, available via `eventsCache.set` chain). Read it at the top of the handler:

```ts
const lastEvents = await getLastEvents();
const lastGhostStoriesRun = lastEvents['ghost-stories'];
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
if (
  lastGhostStoriesRun &&
  Date.now() - new Date(lastGhostStoriesRun.timestamp).getTime() < TWENTY_FOUR_HOURS
) {
  return; // already ran in the last 24h, skip
}
// (remove the `lastInit.body.sessionId !== sessionId` check)
```

If `lastEvents` entries don't have a serialized timestamp today, we add one in the cache layer (single small change in `event-cache.ts`).

### 6.3 Manager-side trigger module

```ts
// code/core/src/manager/components/sidebar/useGhostStoriesTrigger.ts
import { useEffect, useRef } from 'react';
import { PREVIEW_INITIALIZED, GHOST_STORIES_REQUEST } from 'storybook/internal/core-events';
import { useStorybookApi } from 'storybook/manager-api';

const TRIGGER_DELAY_MS = 5000;

export function useGhostStoriesTrigger() {
  const api = useStorybookApi();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const fire = () => {
      if (fired.current) return;
      fired.current = true;
      api.emit(GHOST_STORIES_REQUEST);
    };

    const onInit = () => {
      timeoutId = setTimeout(fire, TRIGGER_DELAY_MS);
    };

    api.once(PREVIEW_INITIALIZED, onInit);
    // Fallback: if PREVIEW_INITIALIZED never fires (broken preview), still try
    // after a longer delay
    const fallbackId = setTimeout(fire, 30000);

    return () => {
      api.off(PREVIEW_INITIALIZED, onInit);
      if (timeoutId) clearTimeout(timeoutId);
      clearTimeout(fallbackId);
    };
  }, [api]);
}
```

Hook is called once from the sidebar's top component (or from a new tiny container at the root).

### 6.4 Risks

- **Vitest startup cost**: ghost-stories runs Vitest. Once per 24h is fine, but we should make sure the trigger doesn't overlap with the user's first interaction (the 5s delay helps).
- **PREVIEW_INITIALIZED re-fire on reload**: `api.once(...)` ensures we only register one listener, and `fired.current` ensures we never fire twice in the same manager tab.
- **Race with the existing modal trigger**: nothing — we remove that path entirely as part of this stream.
- **Cache timestamp format**: today `lastEvents` entries are `{ body, ... }`. We need to confirm there's a timestamp in there or add one. Implementation detail, will verify in the plan.

---

## Section 7: Local debugging + test strategy + MCP installation

### 7.1 Mock telemetry receiver

`scripts/mock-telemetry-receiver.ts` — small standalone Node script.

```ts
#!/usr/bin/env node
import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const PORT = Number(process.env.PORT || 6007);
const LOG_DIR = resolve(process.env.LOG_DIR || '.cache/telemetry-debug');
const events: any[] = [];

await mkdir(LOG_DIR, { recursive: true });

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/event-log') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        events.push({ receivedAt: new Date().toISOString(), ...data });
        // eslint-disable-next-line no-console
        console.log(`\n[telemetry] ${data.eventType}`);
        console.log(JSON.stringify(data, null, 2));
        // Append to a daily log file
        await writeFile(
          resolve(LOG_DIR, `events-${new Date().toISOString().slice(0, 10)}.jsonl`),
          JSON.stringify({ receivedAt: new Date().toISOString(), ...data }) + '\n',
          { flag: 'a' }
        );
        res.statusCode = 200;
        res.end('ok');
      } catch (e) {
        res.statusCode = 400;
        res.end('bad json');
      }
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/events') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(events));
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock telemetry receiver listening on http://localhost:${PORT}/event-log`);
  console.log(`GET http://localhost:${PORT}/events to see all received events`);
  console.log(`Logs in ${LOG_DIR}`);
});
```

### 7.2 Local debugging workflow

```bash
# Terminal 1: start the receiver
node scripts/mock-telemetry-receiver.ts

# Terminal 2: generate and start the sandbox
yarn task sandbox --template react-vite/default-ts --start-from auto
cd ../storybook-sandboxes/react-vite-default-ts
STORYBOOK_TELEMETRY_URL=http://localhost:6007/event-log STORYBOOK_TELEMETRY_DEBUG=1 yarn storybook

# Now any interaction with Storybook (via browser or via MCP from Claude Code)
# triggers telemetry events that show up in Terminal 1.
```

### 7.3 End-to-end test

`code/e2e-tests/telemetry.spec.ts` (NEW). Pseudo-code:

```ts
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { request } from 'node:http';

test.describe('telemetry', () => {
  let receiver: ChildProcess;
  beforeAll(async () => {
    receiver = spawn('node', ['scripts/mock-telemetry-receiver.ts'], {
      env: { ...process.env, PORT: '6007', LOG_DIR: 'tmp/telemetry-test' },
      stdio: 'pipe',
    });
    await waitForReceiver('http://localhost:6007');
  });

  afterAll(() => receiver.kill());

  test('dev event includes feature stats', async () => {
    // run storybook in a sandbox already wired up by sandbox-templates
    // ... (use the existing sandbox harness that other e2e tests use)
    const events = await getEvents();
    const devEvent = events.find((e) => e.eventType === 'dev');
    expect(devEvent).toBeDefined();
    expect(devEvent.payload.storyStats.storiesTotal).toBeGreaterThan(0);
    expect(devEvent.payload.storyStats.storiesWithCompleteStats).toBeGreaterThan(0);
    expect(devEvent.metadata.preview.hasDecorators).toBeDefined();
    expect(devEvent.metadata.addons['@storybook/addon-mcp']).toBeDefined();
  });

  test('ai-prepare emits start and end events', async () => { ... });
  test('ghost-stories fires within 5s of PREVIEW_INITIALIZED', async () => { ... });
});
```

### 7.4 MCP addon installation in sandbox

Already partially in `code/lib/cli-storybook/src/sandbox-templates.ts:382-383`. Stream A includes verifying it's wired correctly in the React Vite sandbox template's `extraDependencies` and `editAddons`.

Once the sandbox is regenerated, MCP is at `http://localhost:<storybook-port>/mcp` and Claude Code (or any MCP client) can drive the manager via the documented tools.

---

## Section 8: Risks, open questions, migration

### 8.1 Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Third-party indexers don't populate `complete` field | High | Document the contract; Metabase queries exclude entries with `complete !== true` |
| `parameters.layout` not detectable for dynamic preview values | Medium | Marked as known limitation; `complete` flag stays `true` if parse succeeded |
| Addon `package.json.keywords` reads add I/O cost | Low | Cache results in the same per-process cache as `getActualPackageVersions` |
| Ghost-stories trigger fires while user's first interaction | Low | 5s debounce after PREVIEW_INITIALIZED |
| Vitest run inside ghost-stories blocks user | Medium | 24h gate ensures it only runs once per project per day |
| Mock telemetry receiver has port conflicts | Low | Configurable PORT env, default 6007 (matches existing CI scripts) |
| `ai-prepare-end` doesn't fire on agent crash | Medium | Use `immediate: true`; document partial-data handling in queries |
| Adding `'@storybook/addon-mcp'` to satellite-addons.ts breaks something elsewhere | Low | The list is consumed by `isSatelliteAddon` in 3 known sites; verify each |
| Frontmatter YAML interferes with prompt parsing for some agents | Low | `--frontmatter` is opt-in |
| `lastEvents` cache schema migration for the new timestamp | Low | If timestamps aren't there today, add them with backward-compat |

### 8.2 Open questions

(Items still to resolve before/during implementation. None of these block writing the plan.)

1. **Where exactly does the `useGhostStoriesTrigger` hook get called from in the manager?** Most natural is at the root of `Sidebar.tsx`, but it could also live in a higher-level container. Verify during implementation.

2. **`parameters.layout` AST detection precision**: do we want to track only the literal string values (e.g. `'centered'`, `'fullscreen'`, `'padded'`) or just presence? Probably just presence for V1.

3. **Should `addonCategories` count appear in the `dev` event payload as well, or only in `metadata`?** Currently planned for metadata only (since metadata is global, attached to all events).

4. **Sandbox-templates verification**: confirm the existing `addon-mcp` references in sandbox-templates.ts are still active or whether they got reverted at some point.

5. **`globalSettings()` schema**: confirm `userSince` exists and is the right value to preserve for agent-in-CI runs. We saw it referenced at `cli/globalSettings.ts:25`.

6. **Trait detection for `'csfSyntax'`** is currently keyed off `hasCsfFactoryPreview`, but if the user has CSF Factory preview but also writes some CSF3 stories, we'd want to know the *prompt's* output style, not the project's existing style. Might need a second trait for "what we generated" vs "what we detected".

7. **Telemetry debug logging size**: the `STORYBOOK_TELEMETRY_DEBUG` output for the new fields could grow large. Consider truncating arrays in the debug output but not in the wire payload.

### 8.3 Migration

- **Backward compatibility**: All new fields are additive. Existing fields stay unchanged. Existing analytics queries continue to work; new queries can use the new fields.
- **`metadata.addons` change**: Community addon names will become hashed on the wire starting from the first deployment. Analytics queries that look up community addon names will silently get nothing. We should communicate this to the analytics team before Stream A ships.
- **`storyStats` new fields**: existing fields stay; new fields are added. Queries that look up specific fields by name will not break.

---

## Spike script — kept until end of Stream A

Location: `scripts/spike-extract-features.ts`

Purpose: timing investigation. Already produced the data in [§ Spike: full feature extraction is feasible](#spike-full-feature-extraction-is-feasible). Will be deleted at the end of Stream A.

Reproduce:
```bash
node scripts/spike-extract-features.ts ./code
node scripts/spike-extract-features.ts ../storybook-sandboxes/react-vite-default-ts
```

---

## Resume tomorrow

If you're picking this up fresh:

1. **Read this whole document.** It captures every decision made.
2. Where we left off: **Section 1 was approved by Steve.** Sections 2–8 are written but not yet user-reviewed.
3. **Walk Steve through Sections 2–8** one by one, accepting changes. Use mcp_question for each section with "Approved / Make changes" options.
4. After all sections approved: **invoke writing-plans skill** (Superpowers) and produce three implementation plans, one per stream. Save them as separate files in `docs/superpowers/specs/2026-04-07-stream-a-plan.md`, `2026-04-07-stream-b-plan.md`, `2026-04-07-stream-c-plan.md`.
5. **Get plan approval** from Steve. Make changes if asked.
6. **Begin executing Stream A first.** Use the executing-plans / subagent-driven-development skill if appropriate.
7. **Local debugging**: when implementing, use the workflow in §7.2 (sandbox + mock receiver + STORYBOOK_TELEMETRY_DEBUG).
8. **Tests**: run `yarn test` in `code/` for unit tests and the new e2e suite as it's built up.

### Outstanding decisions / Steve to confirm or correct

These are the items where I'd like Steve to glance at the choice once more before locking in:

- [ ] Section 2 (Architecture) — please confirm the data flow is right
- [ ] Section 3 (Data model) — review the new field names for `IndexInputStats` and `metadata.preview`. Especially: do you want `ownXxx` / `metaXxx` naming, or `selfXxx` / `inheritedXxx`, or something else?
- [ ] Section 5.2 (Initial trait set) — you might want to drop some of the `'none'` placeholders if 20+ feels excessive
- [ ] Section 6.2 (24h gate) — confirm the timestamp source in `lastEvents` is acceptable (need to verify this exists) or if we need a new cache field
- [ ] Open questions in §8.2 — at least #2 (parameters.layout precision) and #6 (csfSyntax trait split)

### How to keep Claude on track when resuming

Drop this exact prompt to Claude when you wake up:

> Read `docs/superpowers/specs/2026-04-07-telemetry-enhancements-design.md` from start to finish. Section 1 is approved. Walk me through sections 2-8 one at a time and get my approval/changes for each section. Then invoke the writing-plans skill and produce three plan files (one per stream). Then we'll begin executing Stream A.

---

## Appendix: Decisions log (chronological)

1. **Sequencing**: Three sequential PRs A → B → C
2. **Field-metric collection**: Hybrid → all server-side (after spike)
3. **Sample size**: N/A (no sampling)
4. **Visit-tracking**: Deferred
5. **Static build handling**: Feature data in `build` event payload only
6. **Preview HMR resend**: Don't
7. **Whole-file telemetry**: Yes (free, since we extend per-file parse loop)
8. **Addon shape**: Sanitize at wire layer only
9. **Ghost-stories trigger**: Replace modal trigger with post-PREVIEW_INITIALIZED
10. **Ghost-stories gate**: Once-per-24h-per-project, drop init-session check
11. **`sb ai prepare` events**: Two events (start + end)
12. **Prompt traits**: Flat object with enum values
13. **Agent in CI fix**: `isCI() && !detectAgent() ? undefined : globalSettings()`
14. **Test strategy**: Unit + sandbox smoke + e2e in CI
15. **MCP addon**: Add to react-vite sandbox-templates.ts
16. **Keyword allowlist**: Strict catalog category names, no synonyms
17. **Absence vs zero**: `complete?: boolean` marker on stats entries
18. **No `userType` field**: implied by `agent` × `inCI`
19. **userSince in CI+agent**: Preserve when agent detected
