# QA plan for Storybook 11.0

| Field | Value |
| --- | --- |
| Line | 11.0 |
| Version | 11.0.0-beta.3 |
| Window start | `v10.6.0` a77777356be2aeaff89d7a2b25254db7b2318392 |
| Window end | `v11.0.0-beta.3` e0ecb3ec6ba3648e9e5d2cf74002adec6aefe561 |
| Entries per run | 4 |

## Changes to test

### `index-title-change` Pilot of the sweep, no real finding: A changed story title replaces its entries in the story index

- PRs: [#37335](https://github.com/storybookjs/storybook/pull/37335)
- Batch: 1
- Repo `mealdrop`: a story file whose title can change while the dev server runs
- Step: Start the dev server, fetch `http://localhost:6006/index.json`, and save it as `index-title-change-before.json`.
- Step: In `src/components/Button/Button.stories.tsx`, change the title `Components/Button` to `Components/QaButton`, wait ten seconds, fetch `http://localhost:6006/index.json` again, and save it as `index-title-change-after.json`.
- Step: Restore the story file.
- Expected: The first index has the entry `components-button--default`, and the second has `components-qabutton--default` and no id that starts with `components-button--`.

### `prerelease-ranges` Pilot of the sweep, no real finding: The upgrade writes the prerelease ranges of the Storybook packages

- PRs: [#36751](https://github.com/storybookjs/storybook/pull/36751)
- Batch: 1
- Repo `mealdrop`: it depends on `storybook` and several `@storybook/*` packages with caret ranges
- Step: Read `package.json` after the upgrade and quote the version range of `storybook`, `@storybook/react-vite`, and `@storybook/addon-docs` exactly as the file writes them.
- Expected: Each of the three ranges is exactly `^11.0.0-beta.2`.

### `controls-typed-label` Pilot of the sweep, no real finding: A label typed in the Controls panel shows in the preview at once

- PRs: [#37294](https://github.com/storybookjs/storybook/pull/37294), [#36216](https://github.com/storybookjs/storybook/pull/36216)
- Batch: 2
- Repo `mealdrop`: the Input story `WithLabel` has a `label` arg with a text control
- Step: Start the dev server. With your Playwright browser tool, open `http://localhost:6006/?path=/story/components-form-input--with-label`, take a snapshot, quote the label of the input in the preview iframe, and save a screenshot as `controls-typed-label-frames/01-before.png`.
- Step: In the Controls panel, click the text field of the `label` control, clear it, type `Typed by QA`, and save a screenshot as `controls-typed-label-frames/02-after.png`.
- Step: Take a new snapshot and quote the label of the input in the preview iframe as that new snapshot shows it, then join the frames into `controls-typed-label.gif` with the gif tool.
- Expected: Before typing, the label reads `Input field`, and the new snapshot after typing shows the label `Typed by QA` in the preview iframe.

## Discovered repos

| Id | Repo at its commit | Package manager | Storybook directory | Storybook major | Stars | Pushed at | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |

## PRs that need QA

| PR | Area | Title | Decision |
| --- | --- | --- | --- |
| [#31900](https://github.com/storybookjs/storybook/pull/31900) | Preview | Preview: Only pause DocumentTimeline animations in preview-web | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#33422](https://github.com/storybookjs/storybook/pull/33422) | UI | UI: Rebuild Sidebar Tree | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35036](https://github.com/storybookjs/storybook/pull/35036) | Docs | Docs: Add componentName to getAllStoryFiles in Jest portable stories guide | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35298](https://github.com/storybookjs/storybook/pull/35298) | Docs | Docs: Honor language in emitted source snippets | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35437](https://github.com/storybookjs/storybook/pull/35437) | Angular-Vite | Angular-Vite: Drop @angular/animations and warn on legacy animation modules | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35485](https://github.com/storybookjs/storybook/pull/35485) | Webpack | Webpack: Align css-loader to v7 and pin CSS Modules export defaults | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35705](https://github.com/storybookjs/storybook/pull/35705) | Vue3 | Vue3: Only reload the preview when docgen changes on hot update | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35717](https://github.com/storybookjs/storybook/pull/35717) | Evals | Evals: Tweak CI setup for cost efficiency and peace of mind | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35944](https://github.com/storybookjs/storybook/pull/35944) | Next.js | Next.js: Replace node-polyfill-webpack-plugin with minimal polyfills | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36061](https://github.com/storybookjs/storybook/pull/36061) | Addon-Docs | Addon-Docs: Prevent source transform from being applied twice on docs pages | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36128](https://github.com/storybookjs/storybook/pull/36128) | CLI | CLI: Automigrate SB11 setConfig layout options | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36137](https://github.com/storybookjs/storybook/pull/36137) | Core | Core: Replace preview storySort with chained storySorts in main | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36216](https://github.com/storybookjs/storybook/pull/36216) | Dependencies | Dependencies: Upgrade react-aria to 3.52 and drop the patched builds | `controls-typed-label` |
| [#36217](https://github.com/storybookjs/storybook/pull/36217) | Manager | Manager: Rework keyboard shortcut handling and Escape layering | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36231](https://github.com/storybookjs/storybook/pull/36231) | Core | Core: Support XDG_CONFIG_HOME for user files | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36248](https://github.com/storybookjs/storybook/pull/36248) | CSF | CSF: Add shared mutation API for stories and config files | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36282](https://github.com/storybookjs/storybook/pull/36282) | CLI | CLI: Warn when Yarn 1 is detected on a best-effort basis | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36318](https://github.com/storybookjs/storybook/pull/36318) | Webpack5 | Webpack5: Resolve csf import from builder context | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36321](https://github.com/storybookjs/storybook/pull/36321) | Builder-Vite | Builder-Vite: Resolve preview runtime import from builder context | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36352](https://github.com/storybookjs/storybook/pull/36352) | CLI | CLI: Restore pnpm minimumReleaseAge prechecks | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36392](https://github.com/storybookjs/storybook/pull/36392) | CLI | CLI: Keep msw-storybook-addon v2 during automigration | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36401](https://github.com/storybookjs/storybook/pull/36401) | Docgen | Docgen: Stabilize docgenServer and enable it wherever a provider exists | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36417](https://github.com/storybookjs/storybook/pull/36417) | Core | Core: Build preview navigator with DOM APIs instead of innerHTML | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36421](https://github.com/storybookjs/storybook/pull/36421) | Addon Vitest | Addon Vitest: Send the story index to the test runner over IPC, not in every store frame | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36431](https://github.com/storybookjs/storybook/pull/36431) | CLI | CLI: Install the official Storybook skills on init and upgrade | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36436](https://github.com/storybookjs/storybook/pull/36436) | Addon Vitest | Addon Vitest: Restart the test runner after its child process dies | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36483](https://github.com/storybookjs/storybook/pull/36483) | Core | Core: Keep prebuilt manager and preview files under 1MB | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36484](https://github.com/storybookjs/storybook/pull/36484) | Core | Core: Remove argTypes from the story context of loaders, beforeEach, play and afterEach | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36501](https://github.com/storybookjs/storybook/pull/36501) | CSF | CSF: Type meta args by the keys you provide | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36520](https://github.com/storybookjs/storybook/pull/36520) | Core | Core: Stabilize the tag filtering API | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36521](https://github.com/storybookjs/storybook/pull/36521) | Builder-Webpack5 | Builder-Webpack5: Bump webpack-dev-middleware to 8.3.0 (GHSA-g84c-rxfj-3j2c) | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36525](https://github.com/storybookjs/storybook/pull/36525) | Angular-Vite | Angular-Vite: Require @analogjs/vite-plugin-angular 2.7.3 or later | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36532](https://github.com/storybookjs/storybook/pull/36532) | CLI | CLI: Keep custom args types in csf-factories codemod | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36533](https://github.com/storybookjs/storybook/pull/36533) | CSF | CSF: Add meta.type to type a single story in CSF Next | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36534](https://github.com/storybookjs/storybook/pull/36534) | UI | UI: Remove deprecated components for Storybook 11 | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36561](https://github.com/storybookjs/storybook/pull/36561) | CLI | CLI: Install skills with the AI feature instead of addon-mcp | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36562](https://github.com/storybookjs/storybook/pull/36562) | Review | Review: Remove experimentalReview feature flag | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36610](https://github.com/storybookjs/storybook/pull/36610) | SvelteKit | SvelteKit: Support SvelteKit 3 and drop SvelteKit 2 | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36613](https://github.com/storybookjs/storybook/pull/36613) | CSF | CSF: Run csf-tools on OXC instead of Babel | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36623](https://github.com/storybookjs/storybook/pull/36623) | CLI | CLI: Keep React Native stories on #.storybook/preview | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36628](https://github.com/storybookjs/storybook/pull/36628) | Core | Core: Remove changeDetection feature flag | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36636](https://github.com/storybookjs/storybook/pull/36636) | Vue3 | Vue3: Support Vapor components through Vue's interop plugin | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36642](https://github.com/storybookjs/storybook/pull/36642) | Core | Core: Fix autodocs, preset resolution, and React manifest matching | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36659](https://github.com/storybookjs/storybook/pull/36659) | Manager | Manager: Type index titles by their contents | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36664](https://github.com/storybookjs/storybook/pull/36664) | CI | CI: Cancel workflow when format check fails | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36667](https://github.com/storybookjs/storybook/pull/36667) | Core | Core: Remove deprecated mockChannel export from preview-api and manager-api [SB-2038] | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36669](https://github.com/storybookjs/storybook/pull/36669) | Svelte | Svelte: Add CSF factories with definePreview | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36671](https://github.com/storybookjs/storybook/pull/36671) | Addon Vitest | Addon Vitest: Support Vitest 5 | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36672](https://github.com/storybookjs/storybook/pull/36672) | Build | Build: Upgrade repository tests to Vitest 5 | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36673](https://github.com/storybookjs/storybook/pull/36673) | Build | Build: Reset live onboarding survey state between E2E attempts | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36678](https://github.com/storybookjs/storybook/pull/36678) | Manager | Manager: Remove persisted tag-filter state migration [SB-2022] | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36702](https://github.com/storybookjs/storybook/pull/36702) | Svelte | Svelte: Migrate Svelte CSF files to CSF factories and run the Svelte sandboxes with them | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36703](https://github.com/storybookjs/storybook/pull/36703) | Core | Core: Fix composition refs with camelCase keys crashing the sidebar | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36706](https://github.com/storybookjs/storybook/pull/36706) | Core | Core: Remove deprecated CSF and manager type aliases [SB-2017] | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36715](https://github.com/storybookjs/storybook/pull/36715) | TanStack React | TanStack React: Surface story render errors to Storybook | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36716](https://github.com/storybookjs/storybook/pull/36716) | Addon Vitest | Addon Vitest: Apply framework options such as strictMode | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36744](https://github.com/storybookjs/storybook/pull/36744) | CLI | CLI: Honor selected package manager during upgrade | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36745](https://github.com/storybookjs/storybook/pull/36745) | CLI | CLI: Migrate CSF2 argTypes and fail incomplete upgrades | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36746](https://github.com/storybookjs/storybook/pull/36746) | CSF | CSF: Resolve local function story references | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36751](https://github.com/storybookjs/storybook/pull/36751) | CLI | CLI: Align prerelease upgrade ranges | `prerelease-ranges` |
| [#36752](https://github.com/storybookjs/storybook/pull/36752) | Nextjs | Nextjs: Use builder Webpack for framework plugins | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36753](https://github.com/storybookjs/storybook/pull/36753) | CLI | CLI: Install npm workspace dependencies from root | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36758](https://github.com/storybookjs/storybook/pull/36758) | PNPM | PNPM: Preapprove esbuild postinstall when possible | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36760](https://github.com/storybookjs/storybook/pull/36760) | Skills | Skills: Rename stories to ui-workflow, add component-docs, triggered from AGENTS.md | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36774](https://github.com/storybookjs/storybook/pull/36774) | Manager | Manager: Keep addon panel filter active before a story is prepared | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36778](https://github.com/storybookjs/storybook/pull/36778) | Preview-API | Preview-API: prevent rendering superseded selections | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36784](https://github.com/storybookjs/storybook/pull/36784) | CLI | CLI: Exit 1 when the add command's setup fails | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36786](https://github.com/storybookjs/storybook/pull/36786) | CLI | CLI: Detect internal manager-api specifier in set-config-layout automigration | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36788](https://github.com/storybookjs/storybook/pull/36788) | Builder Vite | Builder Vite: Report silent vite config discovery misses with a named warning | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36790](https://github.com/storybookjs/storybook/pull/36790) | Core | Core: Skip TypeScript loader hook registration under Jest | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36791](https://github.com/storybookjs/storybook/pull/36791) | Core | Core: Load presets sequentially to prevent ESM require() race in CJS presets | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36792](https://github.com/storybookjs/storybook/pull/36792) | Core | Core: Floor ts-dedent to ^2.2.0 so a CJS-only hoist cannot break the Vite preview graph | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36793](https://github.com/storybookjs/storybook/pull/36793) | CLI | CLI: Align the Vite upgrade blocker with the 6.3.0 floor | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36794](https://github.com/storybookjs/storybook/pull/36794) | CLI | CLI: Avoid `storybook upgrade` hang on npm by running plain install before --force | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36798](https://github.com/storybookjs/storybook/pull/36798) | Angular-Vite | Angular-Vite: strip legacy animation modules even when renamed by bundlers | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36799](https://github.com/storybookjs/storybook/pull/36799) | Automigrate | Automigrate: Stop wrapping relative addon paths with getAbsolutePath | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36816](https://github.com/storybookjs/storybook/pull/36816) | UI | UI: Improve focus region keyboard shortcuts | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36819](https://github.com/storybookjs/storybook/pull/36819) | ESLint | ESLint: Validate mandatory static fields in CSF 3 and 4 | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36820](https://github.com/storybookjs/storybook/pull/36820) | Skills | Skills: Fix what agents get wrong in the evals | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36841](https://github.com/storybookjs/storybook/pull/36841) | React | React: Alias preview React from the renderer preset | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36880](https://github.com/storybookjs/storybook/pull/36880) | CLI | CLI: Check React Native on-device peers before install | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36882](https://github.com/storybookjs/storybook/pull/36882) | CLI | CLI: Tolerate Yarn 6 in version lookups and sandbox config | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36892](https://github.com/storybookjs/storybook/pull/36892) | CLI | CLI: Detect Remix 3 as the HTML renderer | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36915](https://github.com/storybookjs/storybook/pull/36915) | Core | Core: Make storybook/theming React-free | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36928](https://github.com/storybookjs/storybook/pull/36928) | CLI | CLI: Preserve pnpm terminal for install confirmation | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36948](https://github.com/storybookjs/storybook/pull/36948) | Core | Core: Move save-story, docs snippets and the mock rewrite onto the new csf-tools | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36974](https://github.com/storybookjs/storybook/pull/36974) | Components | Components: Make tall popover content scroll within the viewport | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36987](https://github.com/storybookjs/storybook/pull/36987) | Docgen | Docgen: Make typescript a required peer dependency | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36994](https://github.com/storybookjs/storybook/pull/36994) | Core | Core: Let UniversalStore followers wait for their leader without a timeout | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37002](https://github.com/storybookjs/storybook/pull/37002) | Next.js | Next.js: Preserve display option for local fonts | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37004](https://github.com/storybookjs/storybook/pull/37004) | Docgen | Docgen: Run React and Angular docgen on the TypeScript 7.1 native API | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37032](https://github.com/storybookjs/storybook/pull/37032) | Builder-Vite | Builder-Vite: Write files registered with addWatchFile to preview-stats.json | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37038](https://github.com/storybookjs/storybook/pull/37038) | Sidebar | Sidebar: Expand/collapse all and run tests from root context menu | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37044](https://github.com/storybookjs/storybook/pull/37044) | Angular | Angular: Reject partial loglevel matches | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37099](https://github.com/storybookjs/storybook/pull/37099) | Builder-Webpack5 | Builder-Webpack5: Match mocks against webpack's resolved resource | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37122](https://github.com/storybookjs/storybook/pull/37122) | Astro | Astro: Add init support, doc mention and ecosystem CI sandbox | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37125](https://github.com/storybookjs/storybook/pull/37125) | CLI | CLI: Scaffold CSF4 from storybook init | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37136](https://github.com/storybookjs/storybook/pull/37136) | Core | Core: ASCII-safe open-service static-snapshot filenames | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37140](https://github.com/storybookjs/storybook/pull/37140) | Core | Core: Prebundle `open` to drop 10 installed packages | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37141](https://github.com/storybookjs/storybook/pull/37141) | React | React: Make react-docgen optional and drop builder docgen deps from the default install | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37143](https://github.com/storybookjs/storybook/pull/37143) | Test | Test: Bundle the test libraries and their types, upgrade to Vitest 5 | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37144](https://github.com/storybookjs/storybook/pull/37144) | Manager | Manager: Remove storybook/test from the manager globals | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37157](https://github.com/storybookjs/storybook/pull/37157) | Core | Core: Fix docgen and story docs for reserved ids, renamed files and selected stories | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37162](https://github.com/storybookjs/storybook/pull/37162) | Core | Core: Bundle six small dependencies and require Preact 10.9 | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37165](https://github.com/storybookjs/storybook/pull/37165) | Docs | Docs: Add snippet templates so story snippets can follow the controls | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37166](https://github.com/storybookjs/storybook/pull/37166) | React | React: Story snippets follow the controls | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37167](https://github.com/storybookjs/storybook/pull/37167) | Vue | Vue: Story snippets follow the controls | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37168](https://github.com/storybookjs/storybook/pull/37168) | Svelte | Svelte: Story snippets follow the controls | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37169](https://github.com/storybookjs/storybook/pull/37169) | Web Components | Web Components: Story snippets follow the controls | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37170](https://github.com/storybookjs/storybook/pull/37170) | Angular | Angular: Story snippets follow the controls | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37176](https://github.com/storybookjs/storybook/pull/37176) | Core | Core: Let StackBlitz embed the dev server again | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37187](https://github.com/storybookjs/storybook/pull/37187) | Addon Vitest | Addon Vitest: Run story files Vitest hasn't seen yet | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37203](https://github.com/storybookjs/storybook/pull/37203) | Community | Community: Support prerelease community frameworks in init | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37214](https://github.com/storybookjs/storybook/pull/37214) | SvelteKit | SvelteKit: Mock $app modules with Storybook's mock API, remove sveltekit_experimental | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37223](https://github.com/storybookjs/storybook/pull/37223) | SvelteKit | SvelteKit: Automigrate sveltekit_experimental to beforeEach | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37261](https://github.com/storybookjs/storybook/pull/37261) | CLI | CLI: Remove jscodeshift and Babel, install 13 packages instead of 128 | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37290](https://github.com/storybookjs/storybook/pull/37290) | MCP | MCP: Publish the composition schema a hosted Storybook actually serves | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37294](https://github.com/storybookjs/storybook/pull/37294) | Manager | Manager: Make store reads include writes React has not committed yet | `controls-typed-label` |
| [#37296](https://github.com/storybookjs/storybook/pull/37296) | Skills | Skills: Split ui-workflow into four skills, with AGENTS.md as the workflow | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37335](https://github.com/storybookjs/storybook/pull/37335) | Core | Core: Replace the story index's version counters with replaceable file slots | `index-title-change` |
| [#37344](https://github.com/storybookjs/storybook/pull/37344) | Core | Core: Fix stories failing to load on Windows with the webpack builder | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37348](https://github.com/storybookjs/storybook/pull/37348) | CLI | CLI: Default sandbox command to initializing Storybook | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37371](https://github.com/storybookjs/storybook/pull/37371) | Core | Core: Watch story files with chokidar | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37380](https://github.com/storybookjs/storybook/pull/37380) | CLI | CLI: Keep the sandbox csf-factories codemod out of linked template stories | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37385](https://github.com/storybookjs/storybook/pull/37385) | Theming | Theming: Preserve legacy Emotion imports in browser runtimes | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37387](https://github.com/storybookjs/storybook/pull/37387) | Nextjs-Vite | Nextjs-Vite: Fix Windows paths in static image imports | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37389](https://github.com/storybookjs/storybook/pull/37389) | Manager | Manager: Improve performance of story preloading | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37390](https://github.com/storybookjs/storybook/pull/37390) | Manager | Manager: Cut re-renders and store writes on story change | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |

## Undeclared PRs

| PR | Area | Title | Decision |
| --- | --- | --- | --- |
| [#35399](https://github.com/storybookjs/storybook/pull/35399) | Sidebar 2.0 | Sidebar 2.0: sync with next, viewport-keyed sticky tree, deep review fixes | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35618](https://github.com/storybookjs/storybook/pull/35618) |  | fix: wait for inline stories before rerendering docs | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35658](https://github.com/storybookjs/storybook/pull/35658) | Core | Core: Accept legacy addon namespaces in CSF factories | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35812](https://github.com/storybookjs/storybook/pull/35812) | Core | Core: Adjust type to fix custom tags autocompletion | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#35911](https://github.com/storybookjs/storybook/pull/35911) | TanStack | TanStack: Support Render-Prop Children in Link Mock | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36051](https://github.com/storybookjs/storybook/pull/36051) | Core | Core: Raise browser support floors | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36054](https://github.com/storybookjs/storybook/pull/36054) | Vitest | Vitest: Decode non-ASCII characters in file paths for test execution guard | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36094](https://github.com/storybookjs/storybook/pull/36094) | Build | Build: Remove Next.js 14 and React 16 sandboxes | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36107](https://github.com/storybookjs/storybook/pull/36107) | Core | Core: Clean Up Paused Animations After AfterEach Failure | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36129](https://github.com/storybookjs/storybook/pull/36129) | CLI | CLI: Remove deprecated componentSubtitle | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36202](https://github.com/storybookjs/storybook/pull/36202) | Addons | Addons: Reduce a11y report size and retention in Vitest | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36297](https://github.com/storybookjs/storybook/pull/36297) | Explore | Explore: unified SVG trace layer for the sidebar tree (Design 3) | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36345](https://github.com/storybookjs/storybook/pull/36345) | Builder-Vite | Builder-Vite: Write the full bundler graph to preview-stats.json | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36388](https://github.com/storybookjs/storybook/pull/36388) |  | Fix Yarn 1 next tag lookups | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36390](https://github.com/storybookjs/storybook/pull/36390) | CI | CI: Derive Danger branch version from package version | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36461](https://github.com/storybookjs/storybook/pull/36461) | CLI | CLI: Remove automigrations for upgrades to Storybook 10 and earlier | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36462](https://github.com/storybookjs/storybook/pull/36462) | CLI | CLI: Stream automigration file edits through one transform pipeline | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36463](https://github.com/storybookjs/storybook/pull/36463) | Addon Docs | Addon Docs: Map CSF plugin sourcemaps to the transform input | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36468](https://github.com/storybookjs/storybook/pull/36468) | Addon-docs | Addon-docs: Skip re-parsing untransformed stories in the CSF plugin | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36475](https://github.com/storybookjs/storybook/pull/36475) | CLI | CLI: Stream automigration file edits through one transform pipeline | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36486](https://github.com/storybookjs/storybook/pull/36486) | Build | Build: Bump addon-svelte-csf to 5.1.4 | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36502](https://github.com/storybookjs/storybook/pull/36502) | TanStack | TanStack: Type story query params from the route's search schema | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36547](https://github.com/storybookjs/storybook/pull/36547) | CLI | CLI: Keep a license header first when editing config and setup files | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36548](https://github.com/storybookjs/storybook/pull/36548) | Node logger | Node logger: Keep task logs short and from erasing the output above them | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36579](https://github.com/storybookjs/storybook/pull/36579) | Addon Docs | Addon Docs: Keep the dev server running when a story file is deleted during a rebuild | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36585](https://github.com/storybookjs/storybook/pull/36585) | Build | Build: Fix oxfmt formatting in web-components csf-factories test | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36608](https://github.com/storybookjs/storybook/pull/36608) | React | React: Keep the act environment set while a story tears down | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36612](https://github.com/storybookjs/storybook/pull/36612) | Docs | Docs: Render Markdown in JSDoc parameter and return descriptions | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36619](https://github.com/storybookjs/storybook/pull/36619) | CLI | CLI: Replace addon-svelte-csf with the framework package in every workspace package | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36675](https://github.com/storybookjs/storybook/pull/36675) | Docs | Docs: Update upstream branch to next in CONTRIBUTING.md | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36709](https://github.com/storybookjs/storybook/pull/36709) | Docs | Docs: Update stories block component to use standard heading style | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36712](https://github.com/storybookjs/storybook/pull/36712) | TanStack | TanStack: Add strictMode to FrameworkOptions type | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36732](https://github.com/storybookjs/storybook/pull/36732) | Nextjs-Vite | Nextjs-Vite: Provide parentRenderTree.bfcacheId in app router mock | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36740](https://github.com/storybookjs/storybook/pull/36740) | Typescript | Typescript: Exclude all dunderscore prefixed folders from production compilation | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36807](https://github.com/storybookjs/storybook/pull/36807) | Vitest | Vitest: Don't duplicate setupFiles configured as a string | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36861](https://github.com/storybookjs/storybook/pull/36861) | Core | Core: Let one-shot commands exit while open-service waits for sync replies | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#36967](https://github.com/storybookjs/storybook/pull/36967) | Next.js | Next.js: Prefix the hash of an object href with # in the next/link mocks | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37001](https://github.com/storybookjs/storybook/pull/37001) | Addon Docs | Addon Docs: Keep the code toggle focus ring visible | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37088](https://github.com/storybookjs/storybook/pull/37088) | CI | CI: Remove the webpack pin from the angular-cli sandbox template | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37089](https://github.com/storybookjs/storybook/pull/37089) | Docs | Docs: Make the snippet-order fix test drive-agnostic | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37173](https://github.com/storybookjs/storybook/pull/37173) | Build(deps) | Build(deps): Bump lodash-es from 4.17.21 to 4.18.1 in the npm_and_yarn group across 1 directory | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37174](https://github.com/storybookjs/storybook/pull/37174) | Build(deps) | Build(deps): Bump joi from 17.13.3 to 17.13.9 in the npm_and_yarn group across 1 directory | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37175](https://github.com/storybookjs/storybook/pull/37175) | Build(deps) | Build(deps): Bump node-forge from 1.3.1 to 1.4.2 in the npm_and_yarn group across 1 directory | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37288](https://github.com/storybookjs/storybook/pull/37288) | Angular | Angular: Destroy root components before the application on story switch | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |
| [#37374](https://github.com/storybookjs/storybook/pull/37374) | CLI | CLI: Use current commit hash in sandbox publish commit title | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |

## Groups of maintainer PRs marked qa:skip

| Group | Source | Decision |
| --- | --- | --- |
| `pilot` | every maintainer PR marked qa:skip in the window | skip: skipped for the pilot, which only proves that the sweep runs and tests nothing else |

## Maintainer PRs marked qa:skip

| PR | Area | Title | Group |
| --- | --- | --- | --- |
| [#33917](https://github.com/storybookjs/storybook/pull/33917) | Preact | Preact: Preact 11 support | `pilot` |
| [#34799](https://github.com/storybookjs/storybook/pull/34799) | Tooling | Tooling: Use pkg.pr.new for canary releases | `pilot` |
| [#35245](https://github.com/storybookjs/storybook/pull/35245) | Manager | Manager: Resolve preview iframe URL against the document base URI | `pilot` |
| [#35509](https://github.com/storybookjs/storybook/pull/35509) | UI | UI: Fix controls expander and select chevron overlap in RTL | `pilot` |
| [#35626](https://github.com/storybookjs/storybook/pull/35626) | Core | Core: Add basePath in LoadOptions | `pilot` |
| [#35664](https://github.com/storybookjs/storybook/pull/35664) | Typescript | Typescript: Explicitly type enhanceArgTypes | `pilot` |
| [#35690](https://github.com/storybookjs/storybook/pull/35690) | Tools | Tools: Make toolset aware of SB basePath | `pilot` |
| [#35885](https://github.com/storybookjs/storybook/pull/35885) | Nextjs-Vite | Nextjs-Vite: Hash next-image virtual IDs to avoid ENAMETOOLONG | `pilot` |
| [#36158](https://github.com/storybookjs/storybook/pull/36158) | Telemetry | Telemetry: Read the package manager node linker from its config file | `pilot` |
| [#36181](https://github.com/storybookjs/storybook/pull/36181) | Core | Core: Fix build crash when ref reachability check fails mid-request | `pilot` |
| [#36183](https://github.com/storybookjs/storybook/pull/36183) | A11y | A11y: Fix SummaryScreen region nesting | `pilot` |
| [#36209](https://github.com/storybookjs/storybook/pull/36209) | UI | UI: Preserve story scroll position on HMR re-render | `pilot` |
| [#36210](https://github.com/storybookjs/storybook/pull/36210) | Telemetry | Telemetry: One tools-command record per invocation with CLI toolset and tool names | `pilot` |
| [#36212](https://github.com/storybookjs/storybook/pull/36212) | WC | WC: Add docgen baseline snapshots | `pilot` |
| [#36218](https://github.com/storybookjs/storybook/pull/36218) | UI | UI: Add renderAriaLabel and a context argument to renderLabel | `pilot` |
| [#36219](https://github.com/storybookjs/storybook/pull/36219) | UI | UI: Polish shared primitives ahead of the sidebar rework | `pilot` |
| [#36224](https://github.com/storybookjs/storybook/pull/36224) | UI | UI: Fix focus trap, indicators and tab order in the mobile about overlay | `pilot` |
| [#36225](https://github.com/storybookjs/storybook/pull/36225) | UI | UI: Reset the mobile about overlay when the menu drawer closes | `pilot` |
| [#36226](https://github.com/storybookjs/storybook/pull/36226) | UI | UI: Make settings pages scrollable in mobile layout | `pilot` |
| [#36227](https://github.com/storybookjs/storybook/pull/36227) | UI | UI: Fix stacked modals being inert and Escape closing both | `pilot` |
| [#36229](https://github.com/storybookjs/storybook/pull/36229) | Core | Core: Fix manager WebSocket overload during large test runs | `pilot` |
| [#36244](https://github.com/storybookjs/storybook/pull/36244) | Core | Core: Remove client-side WebSocket timeout detection | `pilot` |
| [#36245](https://github.com/storybookjs/storybook/pull/36245) | Svelte | Svelte: Setup docgen harness | `pilot` |
| [#36247](https://github.com/storybookjs/storybook/pull/36247) | Builder Vite | Builder Vite: Prevent `publicDir` from overriding `index.json` and `staticDirs` | `pilot` |
| [#36254](https://github.com/storybookjs/storybook/pull/36254) | Open Service | Open Service: Rename clientId to runtimeId in sync envelopes | `pilot` |
| [#36259](https://github.com/storybookjs/storybook/pull/36259) | Open Service | Open Service: Record setState mutations as RFC 6902 JSON patches | `pilot` |
| [#36260](https://github.com/storybookjs/storybook/pull/36260) | Open Service | Open Service: Emit RFC 6902 services:entry patches | `pilot` |
| [#36265](https://github.com/storybookjs/storybook/pull/36265) | Open Service | Open Service: Ordered log with undo/redo and concurrent sync | `pilot` |
| [#36270](https://github.com/storybookjs/storybook/pull/36270) | Addon Vitest | Addon Vitest: Support Vitest 5 browser tests | `pilot` |
| [#36271](https://github.com/storybookjs/storybook/pull/36271) | Open Service | Open Service: Bootstrap and repair through snapshot request/reply | `pilot` |
| [#36277](https://github.com/storybookjs/storybook/pull/36277) | Vite | Vite: Fix emptyOutDir override by plugins like Adonis | `pilot` |
| [#36286](https://github.com/storybookjs/storybook/pull/36286) | UI | UI: Ensure FocusScope reuse across manager | `pilot` |
| [#36299](https://github.com/storybookjs/storybook/pull/36299) | Vue | Vue: Restructure docgen and story-snippet | `pilot` |
| [#36307](https://github.com/storybookjs/storybook/pull/36307) | Builder Vite | Builder Vite: Static assets copy to handle Windows paths | `pilot` |
| [#36341](https://github.com/storybookjs/storybook/pull/36341) | Manager | Manager: Improve UI stability on onboarding checklist | `pilot` |
| [#36343](https://github.com/storybookjs/storybook/pull/36343) | CLI | CLI: Use pnpm to query the registry URL | `pilot` |
| [#36371](https://github.com/storybookjs/storybook/pull/36371) | WC | WC: Add docgen provider reading the Custom Elements Manifest | `pilot` |
| [#36385](https://github.com/storybookjs/storybook/pull/36385) | CLI | CLI: Scope AI instructions to the project framework | `pilot` |
| [#36389](https://github.com/storybookjs/storybook/pull/36389) | Docs | Docs: Enable the Code panel by default | `pilot` |
| [#36394](https://github.com/storybookjs/storybook/pull/36394) | Core | Core: Remove features.legacyDecoratorFileOrder | `pilot` |
| [#36395](https://github.com/storybookjs/storybook/pull/36395) | CLI | CLI: Make browser opening opt-in | `pilot` |
| [#36396](https://github.com/storybookjs/storybook/pull/36396) | Addon Vitest | Addon Vitest: Prevent users from calling `setProjectAnnotations`, add auto migration for `vitest.setup.ts` | `pilot` |
| [#36398](https://github.com/storybookjs/storybook/pull/36398) | Open-service | Open-service: Clean up sync code and tests, and fix six sync breaks | `pilot` |
| [#36400](https://github.com/storybookjs/storybook/pull/36400) | Plugins | Plugins: Render the Codex skills from the Claude skills | `pilot` |
| [#36402](https://github.com/storybookjs/storybook/pull/36402) | Core | Core: Make UniversalStore internal | `pilot` |
| [#36409](https://github.com/storybookjs/storybook/pull/36409) | Svelte | Svelte: Setup empty docgen and story snippet skeleton | `pilot` |
| [#36411](https://github.com/storybookjs/storybook/pull/36411) | WC | WC: Add a server-side argTypes mapper for the Custom Elements Manifest | `pilot` |
| [#36416](https://github.com/storybookjs/storybook/pull/36416) | Open-service | Open-service: Test why the Log window keeps entries young or among the newest 256 | `pilot` |
| [#36418](https://github.com/storybookjs/storybook/pull/36418) |  | Remove @storybook/react-dom-shim | `pilot` |
| [#36419](https://github.com/storybookjs/storybook/pull/36419) | CLI | CLI: Fix hidden output of CLI commands on Yarn 1 | `pilot` |
| [#36420](https://github.com/storybookjs/storybook/pull/36420) | Open-service | Open-service: Sync services through ordered JSON patches instead of full snapshots | `pilot` |
| [#36427](https://github.com/storybookjs/storybook/pull/36427) | Evals | Evals: Score storybook tools --input and --json runs | `pilot` |
| [#36428](https://github.com/storybookjs/storybook/pull/36428) | Core | Core: List composed refs in the tools CLI docs toolset | `pilot` |
| [#36429](https://github.com/storybookjs/storybook/pull/36429) | Evals | Evals: Run the experiments on Opus 5.5 medium and GPT-6-Sol medium | `pilot` |
| [#36433](https://github.com/storybookjs/storybook/pull/36433) | Skills | Skills: Show Storybook results in the harness's in-app browser | `pilot` |
| [#36443](https://github.com/storybookjs/storybook/pull/36443) | React | React: Test startup without TypeScript | `pilot` |
| [#36445](https://github.com/storybookjs/storybook/pull/36445) | React Native Web | React Native Web: Fix TypeScript 6 peer conflict | `pilot` |
| [#36449](https://github.com/storybookjs/storybook/pull/36449) | WC | WC: Add manifest manager to the server side docgen | `pilot` |
| [#36451](https://github.com/storybookjs/storybook/pull/36451) | CLI | CLI: Remove `--preview-url` and `--force-build-preview` | `pilot` |
| [#36454](https://github.com/storybookjs/storybook/pull/36454) | WC | WC: Map events, methods, slots and CSS categories in the server-siddocgen | `pilot` |
| [#36477](https://github.com/storybookjs/storybook/pull/36477) | Manifest | Manifest: Enable componentsManifest by default for React, Vue 3, and Angular-Vite | `pilot` |
| [#36480](https://github.com/storybookjs/storybook/pull/36480) | Core | Core: Remove deprecated tab addon registration | `pilot` |
| [#36494](https://github.com/storybookjs/storybook/pull/36494) | Manager | Manager: Capitalize GitHub and open the contributors link in a new tab on mobile | `pilot` |
| [#36495](https://github.com/storybookjs/storybook/pull/36495) | Addon Links | Addon Links: Handle story URLs that only carry a path | `pilot` |
| [#36499](https://github.com/storybookjs/storybook/pull/36499) | WC | WC: Resolve superclass and mixins in unflattened CEM | `pilot` |
| [#36500](https://github.com/storybookjs/storybook/pull/36500) | MCP | MCP: Keep every tool description within Claude Code's 2048-character limit | `pilot` |
| [#36506](https://github.com/storybookjs/storybook/pull/36506) | Svelte | Svelte: Ship the Svelte CSF runtime without svelte-package | `pilot` |
| [#36510](https://github.com/storybookjs/storybook/pull/36510) | WC | WC: Address #36454 reviews | `pilot` |
| [#36511](https://github.com/storybookjs/storybook/pull/36511) | Core | Core: Enable TypeScript strict mode in every package | `pilot` |
| [#36512](https://github.com/storybookjs/storybook/pull/36512) | CSF | CSF: Remove argTypes defaultValue | `pilot` |
| [#36514](https://github.com/storybookjs/storybook/pull/36514) | Svelte | Svelte: Export Svelte CSF from the Svelte packages and unify Args and StoryContext | `pilot` |
| [#36519](https://github.com/storybookjs/storybook/pull/36519) | Interactions | Interactions: Keep the status badge on the current story's result | `pilot` |
| [#36522](https://github.com/storybookjs/storybook/pull/36522) | WC | WC: Bind args by docgen category in the default render | `pilot` |
| [#36524](https://github.com/storybookjs/storybook/pull/36524) | Svelte | Svelte: Remove the legacy Svelte CSF syntax | `pilot` |
| [#36526](https://github.com/storybookjs/storybook/pull/36526) | Preact | Preact: Support Preact 11 | `pilot` |
| [#36535](https://github.com/storybookjs/storybook/pull/36535) | Docs | Docs: Stop double-quoting string defaults from server docgen | `pilot` |
| [#36536](https://github.com/storybookjs/storybook/pull/36536) | Docs | Docs: Label the main argTypes tab with the server docgen name | `pilot` |
| [#36537](https://github.com/storybookjs/storybook/pull/36537) | Themes | Themes: Remove deprecated useThemeParameters helper | `pilot` |
| [#36538](https://github.com/storybookjs/storybook/pull/36538) | CLI | CLI: Find main.mts and main.cts configs in automigrations | `pilot` |
| [#36539](https://github.com/storybookjs/storybook/pull/36539) | CLI | CLI: Stop reading every .gitignore when looking for a Vite config | `pilot` |
| [#36540](https://github.com/storybookjs/storybook/pull/36540) | CLI | CLI: Rename the dirname import when main config declares its own | `pilot` |
| [#36541](https://github.com/storybookjs/storybook/pull/36541) | CLI | CLI: Never look for Storybook projects inside node_modules | `pilot` |
| [#36542](https://github.com/storybookjs/storybook/pull/36542) | CLI | CLI: Keep storybook add's progress lines out of the automigration log | `pilot` |
| [#36543](https://github.com/storybookjs/storybook/pull/36543) | CLI | CLI: Install every pnpm workspace project after an upgrade | `pilot` |
| [#36544](https://github.com/storybookjs/storybook/pull/36544) | CLI | CLI: Treat opt-in automigrations the same with automigrate --yes and upgrade --yes | `pilot` |
| [#36545](https://github.com/storybookjs/storybook/pull/36545) | CLI | CLI: Fail upgrade --yes with a hint instead of prompting for a config dir | `pilot` |
| [#36549](https://github.com/storybookjs/storybook/pull/36549) | CLI | CLI: Log per-project config notices at debug level | `pilot` |
| [#36550](https://github.com/storybookjs/storybook/pull/36550) | CLI | CLI: Never downgrade a satellite addon to its next tag | `pilot` |
| [#36551](https://github.com/storybookjs/storybook/pull/36551) | CLI | CLI: Keep scoped package families on one major when upgrading related dependencies | `pilot` |
| [#36552](https://github.com/storybookjs/storybook/pull/36552) | CLI | CLI: Upgrade pnpm catalog entries instead of pinning catalog dependencies | `pilot` |
| [#36553](https://github.com/storybookjs/storybook/pull/36553) | Core | Core: Load a builder that main config gives as its package directory | `pilot` |
| [#36558](https://github.com/storybookjs/storybook/pull/36558) | Svelte | Svelte: Turn on the built-in Svelte CSF and stop using the addon | `pilot` |
| [#36559](https://github.com/storybookjs/storybook/pull/36559) | Skills | Skills: Stop requiring addon-mcp | `pilot` |
| [#36563](https://github.com/storybookjs/storybook/pull/36563) | MCP | MCP: Put the result instructions in the structured content | `pilot` |
| [#36564](https://github.com/storybookjs/storybook/pull/36564) | Skills | Skills: Put the story instructions and command reference in one skill | `pilot` |
| [#36565](https://github.com/storybookjs/storybook/pull/36565) | WC | WC: Generate apiDescription in componentsManifest | `pilot` |
| [#36572](https://github.com/storybookjs/storybook/pull/36572) | Next.js | Next.js: Fix Babel mode with Next.js 16.3 | `pilot` |
| [#36573](https://github.com/storybookjs/storybook/pull/36573) | Next.js | Next.js: Detect every Babel config file name Next.js supports | `pilot` |
| [#36574](https://github.com/storybookjs/storybook/pull/36574) | React-Vite | React-Vite: Run react-docgen without the project Babel config first | `pilot` |
| [#36578](https://github.com/storybookjs/storybook/pull/36578) | Agent-eval | Agent-eval: Read Storybook calls after heredocs and judge test runs in the sandbox | `pilot` |
| [#36581](https://github.com/storybookjs/storybook/pull/36581) | Svelte | Svelte: Run the Svelte CSF test and example stories in the sandboxes | `pilot` |
| [#36582](https://github.com/storybookjs/storybook/pull/36582) | CLI | CLI: Fix Windows paths in automigration failure reports | `pilot` |
| [#36583](https://github.com/storybookjs/storybook/pull/36583) | TypeScript | TypeScript: Explicitly type returntype of ArgsStore#get | `pilot` |
| [#36586](https://github.com/storybookjs/storybook/pull/36586) | Core | Core: Subscribe services to module-graph changes only in the dev server | `pilot` |
| [#36587](https://github.com/storybookjs/storybook/pull/36587) | CLI | CLI: Add an automigration from `@storybook/addon-svelte-csf` to the built-in Svelte CSF | `pilot` |
| [#36590](https://github.com/storybookjs/storybook/pull/36590) | Agent-eval | Agent-eval: Let shell segments use the tokenizer's heredoc handling | `pilot` |
| [#36592](https://github.com/storybookjs/storybook/pull/36592) | Svelte | Svelte: Show the cause of the Svelte CSF IndexerParseError (0009) | `pilot` |
| [#36594](https://github.com/storybookjs/storybook/pull/36594) | Core | Core: Make experimental_devServer await the services preset | `pilot` |
| [#36595](https://github.com/storybookjs/storybook/pull/36595) | Svelte | Svelte: Remove the deprecated Svelte CSF Story props id, autodocs and source | `pilot` |
| [#36597](https://github.com/storybookjs/storybook/pull/36597) | Svelte | Svelte: Support Svelte CSF in core | `pilot` |
| [#36598](https://github.com/storybookjs/storybook/pull/36598) | Core | Core: Mark a review stale only on changes made after it was published | `pilot` |
| [#36599](https://github.com/storybookjs/storybook/pull/36599) | WC | WC: Generate story snippets from args and the manifest | `pilot` |
| [#36601](https://github.com/storybookjs/storybook/pull/36601) | Tools | Tools: Use strict input schemas so CLI and MCP reject unknown arguments | `pilot` |
| [#36602](https://github.com/storybookjs/storybook/pull/36602) | Core | Core: Point the tools CLI at a private composed Storybook's own MCP | `pilot` |
| [#36607](https://github.com/storybookjs/storybook/pull/36607) | Tools | Tools: Require strict input schemas in defineToolset | `pilot` |
| [#36609](https://github.com/storybookjs/storybook/pull/36609) | Releases | Releases: Update sort-package-json, don't mangle exports fields | `pilot` |
| [#36616](https://github.com/storybookjs/storybook/pull/36616) | Skills | Skills: Remove the legacy instruction templates | `pilot` |
| [#36617](https://github.com/storybookjs/storybook/pull/36617) | CLI | CLI: Remove the storybook ai command | `pilot` |
| [#36618](https://github.com/storybookjs/storybook/pull/36618) | Core | Core: Include stories from every CSF file sharing a component id in story-docs | `pilot` |
| [#36620](https://github.com/storybookjs/storybook/pull/36620) | CLI | CLI: Show the Svelte CSF automigration's details in upgrade, and find more legacy syntax | `pilot` |
| [#36622](https://github.com/storybookjs/storybook/pull/36622) | WC | WC: Deprecate runtime WC manifest path | `pilot` |
| [#36627](https://github.com/storybookjs/storybook/pull/36627) | Core | Core: Wait for the status store to sync in attached `stories changed` | `pilot` |
| [#36629](https://github.com/storybookjs/storybook/pull/36629) | CLI | CLI: Shorten the stories skill to one inline workflow | `pilot` |
| [#36632](https://github.com/storybookjs/storybook/pull/36632) | Builder-Webpack5 | Builder-Webpack5: Categorize WebpackMissingPreviewTemplateError | `pilot` |
| [#36643](https://github.com/storybookjs/storybook/pull/36643) | Core | Core: Stop warning on process ancestry cycles | `pilot` |
| [#36648](https://github.com/storybookjs/storybook/pull/36648) | WC | WC: Automigration from runtime to docgen | `pilot` |
| [#36650](https://github.com/storybookjs/storybook/pull/36650) | WC | WC: Generate story snippet from HTML templates | `pilot` |
| [#36653](https://github.com/storybookjs/storybook/pull/36653) | UI | UI: Respect reduced motion and pause,stop,hide in Card animations | `pilot` |
| [#36657](https://github.com/storybookjs/storybook/pull/36657) | Manager | Manager: Keep tour tooltips on screen when their content grows | `pilot` |
| [#36674](https://github.com/storybookjs/storybook/pull/36674) | Core | Core: Remove the create-new-story button from the sidebar | `pilot` |
| [#36676](https://github.com/storybookjs/storybook/pull/36676) | Tools | Tools: Make docs tool output easier for agents to act on | `pilot` |
| [#36680](https://github.com/storybookjs/storybook/pull/36680) | CLI | CLI: Fix wrong advice in the skills setup instructions | `pilot` |
| [#36683](https://github.com/storybookjs/storybook/pull/36683) | Core | Core: List changed stories first and narrow the coverage gap in stories changed | `pilot` |
| [#36691](https://github.com/storybookjs/storybook/pull/36691) | Svelte | Svelte: Accept preview.meta() in Svelte CSF files | `pilot` |
| [#36693](https://github.com/storybookjs/storybook/pull/36693) | Svelte | Svelte: Support meta.type<>() in Svelte CSF files | `pilot` |
| [#36697](https://github.com/storybookjs/storybook/pull/36697) | Addon Vitest | Addon Vitest: Make the test run report agree with its outcome | `pilot` |
| [#36698](https://github.com/storybookjs/storybook/pull/36698) | Core | Core: Suggest close stories when a story selector matches nothing | `pilot` |
| [#36726](https://github.com/storybookjs/storybook/pull/36726) | Security | Security: Patch GHSA-f2ph-cmg5-wxc8 and GHSA-px85-f4q5-jh77 | `pilot` |
| [#36728](https://github.com/storybookjs/storybook/pull/36728) | WC | WC: Generate docgen with cem-generator | `pilot` |
| [#36763](https://github.com/storybookjs/storybook/pull/36763) | Svelte | Svelte: Add server-side docgen and story snippets | `pilot` |
| [#36764](https://github.com/storybookjs/storybook/pull/36764) | CSF | CSF: Remove legacy .story annotations | `pilot` |
| [#36776](https://github.com/storybookjs/storybook/pull/36776) | Angular | Angular: Fix schema for stats-json so TurboSnap works | `pilot` |
| [#36777](https://github.com/storybookjs/storybook/pull/36777) | CLI | CLI: Warn when the preview still imports the Custom Elements Manifest | `pilot` |
| [#36804](https://github.com/storybookjs/storybook/pull/36804) | Tanstack | Tanstack: Load story router after all beforeEach hooks | `pilot` |
| [#36805](https://github.com/storybookjs/storybook/pull/36805) | WC | WC: Normalize multiline type text in WC arg type parsing | `pilot` |
| [#36806](https://github.com/storybookjs/storybook/pull/36806) | WC | WC: Skip undefined and null args in the web components default render | `pilot` |
| [#36812](https://github.com/storybookjs/storybook/pull/36812) | WC | WC: Read WC meta.component through a spread of a local meta object | `pilot` |
| [#36813](https://github.com/storybookjs/storybook/pull/36813) | Svelte | Svelte: Remove deprecated parameters.component path | `pilot` |
| [#36862](https://github.com/storybookjs/storybook/pull/36862) | WC | WC: Keep properties named like an unrelated attribute | `pilot` |
| [#36864](https://github.com/storybookjs/storybook/pull/36864) | Windows | Windows: Fix various FS-related test failures | `pilot` |
| [#36865](https://github.com/storybookjs/storybook/pull/36865) | Controls | Controls: Seed an empty array from the Object control for array args | `pilot` |
| [#36901](https://github.com/storybookjs/storybook/pull/36901) | CSF | CSF: Do not merge, CI and canary for the oxc csf-tools commits of #36613 | `pilot` |
| [#36909](https://github.com/storybookjs/storybook/pull/36909) | Manager | Manager: Delete v10.3 tag filters from local storage | `pilot` |
| [#36910](https://github.com/storybookjs/storybook/pull/36910) | Core | Core: Exempt chromatic from release-age gates alongside the Chromatic addon | `pilot` |
| [#36916](https://github.com/storybookjs/storybook/pull/36916) | CLI | CLI: Keep hyperlinks out of piped output | `pilot` |
| [#36929](https://github.com/storybookjs/storybook/pull/36929) | CLI | CLI: Resolve Pnpm Catalog Ranges in Framework Detection | `pilot` |
| [#36947](https://github.com/storybookjs/storybook/pull/36947) | CSF Tools | CSF Tools: Complete the public API from the ten ecosystem ports | `pilot` |
| [#36964](https://github.com/storybookjs/storybook/pull/36964) | Svelte | Svelte: Extend a story of the same file with the extend prop in Svelte CSF | `pilot` |
| [#36972](https://github.com/storybookjs/storybook/pull/36972) | CSF | CSF: Ignore empty tags when combining tags | `pilot` |
| [#36973](https://github.com/storybookjs/storybook/pull/36973) | Manager | Manager: Keep empty string args and globals in story URLs | `pilot` |
| [#36983](https://github.com/storybookjs/storybook/pull/36983) | WC | WC: Disable control for cssstate | `pilot` |
| [#36990](https://github.com/storybookjs/storybook/pull/36990) | Sidebar | Sidebar: Design QA refinements | `pilot` |
| [#36991](https://github.com/storybookjs/storybook/pull/36991) | Svelte | Svelte: Keep one docgen program per tsconfig in a component-meta manager | `pilot` |
| [#36993](https://github.com/storybookjs/storybook/pull/36993) | Core | Core: Skip extraction refresh when the story index fails to build | `pilot` |
| [#36996](https://github.com/storybookjs/storybook/pull/36996) | Svelte | Svelte: Print string args in story template snippets as quoted attributes | `pilot` |
| [#37022](https://github.com/storybookjs/storybook/pull/37022) | Sandboxes | Sandboxes: Remove the duplicate JavaScript and the Ember sandbox templates | `pilot` |
| [#37025](https://github.com/storybookjs/storybook/pull/37025) | Core | Core: Make channel path configurable | `pilot` |
| [#37039](https://github.com/storybookjs/storybook/pull/37039) | Build | Build: Rename vitest.config.storybook.ts to vitest.config.ts | `pilot` |
| [#37042](https://github.com/storybookjs/storybook/pull/37042) | UI | UI: Show context menu button on sticky branch rows | `pilot` |
| [#37046](https://github.com/storybookjs/storybook/pull/37046) | Svelte | Svelte: Provide apiDescription in the manifest | `pilot` |
| [#37050](https://github.com/storybookjs/storybook/pull/37050) | Svelte | Svelte: Parse Svelte CSF files instead of compiling them in the indexer | `pilot` |
| [#37056](https://github.com/storybookjs/storybook/pull/37056) | Svelte | Svelte: Parse Svelte CSF files instead of compiling them in the docgen | `pilot` |
| [#37060](https://github.com/storybookjs/storybook/pull/37060) | UI | UI: Add ScrollArea to Popover | `pilot` |
| [#37062](https://github.com/storybookjs/storybook/pull/37062) | Docs | Docs: Keep the color picker handle inside the scrollable popover | `pilot` |
| [#37073](https://github.com/storybookjs/storybook/pull/37073) | Sidebar | Sidebar: Avoid infinite recursion in focus callback | `pilot` |
| [#37074](https://github.com/storybookjs/storybook/pull/37074) | Sidebar | Sidebar: Show the row shortcut tooltip in Chrome | `pilot` |
| [#37076](https://github.com/storybookjs/storybook/pull/37076) | Revert "Docs | Revert "Docs: Keep the color picker handle inside the scrollable popover" | `pilot` |
| [#37081](https://github.com/storybookjs/storybook/pull/37081) | Svelte | Svelte: Put the fix in each Svelte CSF error and remove ERRORS.md | `pilot` |
| [#37082](https://github.com/storybookjs/storybook/pull/37082) | CLI | CLI: Use JSDoc types instead of propTypes in React JS init templates | `pilot` |
| [#37095](https://github.com/storybookjs/storybook/pull/37095) | Greptile | Greptile: Add setup script for environment configuration | `pilot` |
| [#37114](https://github.com/storybookjs/storybook/pull/37114) | Open Service | Open Service: Register core/story-docs in the manager | `pilot` |
| [#37124](https://github.com/storybookjs/storybook/pull/37124) | Telemetry | Telemetry: Add VRT packages | `pilot` |
| [#37138](https://github.com/storybookjs/storybook/pull/37138) | Core | Core: Remove unused docs images from the published package | `pilot` |
| [#37139](https://github.com/storybookjs/storybook/pull/37139) | CLI | CLI: Resolve owner-scoped pkg.pr.new canary specifiers | `pilot` |
| [#37156](https://github.com/storybookjs/storybook/pull/37156) | Core | Core: Show story-docs data that arrives after a subscription starts | `pilot` |
| [#37159](https://github.com/storybookjs/storybook/pull/37159) | Core | Core: Drop npmlog from node-logger | `pilot` |
| [#37183](https://github.com/storybookjs/storybook/pull/37183) | Preview API | Preview API: Skip the landmark navigation listener in RN | `pilot` |
| [#37199](https://github.com/storybookjs/storybook/pull/37199) | Core | Core: Stop a late ack error clobbering resolved static-load state in the story | `pilot` |
| [#37204](https://github.com/storybookjs/storybook/pull/37204) | Svelte | Svelte: Clearer indexing errors for files without defineMeta, and print each error once | `pilot` |
| [#37292](https://github.com/storybookjs/storybook/pull/37292) | React | React: Accept only 0.7 of the docgen Vite plugin until TypeScript 7.1 is stable | `pilot` |
| [#37316](https://github.com/storybookjs/storybook/pull/37316) | Svelte | Svelte: Remove the leftovers from the Svelte CSF addon | `pilot` |
| [#37320](https://github.com/storybookjs/storybook/pull/37320) | React | React: Separate the items of a compact array or object default with one space | `pilot` |
| [#37334](https://github.com/storybookjs/storybook/pull/37334) | Test | Test: Fix the context userEvent in insecure contexts | `pilot` |
| [#37346](https://github.com/storybookjs/storybook/pull/37346) | Skills | Skills: Remove the ui-workflow skill of an 11.0 prerelease on upgrade | `pilot` |

## PRs verified by hand

| PR | Area | Title |
| --- | --- | --- |
| [#36153](https://github.com/storybookjs/storybook/pull/36153) | Addon A11y | Addon A11y: Fix vision simulator color filters in Firefox |
| [#36214](https://github.com/storybookjs/storybook/pull/36214) | Core | Core: Restore the change-detection CTA in the sidebar |
| [#36294](https://github.com/storybookjs/storybook/pull/36294) | Addon Vitest | Addon Vitest: Toggle coverage without restarting Vitest |
| [#36412](https://github.com/storybookjs/storybook/pull/36412) | Core | Core: Require TypeScript 5.9 for Storybook 11 consumers |
| [#37010](https://github.com/storybookjs/storybook/pull/37010) | Core | Core: Stop composed refs from blocking dev-server startup |

## PRs marked qa:skip

| PR | Area | Title |
| --- | --- | --- |
| [#34523](https://github.com/storybookjs/storybook/pull/34523) | Docs | Docs: Document Stencil import injection for static builds |
| [#34741](https://github.com/storybookjs/storybook/pull/34741) | Docs | Docs: Document storybook init --agent and --no-agent |
| [#35337](https://github.com/storybookjs/storybook/pull/35337) | Core | Core: Fix DEP0205 deprecation warning for module.register() on Node.js 26 |
| [#35460](https://github.com/storybookjs/storybook/pull/35460) | ESLint | ESLint: Recognize storybook/test imports in await-interactions |
| [#35834](https://github.com/storybookjs/storybook/pull/35834) | React | React: Guard docgen extraction against TypeScript builds without the compiler API |
| [#35863](https://github.com/storybookjs/storybook/pull/35863) | Core | Core: Handle WebSocket errors so a bad frame can't crash the dev server |
| [#36015](https://github.com/storybookjs/storybook/pull/36015) | Angular | Angular: Preserve unknown standalone metadata in story-docs snippets |
| [#36062](https://github.com/storybookjs/storybook/pull/36062) | Docs | Docs: Fix dead storyshots migration guide link in README |
| [#36110](https://github.com/storybookjs/storybook/pull/36110) | Eval | Eval: Add agentic-reference framework and baseline metrics |
| [#36119](https://github.com/storybookjs/storybook/pull/36119) | Docs | Docs: Remove outdated prerelease reference and fix typo |
| [#36162](https://github.com/storybookjs/storybook/pull/36162) | Vite | Vite: Raise minimum supported version to 7 |
| [#36164](https://github.com/storybookjs/storybook/pull/36164) | Vitest | Vitest: Raise minimum supported Vitest to 4 |
| [#36166](https://github.com/storybookjs/storybook/pull/36166) | Angular | Angular: Raise the supported floor to 21 |
| [#36167](https://github.com/storybookjs/storybook/pull/36167) | Next.js | Next.js: Raise the supported floor to 15 |
| [#36168](https://github.com/storybookjs/storybook/pull/36168) | CLI | CLI: Remove Create React App support |
| [#36169](https://github.com/storybookjs/storybook/pull/36169) | React | React: Raise the supported floor to 18 |
| [#36187](https://github.com/storybookjs/storybook/pull/36187) | CLI | CLI: Block upgrade when addon-vitest runs Vitest below 4 |
| [#36188](https://github.com/storybookjs/storybook/pull/36188) | Vitest | Vitest: Remove workarounds obsoleted by the Vitest 4 floor |
| [#36189](https://github.com/storybookjs/storybook/pull/36189) | Addon Links | Addon Links: Add `hrefToSync` function for synchronous url generation |
| [#36192](https://github.com/storybookjs/storybook/pull/36192) | MIGRATION | MIGRATION: Consolidate item title format |
| [#36193](https://github.com/storybookjs/storybook/pull/36193) | Next.js | Next.js: Deprecate @storybook/nextjs (removal in SB12) |
| [#36196](https://github.com/storybookjs/storybook/pull/36196) | Build | Build: Skip the canary PR body update when the description has no markers |
| [#36198](https://github.com/storybookjs/storybook/pull/36198) | Vitest | Vitest: Revert removal of workarounds obsoleted by the Vitest 4 floor |
| [#36199](https://github.com/storybookjs/storybook/pull/36199) | Revert "Next.js | Revert "Next.js: Raise the supported floor to 15" |
| [#36200](https://github.com/storybookjs/storybook/pull/36200) | Vitest | Vitest: Removal of workarounds obsoleted by the Vitest 4 floor |
| [#36201](https://github.com/storybookjs/storybook/pull/36201) | Next.js | Next.js: Raise the supported floor to 15 |
| [#36213](https://github.com/storybookjs/storybook/pull/36213) | Docs | Docs: Add deprecation callout to Next.js framework page |
| [#36223](https://github.com/storybookjs/storybook/pull/36223) | CI | CI: Distinguish review approval danger error messages |
| [#36236](https://github.com/storybookjs/storybook/pull/36236) | Docs | Docs: Remove Yarn PnP documentation |
| [#36237](https://github.com/storybookjs/storybook/pull/36237) | Core | Core: Remove Yarn PnP support |
| [#36240](https://github.com/storybookjs/storybook/pull/36240) | Docs | Docs: Correct viewport dimensions for desktop and nexus5x |
| [#36242](https://github.com/storybookjs/storybook/pull/36242) | Build | Build: Remove PnP from sandbox generation and CI |
| [#36249](https://github.com/storybookjs/storybook/pull/36249) | Docs | Docs: Add encode-lessons-in-structure skill |
| [#36252](https://github.com/storybookjs/storybook/pull/36252) | Vue | Vue: Resolve named-type properties in docgen-server argTypes |
| [#36253](https://github.com/storybookjs/storybook/pull/36253) | Angular | Angular: Resolve named-type properties in docgen-server extractType |
| [#36255](https://github.com/storybookjs/storybook/pull/36255) | Vite | Vite: Restore support for Vite 6.3+ |
| [#36256](https://github.com/storybookjs/storybook/pull/36256) | Docs | Docs: Fix QueryClient imports in TanStack React setup snippets |
| [#36258](https://github.com/storybookjs/storybook/pull/36258) | Docs | Docs: Update migration guides for v11 |
| [#36261](https://github.com/storybookjs/storybook/pull/36261) | Docs | Docs: Update addon migration guide for SB 11 |
| [#36262](https://github.com/storybookjs/storybook/pull/36262) | Dependencies | Dependencies: Bump `jscodeshift` to 17.4.0 |
| [#36264](https://github.com/storybookjs/storybook/pull/36264) | Core | Core: Limit onboarding checklist rainbow animation |
| [#36268](https://github.com/storybookjs/storybook/pull/36268) | Docs | Docs: Remove comments from copyable shell snippets |
| [#36276](https://github.com/storybookjs/storybook/pull/36276) | Docs | Docs: Backfill SB11 migration references and guide links |
| [#36278](https://github.com/storybookjs/storybook/pull/36278) | Docs | Docs: Use Callout prompt variant for AI-prompt callouts |
| [#36279](https://github.com/storybookjs/storybook/pull/36279) | Node.js | Node.js: Require 22.12+ for Storybook 11 |
| [#36284](https://github.com/storybookjs/storybook/pull/36284) | CI | CI: Skip Playwright browser install in init-empty jobs |
| [#36289](https://github.com/storybookjs/storybook/pull/36289) | CI | CI: Remove obsolete test-storybooks-portable-vitest3 job and react-vitest-3 template |
| [#36291](https://github.com/storybookjs/storybook/pull/36291) | Docs | Docs: Improve links in migration guide |
| [#36296](https://github.com/storybookjs/storybook/pull/36296) | Nextjs-Vite | Nextjs-Vite: Skip unresolved image imports |
| [#36301](https://github.com/storybookjs/storybook/pull/36301) | MCP | MCP: Point the splash link at the agent setup guide |
| [#36303](https://github.com/storybookjs/storybook/pull/36303) | Build | Build: Mark the contributor skills as internal for the skills CLI |
| [#36304](https://github.com/storybookjs/storybook/pull/36304) | React Native Web | React Native Web: Fix compatibility with typescript>5 |
| [#36308](https://github.com/storybookjs/storybook/pull/36308) | Docs | Docs: Split agent guidelines out of AGENTS.md for progressive disclosure |
| [#36309](https://github.com/storybookjs/storybook/pull/36309) | Tests | Tests: Fix Preact React version expectation |
| [#36310](https://github.com/storybookjs/storybook/pull/36310) | CLI | CLI: Fix vitest ERESOLVE on fresh Next.js apps. |
| [#36320](https://github.com/storybookjs/storybook/pull/36320) | CLI | CLI: Accept Node.js prerelease builds in the version gate |
| [#36322](https://github.com/storybookjs/storybook/pull/36322) | Docs | Docs: Update SB11 migration notes for CSF tools |
| [#36324](https://github.com/storybookjs/storybook/pull/36324) | Core | Core: Promote declared-subcomponents CSF helper |
| [#36328](https://github.com/storybookjs/storybook/pull/36328) | Vue | Vue: Emit declared subcomponents in docgen payload |
| [#36333](https://github.com/storybookjs/storybook/pull/36333) | TanStack | TanStack: Support both interpolatePath signatures |
| [#36338](https://github.com/storybookjs/storybook/pull/36338) | Docs | Docs: Add external resources to the testing and documentation link lists |
| [#36339](https://github.com/storybookjs/storybook/pull/36339) | Docgen | Docgen: Baseline typed TSX/JSX slot extraction for Vue 3 |
| [#36342](https://github.com/storybookjs/storybook/pull/36342) | Docgen | Docgen: Fold or skip dynamic slot names in the Vue template fallback merge |
| [#36346](https://github.com/storybookjs/storybook/pull/36346) | Core | Core: Make csf-tools printing and CLI dispatcher output Windows-stable |
| [#36348](https://github.com/storybookjs/storybook/pull/36348) | Core, Vite | Core, Vite: Support embedding Storybook in a host |
| [#36353](https://github.com/storybookjs/storybook/pull/36353) | Core | Core: Allow vite-plus 0.3.x in the optional peer range |
| [#36354](https://github.com/storybookjs/storybook/pull/36354) | Docs | Docs: Clarify Node.js prerelease support |
| [#36357](https://github.com/storybookjs/storybook/pull/36357) | CI | CI: Add a ci:focus label that runs only what the diff affects |
| [#36360](https://github.com/storybookjs/storybook/pull/36360) | Core | Core: Stabilize csf-tools quote inference and webpack5 test on Windows |
| [#36361](https://github.com/storybookjs/storybook/pull/36361) | Docs | Docs: Explain Vite build option handling |
| [#36362](https://github.com/storybookjs/storybook/pull/36362) | Docs | Docs: Clarify Angular provider decorators |
| [#36370](https://github.com/storybookjs/storybook/pull/36370) | CI | CI: Generate the CircleCI config without installing dependencies |
| [#36375](https://github.com/storybookjs/storybook/pull/36375) | Angular Vite | Angular Vite: Honor angular.json browserTarget options in build/start builders |
| [#36381](https://github.com/storybookjs/storybook/pull/36381) | Release | Release: Bump version to 11.0.0-alpha.1 |
| [#36384](https://github.com/storybookjs/storybook/pull/36384) | CLI | CLI: Report when a CSF file could not be parsed |
| [#36391](https://github.com/storybookjs/storybook/pull/36391) | CLI | CLI: Support CommonJS ESLint flat config automigration |
| [#36393](https://github.com/storybookjs/storybook/pull/36393) | Open-service | Open-service: Document the final sync protocol |
| [#36413](https://github.com/storybookjs/storybook/pull/36413) | Build | Build: Sync the skills to storybookjs/skills and tag every release |
| [#36422](https://github.com/storybookjs/storybook/pull/36422) | Docs | Docs: Modernize TypeScript story examples |
| [#36424](https://github.com/storybookjs/storybook/pull/36424) | Core | Core: Replace obsolete satisfies compatibility helper |
| [#36425](https://github.com/storybookjs/storybook/pull/36425) | Stories | Stories: Use satisfies for React meta declarations |
| [#36439](https://github.com/storybookjs/storybook/pull/36439) | Evals | Evals: Install every Storybook package from the checkout under test |
| [#36442](https://github.com/storybookjs/storybook/pull/36442) | WC | WC: Fix unit tests for windows |
| [#36448](https://github.com/storybookjs/storybook/pull/36448) | Docs | Docs: Record recently merged breaking changes in the migration files |
| [#36465](https://github.com/storybookjs/storybook/pull/36465) | UI | UI: Fix JSX runtime resolution in manager addons |
| [#36474](https://github.com/storybookjs/storybook/pull/36474) | Docgen | Docgen: Avoid loading test libraries in the Vue and Angular presets |
| [#36478](https://github.com/storybookjs/storybook/pull/36478) | Evals | Evals: Put the Storybook MCP server instructions in AGENTS.md for Codex |
| [#36479](https://github.com/storybookjs/storybook/pull/36479) | Vue | Vue: Restore DOCGEN_WORKER_SPECIFIER export from preset |
| [#36481](https://github.com/storybookjs/storybook/pull/36481) | Build | Build: Remove test-runner from CI and sandboxes |
| [#36482](https://github.com/storybookjs/storybook/pull/36482) | Docs | Docs: Document end of test runner support |
| [#36493](https://github.com/storybookjs/storybook/pull/36493) | Docs | Docs: Record recently merged breaking changes in the migration files |
| [#36496](https://github.com/storybookjs/storybook/pull/36496) | Svelte | Svelte: Import addon-svelte-csf with its git history |
| [#36497](https://github.com/storybookjs/storybook/pull/36497) | Svelte | Svelte: Wire the imported Svelte CSF code into @storybook/svelte |
| [#36503](https://github.com/storybookjs/storybook/pull/36503) | UI | UI: Fix incorrect name of WithTooltipPure replacement |
| [#36505](https://github.com/storybookjs/storybook/pull/36505) | Build | Build: Speed up monorepo compile |
| [#36508](https://github.com/storybookjs/storybook/pull/36508) | UI | UI: Restore accessible descriptions for generic tooltips |
| [#36513](https://github.com/storybookjs/storybook/pull/36513) | Docs | Docs: Fix select control options in the conditional controls snippet |
| [#36516](https://github.com/storybookjs/storybook/pull/36516) | Build | Build: Run Vitest type tests on TypeScript 7 and finish internal TS 7 cleanup |
| [#36517](https://github.com/storybookjs/storybook/pull/36517) | Build | Build: Upgrade oxlint to 1.85 and oxfmt to 0.70 |
| [#36518](https://github.com/storybookjs/storybook/pull/36518) | CI | CI: Run internal Storybook E2E on a large executor |
| [#36531](https://github.com/storybookjs/storybook/pull/36531) | Docs | Docs: Record the argTypes removal and four missing breaking changes in the migration guide |
| [#36557](https://github.com/storybookjs/storybook/pull/36557) | Docs | Docs: Document docgenServer as stable and enabled by default |
| [#36560](https://github.com/storybookjs/storybook/pull/36560) | CI | CI: Run agent-eval unit tests only on CircleCI Linux |
| [#36569](https://github.com/storybookjs/storybook/pull/36569) | Docs | Docs: Fix outdated Storybook plugin version in ESLint compatibility table |
| [#36575](https://github.com/storybookjs/storybook/pull/36575) | UI | UI: Allow collapsing the testing widget after a crash |
| [#36584](https://github.com/storybookjs/storybook/pull/36584) | Sandboxes | Sandboxes: Record docgen baselines on the default Angular and Vue sandboxes |
| [#36588](https://github.com/storybookjs/storybook/pull/36588) | Next.js | Next.js: Fix app-router mock crash on Next.js 16.4 |
| [#36596](https://github.com/storybookjs/storybook/pull/36596) | Core | Core: Share authoredSource across story-docs providers |
| [#36603](https://github.com/storybookjs/storybook/pull/36603) | Svelte | Svelte: Fix the Svelte CSF automigration unit tests on Windows |
| [#36605](https://github.com/storybookjs/storybook/pull/36605) | Build | Build: Fix the unit tests that still fail on Windows |
| [#36624](https://github.com/storybookjs/storybook/pull/36624) | Agent-eval | Agent-eval: Run the Codex experiments on GPT-6.1-Sol |
| [#36634](https://github.com/storybookjs/storybook/pull/36634) | TanstackReact | TanstackReact: Fix accross typo in path-utils comment |
| [#36637](https://github.com/storybookjs/storybook/pull/36637) | Docs | Docs: Document that Vite full bundle mode is not supported |
| [#36644](https://github.com/storybookjs/storybook/pull/36644) | Preact | Preact: Add a Preact 10 sandbox to daily CI |
| [#36654](https://github.com/storybookjs/storybook/pull/36654) | Docs | Docs: Note the webpack 5.101 requirement in the migration guide |
| [#36656](https://github.com/storybookjs/storybook/pull/36656) | Agent-eval | Agent-eval: Update the fixture template to msw-storybook-addon v3 |
| [#36658](https://github.com/storybookjs/storybook/pull/36658) | Agent-eval | Agent-eval: Add an eval for stories of a component that fetches |
| [#36661](https://github.com/storybookjs/storybook/pull/36661) | Core | Core: Render full unions for named-alias enum props |
| [#36662](https://github.com/storybookjs/storybook/pull/36662) | Core | Core: Remove legacy highlight object format |
| [#36663](https://github.com/storybookjs/storybook/pull/36663) | Core | Core: Remove viewport.defaultViewport parameter and responsiveViewport export |
| [#36677](https://github.com/storybookjs/storybook/pull/36677) | Agents | Agents: Add a code review guide and slim AGENTS.md down to pointers |
| [#36679](https://github.com/storybookjs/storybook/pull/36679) | Agent evals | Agent evals: Install the branch build in the lifecycle evals and commit the setup files |
| [#36682](https://github.com/storybookjs/storybook/pull/36682) | React | React: Prebundle react/jsx-runtime to avoid a reload when plugins import it |
| [#36684](https://github.com/storybookjs/storybook/pull/36684) | Core | Core: Unify the worker-gated story-docs provider |
| [#36687](https://github.com/storybookjs/storybook/pull/36687) | Docs | Docs: Explain Vitest addon test isolation with extends: true |
| [#36688](https://github.com/storybookjs/storybook/pull/36688) | Build | Build: Align remaining dev dependencies with supported ranges |
| [#36692](https://github.com/storybookjs/storybook/pull/36692) | Sandboxes | Sandboxes: Remove the SvelteKit 3 age-gate workaround |
| [#36704](https://github.com/storybookjs/storybook/pull/36704) | Docs | Docs: Update WC documentation for SB 11 |
| [#36705](https://github.com/storybookjs/storybook/pull/36705) | Core | Core: SB-2021 remove open-service getStatus and getGraphRevision aliases |
| [#36707](https://github.com/storybookjs/storybook/pull/36707) | WC | WC: Add tests and stories to cover new types of inputs |
| [#36717](https://github.com/storybookjs/storybook/pull/36717) | Core | Core: Make manager globals test Windows-stable |
| [#36721](https://github.com/storybookjs/storybook/pull/36721) | Addon Themes | Addon Themes: Declare the package as an ES module |
| [#36731](https://github.com/storybookjs/storybook/pull/36731) | Build | Build: Fail production compile on declaration emit diagnostics |
| [#36733](https://github.com/storybookjs/storybook/pull/36733) | Core | Core: Tighten toolbar types and remove redundant normalization (SB-2019) |
| [#36736](https://github.com/storybookjs/storybook/pull/36736) | SB-2014 | SB-2014: Remove remaining storiesOf detection leftovers |
| [#36754](https://github.com/storybookjs/storybook/pull/36754) | React | React: Make nested user-event act wrappers re-entrant |
| [#36755](https://github.com/storybookjs/storybook/pull/36755) | Docs | Docs: Correct Storybook 11 migration guidance |
| [#36756](https://github.com/storybookjs/storybook/pull/36756) | WC | WC: Drop docgen.typeProperty |
| [#36757](https://github.com/storybookjs/storybook/pull/36757) |  | [SB-2007] Remove ExternalDocs and ExternalDocsContainer |
| [#36768](https://github.com/storybookjs/storybook/pull/36768) | Svelte | Svelte: Resolve existing Knip findings |
| [#36770](https://github.com/storybookjs/storybook/pull/36770) | Svelte | Svelte: Fix Svelte CSF code snippet crash on null args |
| [#36775](https://github.com/storybookjs/storybook/pull/36775) | Agent-eval | Agent-eval: Strip ANSI colors from captured eval output |
| [#36780](https://github.com/storybookjs/storybook/pull/36780) | Angular | Angular: Read Component Metadata From Ivy Declarations |
| [#36808](https://github.com/storybookjs/storybook/pull/36808) | Docs | Docs: Document docgen snippets being static |
| [#36815](https://github.com/storybookjs/storybook/pull/36815) | Core | Core: Keep the module graph reverse index off the server channel |
| [#36822](https://github.com/storybookjs/storybook/pull/36822) | Addon Vitest | Addon Vitest: Keep non-array test.projects applying when appending storybook project |
| [#36823](https://github.com/storybookjs/storybook/pull/36823) | Core | Core: Exit 1 when a prompt aborts or stdin ends mid-run |
| [#36824](https://github.com/storybookjs/storybook/pull/36824) | React renderer | React renderer: Prebundle react so Vitest browser mode can link React's default export |
| [#36828](https://github.com/storybookjs/storybook/pull/36828) | React | React: Parse each tsconfig once per components manifest run |
| [#36830](https://github.com/storybookjs/storybook/pull/36830) | CI | CI: Pin the npm that the benchmark and sandbox jobs run |
| [#36834](https://github.com/storybookjs/storybook/pull/36834) | Agents | Agents: Drop the removed --no-open flag from skills |
| [#36835](https://github.com/storybookjs/storybook/pull/36835) | CI | CI: Remove review approval check from Danger |
| [#36836](https://github.com/storybookjs/storybook/pull/36836) | Tree | Tree: Fix story to handle virtualization and scroll behavior |
| [#36838](https://github.com/storybookjs/storybook/pull/36838) | Docs | Docs: Fix typo in CLI options |
| [#36853](https://github.com/storybookjs/storybook/pull/36853) | Docs | Docs: fix broken toolbars link in README |
| [#36857](https://github.com/storybookjs/storybook/pull/36857) | React | React: Keep react-docgen-typescript JSDoc tags in the components manifest |
| [#36875](https://github.com/storybookjs/storybook/pull/36875) | Frameworks | Frameworks: Accept TypeScript 7 in peer dependency ranges |
| [#36877](https://github.com/storybookjs/storybook/pull/36877) | Manager | Manager: Align native control colors with selected theme |
| [#36878](https://github.com/storybookjs/storybook/pull/36878) | Docs | Docs: Explain release-day package manager gates and Remix 3 |
| [#36879](https://github.com/storybookjs/storybook/pull/36879) | Sandboxes | Sandboxes: Pin React prerelease templates to canary |
| [#36881](https://github.com/storybookjs/storybook/pull/36881) | CI | CI: Pin npm 12 and smoke-test Node 26 |
| [#36886](https://github.com/storybookjs/storybook/pull/36886) | Build | Build: Disable the sandbox npm age gate in ecosystem CI |
| [#36904](https://github.com/storybookjs/storybook/pull/36904) | Docs | Docs: Add runtime WC manifest API deprecation to MIGRATION.md |
| [#36913](https://github.com/storybookjs/storybook/pull/36913) | Core | Core: Make storybook/theming React-free |
| [#36914](https://github.com/storybookjs/storybook/pull/36914) | Core | Core: Import Emotion theming APIs from storybook/theming/emotion |
| [#36917](https://github.com/storybookjs/storybook/pull/36917) | Builder Vite | Builder Vite: Print the found Vite config path with forward slashes on Windows |
| [#36941](https://github.com/storybookjs/storybook/pull/36941) | Docs | Docs: Put CSF Next snippets before CSF 3 and enforce the order |
| [#36943](https://github.com/storybookjs/storybook/pull/36943) | Docs | Docs: Rename CSF Next snippet tabs to CSF 4 |
| [#36946](https://github.com/storybookjs/storybook/pull/36946) | Docs | Docs: Svelte CSF Next snippet variants (Svelte CSF stays, CSF 3 removed) |
| [#36950](https://github.com/storybookjs/storybook/pull/36950) | Agents | Agents: List Chromatic project IDs for the UI and sandboxes |
| [#36958](https://github.com/storybookjs/storybook/pull/36958) | Build | Build: Stop requiring a ci:* label in Danger |
| [#36959](https://github.com/storybookjs/storybook/pull/36959) | CI | CI: Combine ci:* labels and add ci:windows |
| [#36960](https://github.com/storybookjs/storybook/pull/36960) | CI | CI: Replace merged runs with a nightly Slack failure report |
| [#36962](https://github.com/storybookjs/storybook/pull/36962) | Docs | Docs: Document TypeScript 7 side by side with TypeScript 6 |
| [#36965](https://github.com/storybookjs/storybook/pull/36965) | CLI | CLI: SB-2390 Gate the SvelteKit 3 floor behind @storybook/sveltekit |
| [#36976](https://github.com/storybookjs/storybook/pull/36976) | Preview API | Preview API: Keep nested globals when restoring them from the URL |
| [#36979](https://github.com/storybookjs/storybook/pull/36979) | Build | Build: Resolve workspace packages to source in unit tests |
| [#36984](https://github.com/storybookjs/storybook/pull/36984) | Build | Build: Drop Expo sandbox age-gate exemptions and name quarantined transitive dependencies |
| [#36985](https://github.com/storybookjs/storybook/pull/36985) | E2E | E2E: Give the sidebar-scrolling settle poll time on a loaded machine |
| [#36988](https://github.com/storybookjs/storybook/pull/36988) | Svelte | Svelte: Accept member expression components in defineMeta |
| [#36992](https://github.com/storybookjs/storybook/pull/36992) | Docs | Docs: Add a warning comment to CSF 3 snippets |
| [#36997](https://github.com/storybookjs/storybook/pull/36997) | CI | CI: Right-size the sandbox create and Chromatic jobs |
| [#37003](https://github.com/storybookjs/storybook/pull/37003) | CI | CI: Remove the ci:merged label and workflow |
| [#37006](https://github.com/storybookjs/storybook/pull/37006) | WC | WC: Document @wc-toolkit/storybook-helpers in migration |
| [#37009](https://github.com/storybookjs/storybook/pull/37009) | Core | Core: Upgrade oxc-parser to 0.155.0 |
| [#37012](https://github.com/storybookjs/storybook/pull/37012) | CI | CI: Resolve kitchen-sink template paths with pathe so Windows unit tests pass |
| [#37017](https://github.com/storybookjs/storybook/pull/37017) | Nextjs-Vite | Nextjs-Vite: Preserve Async Cache Mock Implementations |
| [#37024](https://github.com/storybookjs/storybook/pull/37024) | CI | CI: Resolve the config generator's file reads on Windows |
| [#37026](https://github.com/storybookjs/storybook/pull/37026) | CI | CI: Speed up the Windows unit test job |
| [#37033](https://github.com/storybookjs/storybook/pull/37033) | CI | CI: Restore the compile step on the Node 26 smoke job |
| [#37034](https://github.com/storybookjs/storybook/pull/37034) | CI | CI: Run Chromatic on every focus sandbox when a shared template story changes |
| [#37035](https://github.com/storybookjs/storybook/pull/37035) | CI | CI: Pin TypeScript 6 in the react-vite TypeScript sandbox templates |
| [#37036](https://github.com/storybookjs/storybook/pull/37036) | CI | CI: Un-silence the Node 26 smoke sandbox builds and skip their Playwright install |
| [#37043](https://github.com/storybookjs/storybook/pull/37043) | Build | Build: Keep the CircleCI config generator free of installed dependencies |
| [#37048](https://github.com/storybookjs/storybook/pull/37048) | Svelte CSF | Svelte CSF: Normalize the runtime stories path resolved by the Vite plugin |
| [#37051](https://github.com/storybookjs/storybook/pull/37051) | Core | Core: Widen the file-lock heartbeat test margins for slow CI runners |
| [#37057](https://github.com/storybookjs/storybook/pull/37057) | Svelte CSF | Svelte CSF: Use Storybook loggers instead of console |
| [#37058](https://github.com/storybookjs/storybook/pull/37058) | CI | CI: Restore the template prompt in yarn task |
| [#37063](https://github.com/storybookjs/storybook/pull/37063) | CI | CI: Run the internal Storybook Chromatic job on every focus run |
| [#37064](https://github.com/storybookjs/storybook/pull/37064) | Core | Core: Remove temporary migration flags argTypeTargetsV7 and disallowImplicitActionsInRenderV8 |
| [#37068](https://github.com/storybookjs/storybook/pull/37068) | Core | Core: Stabilize Windows unit tests (file-lock stale window, vue3 meta + dist-contract timeouts) |
| [#37075](https://github.com/storybookjs/storybook/pull/37075) | Build | Build: Read AGENTS.md directly and symlink skills from .agents |
| [#37085](https://github.com/storybookjs/storybook/pull/37085) | CI | CI: Automate MIGRATION.md table of contents updates |
| [#37086](https://github.com/storybookjs/storybook/pull/37086) | Docs | Docs: Move CSF reference into Writing stories and update for CSF 4 |
| [#37087](https://github.com/storybookjs/storybook/pull/37087) | Telemetry | Telemetry: Count story snippet outcomes in the build event |
| [#37097](https://github.com/storybookjs/storybook/pull/37097) | Agents | Agents: Add the build-it workflow and its review and QA skills |
| [#37101](https://github.com/storybookjs/storybook/pull/37101) | Docs | Docs: Update Chromatic Storybook MCP links |
| [#37102](https://github.com/storybookjs/storybook/pull/37102) | Docs | Docs: Rewrite Storybook 11 migration guide |
| [#37111](https://github.com/storybookjs/storybook/pull/37111) | Manager | Manager: Cover cleared args in Open in isolation mode with tests |
| [#37117](https://github.com/storybookjs/storybook/pull/37117) | CI | CI: Stop fetching every release tag on PR checkouts |
| [#37119](https://github.com/storybookjs/storybook/pull/37119) | CI | CI: Clone the Chromatic job's history without blobs |
| [#37133](https://github.com/storybookjs/storybook/pull/37133) | Angular-Vite | Angular-Vite: Evaluate @angular/compiler once per page under Vitest |
| [#37137](https://github.com/storybookjs/storybook/pull/37137) | Svelte | Svelte: Remove stale CSF type augmentations |
| [#37142](https://github.com/storybookjs/storybook/pull/37142) | Svelte | Svelte: Update esrap to 2.x |
| [#37160](https://github.com/storybookjs/storybook/pull/37160) | Core | Core: Prevent duplicate Run All test runs across manager tabs |
| [#37177](https://github.com/storybookjs/storybook/pull/37177) | Build | Build: Stop auto-closing issues whose reproduction link is a local Storybook |
| [#37195](https://github.com/storybookjs/storybook/pull/37195) | React | React: Make the react-docgen alias test assertion separator-agnostic |
| [#37201](https://github.com/storybookjs/storybook/pull/37201) | Build | Build: Declare node types where node built-ins are used |
| [#37202](https://github.com/storybookjs/storybook/pull/37202) | Build | Build: Declare Node types once in the shared tsconfig |
| [#37218](https://github.com/storybookjs/storybook/pull/37218) | Build | Build: Keep 100 commits of history after the shallow-clone fetch |
| [#37233](https://github.com/storybookjs/storybook/pull/37233) | Build | Build: Only trigger CircleCI when a CI workflow label is added |
| [#37246](https://github.com/storybookjs/storybook/pull/37246) | Build | Build: Run the scripts unit tests in forks, not worker threads |
| [#37262](https://github.com/storybookjs/storybook/pull/37262) | Docs | Docs: fix Web Storybook Builder link in the Builder API docs |
| [#37266](https://github.com/storybookjs/storybook/pull/37266) | Build | Build: Avoid duplicate oxlint flags in affected CI |
| [#37267](https://github.com/storybookjs/storybook/pull/37267) | Docs | Docs: Fix seperator typo and duplicated words |
| [#37272](https://github.com/storybookjs/storybook/pull/37272) | Build | Build: Add the ecosystem QA harness and workflow (cycle 0) |
| [#37274](https://github.com/storybookjs/storybook/pull/37274) | Build | Build: Fix declaration emit and uncommitted-changes check after exports reorder |
| [#37278](https://github.com/storybookjs/storybook/pull/37278) | Revert | Revert: Update sort-package-json, don't mangle exports fields |
| [#37279](https://github.com/storybookjs/storybook/pull/37279) | Agents | Agents: Ask Greptile for one review in build-it |
| [#37280](https://github.com/storybookjs/storybook/pull/37280) | Test | Test: Print console output only for failing tests and trim CI test logs |
| [#37281](https://github.com/storybookjs/storybook/pull/37281) | Sandboxes | Sandboxes: Disable the Astro sandbox in CI instead of exempting it from the age gate |
| [#37286](https://github.com/storybookjs/storybook/pull/37286) | Build | Build: Never start a second dev server in the dev E2E jobs |
| [#37287](https://github.com/storybookjs/storybook/pull/37287) | Build | Build: Run the sandbox dev smoke test in the foreground |
| [#37289](https://github.com/storybookjs/storybook/pull/37289) | Docs | Docs: Mention the removed --no-open flag in MIGRATION.md |
| [#37293](https://github.com/storybookjs/storybook/pull/37293) | Build | Build: Guard TypeScript 7.1 docgen with daily sandboxes and harness gates |
| [#37312](https://github.com/storybookjs/storybook/pull/37312) | Docs | Docs: Complete the Svelte docs for Storybook 11 |
| [#37315](https://github.com/storybookjs/storybook/pull/37315) | Svelte | Svelte: Align the Svelte CSF unit tests with the monorepo conventions |
| [#37318](https://github.com/storybookjs/storybook/pull/37318) | Ecosystem-QA | Ecosystem-QA: Land the checklist's planned rows as the extended tier |
| [#37323](https://github.com/storybookjs/storybook/pull/37323) | Test | Test: Compose local fixture Storybooks in the MCP composition E2E tests |
| [#37325](https://github.com/storybookjs/storybook/pull/37325) | Agents | Agents: Add the ready-for-review skill and fix gaps in build-it |
| [#37328](https://github.com/storybookjs/storybook/pull/37328) | Ecosystem QA | Ecosystem QA: Default Claude to Haiku 5.5 at low effort |
| [#37342](https://github.com/storybookjs/storybook/pull/37342) | Build | Build: List the correct templates that failed to generate outside CI |
| [#37400](https://github.com/storybookjs/storybook/pull/37400) | Core | Core: Make the watch-story-specifiers test expectations separator-agnostic |
| [#37408](https://github.com/storybookjs/storybook/pull/37408) | Build | Build: Pack ecosystem-qa node_modules into the CI workspace |
