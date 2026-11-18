# Storybook feature audit: inventory, cost, usefulness and ranking

Feature map drawn 2026-10-20 at commit `db128150dc9`; the model and scores were refined over four
rounds on 2026-10-21. Each generated file (`metrics.json`, `ranking.md`, `quadrants.md`,
`sensitivity.md`) records the HEAD it was scanned at. The sections are newest first: round 4
supersedes the numbers in earlier rounds where they overlap; the round-1 analysis is kept because its
inventory and qualitative themes still hold.

## Round 4 (2026-10-21): maintainer re-scoring, issue-derived severity, scale shown side by side

### Decisions

- **Fifteen usefulness scores were reviewed one at a time by the maintainer**, with the evidence from
  `score-review.md` (reach, downloads, open issues, fix and feature PRs, source size, exclusive
  dependencies). The agent stack is now mission-critical across the board:
  component manifests, agent skills, MCP, toolsets, the tools CLI, open-service and docgen core all
  score 4, "the core technology behind all our agent APIs, which are our most important bet". TanStack
  rises to 3 as a strategic bet on a rising React meta-framework; Web Components docgen rises to 3
  because design-system teams on Lit depend on it; change detection rises to 3 as the foundation for
  agent and CI workflows that only touch what changed; the code-examples service rises to 3. The setup
  checklist drops to 1 ("nagware; the fix count suggests it costs more than it converts"). Review,
  Svelte CSF and the module graph stay at 2. Each re-scored feature says so in its rationale.
- **Severity now comes from closed issues when the PR has no label.** Only 81 of 752 fix PRs carry a
  `sev:*` label themselves; linking each PR to the issues it closes raises that to roughly 224, with
  the issue's label used when the PR has none. Unlabelled PRs that close a bug-labelled issue are
  counted as fixes. The multipliers are S1 ×4, S2 ×2, S3 ×1, S4 ×0.5, unlabelled ×1, with
  `fix_pr` as the adjustable 1× rate.
- **The geometric scale is explained in plain words and shown at three multipliers.** The "base" is how
  many times more valuable each usefulness level is than the level below it: base 3 means low 1,
  medium 3, high 9, mission-critical 27; base 2 means 1/2/4/8; base 4 means 1/4/16/64. Base 3 stays
  the primary view; `ranking.md` carries rank columns for 2× and 4× beside it.
- **Scope**: this is a reporting tool for a dashboard. Sunset and consolidation plans are explicitly
  out of scope; the next deliverable is a website that packages the findings, modelled on the
  agentic-reference report UI.

### What changed in the picture (run at `00059337f08`)

- **Scores**: 33 features at 4, 36 at 3, 25 at 2, 7 at 1. The AI group's cost-weighted usefulness
  rose from 2.30 to 2.79; it is still the group with the worst cost per usefulness (34.9k), ahead
  of the manager UI (33.0k), builders and frameworks (32.2k), Node core (30.7k) and the preview
  runtime (30.1k); testing remains the best value (9.7k).
- **Cost composition**: 816k points, 50% code, 23% dependencies, 28% churn (severity weighting
  added about 20k points of fix cost). Severity now covers 225 of 759 fix PRs: 9 S1, 68 S2, 115 S3,
  33 S4.
- **The low-usefulness, high-cost quadrant holds three features**: the setup checklist, agentic
  review and the Svelte CSF compiler. None of them changes quadrant in any sensitivity scenario.
  Six features are in the worst 20 under all four usefulness hypotheses: the AI evaluation harness,
  review, Svelte CSF, Angular docgen, the Angular framework and TanStack; the checklist is second or
  third on every scale except reach, where its reach estimate pulls it to 64th. The rest of the top
  of the cost-per-usefulness ranking is maintainer-only tooling (build scripts, docgen harness,
  sandboxes) and the small score-1 items (server renderer, measure, Ember, Preact, outline).
