# Phase 1: `apiMd` manifest fragments (Vue-first) — Implementation Notes

## What was built

The decided docs design: framework-specific API content is rendered to a **neutral markdown
string** at build time by framework code and stored in the manifest; MCP owns only assembly and
presentation at runtime and never parses framework-specific data. Phase 1 ships the first real
producer of the new `apiMd` field (Vue) and teaches MCP to insert it verbatim, while React +
its `reactDocgen*` fields remain the permanent runtime fallback.

### Storybook side (worktree `../storybook-apiMd`, branch `feat/manifest-api-markdown`)

- **Types** (`code/core/src/types/modules/core-common.ts`):
  - Added `apiMd?: string` and `renderer?: string` to `ComponentManifest`, with the required
    "insert verbatim / never parse" JSDoc.
  - Added both fields to the `ComponentSubcomponentManifest` `Pick` (the storybook-side name for the
    subcomponent row; MCP calls it `SubcomponentManifest`).
  - Extended `ComponentsManifest.meta.docgen` union with `'vue-docgen-api'` (required so the Vue
    contribution's `meta.docgen` typechecks; core does not infer the engine id).
- **Vue API renderer** (`code/frameworks/vue3-vite/src/docs/vueapiMd.ts`): `renderVueapiMd(doc)`
  ported from the C3 salvage `vueDocsMarkdown.ts`, adapted to render **only** the API fragment —
  `## Props`, `## Slots`, `## Events`, `## Exposed`. No component header, description, or stories
  (those are MCP's envelope). Pure function, no IO.
- **Vue manifest contribution** (`code/frameworks/vue3-vite/src/docs/vueComponentManifest.ts`): adapts the
  C4 salvage generator but emits `apiMd` (from `renderVueapiMd`) instead of raw
  `vueDocgen`. Sets `renderer: 'vue3'`. CSF → `.vue` resolution via `loadCsf` + `_rawComponentPath`
  + `vue-docgen-api.parseMulti`. Per-component docgen failures are logged (`node-logger`) and the
  row is still emitted with neutral fields (`id`/`name`/`path`/`stories`/`renderer`) but no
  `apiMd`; the build never fails.
- **Stories**: populated from the parsed CSF (`{ id, name, snippet, description }`) using the
  printed CSF statement as `snippet`. No args-only synthesis (deferred to a later phase).
- **Preset wiring** (`code/frameworks/vue3-vite/src/preset.ts`): `export { manifests as
  experimental_manifests }` so the framework preset contributes to core's `experimental_manifests`.

### MCP side (worktree `../mcp-apiMd`, branch `feat/api-markdown-assembly`)

- **Schema** (`packages/mcp/src/types.ts`): added `apiMd: v.optional(v.string())` and
  `renderer: v.optional(v.string())` to `BaseInlineComponentProperties`, so they flow to both
  `ComponentManifestV0` and `SubcomponentManifest` (and therefore to the resolved `ComponentManifest`
  = V0 shape). The **v1** shallow index rows (`ComponentManifestV1`) were intentionally NOT changed:
  they carry only identity+summary, with body content resolved into the V0 shape via `$ref`s.
  `apiMd` is body content, so it lands on the resolved V0 row and needs no v1 index field.
- **Assembly** (`packages/mcp/src/utils/manifest-formatter/markdown.ts`, `formatComponentManifest` +
  `formatSubcomponentsSection`):
  - Component level: when `apiMd` is present, it is inserted **verbatim** exactly where the
    `formatPropsSection` output goes today, and `getParsedDocgen`/`formatPropsSection` are skipped
    entirely for that row.
  - Subcomponent level: same rule per subcomponent.
  - Story-count rule: when `apiMd` is present, stories are capped at `MAX_STORIES_TO_SHOW`;
    when absent, the existing `parsedDocgen` `hasProps` behavior is preserved exactly (the
    react/legacy path). Implemented as `capStories = hasapiMd || hasProps`.
  - Contract: presence is checked with `apiMd != null` only — no code inspects the fragment's
    content.

## Deviations from the brief

- The subcomponent type on the storybook side is `ComponentSubcomponentManifest` (a `Pick`), not a
  standalone `SubcomponentManifest` interface. Added the two fields to the `Pick` list. (On the MCP
  side the type is named `SubcomponentManifest` as the brief states.)
- Had to extend `ComponentsManifest.meta.docgen` with `'vue-docgen-api'` (not called out in the
  brief) — without it the Vue contribution does not typecheck. This is a neutral, additive change.
- On docgen failure the Vue generator logs via `logger.warn` (brief said "log via node-logger") and
  returns the neutral row; parse/read failures of the CSF itself use `logger.debug` and skip the row
  entirely (there is no meaningful row to emit without a resolved component).

## Test inventory

Storybook (`code/frameworks/vue3-vite/src/docs/`):
- `vueapiMd.test.ts` — 5 unit tests for `renderVueapiMd`, including the **acceptance
  criterion**: a scoped slot named `default` appears under `## Slots` and never under `## Props`;
  plus "API fragment only" (no header/description/stories) and empty-section omission.
- `vueComponentManifest.integration.test.ts` — 2 tests driving the real `experimental_manifests`
  preset over the real template fixture (`renderers/vue3/.../MySlotComponent.vue` via
  `ScopedSlots.stories.ts`): asserts the row carries `apiMd` with slots kept out of props, and
  a second test asserting the row served through the exact `experimental_manifests` apply-contract
  (as core's dev-server `getManifests` invokes it) carries `apiMd`.
- Result: **2 files, 7 tests, all passing**; `yarn nx check core,vue3-vite` clean.

MCP (`packages/mcp/src/utils/manifest-formatter/markdown.test.ts`):
- New `apiMd fragment (framework-rendered)` describe block: verbatim insertion + legacy path
  skipped; stories capped at 3 with a fragment present; subcomponent fragment verbatim; mixed
  (component fragment present, subcomponent absent → legacy path); and a regression test asserting a
  fragment-less fixture is byte-identical.
- The existing `formats all full fixtures` snapshot test (button/card/input) is the primary
  byte-identical guard for the absence path and **passes unchanged** (snapshots not regenerated).
- Result: **`@storybook/mcp` project — 202 tests, all passing**; `pnpm --filter @storybook/mcp
  typecheck` clean.

## Sandbox outcome

`yarn task sandbox --template vue3-vite/default-ts --start-from auto` **reproduced the known
blocker** and failed at the yarn link step:

```
YN0071: Cannot link @storybook/vue3-vite ... typescript@5.9.3 conflicts with parent dependency
typescript@6.0.3
```

Per the brief, this was not fought. Validation instead rests on the integration tests, which drive
the real preset over the real `.vue` template fixture (no mocks, no worker). A partial
`../storybook-sandboxes/vue3-vite-default-ts` dir exists from the failed run but has no installed
deps.

## Notes for Phase 2/3

- **React migration**: `reactDocgen*` + MCP's `formatPropsSection`/`getParsedDocgen` remain the
  permanent fallback. When/if React emits `apiMd`, the MCP assembly already prefers it with no
  further change (presence check only). The react generator was deliberately left untouched.
- **Stories snippets**: Phase 1 emits `snippet` only from authored CSF statements. Args-only
  synthesis, shared-skeleton refactor, and tier-3 args-JSON fallback are all deferred.
- **v1 ref manifest**: if a future producer wants `apiMd` behind a `$ref` (like docgen), the
  v1 index rows would need a new ref field and resolution wiring; today it rides the inline V0 shape.
- **`meta.docgen` union**: now includes `'vue-docgen-api'`. Additional renderers should extend it
  similarly (it is consumed by the components HTML debugger, not by MCP).

---

# Phase 1b: switch the Vue `apiMd` engine to `vue-component-meta` (Volar)

The wire contract is unchanged (`apiMd` opaque string + neutral fields; MCP sees no
difference). Only the INTERNAL extraction engine changed: from `vue-docgen-api` to
`vue-component-meta` (the same Volar-based engine the docgen Vite plugin already uses, and the planned
future docgen default). The motivation is richer, resolved types: component-meta emits
`'sm' | 'md' | 'lg'` where vue-docgen-api emits a flat `union`.

## Shared-checker refactor

- New module `code/frameworks/vue3-vite/src/plugins/vue-component-meta-checker.ts` holds the
  production-hardened Volar plumbing, factored out of `plugins/vue-component-meta.ts` verbatim:
  `createVueComponentMetaChecker`, `removeNestedSchemas` + a `stripNestedSchemas(meta)` wrapper (the
  loop the plugin ran inline), `applyTempFixForEventDescriptions`, `filterExposed(meta)` (the on-/
  `$slots`-dedupe the plugin ran inline), and `getFilenameWithoutExtension`.
- `plugins/vue-component-meta.ts` now imports these; its transform is behavior-identical (the inline
  schema-strip loop and exposed-filter blocks were replaced by calls to the shared helpers with
  identical logic). Verified by its unchanged test `plugins/vue-component-meta.test.ts` (all passing).
- `createVueComponentMetaChecker(tsconfigPath, projectRoot?)` gained an optional `projectRoot`
  parameter defaulting to `getProjectRoot()` — so the plugin call is byte-identical, while the
  manifest generator can scope the checker's TS program to its own working dir.

## Perf structure (the important part)

The checker builds a full TypeScript program, so it is created **once** per manifest generation (top
of the `manifests` preset) and reused via `checker.getComponentMeta(path, exportName)` per component.
The old per-file `parseMulti` structure would have been catastrophic here (a full TS program per
component). Measured on the template fixture (`MySlotComponent.vue`, scoped to the template dir):

| step | cost |
| --- | --- |
| `createVueComponentMetaChecker` (lazy) | ~7 ms |
| first `getComponentMeta` (builds the TS program) | ~360 ms |
| each subsequent `getComponentMeta` (warm program) | ~0 ms |
| `vue-docgen-api.parseMulti` (per file, for comparison) | ~7 ms |

So the tradeoff is a **~360 ms fixed cost** (deferred to the first extraction) that then amortizes to
near-zero per additional component, versus vue-docgen-api's ~7 ms × N linear cost. Break-even is
roughly ~50 components; above that component-meta is cheaper, below it is more expensive but buys the
richer resolved types. This only holds because the checker is created once — hence the restructure.

## tsconfig resolution

The generator calls `createVueComponentMetaChecker('tsconfig.json', process.cwd())`. The shared helper
reuses the plugin's exact logic: prefer `<projectRoot>/tsconfig.json`, but if it declares project
`references` (which Volar cannot resolve, vuejs/language-tools#3896) fall back to a
`createCheckerByJson(projectRoot, { include: ['**/*'] })` checker; if no tsconfig exists, use that
fallback too. `process.cwd()` is used as the project root so it lines up with how the generator
already resolves story import paths, and so the integration test (which mocks `process.cwd()` to the
template dir) scopes the program to that dir rather than the whole repo.

## ComponentMeta field mapping

Rendered per section from the Volar `ComponentMeta` arrays (see `renderers/vue3/src/extractArgTypes.ts`
for the proven field reference):

- **Props** (`meta.props`, filtering out `prop.global` inherited attrs): `name`, `type` (resolved
  string), `required`, `default`, `description`.
- **Slots** (`meta.slots`): `name`, `type` (the scoped-bindings type string, used as the "Bindings"
  column), `description`.
- **Events** (`meta.events`): `name`, `type`, `description` (descriptions patched in by
  `applyTempFixForEventDescriptions`, since Volar cannot extract them).
- **Exposed** (`meta.exposed`, after `filterExposed`): `name`, `type`, `description`. (Component-meta
  exposes a resolved `type`, so the Exposed table gained a Type column vs the docgen-api version.)

`removeNestedSchemas`/`stripNestedSchemas` is applied to the selected meta before rendering (bundle/OOM
guard). The Volar meta exposes **getter-only** top-level props, so the generator spreads into a plain
object (`{ ...meta, exposed: filterExposed(meta) }`) for rendering rather than mutating `meta.exposed`
in place (which throws). The empty-fragment / story-count contract is preserved exactly: the renderer
returns `''` when nothing is documentable and the generator collapses that to `undefined`.

## Errors

- Checker fails to construct → logged **once** via `node-logger` at the top of the preset; every row
  is still emitted, just without `apiMd`. Never crashes the manifest build.
- Per-component `getComponentMeta` failure → logged via `node-logger` and the row is emitted with
  neutral fields and no `apiMd`. Never fails the build.

## docgen-config decision

**Hardcoded to `vue-component-meta`.** The generator does not read the framework `docgen` option
(`false` / `'vue-docgen-api'` / `{ plugin, tsconfig }`) and always uses component-meta with a default
`tsconfig.json`. This is the acceptable-for-this-pass choice the brief allowed. Two consequences a
later pass may want to address: (1) a user who set `docgen: 'vue-docgen-api'` or `docgen: false` for
the preview still gets component-meta extraction for the manifest, and (2) the user's custom
`tsconfig` path from `docgen: { plugin, tsconfig }` is not threaded into the manifest checker. Wiring
the framework options through the preset would fix both.

## Test changes

- `docs/vueapiMd.test.ts` — fixture is now a `ComponentMeta` (was `ComponentDoc`). All prior
  assertions kept, incl. the acceptance criterion (scoped slot `default` under Slots, never Props) and
  the load-bearing empty-component `''`. Added: a Volar-resolved-union assertion (`'primary' \|
  'secondary'`, note the table `|`-escape) and a global-prop-skip assertion.
- `docs/vueComponentManifest.integration.test.ts` — now drives the **real Volar checker** over the
  real `MySlotComponent.vue` (via `process.cwd()` mocked to the template dir, so
  `createCheckerByJson` scopes the program there). `meta.docgen` assertion updated to
  `'vue-component-meta'`; per-test timeout raised to 60 s since the checker builds a TS program. All
  other assertions unchanged (props `label`/`year`, scoped `default` slot kept out of Props, story
  snippets).
- Result: `vueapiMd` (8 tests) + `vueComponentManifest` (2) + `vue-component-meta` (9, unchanged)
  all passing; `yarn nx run-many -t compile,check --projects=core,vue3-vite` clean (vue3-vite via
  `vue-tsc`).

## Notes for Phase 2/3 — duplicate extraction

The Vue **preview** already runs `vue-component-meta` (the docgen Vite plugin) to attach
`__docgenInfo`. This manifest generator now runs the **same** engine a **second** time at build/dev
setup, building a second TS program. Phase 2/3 should consider unifying extraction so the TS program
runs once and both the preview `__docgenInfo` and the manifest `apiMd` are derived from a single
pass (e.g. share a checker instance, or have the generator read the plugin's already-extracted meta).
This is the main follow-up cost concern introduced by this switch.

---

# Phase 1c: render structured API data as TypeScript-type syntax (not markdown tables)

Team decision: for the structured API sections, emit **TypeScript-type-like syntax** instead of
`| Name | Type | ... |` markdown tables — it is easier for AI/agents to consume and makes Vue
consistent with the React producer, which already emits `export type Props = { ... }`.

## What changed

`renderVue*` (`code/frameworks/vue3-vite/src/docs/vueapiMd.ts`) now renders each of the four sections
as a fenced ` ```ts ` block declaring an `export type`, keeping the `## Props` / `## Slots` /
`## Events` / `## Exposed` section headers above each block:

- **Props** → `export type Props = { ... }`, one member per line: a single-line `/** description */`
  JSDoc comment (when a description exists) + `name` + `?` when not required + `: <type>` +
  ` = <default>` when a default exists + `;`. Mirrors the React `formatPropsSection` shape, fed from
  component-meta's resolved `type` strings.
- **Slots / Events / Exposed** → same block style (`export type Slots|Events|Exposed = { ... }`), each
  member `name: <type>;` using the component-meta resolved `type` string (slot.type = bindings type,
  event.type = payload, exposed.type = member type).

Contract invariants preserved exactly:

- Empty-fragment contract: a section whose array is empty is omitted; the whole fragment is `''` when
  nothing is documentable, so the generator's `|| undefined` still fires and the story-cap signal
  holds.
- Resolved union literals stay visible (`'primary' | 'secondary'`, never a flat `union`). Inside a
  fenced code block the union `|` is **raw** — the previous table `\|` escaping is gone.
- `global` props are still skipped; `filterExposed` handling is unchanged.
- Acceptance criterion still holds and is still tested: a scoped slot named `default` appears under
  `## Slots` and never under `## Props`.

## Sample rendered output (one component)

```md
## Props

​```ts
export type Props = {
  /** Visual style of the button. */
  variant?: 'primary' | 'secondary' = 'primary';
  /** Whether the button is disabled. */
  disabled?: boolean;
}
​```

## Slots

​```ts
export type Slots = {
  /** The button label content. */
  default: { active: boolean };
}
​```

## Events

​```ts
export type Events = {
  /** Fired when the button is clicked. */
  click: MouseEvent;
}
​```

## Exposed

​```ts
export type Exposed = {
  /** Focuses the button element. */
  focus: () => void;
}
​```
```

(The zero-width spaces before the inner fences above are only to keep this markdown file's own fence
from closing early; the real output has bare ` ```ts ` / ` ``` ` fences.)

## Tests

- `vueApiMarkdown.test.ts` — table assertions (`| variant |`, `| default |`, escaped
  `'primary' \| 'secondary'`) replaced with TS-syntax equivalents (`export type Props`,
  `variant?: 'primary' | 'secondary' = 'primary';`, `default: { active: boolean };`, etc.). Added
  assertions for the fenced `ts` block / no-table-syntax, `?`+`= default` rendering, and single-line
  JSDoc. Every prior semantic check kept, incl. the acceptance criterion, global-prop skip, and the
  empty-component `''`.
- `vueComponentManifest.integration.test.ts` — table assertions swapped for `export type Props = {`,
  `label`/`year` presence, and `export type Slots = {` / `default:` under Slots.
- Result: `vueApiMarkdown` (11) + `vueComponentManifest` (2) + `vue-component-meta` (9) = 22 passing;
  `yarn nx run-many -t compile,check --projects=core,vue3-vite` clean.

## ⚠️ Naming / cross-worktree contract mismatch (NOT resolved here — needs a decision)

While doing this pass I found the Storybook worktree had been renamed (by a third session; not this
task and not apimd-phase1's Phase-1 work) from `apiMarkdown` → **`apiMd`**, `renderVueApiMarkdown` →
`renderVueapiMd`, file `vueApiMarkdown.ts` → `vueapiMd.ts`, with commits pushed to origin. I
consolidated the renderer onto that **existing on-disk `apiMd` naming** so the SB tree builds and my
TS-syntax change is verifiable; the TS-syntax content itself is naming-agnostic.

BUT the MCP consumer worktree (`../mcp-apimarkdown`, `feat/api-markdown-assembly`) still reads the
field as **`apiMarkdown`** (its `types.ts` schema + `manifest-formatter/markdown.ts`). So end-to-end
the producer (SB=`apiMd`) and consumer (MCP=`apiMarkdown`) **do not match** and the feature is broken
across the two worktrees. The original design brief named the field `apiMarkdown`. This needs a
single decision on the field name, reconciled across BOTH worktrees — it is out of scope for the
table→TS-syntax task and is flagged to the coordinator. (I also had to re-add `'vue-component-meta'`
to the `ComponentsManifest.meta.docgen` union in core-common.ts; the third session's reset had
dropped the Phase-1b union additions, which broke `vue3-vite:check`.)
