# WS1: Agentic Telemetry — PM Overview

> **Status**: Ready for review
> **Design doc**: `docs/superpowers/specs/2026-04-07-telemetry-enhancements-design.md`
> **Companion engineer plan**: `docs/superpowers/specs/2026-04-08-ws1-agentic-telemetry-plan-engineer.md`

## Goal

Ship a single PR that gives us full observability into agent-driven Storybook usage: who's an agent, what `sb ai prepare` produces, and whether ghost-stories telemetry reaches us reliably.

---

## Change 1: Preserve `userSince` for agents in CI

### What changes
In `code/core/src/telemetry/storybook-metadata.ts`, the line `const settings = isCI() ? undefined : await globalSettings()` drops all global settings (including `userSince`) when running in CI. We change it to preserve settings when an agent is detected: `const settings = isCI() && !detectAgent() ? undefined : await globalSettings()`.

### Why this change
Today, when a coding agent (Copilot, Claude, Cursor, etc.) runs Storybook in CI, we lose the `userSince` identifier. This means we can't correlate multiple agent runs in the same CI environment. The `userSince` value is a timestamp of first use — not a user identity — so preserving it in agent-in-CI contexts is safe and gives us longitudinal tracking without privacy risk.

### Why this implementation
The existing `context.agent` × `context.inCI` matrix already classifies users into four buckets (human local, human CI, agent local, agent CI). The only missing piece is that agent-in-CI runs are indistinguishable from each other because `userSince` is always `undefined`. By gating the CI exclusion on "not an agent", we fix this with a one-line change and zero new abstractions.

### Files touched
- `code/core/src/telemetry/storybook-metadata.ts` (1 line changed)
- `code/core/src/telemetry/storybook-metadata.test.ts` (1 new test case)

---

## Change 2: `sb ai prepare` start telemetry event + baseline snapshot

### What changes
Add an explicit `telemetry('ai-prepare', startPayload)` call inside `aiPrepare()` with rich project context. Cache an `'ai-setup-pending'` record containing: timestamp, session ID, configDir, preview file path + content hash (SHA-256), and prompt traits. This baseline snapshot is read by subsequent CLI entry points to detect what the agent changed (see Change 7).

### Why this change
Today `sb ai prepare` is wrapped by `withTelemetry('ai-prepare', ...)` which only sends a generic `boot` event. We have no visibility into what the command detected or what prompt was generated. The cached baseline snapshot enables evidence-based completion tracking — since `sb ai prepare` exits in seconds but the agent works for 5–120 minutes after, we can't fire a synchronous "end" event. Instead, we observe outcomes at subsequent CLI entry points.

### Why this implementation
- The start payload captures project context already gathered by `getStorybookData()` — no new detection logic needed.
- The preview file baseline uses the existing `findConfigFile('preview', configDir)` to locate whichever `preview.{ts,tsx,js,jsx,mjs,cjs}` exists. SHA-256 hash of its contents gives us a reliable change-detection signal (not mtime, which has false positives from formatters/editors). If no preview file exists, we record `null` for both path and hash.
- The pending record is stored in the existing event cache (`FileSystemCache` at `node_modules/.cache/storybook/{version}/default/dev-server/`).
- We use the existing `SESSION_TIMEOUT` (2h) as the expiry window — matching the sliding session concept already used for `sessionId`.

### Files touched
- `code/core/src/telemetry/types.ts` (add `'ai-setup-evidence'` to EventType)
- `code/lib/cli-storybook/src/ai/types.ts` (add `AiPrepareTraits` type, extend `AiPrepareOptions` with `frontmatter` flag)
- `code/lib/cli-storybook/src/ai/setup-requirements.ts` (NEW — colocated with prompt.ts; contains `AI_STORY_TITLE_PREFIX`, `AI_EXPECTED_STORY_COMPONENTS`, `isStoryAIGenerated()` checker, `AiSetupPendingRecord` type, `snapshotPreviewFile()` helper)
- `code/lib/cli-storybook/src/ai/prompt.ts` (thread traits accumulator through `getPrompts`/`generateMarkdownOutput`)
- `code/lib/cli-storybook/src/ai/index.ts` (add telemetry call, cache pending record, handle frontmatter)
- `code/lib/cli-storybook/src/bin/run.ts` (add `--frontmatter` CLI option)
- Tests: new test file for ai-prepare telemetry

---

## Change 3: `--frontmatter` flag for `sb ai prepare`

### What changes
Add a `--frontmatter` option to `sb ai prepare`. When used together with `--output`, it prepends YAML frontmatter to the markdown output containing the same trait data + project context. This lets evaluation pipelines read machine-parseable metadata from the prompt file.

### Why this change
Prompt evaluation workflows need to know which traits and project context were active when a prompt was generated, without parsing the prompt body. YAML frontmatter is the standard way to attach metadata to markdown files.

### Why this implementation
`--frontmatter` is opt-in to avoid breaking agents that parse the prompt as pure markdown. The frontmatter contains: storybook version, framework, renderer, builder, language, monorepo type, package manager, CSF factory status, and all active traits.

