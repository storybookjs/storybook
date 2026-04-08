# Telemetry Enhancements Design

> **Status**: Design approved. Writing implementation plans.
> **Started**: 2026-04-07
> **Updated**: 2026-04-08
> **Mode**: All sections approved → writing implementation plans
> **Resume**: see [§ Resume Tomorrow](#resume-tomorrow) at the bottom

## Resume tomorrow

If you're picking this up fresh:
1. Read this whole document. It captures every decision made so far.
2. **Where we left off**: All sections approved (2026-04-08). Two workstreams: WS1 (agentic telemetry) and WS2 (feature adoption tracking).
3. Check if implementation plan files exist at `docs/superpowers/specs/2026-04-08-ws1-*.md` and `2026-04-08-ws2-*.md`. If not, invoke writing-plans skill to produce them.
4. Execute WS1 first.
5. **Spike script**: `scripts/spike-extract-features.ts` — delete during WS2 (or whenever convenient).
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

1. ✓ **Sequencing**: ~~Three sequential PRs A → B → C~~ → Two workstreams: WS1 (agentic telemetry) then WS2 (feature adoption tracking)
2. ✓ **Field-metric collection location**: Originally browser+server hybrid, but the spike showed full server-side extraction is feasible. Now: full extraction inline in CsfFile.parse() and summarizeStats.
3. ✓ **Sample size**: N/A (no sampling needed)
4. ✓ **Visit-tracking**: Deferred. Not part of this iteration.
5. ✓ **Static build handling**: Feature data in `build` event payload only.
6. ✓ **Preview HMR resend**: No, first measurement is final.
7. ✓ **Whole-file telemetry**: When extracting features, return data for the whole file (already happens since we extend the existing per-file parse loop).
8. ✓ **Addon shape**: Sanitize at wire layer only. In-memory `metadata.addons` stays unchanged. Add new `metadata.addonCategories` field (bucket counts). → **Moved to WS2**.
9. ✓ **Ghost stories trigger**: Replace modal trigger with post-`PREVIEW_INITIALIZED + 10min delay`. ~~+ 5-second debounce~~ → 10 minutes.
10. ✓ **Ghost stories gate**: ~~Once-per-24h-per-project~~ → Once-ever per project. Use `lastEvents['ghost-stories']` existence as gate.
11. ✓ **`sb ai prepare` events**: Two events — `ai-prepare` (start) + `ai-prepare-end` (with traits, output mode, duration, success).
12. ✓ **Prompt trait modeling**: Single flat object with enum values. ~~22 traits with placeholders~~ → 2 active traits only (`csfSyntax`, `setupGenericV1`), add more as prompt evolves.
13. ✓ **Agent in CI fix**: `isCI() && !detectAgent() ? undefined : globalSettings()` — drop the CI guard when agent is detected, so `userSince` is preserved for agent-in-CI runs.
14. ✓ **Test strategy**: Unit tests + sandbox smoke verification + full e2e telemetry receiver in CI.
15. ✓ **MCP addon installation**: Add to `react-vite/default-ts` sandbox via `sandbox-templates.ts:382-383` (already partially there — verify wiring and use for our debugging + future e2e).
16. ✓ **Addon keyword allowlist**: → **Moved to WS2**.
17. ✓ **Absence vs zero distinction**: → **Moved to WS2**.
18. ✓ **No `userType` field needed**: `context.agent` already attached to every event. The agent-in-CI fix preserves `userSince` so subsequent runs in the same agent session are correlatable.
19. ✓ **userType is implicit** from `context.agent` × `context.inCI`.
20. ✓ **Workstream split (2026-04-08)**: Collapsed three streams into two workstreams by concern. Addon sanitization + addonCategories → WS2. Ghost stories → WS1 with redesigned timing.
21. ✓ **Ghost stories once-ever cache**: Use existing `lastEvents['ghost-stories']` key existence check.
22. ✓ **Trait trimming**: Only ship traits inferable from actual prompt.ts branching.
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

## Section 1: Overview & workstream sequencing — APPROVED ✓ (updated 2026-04-08)

Two sequential workstreams (changed from the original three-stream plan):

| Workstream | Title | Scope |
|---|---|---|
| **WS1** | Agentic telemetry | Agent-in-CI `userSince` fix, `sb ai prepare` start event with rich payload, prompt trait extraction (active traits only), `--frontmatter` flag, evidence-based completion tracking (`ai-setup-evidence` events at CLI entry points within 2h session window), `isStoryAIGenerated()` checker colocated with prompt, add `@storybook/addon-mcp` to satellite-addons.ts, ghost stories redesign (10min delay + once-ever gate via lastEvents cache), mock telemetry receiver |
| **WS2** | Feature adoption tracking | Feature extraction in csf-tools (`IndexInputStats` enrichment, own/meta fields, `complete` marker), `summarizeStats` expansion, `summarizeIndex` `metaStats`, preview.ts deeper parse, addon allowlist sanitizer at wire layer (hash community addons), `addonCategories` bucketing |

**Out of scope**: browser-side visit-tracking, per-visit feature collection, static-build runtime telemetry, preview HMR resend, A/B serving of prompt traits.

**Key changes from original three-stream plan**:
- Streams A+B+C collapsed into two workstreams by concern (agentic vs feature adoption)
- Addon sanitization + addonCategories moved from agentic to feature adoption
- Ghost stories: changed from 24h gate to once-ever with 10min delay
- Trait set trimmed from 22 to 2 active traits (add more as prompt evolves)
- `ai-prepare-end` replaced with evidence-based `ai-setup-evidence` events fired from CLI entry points (2026-04-08)

---

## Section 2: Architecture — end-to-end data flow — APPROVED ✓ (re-scoped to WS1/WS2)

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

### Stream-B specific path: ai-prepare events + evidence-based completion tracking

**Problem**: `sb ai prepare` exits in seconds (it prints a prompt). The agent then spends 5–120 minutes following the instructions: writing stories, adding decorators, running Vitest, starting dev. We cannot delegate observation to the agent — only SB CLI/Node processes can observe and report.

**Solution**: Evidence-based checkpoint events fired from CLI entry points within the existing 2h session window.

Today, `code/lib/cli-storybook/src/bin/run.ts:326` wraps `aiPrepare()` in `withTelemetry('ai-prepare', ...)`. That sends only the `boot` event. We add:
- An explicit `telemetry('ai-prepare', startPayload)` call at the start of `aiPrepare()`
- A new `traits` accumulator threaded through `prompt.ts` so each conditional trait records its current version
- A cached `'ai-setup-pending'` record written at ai-prepare time containing a baseline snapshot (preview file hash, configDir, timestamp)
- Optional `--frontmatter` flag that prepends YAML frontmatter with the same trait data + project context, for use with `--output`

**Evidence collection at subsequent CLI entry points** (replaces the synchronous `ai-prepare-end` event):

```
  sb ai prepare                    sb dev / sb build / sb doctor / ...
  ─────────────                    ────────────────────────────────────
  │                                │
  ├─ fire telemetry('ai-prepare')  ├─ withTelemetry() boot event
  ├─ snapshot preview file hash    ├─ detectAgent() → agent present?
  ├─ cache 'ai-setup-pending'      │    └─ no → skip evidence check
  ├─ generate prompt + traits      ├─ read 'ai-setup-pending' from cache
  └─ exit                          │    └─ missing or >2h old → skip
                                   ├─ collect evidence:
                                   │   ├─ preview file changed? (hash comparison)
                                   │   ├─ AI-authored stories? (isStoryAIGenerated check, dev/build only)
                                   │   └─ doctor ran since setup? (cache timestamp check)
                                   ├─ fire telemetry('ai-setup-evidence', evidence)
                                   └─ continue with normal command
```

**Observation requirements are colocated with the prompt** in `code/lib/cli-storybook/src/ai/setup-requirements.ts`. When the prompt changes (different title prefix, different expected count), both the prompt output and the observation logic update together. The `isStoryAIGenerated()` checker function provides a single swappable point for the planned title→tag migration.

**The single integration point** is `withTelemetry()` (`code/core/src/core-server/withTelemetry.ts`), which already wraps every CLI command. The evidence check runs there after the `boot` event, gated on agent detection (cheap — computed at module load) and cache presence.

**For `dev` specifically**, the story index is available inside `doTelemetry()`. Evidence collection hooks there to get the AI-authored story count from the index. For non-`dev`/`build` commands, `aiAuthoredStories` is `0` (no index available).

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

## Section 3: Data model — types & event payloads — APPROVED ✓ (§3.1-3.5 → WS2, §3.6-3.7 → WS1)

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

### 3.6 New `ai-prepare` event payload and evidence-based completion tracking

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
```

#### Cached pending-setup record

Written to the event cache at `ai-prepare` time under the key `'ai-setup-pending'`. Read by subsequent CLI entry points to decide whether to collect evidence.

```ts
interface AiSetupPendingRecord {
  timestamp: number;          // Date.now() at ai-prepare time
  sessionId: string;          // current session ID
  configDir: string;          // resolved configDir path
  previewFile: string | null; // filename of preview.{ts,tsx,js,jsx,...} or null
  previewHash: string | null; // SHA-256 of preview file contents, or null if no file
  traits: AiPrepareTraits;    // traits from prompt generation
}
```

#### Evidence event (replaces synchronous `ai-prepare-end`)

Instead of firing `ai-prepare-end` when the CLI command exits (which only means "we printed the prompt"), we fire `ai-setup-evidence` from subsequent CLI entry points when an agent is detected and a pending setup record exists within the 2h session window.

```ts
// NEW: ai-setup-evidence event payload
type AiSetupEvidencePayload = {
  trigger: EventType;               // which CLI command triggered this check ('dev', 'build', 'doctor', etc.)
  msSinceAiPrepare: number;         // Date.now() - cached ai-setup-pending timestamp
  evidence: {
    previewChanged: boolean;         // content hash differs from baseline (any reason: modified, created, deleted, renamed)
    aiAuthoredStories: number;       // count of stories passing isStoryAIGenerated() — only at dev/build time, 0 otherwise
    doctorRanSinceSetup: boolean;    // 'doctor' boot event in cache with timestamp > ai-prepare timestamp
  };
  traits: AiPrepareTraits;           // carried from the cached pending record
};
```

**Session window**: Uses the existing `SESSION_TIMEOUT` (2h) from `session-id.ts`. After 2h the cache entry expires silently — no cleanup event, manageable in Metabase.

**Detection order at CLI entry points** (in `withTelemetry()`):
1. Check `detectAgent()` — bail if no agent (cheap, computed at module load)
2. Check `'ai-setup-pending'` in event cache — bail if missing
3. Check timestamp: bail if `Date.now() - pending.timestamp > SESSION_TIMEOUT`
4. Collect evidence, fire `telemetry('ai-setup-evidence', payload)`

**AI story detection via `isStoryAIGenerated()`**: A checker function in `setup-requirements.ts` that currently checks title prefix (`AI Generated/`). When we migrate to a tag-based approach, this single function is the swap point. The story index is only available at `dev`/`build` time; for other CLI commands, `aiAuthoredStories` is `0`.

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

## Section 4: Stream A — Metadata enrichment — APPROVED ✓ (split: agentic items → WS1, feature extraction → WS2)

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

## Section 5: Stream B — `sb ai prepare` events, prompt traits, and evidence-based completion — APPROVED ✓ (revised 2026-04-08)

### 5.1 Files touched

| File | Change |
|---|---|
| `code/core/src/telemetry/types.ts` | Add `'ai-setup-evidence'` to the `EventType` union (line 9-48 area). |
| `code/lib/cli-storybook/src/ai/types.ts` | Add `AiPrepareTraits` flat object type. Extend `AiPrepareOptions` with `frontmatter?: boolean` (CLI flag). |
| `code/lib/cli-storybook/src/ai/prompt.ts` | Refactor `getPrompts` and `getSetupInstructions` to thread a `traits: AiPrepareTraits` accumulator. Each conditional branch records its trait value. Today only `csfSyntax: 'factory-v1' \| 'csf3-v1'` is detectable (the only existing branch). New traits like `themes`, `mocking`, `monorepo` get their initial `'v1'` value when their corresponding sections are added (or wired with `'none'` placeholder for now, ready for future expansion). |
| `code/lib/cli-storybook/src/ai/setup-requirements.ts` (NEW) | Colocated with prompt.ts. Contains `AI_STORY_TITLE_PREFIX`, `AI_EXPECTED_STORY_COMPONENTS`, and `isStoryAIGenerated()` checker function. The checker currently uses title prefix; will swap to tag presence check when tag-based approach ships. Also contains the `AiSetupPendingRecord` type and `snapshotPreviewFile()` helper for recording the baseline. |
| `code/lib/cli-storybook/src/ai/index.ts` | Fire `telemetry('ai-prepare', startPayload)` at start. Cache `'ai-setup-pending'` record (preview file hash, configDir, timestamp, traits). Handle `--frontmatter` flag. No `ai-prepare-end` event — completion is tracked via `ai-setup-evidence` from subsequent CLI entry points. |
| `code/lib/cli-storybook/src/bin/run.ts` | Add `--frontmatter` option to the `prepare` subcommand. |
| `code/core/src/core-server/withTelemetry.ts` | Add evidence collection hook: after `boot` event, check for agent → check for pending setup → collect evidence → fire `ai-setup-evidence`. |
| `code/core/src/core-server/utils/doTelemetry.ts` | Pass story index to evidence collector for `dev` events so `aiAuthoredStories` can be counted via `isStoryAIGenerated()`. |
| Tests as in §4.2 |

### 5.2 Initial trait set (WS1 baseline — trimmed to active traits only)

Only traits that can be inferred from actual conditional branching in `prompt.ts` today:

| Trait name | Value | Source |
|---|---|---|
| `csfSyntax` | `'factory-v1'` or `'csf3-v1'` | `hasCsfFactoryPreview` branch at `prompt.ts:96` |
| `setupGenericV1` | `'v1'` | Overall setup instructions baseline version |

More traits will be added as prompt generation evolves. Each new conditional section in `prompt.ts` should register its trait and version.

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
- **Evidence event never fires if agent crashes early and no subsequent CLI command runs**: Acceptable — if no work was done, no evidence fires. If partial work was done but no CLI command runs, we lose the signal. This is inherent to the "observe at CLI entry points" approach.
- **Preview hash false positive from unrelated edits**: If a developer (not the agent) edits preview.ts within the 2h window, `previewChanged` will be true. At statistical scale (Metabase dashboards), this washes out. Within the 2h post-ai-prepare window with an agent detected, it's overwhelmingly likely the agent did it.
- **`isStoryAIGenerated()` title prefix is brittle**: Planned migration to tag-based approach. The checker function in `setup-requirements.ts` is the single swap point — one-line change when tags ship.
- **`withTelemetry` runs evidence check on every CLI command**: The `detectAgent()` check is module-level (near-zero cost), and the cache read only happens when an agent is detected. Negligible overhead for non-agent usage.

---

## Section 6: Ghost-stories redesign — APPROVED ✓ (10min delay + once-ever, WS1)

### 6.1 Files touched

| File | Change |
|---|---|
| `code/core/src/manager/components/sidebar/CreateNewStoryFileModal.tsx` | Remove the `executeGhostStoriesFlow` `useEffect` and `hasRunGhostStoriesFlow` ref. The modal no longer triggers ghost stories. |
| `code/core/src/manager/components/sidebar/Sidebar.tsx` (or new module) | Add a new `useGhostStoriesTrigger()` hook (or render a tiny `<GhostStoriesTrigger />` component in the manager root) that listens to `api.once(PREVIEW_INITIALIZED, ...)` + 10-minute `setTimeout`, then emits `GHOST_STORIES_REQUEST`. |
| `code/core/src/core-server/server-channel/ghost-stories-channel.ts` | Replace `lastEvents['ghost-stories']` cache key check with a simple existence check: if `lastEvents['ghost-stories']` exists, skip (already ran). Remove the `lastInit.body.sessionId !== sessionId` check entirely. Keep React + Vitest gate. |

### 6.2 Once-ever gate implementation

Use the existing `lastEvents` cache. Ghost-stories already writes to it after a successful `telemetry('ghost-stories', ...)` call. The gate is simply: does the key exist?

```ts
const lastEvents = await getLastEvents();
const lastGhostStoriesRun = lastEvents['ghost-stories'];
if (lastGhostStoriesRun) {
  return; // already ran once for this project, never run again
}
// (remove the `lastInit.body.sessionId !== sessionId` check)
```

### 6.3 Manager-side trigger module

```ts
// code/core/src/manager/components/sidebar/useGhostStoriesTrigger.ts
import { useEffect, useRef } from 'react';
import { PREVIEW_INITIALIZED, GHOST_STORIES_REQUEST } from 'storybook/internal/core-events';
import { useStorybookApi } from 'storybook/manager-api';

const TRIGGER_DELAY_MS = 10 * 60 * 1000; // 10 minutes

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

    return () => {
      api.off(PREVIEW_INITIALIZED, onInit);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [api]);
}
```

Hook is called once from the sidebar's top component (or from a new tiny container at the root). No fallback timeout — if `PREVIEW_INITIALIZED` never fires (broken preview), ghost stories simply don't run.

### 6.4 Risks

- **10min delay means user may close the tab first**: acceptable — ghost stories is best-effort telemetry. If they close before 10min, we don't fire, and next session we'll try again (since the lastEvents key won't exist).
- **PREVIEW_INITIALIZED re-fire on reload**: `api.once(...)` ensures we only register one listener, and `fired.current` ensures we never fire twice in the same manager tab. A full page reload restarts the 10min timer — that's fine, the server-side gate prevents duplicate telemetry.
- **Race with the existing modal trigger**: nothing — we remove that path entirely.
- **Ghost-stories runs Vitest and can be slow**: the 10min delay gives the user time to finish their initial work session undisturbed.

---

## Section 7: Local debugging + test strategy + MCP installation — APPROVED ✓ (re-scoped per workstream)

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

## Section 8: Risks, open questions, migration — APPROVED ✓ (re-scoped per workstream)

### 8.1 Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Third-party indexers don't populate `complete` field | High | Document the contract; Metabase queries exclude entries with `complete !== true` |
| `parameters.layout` not detectable for dynamic preview values | Medium | Marked as known limitation; `complete` flag stays `true` if parse succeeded |
| Addon `package.json.keywords` reads add I/O cost | Low | Cache results in the same per-process cache as `getActualPackageVersions` |
| Ghost-stories trigger fires while user's first interaction | Low | 5s debounce after PREVIEW_INITIALIZED |
| Vitest run inside ghost-stories blocks user | Medium | 24h gate ensures it only runs once per project per day |
| Mock telemetry receiver has port conflicts | Low | Configurable PORT env, default 6007 (matches existing CI scripts) |
| Evidence event never fires if agent crashes and no CLI runs after | Medium | Acceptable — no work done means no evidence. Partial work without subsequent CLI entry is a known blind spot. |
| Preview hash false positive from unrelated developer edits in 2h window | Low | At statistical scale, this washes out. Agent detection + 2h window makes it overwhelmingly likely the agent did it. |
| `isStoryAIGenerated()` title prefix is brittle | Medium | Single swap point in `setup-requirements.ts`; planned migration to tag-based detection |
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

8. **Evidence collection in `doTelemetry` vs `withTelemetry`**: For `dev` events, the story index is available in `doTelemetry()` (after `generator.getIndexAndStats()`). The evidence hook in `withTelemetry()` runs earlier (at boot time), before the index exists. We need to either: (a) fire evidence from both `withTelemetry` (without story count) and `doTelemetry` (with story count), or (b) delay the evidence check for `dev` commands until `doTelemetry` runs. Option (b) avoids duplicate events. Resolve during implementation.

9. **Event cache key for `ai-setup-pending`**: The existing cache uses `EventType` keys. `'ai-setup-pending'` is not an event type — it's internal state. Should we store it in the same `lastEvents` record (adding it to the EventType union) or in a separate cache key? Separate key is cleaner but requires a new cache read.

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
2. Where we left off: **All sections approved (2026-04-08).** Two workstreams defined.
3. **Implementation plans** should exist at:
   - `docs/superpowers/specs/2026-04-08-ws1-agentic-telemetry-plan.md`
   - `docs/superpowers/specs/2026-04-08-ws2-feature-adoption-plan.md`
4. **Execute WS1 first.**
5. **Spike script**: `scripts/spike-extract-features.ts` — delete during WS2 (or whenever convenient).

### How to keep Claude on track when resuming

> Read `docs/superpowers/specs/2026-04-07-telemetry-enhancements-design.md`. All sections are approved. Check if plan files exist under `docs/superpowers/specs/`. If they do, begin executing WS1. If they don't, invoke writing-plans and produce them first.

---

## Appendix: Decisions log (chronological)

1. **Sequencing**: ~~Three sequential PRs A → B → C~~ → Two workstreams (WS1 agentic, WS2 feature adoption)
2. **Field-metric collection**: Hybrid → all server-side (after spike)
3. **Sample size**: N/A (no sampling)
4. **Visit-tracking**: Deferred
5. **Static build handling**: Feature data in `build` event payload only
6. **Preview HMR resend**: Don't
7. **Whole-file telemetry**: Yes (free, since we extend per-file parse loop)
8. **Addon shape**: Sanitize at wire layer only → **WS2**
9. **Ghost-stories trigger**: Replace modal trigger with post-PREVIEW_INITIALIZED + 10min delay
10. **Ghost-stories gate**: ~~Once-per-24h-per-project~~ → Once-ever, `lastEvents` existence check
11. **`sb ai prepare` events**: ~~Two events (start + end)~~ → Start event + evidence-based completion tracking (decision 23)
12. **Prompt traits**: Flat object with enum values, 2 active traits only
13. **Agent in CI fix**: `isCI() && !detectAgent() ? undefined : globalSettings()`
14. **Test strategy**: Unit + sandbox smoke + e2e in CI
15. **MCP addon**: Add to react-vite sandbox-templates.ts
16. **Keyword allowlist**: → **WS2**
17. **Absence vs zero**: → **WS2**
18. **No `userType` field**: implied by `agent` × `inCI`
19. **userSince in CI+agent**: Preserve when agent detected
20. **Workstream split**: Two workstreams by concern (2026-04-08)
21. **Ghost-stories once-ever cache**: `lastEvents['ghost-stories']` existence
22. **Trait trimming**: Only ship traits with actual prompt.ts branching
23. **Evidence-based completion** (2026-04-08): `sb ai prepare` exits in seconds; the agent works for 5-120min after. Replace synchronous `ai-prepare-end` with `ai-setup-evidence` events fired from CLI entry points. SB CLI observes and reports — no delegation to agents.
24. **Evidence collection hook point** (2026-04-08): `withTelemetry()` in `code/core/src/core-server/withTelemetry.ts` — single integration point. Agent check first (`detectAgent()`), then cache check. Near-zero overhead for non-agent usage.
25. **Preview file change detection** (2026-04-08): Content hash (SHA-256) comparison. Record baseline hash at `ai-prepare` time for whichever `preview.{ts,tsx,js,jsx,mjs,cjs}` exists. At checkpoint, re-scan and compare. Binary changed/unchanged — no distinction between modified, created, deleted, or renamed.
26. **AI story detection** (2026-04-08): `isStoryAIGenerated()` checker function in `setup-requirements.ts` colocated with prompt code. Currently title-prefix based (`AI Generated/`), planned migration to tag-based. Field named `aiAuthoredStories` (not `storiesWithAiTitle`). Not added to `summarizeIndex` to avoid cross-contamination when users adopt AI-written stories.
27. **Session window for evidence** (2026-04-08): Use existing `SESSION_TIMEOUT` (2h) instead of 24h. Cache expires silently — manageable in Metabase.
28. **Setup requirements colocation** (2026-04-08): `setup-requirements.ts` lives next to `prompt.ts` so prompt changes naturally accompany observation logic updates. Contains title prefix, expected count, and `isStoryAIGenerated()` checker.