- **Under the reach hypothesis the framework-specific features lead**: TanStack, Angular in both
  flavours, Web Components docgen and renderer, Svelte CSF, React Native Web, the Svelte renderer,
  the server renderer and Ember are all in the worst 20 per user served.
- **Simplification targets (ten)**: ranked by cost with fix and maintenance churn weighted 3×, the
  list is config-and-presets, the Vitest addon, the manager shell, the UI component library, the
  upgrade pipeline, docs blocks, the sidebar, init, component manifests and the package-manager
  proxies. Severity-weighted fix load leads with config-and-presets (73 fixes, 81.5 weighted), the
  Vitest addon (59, 67), the UI library (50, 53), the manager shell (51, 51.5), init (42, 47), the
  upgrade pipeline (45, 46.5), docs blocks (47, 45.5), package-manager proxies (32, 41.5) and
  TanStack (30, 40.5).
- **Inherited usefulness** raises ten features, all infrastructure: loggers, theming, universal store,
  module mocking, tags, telemetry and the code-examples service to 4; the Web Components renderer and
  Svelte docgen to 3; the module graph to 4 through docgen core.
- **The website** (`site/index.html`, also published as an artifact) presents all of this: group
  cost bars, the decision map, the full feature table with a detail drawer, the sensitivity view,
  dependency hubs, stale packages and clusters, and the method.

### Operational note

The untracked `feature-audit/` folder was deleted on 2026-10-21 around 15:00 by a tree clean run
from another session that had switched this checkout to a `claude/gifted-galileo-*` branch and
pulled. Everything was rebuilt from the conversation record with the final model already applied, the
GitHub and npm signals were refetched, and each pipeline run now writes a backup tarball outside
the repository. Committing the folder on a branch is the durable fix.

## Round 3 (2026-10-21): severity, same-group inheritance, hand-set reach, sensitivity

Numbers in this section are from the round-3 run at `db128150dc9`.

### What changed

- **Fix PRs are severity-weighted**: `sev:S1` ×4, `S2` ×2, `S3` ×1, `S4` ×0.5, unlabelled ×1, with
  `fix_pr = 120` as the adjustable 1× rate. On PR labels alone it barely moved anything, because only
  81 of the 752 fix PRs carried a severity label (6 S1, 23 S2, 39 S3, 13 S4); severity lives on
  issues, which round 4 addressed.
- **Inherited usefulness ignores same-group edges.** Raises dropped from 18 to 12; embed mode, the
  context menu, viewport and MDX no longer inherit from the parents they were carved out of. Still
  raised: loggers, theming, universal store, open-service, docgen core, module mocking, tags and
  telemetry (all defensible), plus component manifests via the React renderer's preset wiring and
  the module graph via docgen core (attribution artefacts).
- **Reach is hand-set for 62 in-core features** with a one-line justification each (listed in
  `ranking.md` under "Reach estimates"), overriding the npm-derived value for `cli-core`, `init` and
  `upgrade-automigrate`, whose package downloads measure legacy or npx-bypassed usage.
- **`sensitivity.py`** re-evaluates the model against one scan, one change at a time: every weight
  at ×0.5 and ×1.5, churn/dependency/test pricing switched off, coupling priced, geometric base 2
  and 4, one-hop inheritance. `score-review.md` lists the features whose verdict depends on their
  score, with the evidence needed to re-score them.

### What the sensitivity analysis says

- **The cost weights do not matter much.** Every ±50% change keeps the geometric ranking at a
  Spearman correlation of 0.997 or better with the baseline; switching churn pricing off entirely
  gives 0.985, dependency pricing off 0.973, test weight off 0.990. The one knob that reshapes the
  order is the geometric base: base 2 gives 0.911 and pulls the big mission-critical features back
  up the table (UI components 43→18, config-and-presets 40→15, Vitest addon 44→20), base 4 gives
  0.973. The 3× scale is therefore the main modelling decision, and it is a judgement about how much
  more a mission-critical feature is worth, not something the data settles.