### Files touched
- `code/lib/cli-storybook/src/bin/run.ts` (add `--frontmatter` option)
- `code/lib/cli-storybook/src/ai/index.ts` (prepend frontmatter when both flags present)
- `code/lib/cli-storybook/src/ai/types.ts` (add `frontmatter?: boolean` to options)

---

## Change 4: Add `@storybook/addon-mcp` to satellite addons

### What changes
Add `'@storybook/addon-mcp'` to the list in `code/core/src/common/satellite-addons.ts`.

### Why this change
`@storybook/addon-mcp` is a first-party Storybook package maintained outside the monorepo. Adding it to the satellite addons list ensures:
1. It's recognized as first-party by `isSatelliteAddon()` checks throughout the codebase
2. When WS2 ships addon sanitization, its name won't be hashed in telemetry
3. Migration and compatibility checks treat it correctly

### Why this implementation
The satellite-addons list is the canonical registry for first-party packages outside the monorepo. It's a one-line addition to an existing array.

### Files touched
- `code/core/src/common/satellite-addons.ts` (1 line added)

---

## Change 5: Ghost stories redesign — 10min delay + once-ever gate

### What changes
1. **Remove modal trigger**: Delete the `executeGhostStoriesFlow` useEffect and `hasRunGhostStoriesFlow` ref from `CreateNewStoryFileModal.tsx`
2. **Add manager-side trigger**: New `useGhostStoriesTrigger()` hook that fires `GHOST_STORIES_REQUEST` 10 minutes after `PREVIEW_INITIALIZED`
3. **Simplify server-side gate**: Replace the session-based check with a simple existence check on `lastEvents['ghost-stories']` — if it exists, ghost stories already ran for this project, never run again

### Why this change
The current ghost-stories trigger is tied to the "Create New Story" modal — it only fires when users open that modal, which gives us very low sample coverage. Ghost stories runs Vitest to generate telemetry about uncovered components, which is valuable data. By triggering automatically after the app has been running for 10 minutes, we capture data from any session long enough to indicate real usage, without disturbing early interactions.

The once-ever gate (instead of the previous 24h plan) reflects the discovery that ghost-stories takes much longer than initially expected to run. Running it repeatedly would impact user experience. Once-ever gives us the data point we need without recurring cost.

### Why this implementation
- 10 minutes ensures the user is in a real work session, not just testing their config
- `PREVIEW_INITIALIZED` is the right starting gun — it means the preview iframe loaded and stories are renderable
- The `lastEvents` cache already stores ghost-stories results per-project with timestamps. A simple existence check (`if (lastGhostStoriesRun) return`) is the minimal gate
- Removing the modal trigger entirely (rather than keeping both) avoids duplicate fires and simplifies the code
- No fallback timeout — if `PREVIEW_INITIALIZED` never fires, the preview is broken and ghost stories wouldn't work anyway

### Files touched
- `code/core/src/manager/components/sidebar/CreateNewStoryFileModal.tsx` (remove ghost stories code)
- `code/core/src/manager/components/sidebar/useGhostStoriesTrigger.ts` (new file)
- `code/core/src/manager/components/sidebar/Sidebar.tsx` (call the new hook)
- `code/core/src/core-server/server-channel/ghost-stories-channel.ts` (simplify gate)

---

## Change 6: Mock telemetry receiver (developer tooling)

### What changes
Add `scripts/mock-telemetry-receiver.ts` — a small standalone Node HTTP server that receives, logs, and stores telemetry events for local debugging.

### Why this change
We need a way to verify telemetry payloads during development and in e2e tests. Today there's no local receiver — you can only check if events fire by reading debug logs, not by inspecting the actual wire payloads.

### Why this implementation
A standalone script (not wired into the build system) keeps it simple and reusable. It listens on a configurable port, logs events to stdout, appends to JSONL files, and exposes a GET endpoint for programmatic inspection. This forms the basis for both manual debugging and automated e2e tests.

### Files touched
- `scripts/mock-telemetry-receiver.ts` (new file)

---

## Change 7: Evidence-based completion tracking at CLI entry points

### What changes
Add an evidence collection hook in `withTelemetry()` (`code/core/src/core-server/withTelemetry.ts`) that fires `telemetry('ai-setup-evidence', payload)` when:
1. An agent is detected (`detectAgent()` — checked first, cheapest gate)
2. An `'ai-setup-pending'` record exists in the event cache
3. The record is within the 2h session window (`SESSION_TIMEOUT`)

The evidence payload includes:
- `trigger`: which CLI command triggered the check (`'dev'`, `'build'`, `'doctor'`, etc.)
- `msSinceAiPrepare`: time elapsed since `ai-prepare` ran
- `evidence.previewChanged`: whether the preview file content hash differs from baseline
- `evidence.aiAuthoredStories`: count of stories matching `isStoryAIGenerated()` (only at `dev`/`build` time when the story index is available, `0` otherwise)
- `evidence.doctorRanSinceSetup`: whether a `doctor` boot event exists in the cache with a timestamp after the ai-prepare timestamp
- `traits`: carried from the cached pending record

