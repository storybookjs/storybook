# Deep Interview Spec: Before/After Story Comparison Addon

## Metadata
- Rounds: 10
- Final Ambiguity Score: 20%
- Type: brownfield
- Generated: 2026-04-01
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.85 | 0.35 | 0.30 |
| Constraint Clarity | 0.75 | 0.25 | 0.19 |
| Success Criteria | 0.78 | 0.25 | 0.20 |
| Context Clarity | 0.70 | 0.15 | 0.11 |
| **Total Clarity** | | | **0.80** |
| **Ambiguity** | | | **0.20** |

## Goal

Build a core Storybook addon ("before-after") that shows a **live rendered iframe** of how a story looked **before** the current uncommitted changes (git HEAD state), displayed in a new addon panel. The "before" view uses the same decorators, args, and preview configuration as the main preview — only the component source code differs (HEAD vs working tree). The feature is **Vite-only** and uses a **dev-server transform** approach (no separate static build).

## Constraints
- **Vite-only**: This feature only works with the Vite builder. Non-Vite builders should gracefully ignore it.
- **Dev-server transform**: No separate build process. The "before" version is served on-the-fly via Vite's Environment API or a custom Vite plugin transform.
- **Full preview parity**: The "before" iframe renders with the same decorators, globalTypes, parameters, and theme as the main preview. Only component file content differs.
- **Core addon**: Lives at `code/addons/before-after/` as a new package shipped with Storybook by default.
- **Only changed stories**: The "before" panel only renders content for stories whose component files have uncommitted git changes (diff against HEAD).
- **Reacts to commits**: The "before" state updates when git HEAD changes (new commits). File saves without committing don't change "before" — they change the main preview ("after").
- **Reuses existing infrastructure**: Uses the existing `GitDiffProvider` and `ChangeDetectionService` in `code/core/src/core-server/change-detection/` rather than implementing independent git diff logic.

## Non-Goals
- Static/production build of the "before" version (dev-server only for now)
- Support for non-Vite builders (webpack, etc.)
- User-selectable git refs (only HEAD vs working tree)
- Visual diff overlays or pixel comparison
- Before/after for non-component files (e.g., CSS modules, assets)

## Acceptance Criteria
- [ ] A new addon panel tab ("Before") appears in the Storybook addon panel area
- [ ] The panel is always visible (even when no changes), showing an informational message when there are no changes or git is unavailable
- [ ] For stories with changed component files, the panel renders a live iframe showing the story with HEAD-version component code
- [ ] The "before" iframe uses the same decorators, args, and preview configuration as the main preview
- [ ] When the user commits changes, the "before" panel updates to reflect the new HEAD
- [ ] The feature works only with the Vite builder; non-Vite setups gracefully degrade (panel shows a "Vite-only" message)
- [ ] The addon reuses `GitDiffProvider` from `code/core/src/core-server/change-detection/`
- [ ] The addon package exists at `code/addons/before-after/`

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| Needs a separate static build | "What if there's no separate build at all? A Vite plugin could serve HEAD files on-the-fly." | Dev-server transform is sufficient; no separate build needed. User open to Vite Environment API or separate Vite process. |
| Shows all stories | "Showing it for unchanged stories means most panels are identical to main preview" | Only show rendered content for stories with changed component files |
| "Before" is fixed at server start | "Should it react to new commits?" | Yes — updates when HEAD changes (new commits), not on file saves |
| Minimal render is fine | "Does it need same decorators and config?" | Full preview parity required — same decorators, args, theme |

## Technical Context

### Existing Infrastructure
- **GitDiffProvider**: `code/core/src/core-server/change-detection/GitDiffProvider.ts` — provides git diff data
- **ChangeDetectionService**: `code/core/src/core-server/change-detection/ChangeDetectionService.ts` — maps changed files to affected story IDs, uses `GitDiffProvider`
- **Builder-Vite**: `code/builders/builder-vite/` — Vite integration with `createViteServer()`, `commonConfig()`, `pluginConfig()`, and `viteFinal` preset hook
- **Vite Server**: Created in `code/builders/builder-vite/src/vite-server.ts` via `createServer()` in middleware mode
- **Addon Panel Pattern**: See `code/addons/a11y/src/manager.tsx` for how panels are registered via `addons.add()`