- **The usefulness scores decide the verdicts.** The 2×2 splits usefulness between 2 and 3, so each
  of the sunset candidates at the time (TanStack, component manifests, review, Web Components docgen,
  Svelte CSF, agent skills, checklist) moves to "simplify" with a one-step raise of its score, while
  no weight scenario moves any of them. That is why round 4 re-scored them by hand.

## Round 2 (2026-10-21): refined cost and usefulness model

Numbers in this section are from the round-2 run at `db128150dc9`.

### What changed in the model

- **Churn is priced through PR labels, not commit counts.** 2,053 merged PRs from the last 12
  months were categorised by label: 752 bug, 158 feature, 539 maintenance (dependency bumps, build,
  cleanup), 153 docs, 209 unlabelled, 242 release or bulk PRs dropped. Bug-fix PRs cost 120 points
  and maintenance PRs 40 each per feature touched; feature and docs PRs are investment and unpriced.
- **Dependencies are priced individually** from npm registry metadata for all 285 packages: 150
  base, plus 1 per release in the last 12 months (capped at 200), plus 150 if the package has not
  been published for two years or is deprecated. 52 of the 285 are stale or deprecated.
- **Exclusive cost** counts only the dependencies that no other feature imports. It is what removal
  actually saves and drives the sunset list.
- **The feature-to-feature import graph** is resolved (relative imports, `storybook/*` entry points,
  workspace packages). It gives fan-in and fan-out per feature and feeds the inherited hypothesis.
- **Four usefulness denominators** are computed side by side: linear 1–4, geometric 1/3/9/27, reach
  (npm downloads ÷ `storybook` downloads, floored at 1%, with per-score defaults for in-core
  features), and inherited (a feature inherits the score of whatever genuinely depends on it, with
  aggregator importers such as the presets, shell and CLI ignored and a minimum of three importing
  places per edge).
- **Decision views** replace the single ratio: a 2×2, a sunset list, a simplification list, a
  maintainer-only table and an agreement table across hypotheses. `agent-eval` and `docgen-harness` are flagged
  maintainer-only alongside the repo-tooling group.

### Cost composition (round 2)

| Component | Points | Share |
| --- | --: | --: |
| Code (src + ¼ non-src) | 405,622 | 51% |
| Dependencies | 185,071 | 23% |
| Bug-fix and maintenance PRs | 205,680 | 26% |
| **Total** | **796,373** | |

Half the modelled cost is something other than size, which is the point: round 1 was a size ranking
with a usefulness divisor.

### Findings that round 1 could not see

- **Where bug fixes land.** Fix PRs per feature: config-and-presets 71, Vitest addon 59, UI
  component library 50, manager shell 50, docs blocks 46, upgrade/automigrations 45, init 42, sidebar
  tree 37, package-manager proxies 31, TanStack 30, component manifests 29, Next.js-webpack 28. Per
  thousand source lines the densest are the Vue 3 renderer (21), React renderer (18.5), canvas (12),
  sidebar search (11), dev server and init (10.6 each). TanStack accumulating 30 fix PRs on 3.2k lines
  in its first year, and component manifests taking 29 fixes plus 22 feature PRs while still
  experimental, were the two clearest signals the model added.
- **Exclusive dependencies.** Next.js-webpack owns 13 packages nobody else uses (twelve Babel plugins
  and the react-refresh webpack plugin); the UI component library 9 (Radix scroll-area and slot,
  react-aria and react-stately overlays, react-popper-tooltip, react-syntax-highlighter,
  react-textarea-autosize, use-resize-observer); builder-webpack5 8; interaction testing 7 (chai,
  tinyspy, jest-dom, Vitest internals); TanStack 6; React docgen 6. Removing a feature with zero
  exclusive dependencies saves code and churn only.