### Why this change
`sb ai prepare` exits in seconds — it prints a prompt. The agent then spends 5–120 minutes following the instructions: writing stories, adding decorators, running Vitest, starting dev. We cannot delegate observation to the agent. Only SB CLI/Node processes can observe and report. Every CLI entry point is a natural checkpoint where we have access to the filesystem and (for `dev`/`build`) the story index.

### Why this implementation
- **`withTelemetry` as single hook point**: Already wraps every CLI command. Adding the check there means zero per-command integration work. One code path handles all entry points.
- **Agent check first**: `detectAgent()` is computed at module load (near-zero cost). Non-agent users see no overhead at all.
- **Content hash for preview detection**: Avoids false positives from formatters/editors touching mtime. Simple and reliable — hash at baseline, hash at checkpoint, compare.
- **`isStoryAIGenerated()` checker**: Single swappable function in `setup-requirements.ts` colocated with the prompt. Currently uses title prefix; will swap to tag presence when tag-based approach ships.
- **Per-CLI-entry firing**: Every CLI command that runs within the 2h window fires an evidence event. This gives a timeline in Metabase (partial at T+5min, complete at T+45min). Deduplication is done in analytics, not in the code.
- **2h session window**: Reuses the existing `SESSION_TIMEOUT` constant. After 2h the pending record expires silently — no cleanup event needed.
- **For `dev` specifically**: The story index is available in `doTelemetry()`. Evidence collection hooks there to get the `aiAuthoredStories` count. For other commands, that count is `0`.

### Files touched
- `code/core/src/core-server/withTelemetry.ts` (add evidence collection hook after boot event)
- `code/core/src/core-server/utils/doTelemetry.ts` (pass story index to evidence collector for dev events)
- `code/lib/cli-storybook/src/ai/setup-requirements.ts` (already created in Change 2 — contains `isStoryAIGenerated()`, `snapshotPreviewFile()`)
- `code/core/src/telemetry/event-cache.ts` (add helpers for reading/writing `'ai-setup-pending'` record)
- Tests: evidence collection unit tests, integration test with mock cache

---

## Summary of all files changed

| File | Change type |
|---|---|
| `code/core/src/telemetry/storybook-metadata.ts` | Modify (agent-in-CI fix) |
| `code/core/src/telemetry/storybook-metadata.test.ts` | Modify (new test) |
| `code/core/src/telemetry/types.ts` | Modify (add `'ai-setup-evidence'` event type) |
| `code/core/src/telemetry/event-cache.ts` | Modify (add ai-setup-pending read/write helpers) |
| `code/core/src/common/satellite-addons.ts` | Modify (add addon-mcp) |
| `code/lib/cli-storybook/src/ai/types.ts` | Modify (traits type, frontmatter option) |
| `code/lib/cli-storybook/src/ai/prompt.ts` | Modify (traits accumulator) |
| `code/lib/cli-storybook/src/ai/index.ts` | Modify (telemetry call, baseline snapshot, frontmatter) |
| `code/lib/cli-storybook/src/ai/setup-requirements.ts` | New (colocated requirements: isStoryAIGenerated, snapshotPreviewFile, constants) |
| `code/lib/cli-storybook/src/bin/run.ts` | Modify (--frontmatter flag) |
| `code/core/src/core-server/withTelemetry.ts` | Modify (evidence collection hook) |
| `code/core/src/core-server/utils/doTelemetry.ts` | Modify (pass story index to evidence collector for dev events) |
| `code/core/src/manager/components/sidebar/CreateNewStoryFileModal.tsx` | Modify (remove ghost stories) |
| `code/core/src/manager/components/sidebar/Sidebar.tsx` | Modify (call ghost stories hook) |
| `code/core/src/manager/components/sidebar/useGhostStoriesTrigger.ts` | New |
| `code/core/src/core-server/server-channel/ghost-stories-channel.ts` | Modify (simplify gate) |
| `scripts/mock-telemetry-receiver.ts` | New |
| Tests for ai-prepare and evidence collection | New |

## Risks

| Risk | Mitigation |
|---|---|
| Evidence event never fires if agent crashes and no CLI runs after | Acceptable — no work done means no evidence to report |
| Preview hash false positive from unrelated developer edits in 2h window | At statistical scale, washes out; agent detection + 2h window makes false positives unlikely |
| `isStoryAIGenerated()` title prefix is brittle | Single swap point in `setup-requirements.ts`; planned migration to tag-based detection |
| `--frontmatter` confuses some agents parsing the prompt | Opt-in flag, not default |
| Ghost stories never fires if user closes tab before 10min | Acceptable — best-effort telemetry, retries next session |
| Adding addon-mcp to satellite-addons affects other checks | List consumed by `isSatelliteAddon` in 3 known sites; all safe |
| `withTelemetry` evidence check adds overhead | `detectAgent()` is module-level (near-zero); cache read only when agent detected |