### Recommended Approach: Vite Environment API (Vite 6+, RC in Vite 7)
- Register a `before` environment: `config.environments.before ??= {}` in plugin's `config` hook
- Each environment gets its own isolated module graph (`environment.moduleGraph`)
- Plugin hooks expose `this.environment` — transforms can serve different content per environment
- Use `applyToEnvironment` to scope a `load` hook that returns `git show HEAD:<path>` content for changed files
- Per-environment HMR via `hotUpdate` hook — when HEAD changes, invalidate "before" environment modules
- Both environments share the same dev server, port, and file watcher — only module transforms diverge
- Requires **Vite 6.0+** as minimum peer dependency

### Alternative Approach: Separate Vite Process
Spawn a second Vite dev server with `middlewareMode: true` and a plugin that intercepts transforms and serves HEAD content. Simpler isolation but higher resource overhead (two full plugin pipelines, two dep-optimizers, two module graphs). The Vite Environment API is preferred.

### Key Vite Environment API Patterns
```ts
// Register environment in plugin config hook
config(config) {
  config.environments.before ??= {}
}

// Per-environment plugin scoping
applyToEnvironment(environment) {
  return environment.name === 'before'
}

// Branch on environment in hooks
load(id) {
  if (this.environment.name === 'before') {
    return readFromGit('HEAD', id)
  }
}

// Per-environment HMR
hotUpdate({ modules, timestamp }) {
  if (this.environment.name === 'before') {
    // invalidate and reload
  }
}
```

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Story | core domain | id, importPath, componentFiles | belongs to StoryIndex, rendered by Before Preview |
| Before Preview | core domain | iframe, environmentName, renderedStoryId | renders Story using HEAD code |
| Vite Plugin | supporting | name, transform hook, environment check | intercepts transforms in Before Environment |
| Dev Transform | supporting | changedFiles, headContent | serves HEAD content for changed files |
| GitDiffProvider | external system | diffData, changedFiles | provides diff data to ChangeDetectionService and Vite Plugin |
| Vite Environment | supporting | name="before", moduleGraph, plugins | isolates "before" module resolution |
| Before-After Addon | core domain | panelId, manager, preset | registers panel, integrates with Storybook |

## Interview Transcript
<details>
<summary>Full Q&A (10 rounds)</summary>

### Round 1
**Q:** When the user opens the 'Before' addon panel for a story, what exactly do they see?
**A:** Live rendered iframe — same as the main preview but using the 'before' version of changed files.
**Ambiguity:** 63%

### Round 2
**Q:** How would you verify this feature works correctly? What does "correct" mean for the before iframe?
**A:** Matches last commit state (HEAD). The before iframe renders stories using component code from HEAD, while the main preview uses the working tree.
**Ambiguity:** 53%

### Round 3
**Q:** Should the feature reuse existing GitDiffProvider/ChangeDetectionService or implement independent git diff logic?
**A:** Reuse existing infrastructure.
**Ambiguity:** 50%

### Round 4 (Contrarian Mode)
**Q:** What if there's no separate build at all? Could a dev-server transform serve HEAD files on-the-fly?
**A:** Dev-server transform is enough. Also discover Vite's Environment API. Could spawn a separate Vite process. Whatever works best.
**Ambiguity:** 45%

### Round 5
**Q:** Vite Environment API vs separate Vite process — which approach?
**A:** Research and recommend.
**Ambiguity:** 45%

### Round 6 (Simplifier Mode)
**Q:** Should the before panel show for ALL stories or only stories with changed component files?
**A:** Only changed stories.
**Ambiguity:** 40%

### Round 7
**Q:** Does the "before" state stay fixed at server start, or react to new commits?
**A:** Reacts to commits — updates when HEAD changes.
**Ambiguity:** 34%

### Round 8
**Q:** Does the before iframe need full preview parity (decorators, args, theme) or minimal render?
**A:** Full preview parity.
**Ambiguity:** 29%

### Round 9
**Q:** What happens with no uncommitted changes or no git?
**A:** Panel always visible with informational message.
**Ambiguity:** 25%

### Round 10
**Q:** Core addon in code/addons/, separate installable, or integrated into core?
**A:** Core addon in code/addons/.
**Ambiguity:** 20%

</details>