- **Stale dependencies** cluster in build scripts (11), config-and-presets (8), component manifests
  (7), builder-webpack5 (6) and the dev server (6). Three are deprecated:
  `@angular-devkit/build-angular`, `npm-registry-client`, `npmlog`.
- **Hub packages**: `ts-dedent` is imported by 48 features, `react` 45, `@storybook/global` 35,
  `pathe` 29, `@storybook/icons` 27, `picocolors` 26. These are cheap to keep and expensive to swap.

## Round 1 (2026-10-20): inventory and size-based ranking

Numbers in this section are from the round-1 run at `db128150dc9` (cost = src LOC + ¼ non-src LOC +
250 per dependency; usefulness linear 1–4 as first assigned).

### Summary

- The repository holds **308.6k lines of source** (excluding ~388k lines of tests, stories and
  fixtures, and ~61k lines of built output that were ignored) importing **285 distinct third-party
  packages**, spread over **10 macro groups and 101 leaf features**.
- Three groups carried the worst cost-to-usefulness ratio and together are 40% of all source lines:
  AI & agent integration (59k lines), docgen & component metadata (38k) and builders & frameworks
  (27k but 77 distinct third-party dependencies).
- The single largest cost items are not user features: the AI evaluation harnesses (36k lines, 24
  dependencies), the monorepo scripts (12k lines, 52 dependencies) and sandbox tooling. Together with
  the docgen harness that is ~55k lines of maintainer-only code.
- The clearest structural duplication is in docgen: React has three extraction backends, Vue two,
  Angular two generations (Compodoc and angular-cm), plus a separate manifest pipeline. Docgen is 38k
  source lines plus 70k lines of tests and fixtures.
- The webpack lineage (builder-webpack5, Next.js-webpack, Angular-webpack, React-webpack5, Ember,
  server) is ~14k source lines and ~70 dependencies serving a shrinking share of installs; every one
  of them has a Vite replacement already shipping.
- The best value in the codebase is the thin Vite framework packages, the small essential addons
  (backgrounds, toolbars, links, themes), CSF, static build and the canvas.

### Method in one paragraph

Every tracked source file under `code/`, `scripts/`, `agent-eval/` and `test-storybooks/` was
classified (source / test / stories / fixture / ignored) and assigned to exactly one leaf feature by
glob. For each feature the script counts source lines, non-source lines, distinct third-party
packages imported by its source files, and non-merge commits over the last 12 months (ignoring bulk
commits that touch more than 40 files). Usefulness is a 1–4 score per feature with a written
rationale, calibrated against npm downloads and open-issue counts per GitHub label (both captured
under `signals/`). The ratio is cost ÷ usefulness, so a high ratio means "expensive for what it
gives".

### Macro picture (round 1)

| Group | Features | Src LOC | Tests+fixtures | Distinct deps | Churn (12 mo) | Weighted usefulness |
| --- | --: | --: | --: | --: | --: | --: |
| AI & agent integration | 6 | 59,345 | 57,040 | 42 | 1,846 | 2.30 |
| Docgen & component metadata | 8 | 37,795 | 70,279 | 48 | 1,136 | 2.73 |
| Builders & frameworks | 17 | 27,168 | 37,005 | 77 | 1,381 | 2.81 |
| Manager UI | 14 | 38,305 | 59,453 | 47 | 1,711 | 3.43 |
| Story model & preview runtime | 17 | 34,900 | 60,133 | 61 | 1,130 | 3.26 |
| Node core: config, server, build | 12 | 36,229 | 37,953 | 58 | 1,729 | 3.35 |
| Essential & bundled addons | 15 | 24,033 | 18,844 | 29 | 626 | 3.14 |
| Repository tooling & test infra | 3 | 18,282 | 9,998 | 63 | 1,292 | 3.00 |
| CLI & lifecycle | 6 | 19,729 | 19,870 | 34 | 1,034 | 3.66 |
| Testing | 3 | 12,793 | 17,596 | 31 | 524 | 3.89 |

The engine (preview runtime, Node core, manager UI) is about a third of the code and scores 3.3–3.4;
its cost is mostly intrinsic size. AI was already the largest group by source lines and the most
churned, with 36k of its 59k lines being evaluation harnesses. Docgen has more test and fixture code
than source because it is verified against framework corpora. Builders and frameworks have the widest
dependency surface for the smallest source footprint among the big groups, concentrated in the
webpack lineage and Next.js. Testing is the best-value group.

### Feature breakdown (macro → leaf)

Numbers are source LOC / third-party deps / usefulness as first assigned. Full detail is in
`ranking.md`.

**Story model & preview runtime (34.9k).** CSF types 1.3k/4/4 · csf-tools (CsfFile, ConfigFile,
story-shape) 7.2k/3/4 · parser stacks (Babel + oxc) 1.2k/7/4 · story store 2.1k/4/4 · preview runtime
4.7k/7/4 · story indexing 2.1k/12/4 · module mocking 1.8k/10/3 · portable stories 2.7k/11/3 · embed
mode 1.0k/1/2 · renderers: React 1.1k/4/4, Vue 3 0.9k/6/3, Svelte 1.8k/4/3, Web Components 0.8k/4/2,
HTML 0.3k/2/2, Preact 0.2k/4/1, Server (+ server-webpack5) 0.6k/6/1 · Svelte CSF compiler 5.0k/8/2.

**Docgen & component metadata (37.8k).** Docgen server + component-meta + docs-tools 3.4k/5/3 ·
React docgen (react-docgen, react-docgen-typescript, component-meta, JSX source) 5.1k/19/4 · Vue 3
docgen (vue-component-meta + vue-docgen-api) 6.7k/7/3 · Angular docgen (angular-cm + Compodoc)
8.9k/8/3 · Web Components docgen 5.2k/6/2 · Svelte docgen 1.1k/8/2 · component manifests 7.0k/16/2 ·
docgen harness 0.4k source + 21k fixtures/2.

**Node core (36.2k).** Config loading, presets and shared utils + public types 7.7k/25/4 · dev
server 2.6k/17/4 · static build 0.4k/4/4 · manager bundler (esbuild) 1.5k/11/4 · channels, events and
error catalogues 2.9k/5/4 · loggers 2.0k/7/3 · telemetry 2.8k/14/3 · package-manager proxies
(npm, yarn 1, yarn 2, pnpm, bun) 4.5k/10/3 · universal/status/test-provider stores 2.0k/3/3 ·
open-service framework 6.3k/8/3 · module graph service 2.5k/5/2 · code examples service 1.0k/4/2.

**Builders & frameworks (27.2k).** Vite builder 1.9k/9/4 · webpack 5 builder + core-webpack
2.0k/19/3 · react-vite 0.2k/1/4 · react-webpack5 + preset 0.5k/6/2 · nextjs (webpack) 3.3k/23/3 ·
nextjs-vite + vite plugin 4.1k/17/3 · vue3-vite 0.3k/1/3 · angular (webpack) 4.6k/19/3 · angular-vite
3.7k/13/3 · svelte-vite 0.2k/1/3 · sveltekit 0.9k/2/2 · web-components-vite 0.1k/0/2 · html-vite
0.1k/0/2 · preact-vite 0.1k/0/1 · ember 0.6k/5/1 · react-native-web-vite + RN init 1.3k/4/2 ·
tanstack-react 3.2k/12/2.

**Manager UI (38.3k).** Shell (layout, panels, mobile, shortcuts, settings, manager-api core,
router) 9.5k/19/4 · canvas 1.3k/5/4 · sidebar tree 5.3k/9/4 (plus a 27k-line mock fixture) · sidebar
search 0.9k/7/3 · context menu 0.4k/3/2 · tags & filtering 1.0k/5/3 · composition (refs) 1.3k/5/3 ·
shared component library 9.7k/20/4 · theming (Emotion) 1.2k/9/3 · onboarding tour 2.0k/6/2 ·
checklist 3.1k/4/2 · version check / What's New 0.8k/8/2 · change detection 1.7k/7/2 · open in
editor 0.1k/3/2.

**Essential & bundled addons (24.0k).** Controls + ArgsTable widgets 4.9k/9/4 · docs (autodocs,
blocks, renderer) 7.7k/14/4 · MDX 0.5k/9/3 · actions 0.8k/6/3 · backgrounds 0.4k/2/3 · toolbars &
globals 0.5k/2/3 · viewport 1.5k/3/3 · a11y 2.7k/6/3 · highlight 1.2k/1/2 · save story 0.7k/3/2 ·
links 0.3k/2/2 · themes 0.4k/2/2 · pseudo-states 0.9k/2/2 · measure 1.0k/4/1 · outline 0.6k/4/1.

**Testing (12.8k).** Interaction testing (storybook/test, instrumenter, panel) 4.5k/17/4 · Vitest
addon (runner, widget, coverage, vitest plugin) 7.6k/17/4 · ghost stories 0.7k/2/2.

**AI & agent integration (59.3k).** MCP (addon + package) 4.1k/12/3 · toolsets (docs, stories,
test) 5.6k/4/3 · tools CLI + SDK + attach runtime 4.3k/7/3 · skills, instructions, Claude/Codex
plugins 4.5k/5/2 · agentic review 4.5k/5/2 · evaluation harnesses 36.4k/24/2.

**CLI & lifecycle (19.7k).** CLI core and dispatcher 2.7k/18/4 · init / create-storybook 4.0k/7/4
· upgrade, automigrations, autoblockers, codemods 7.5k/14/4 · addon management 0.7k/3/3 ·
eslint-plugin 4.1k/13/3 · doctor 0.9k/3/2.

**Repository tooling (18.3k).** Build/release/CI scripts 11.7k/52/3 · sandbox templates 5.7k/24/3
· e2e suites, internal Storybook, benches 0.9k source + 4k tests/11/3.

### Usefulness scale

**4 mission-critical** (Storybook does not work, or most users are blocked, without it), **3 high**
(used by a large share of installs or strategically central), **2 medium** (valuable to a segment, or
experimental with a credible path), **1 low** (niche, replaceable by other tools, or on a sunset
path). Calibration inputs: npm downloads last month (`storybook` 97M, `@storybook/react` 88M,
`builder-vite` 71M, `react-vite` 63M, `addon-docs` 75M, `addon-a11y` 49M, `eslint-plugin-storybook`
35M, `builder-webpack5` 23M, `addon-vitest` 22M, `nextjs-vite` 12M vs `nextjs` 10M, `react-webpack5`
10M, `addon-mcp` 9.6M, `vue3` 4.5M, `angular` 2.2M vs `angular-vite` 0.5M, `svelte` 1.6M,
`web-components` 1.0M, `preact` 0.27M, `ember` 24k) and open issues per label (1,568 open in total:
`addon: docs` 175, `react` 128, `builder-vite` 117, `angular` 92, `addon: controls` 84, `cli` 78,
`ui` 77, `nextjs` 67, `addon: vitest` 66, `vue3` 66, `docgen` 61, `block: source` 52,
`builder-webpack5` 48, `mdx` 41, `web-components` 41, `composition` 28, `automigrations` 24,
`portable stories` 22).

### Themes in the size-based ranking

- **Maintainer-only harnesses.** The AI evaluation harnesses, build scripts, sandbox tooling and
  docgen harness total ~55k source lines plus ~50k fixture lines, 100+ distinct dependencies
  (including the Anthropic and OpenAI SDKs, BigQuery, Octokit, Playwright and Next.js inside
  `agent-eval`), and ~1,700 commits in a year. None of it ships to users; `agent-eval` alone is larger
  than the entire manager UI source.
- **Docgen multiplicity.** Each framework has accreted backends: React runs react-docgen,
  react-docgen-typescript and the component-meta TS program; Vue runs vue-component-meta and
  vue-docgen-api; Angular runs Compodoc and angular-cm; Web Components maintains a 5k-line
  custom-elements-manifest pipeline; and component manifests re-extract much of the same information
  for AI consumers. The docgen server already exists as the unifying layer.
- **The experimental AI surface** (MCP, toolsets, tools CLI, skills, review, module graph, checklist,
  change detection, ghost stories) is ~30k source lines with the highest churn in the repo. Prose
  shipped as code (3k lines of setup prompts) is cheap to write and expensive to keep correct across
  frameworks; the `remove-experimental-review` and `remove-change-detection-flag` automigrations show
  experiments already need explicit sunset paths.
- **Duplicate framework lineages.** Every webpack-era package has a Vite sibling. The webpack lineage
  is ~14k source lines and ~70 distinct dependencies (Next.js-webpack alone pulls 12 Babel packages
  plus SWC bindings) for a declining share of installs. Angular is the hardest case: webpack still has
  4.5× the installs of angular-vite.
- **Big-but-essential core.** The shared component library, manager shell, sidebar, config/presets,
  Vitest addon, upgrade pipeline, docs blocks and csf-tools rank high purely on size. The narrower
  signals: the component library imports three overlapping UI-primitive stacks (react-aria /
  react-aria-components, Radix, react-popper-tooltip) plus downshift for search; the manager shell
  still carries react-router-dom and react-helmet-async; five globbing libraries and three process
  spawners coexist across the repo; the sidebar ships a 27k-line mock fixture that dwarfs its 5k
  lines of source.
- **Small low-usefulness features** (server renderer, measure, Ember, outline, Preact) are cheap in
  absolute terms but each is a support surface (labels, docs pages, sandboxes, CI matrix entries).
- **Best value**: html-vite, react-vite, web-components-vite, preact-vite, vue3-vite, svelte-vite,
  backgrounds, static build, toolbars, links, open-in-editor, HTML renderer, themes, addon
  management, context menu, CSF, canvas.

### Dependency hot-spots

Features with the widest third-party surface: build scripts 52 · config-and-presets 25 ·
agent-eval 24 · sandbox tooling 24 · Next.js-webpack 23 · shared components 20 · manager shell,
Angular-webpack, React docgen and builder-webpack5 19 each · CLI core 18 · Vitest addon, nextjs-vite,
interaction testing and dev server 17 each. Same-purpose packages that coexist across features:
globbing (`glob`, `globby`, `tinyglobby`, `fast-glob`, `picomatch`, `minimatch`, `micromatch`);
process spawning (`execa`, `cross-spawn`, `tinyexec`); JS parsing (`@babel/*`, `oxc-parser`, `acorn`
+ `acorn-jsx`, `recast`, `jscodeshift`, `typescript`, `es-module-lexer` + `cjs-module-lexer`); UI
primitives (`react-aria*`, `@radix-ui/*`, `react-popper-tooltip`, `downshift`); schema validation
(`valibot`, `zod`, `@standard-schema/spec`); colour utilities (`polished`, `color-convert`,
`react-colorful`).

### Caveats that still apply

- Lines of code measure size, not difficulty. Fix-PR counts and open issues are the closest proxies.
- Dependency weights treat a release as a release; unpacked size is captured but unused.
- Issue-label counts overlap and some areas have no label (open-service, tools, manifests).
- npm counts for framework-internal packages (`builder-*`, `preset-*`, `core-webpack`) are inflated
  by transitive installs.
- The snapshot excludes `docs/` (documentation site content, ~200 MDX pages), a real maintenance cost
  not attributed per feature.
