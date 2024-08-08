## 8.3.0-alpha.4

- CSF: Allow overridding globals at the story level - [#26654](https://github.com/storybookjs/storybook/pull/26654), thanks @tmeasday!
- Core: Introduce run over play in portable stories, and revert back play changes of 8.2 - [#28764](https://github.com/storybookjs/storybook/pull/28764), thanks @kasperpeulen!
- Core: Split Storybook CLI  - [#28519](https://github.com/storybookjs/storybook/pull/28519), thanks @kasperpeulen!
- Fix: Invariant failed: Expected package.json#version to be defined in the "undefined" package - [#28752](https://github.com/storybookjs/storybook/pull/28752), thanks @abcdmku!
- Next.js: Make RSC portable-stories compatible - [#28756](https://github.com/storybookjs/storybook/pull/28756), thanks @valentinpalkovic!
- UI: Fix collapse/expand all functionality - [#28582](https://github.com/storybookjs/storybook/pull/28582), thanks @filipemelo2002!

## 8.3.0-alpha.3

- Angular: Fix Angular template error for props with a circular reference - [#28498](https://github.com/storybookjs/storybook/pull/28498), thanks @Marklb!
- Angular: Fix template props not able to use dot notation - [#28588](https://github.com/storybookjs/storybook/pull/28588), thanks @Marklb!
- CLI: Fix the initialization of Storybook in workspaces - [#28699](https://github.com/storybookjs/storybook/pull/28699), thanks @valentinpalkovic!
- CPC: Fix missing exports for addon-kit - [#28691](https://github.com/storybookjs/storybook/pull/28691), thanks @ndelangen!
- CPC: Fix type usage in renderers - [#28745](https://github.com/storybookjs/storybook/pull/28745), thanks @ndelangen!
- Controls: Add disableSave parameter - [#28734](https://github.com/storybookjs/storybook/pull/28734), thanks @valentinpalkovic!
- React: Avoid 'Dynamic require of react is not possible' issue - [#28730](https://github.com/storybookjs/storybook/pull/28730), thanks @valentinpalkovic!
- Telemetry: Add mount, beforeEach, moduleMock stats - [#28624](https://github.com/storybookjs/storybook/pull/28624), thanks @shilman!
- Telemetry: CSF feature usage - [#28622](https://github.com/storybookjs/storybook/pull/28622), thanks @shilman!
- Types: Adjust beforeAll to be non-nullable in NormalizedProjectAnnotations - [#28671](https://github.com/storybookjs/storybook/pull/28671), thanks @kasperpeulen!
- Vue: Fix out of memory error when using vue-component-meta for events and slots - [#28674](https://github.com/storybookjs/storybook/pull/28674), thanks @larsrickert!
- Vue: Improve generated code snippets - [#27194](https://github.com/storybookjs/storybook/pull/27194), thanks @larsrickert!

## 8.3.0-alpha.2

- Addon-Interactions: Fix status in panel tab - [#28580](https://github.com/storybookjs/storybook/pull/28580), thanks @yannbf!
- Build: Remove external overrides, use package.json as source of truth - [#28632](https://github.com/storybookjs/storybook/pull/28632), thanks @kasperpeulen!
- CLI: Add conditional logging for manager and preview start - [#28603](https://github.com/storybookjs/storybook/pull/28603), thanks @tobiasdiez!
- CPC: Add the globals export for manager - [#28650](https://github.com/storybookjs/storybook/pull/28650), thanks @ndelangen!
- CPC: Correct path to the `@storybook/theming/create` alias - [#28643](https://github.com/storybookjs/storybook/pull/28643), thanks @Averethel!
- Core: Fix manager-builder `tsconfig` to emit `react-jsx` - [#28541](https://github.com/storybookjs/storybook/pull/28541), thanks @williamhelmrath!
- Fix: Add header for MountMustBeDestructuredError message - [#28590](https://github.com/storybookjs/storybook/pull/28590), thanks @0916dhkim!
- Fix: Prevent iframe from capturing mouse events in composed Storybooks - [#28568](https://github.com/storybookjs/storybook/pull/28568), thanks @Vincentdevreede!
- Onboarding: Fix code snippet when story name differs from export name - [#28649](https://github.com/storybookjs/storybook/pull/28649), thanks @ghengeveld!
- Vue: Fix out of memory error when using vue-component-meta - [#28589](https://github.com/storybookjs/storybook/pull/28589), thanks @larsrickert!

## 8.3.0-alpha.1

- Bug: Fix invalid docs links in Configure.mdx template page - [#28560](https://github.com/storybookjs/storybook/pull/28560), thanks @kylegach!
- CLI: Add "missing-storybook-dependencies" automigration - [#28579](https://github.com/storybookjs/storybook/pull/28579), thanks @yannbf!
- CLI: Add diagnostic when the `storybook` package is missing - [#28604](https://github.com/storybookjs/storybook/pull/28604), thanks @kasperpeulen!
- CLI: Make a few automigrations run on all version upgrades - [#28601](https://github.com/storybookjs/storybook/pull/28601), thanks @yannbf!
- CPC: Add `theming/create` aliases in docs preset - [#28570](https://github.com/storybookjs/storybook/pull/28570), thanks @ndelangen!
- CPC: Direct dependencies on shim packages in renderers - [#28599](https://github.com/storybookjs/storybook/pull/28599), thanks @ndelangen!
- CPC: Fix Vite builder had wrong conditions - [#28581](https://github.com/storybookjs/storybook/pull/28581), thanks @ndelangen!
- CPC: Fix incorrect re-export in `core-events` - [#28573](https://github.com/storybookjs/storybook/pull/28573), thanks @ndelangen!
- CSF: Fix small typing issue - [#28587](https://github.com/storybookjs/storybook/pull/28587), thanks @valentinpalkovic!
- Core: Upgrade docs-mdx for smaller install - [#28552](https://github.com/storybookjs/storybook/pull/28552), thanks @shilman!
- Portable stories: Remove unused types - [#28548](https://github.com/storybookjs/storybook/pull/28548), thanks @kasperpeulen!
- Webpack: Fix sourceMap generation in csf-tools - [#28585](https://github.com/storybookjs/storybook/pull/28585), thanks @valentinpalkovic!

## 8.3.0-alpha.0


## 8.2.0-beta.3

- Addon Controls: Fix saving on Windows - [#28485](https://github.com/storybookjs/storybook/pull/28485), thanks @ghengeveld!
- React: Export ButtonProps and HeaderProps in CLI templates - [#28487](https://github.com/storybookjs/storybook/pull/28487), thanks @valentinpalkovic!

## 8.2.0-beta.2

- Addon Onboarding: Trigger onboarding during init for Vue and Angular projects - [#28482](https://github.com/storybookjs/storybook/pull/28482), thanks @ghengeveld!
- CLI: Prebundle get-npm-tarball-url and @ndelangen/get-tarball - [#28481](https://github.com/storybookjs/storybook/pull/28481), thanks @ndelangen!

## 8.2.0-beta.1

- Babel: Ensure story files not transpiled earlier than ES2017 - [#28469](https://github.com/storybookjs/storybook/pull/28469), thanks @kasperpeulen!
- Blocks: Prebundle `tocbot` - [#28318](https://github.com/storybookjs/storybook/pull/28318), thanks @shilman!
- Core: Make sure StorybookError message shows up in browser console and interactions panel - [#28464](https://github.com/storybookjs/storybook/pull/28464), thanks @kasperpeulen!
- Index: Fix MDX to override project-level autodocs - [#28461](https://github.com/storybookjs/storybook/pull/28461), thanks @shilman!
- Test: Improve MountMustBeDestructuredError error message - [#28468](https://github.com/storybookjs/storybook/pull/28468), thanks @kasperpeulen!

## 8.2.0-beta.0

- Addon Interactions: Use unique keys when rendering array nodes in panel - [#28423](https://github.com/storybookjs/storybook/pull/28423), thanks @yannbf!
- Addon Onboarding: Add icons for dev/test/doc to the splash screen - [#28389](https://github.com/storybookjs/storybook/pull/28389), thanks @ghengeveld!
- Addon Onboarding: New design and flow based on Save from Controls - [#28327](https://github.com/storybookjs/storybook/pull/28327), thanks @ghengeveld!
- Angular: Allow format configuration of custom source preview - [#28305](https://github.com/storybookjs/storybook/pull/28305), thanks @64BitAsura!
- Angular: Fix enableProdMode setting - [#28415](https://github.com/storybookjs/storybook/pull/28415), thanks @valentinpalkovic!
- Angular: Update outputPath default value in angular-cli-webpack.js - [#28418](https://github.com/storybookjs/storybook/pull/28418), thanks @valentinpalkovic!
- Blocks: Fix reference to storybook core - [#28422](https://github.com/storybookjs/storybook/pull/28422), thanks @yannbf!
- Build: Ignore ts stories in cra/default-js sandbox - [#28354](https://github.com/storybookjs/storybook/pull/28354), thanks @valentinpalkovic!
- CLI: Add support for Nuxt to project init - [#26884](https://github.com/storybookjs/storybook/pull/26884), thanks @tobiasdiez!
- CLI: Improve error message when fetching CLI version - [#28289](https://github.com/storybookjs/storybook/pull/28289), thanks @yannbf!
- CPC: Add `CJS` for `core/components` - [#28440](https://github.com/storybookjs/storybook/pull/28440), thanks @ndelangen!
- CPC: Core Package Consolidation - [#27039](https://github.com/storybookjs/storybook/pull/27039), thanks @ndelangen!
- Config: Apply JavaScript-only story glob extensions for JavaScript projects - [#28338](https://github.com/storybookjs/storybook/pull/28338), thanks @valentinpalkovic!
- Core: Add context as a property of the context (self-referencing) - [#28353](https://github.com/storybookjs/storybook/pull/28353), thanks @kasperpeulen!
- Core: Add support for `beforeAll` hook - [#28255](https://github.com/storybookjs/storybook/pull/28255), thanks @ghengeveld!
- Core: Migrate from `pkg-dir` to `fd-package-json` - [#28270](https://github.com/storybookjs/storybook/pull/28270), thanks @43081j!
- Core: Refactor phases to run in order `loading` -> `rendering` -> `playing` - [#28431](https://github.com/storybookjs/storybook/pull/28431), thanks @kasperpeulen!
- Dependency: Remove node-fetch - [#28160](https://github.com/storybookjs/storybook/pull/28160), thanks @yk-kd!
- Deps: Migrate from `read-pkg-up` to `fd-package-json` - [#28272](https://github.com/storybookjs/storybook/pull/28272), thanks @43081j!
- Docs: Filter mount stories from `Stories` block, error when referenced in MDX - [#28434](https://github.com/storybookjs/storybook/pull/28434), thanks @kasperpeulen!
- Indexer: Improve locating stories with specials chars in path - [#22110](https://github.com/storybookjs/storybook/pull/22110), thanks @jankoritak!
- Next.js: Set `env.bugfixes` in SWC so destructuring is never transpiled - [#28363](https://github.com/storybookjs/storybook/pull/28363), thanks @kasperpeulen!
- Next: Set default targets for next babel config - [#28443](https://github.com/storybookjs/storybook/pull/28443), thanks @kasperpeulen!
- SWC: Set default targets for swc that align with our esbuild targets - [#28435](https://github.com/storybookjs/storybook/pull/28435), thanks @kasperpeulen!
- Telemetry: Detect Node version - [#28299](https://github.com/storybookjs/storybook/pull/28299), thanks @yannbf!
- Telemetry: Stop prompting about crash reports in CI - [#28433](https://github.com/storybookjs/storybook/pull/28433), thanks @yannbf!
- Test: Add args to `mount` in react, svelte, and vue renderers - [#28385](https://github.com/storybookjs/storybook/pull/28385), thanks @kasperpeulen!
- Test: Add mount property to the story context - [#28383](https://github.com/storybookjs/storybook/pull/28383), thanks @kasperpeulen!
- Test: Enhance the context with canvas when the test package is used - [#28368](https://github.com/storybookjs/storybook/pull/28368), thanks @kasperpeulen!
- Test: Reactive spies preserve the this instance - [#28445](https://github.com/storybookjs/storybook/pull/28445), thanks @kasperpeulen!

## 8.2.0-alpha.10

- Addon-interactions: Fix deprecation warnings - [#28250](https://github.com/storybookjs/storybook/pull/28250), thanks @shilman!
- Core: Remove util dependency - [#28191](https://github.com/storybookjs/storybook/pull/28191), thanks @43081j!
- Dependencies: Allow esbuild version 0.21.x - [#28245](https://github.com/storybookjs/storybook/pull/28245), thanks @edoardocavazza!

## 8.2.0-alpha.9

- Addon-a11y: Workaround for Vite 5.3.0 compat - [#28241](https://github.com/storybookjs/storybook/pull/28241), thanks @shilman!
- CLI: Fix CLI always asking all automigrations - [#28238](https://github.com/storybookjs/storybook/pull/28238), thanks @ndelangen!
- Core: Fix startup hang caused by watchStorySpecifiers - [#27016](https://github.com/storybookjs/storybook/pull/27016), thanks @heyimalex!

## 8.2.0-alpha.8

- Automigrations: Make VTA "learn more" link clickable - [#28020](https://github.com/storybookjs/storybook/pull/28020), thanks @deiga!
- CLI: Fix `init --skip-install` - [#28226](https://github.com/storybookjs/storybook/pull/28226), thanks @shilman!
- CSF: Rename `preview.js` `globals` to `initialGlobals` - [#27517](https://github.com/storybookjs/storybook/pull/27517), thanks @shilman!

## 8.2.0-alpha.7

- Angular: Allow outputPath object syntax - [#28144](https://github.com/storybookjs/storybook/pull/28144), thanks @valentinpalkovic!
- Angular: Introduce preserveSymlink builder option - [#28145](https://github.com/storybookjs/storybook/pull/28145), thanks @valentinpalkovic!
- CLI: Fix typo in React Docgen migration - [#27536](https://github.com/storybookjs/storybook/pull/27536), thanks @jonniebigodes!
- CSF: Automatically extract componentPath - [#24396](https://github.com/storybookjs/storybook/pull/24396), thanks @shilman!
- Core: Remove more `.stories.mdx` handling - [#25973](https://github.com/storybookjs/storybook/pull/25973), thanks @JReinhold!
- Docs-tools: Replace `doctrine` with `jsdoc-type-pratt-parser` - [#26305](https://github.com/storybookjs/storybook/pull/26305), thanks @43081j!
- Test: Display toHaveBeenCalledWith expected / received values on failure - [#28088](https://github.com/storybookjs/storybook/pull/28088), thanks @kasperpeulen!

## 8.2.0-alpha.6

- Addon-actions: Only log spies with names - [#28091](https://github.com/storybookjs/storybook/pull/28091), thanks @kasperpeulen!
- Build: Change require/import order, so that import has higher prio if both are specified - [#27730](https://github.com/storybookjs/storybook/pull/27730), thanks @kasperpeulen!
- CLI: Only log the UpgradeStorybookToSameVersionError but continue the upgrade as normal - [#27217](https://github.com/storybookjs/storybook/pull/27217), thanks @kasperpeulen!
- Core: Replace ip function with a small helper function to address security concerns - [#27529](https://github.com/storybookjs/storybook/pull/27529), thanks @tony19!
- Portable Stories: Add tags to composed story - [#27708](https://github.com/storybookjs/storybook/pull/27708), thanks @yannbf!
- Test: Upgrade deps of @storybook/test - [#27862](https://github.com/storybookjs/storybook/pull/27862), thanks @kasperpeulen!
- Vite: Fix stats-plugin to normalize file names with posix paths - [#27218](https://github.com/storybookjs/storybook/pull/27218), thanks @AlexAtVista!

## 8.2.0-alpha.5

- Angular: Fix wrong detection of standalone components - [#27353](https://github.com/storybookjs/storybook/pull/27353), thanks @dario-baumberger!
- Dependency: Bump Express.js - [#26680](https://github.com/storybookjs/storybook/pull/26680), thanks @valentinpalkovic!
- Tags: Fix unsafe project-level tags lookup - [#27511](https://github.com/storybookjs/storybook/pull/27511), thanks @shilman!

## 8.2.0-alpha.4

- CSF-Tools: Fix export specifier bug - [#27418](https://github.com/storybookjs/storybook/pull/27418), thanks @valentinpalkovic!
- Dependency: Upgrade tempy - [#27366](https://github.com/storybookjs/storybook/pull/27366), thanks @mnigh!
- Tags: Refine composition behavior - [#27379](https://github.com/storybookjs/storybook/pull/27379), thanks @shilman!
- Theming: Fix self-referencing type - [#27155](https://github.com/storybookjs/storybook/pull/27155), thanks @SimenB!
- Vue3: Enable new hydration mismatch compile time flag - [#27192](https://github.com/storybookjs/storybook/pull/27192), thanks @Cherry!

## 8.2.0-alpha.3

- Addon-A11y: Fix property default assignment - [#27224](https://github.com/storybookjs/storybook/pull/27224), thanks @valentinpalkovic!
- Angular: Revert style adjustments - [#27361](https://github.com/storybookjs/storybook/pull/27361), thanks @valentinpalkovic!
- Angular: Support v18 - [#27237](https://github.com/storybookjs/storybook/pull/27237), thanks @valentinpalkovic!
- Controls: Fix date picker control validation and assignment - [#26695](https://github.com/storybookjs/storybook/pull/26695), thanks @leeovictor!
- Next.js: Avoid interfering with the svgr loader - [#27198](https://github.com/storybookjs/storybook/pull/27198), thanks @seanparmelee!
- Svelte: Support latest prerelease - [#27378](https://github.com/storybookjs/storybook/pull/27378), thanks @valentinpalkovic!
- Tags: Fix composition with older storybooks - [#27358](https://github.com/storybookjs/storybook/pull/27358), thanks @shilman!
- Telemetry: Add test packages - [#27226](https://github.com/storybookjs/storybook/pull/27226), thanks @shilman!
- Types: Fix type implementation for `CompatibleString` - [#27180](https://github.com/storybookjs/storybook/pull/27180), thanks @sni-J!
- Vite: Fix HMR issue for Storybook preview files - [#27256](https://github.com/storybookjs/storybook/pull/27256), thanks @valentinpalkovic!
- Vite: Fix asset warning by externalizing sb-common-assets font - [#27110](https://github.com/storybookjs/storybook/pull/27110), thanks @valentinpalkovic!
- Webpack5/Vite: Fix sourcemaps - [#27171](https://github.com/storybookjs/storybook/pull/27171), thanks @valentinpalkovic!

## 8.2.0-alpha.2

- Angular: Cleanup types - [#27189](https://github.com/storybookjs/storybook/pull/27189), thanks @valentinpalkovic!
- Angular: Fix filtering of workspace config styles - [#27108](https://github.com/storybookjs/storybook/pull/27108), thanks @valentinpalkovic!
- Controls: Fix grouped Radio controls to have the same name - [#23374](https://github.com/storybookjs/storybook/pull/23374), thanks @srapilly!
- Controls: Throttling makes Color control lagging - [#22615](https://github.com/storybookjs/storybook/pull/22615), thanks @gitstart!
- Docs: Fix `Typeset` Doc block `fontSizes` type - [#26475](https://github.com/storybookjs/storybook/pull/26475), thanks @noranda!

## 8.2.0-alpha.1

- CLI: Add optional `--dev` and `--no-dev` options to `storybook init` CLI - [#26918](https://github.com/storybookjs/storybook/pull/26918), thanks @fastfrwrd!
- CLI: Include `@storybook/addon-svelte-csf` when initializing new projects - [#27070](https://github.com/storybookjs/storybook/pull/27070), thanks @benmccann!
- Dependency: Upgrade `webpack-virtual-modules` to 0.6.0 - [#27102](https://github.com/storybookjs/storybook/pull/27102), thanks @fyodorovandrei!
- Dependency: bump `markdown-to-jsx` to v7.4.5 - [#26694](https://github.com/storybookjs/storybook/pull/26694), thanks @xyy94813!
- Docgen: Only add react-docgen info when a component is defined in the file - [#26967](https://github.com/storybookjs/storybook/pull/26967), thanks @glenjamin!
- Docs: Fix MDX Stories block tag-filtering behavior - [#27144](https://github.com/storybookjs/storybook/pull/27144), thanks @shilman!
- Docs: Fix Subtitle block when no `of` prop passed - [#27147](https://github.com/storybookjs/storybook/pull/27147), thanks @JReinhold!
- Next.js: Add typing for NextImage to main framework options type - [#27105](https://github.com/storybookjs/storybook/pull/27105), thanks @valentinpalkovic!
- Next.js: Avoid conflicts with the raw loader - [#27093](https://github.com/storybookjs/storybook/pull/27093), thanks @seanparmelee!
- Types: Fix typing for main.framework/builder fields - [#27088](https://github.com/storybookjs/storybook/pull/27088), thanks @valentinpalkovic!

## 8.2.0-alpha.0


## 8.1.0-beta.1

- API: Add API access to sidebar renderLabel - [#27099](https://github.com/storybookjs/storybook/pull/27099), thanks @shilman!
- CLI: Add main.js `docs.autodocs` automigration - [#27089](https://github.com/storybookjs/storybook/pull/27089), thanks @shilman!
- CLI: Fix eslint configuration for string `extends` - [#27097](https://github.com/storybookjs/storybook/pull/27097), thanks @shilman!
- Indexer: Escape special characters in storyImport regex - [#22545](https://github.com/storybookjs/storybook/pull/22545), thanks @VojGin!
- Next.js: Fix Compatibility with <v14.0.4 - [#27082](https://github.com/storybookjs/storybook/pull/27082), thanks @JReinhold!
- Tags: Fix missing default tags if no `preview.js` - [#27098](https://github.com/storybookjs/storybook/pull/27098), thanks @shilman!

## 8.1.0-beta.0

- Dependencies: Upgrade `@joshwooding/vite-plugin-react-docgen-typescript` to `0.3.1` - [#26673](https://github.com/storybookjs/storybook/pull/26673), thanks @joshwooding!
- Dependencies: Upgrade `ejs` to `3.1.10` - [#27054](https://github.com/storybookjs/storybook/pull/27054), thanks @RiuSalvi!
- Nextjs: Implement next redirect and the RedirectBoundary - [#27050](https://github.com/storybookjs/storybook/pull/27050), thanks @yannbf!
- Onboarding: Improve UI - [#27074](https://github.com/storybookjs/storybook/pull/27074), thanks @ndelangen!
- Portable Stories: Remove link to missing docs - [#27075](https://github.com/storybookjs/storybook/pull/27075), thanks @JReinhold!
- React: Support v19 betas in peer dependencies - [#26960](https://github.com/storybookjs/storybook/pull/26960), thanks @JReinhold!
- Tags: Add project tags, negation, `dev`/`autodocs`/`test` system tags - [#26634](https://github.com/storybookjs/storybook/pull/26634), thanks @shilman!
- UI: Fix panel layout resizing do not apply when done too fast - [#26460](https://github.com/storybookjs/storybook/pull/26460), thanks @jorge-ji!

## 8.1.0-alpha.8

- Addon-actions: Fix falsy args printing as object - 22163 - [#26917](https://github.com/storybookjs/storybook/pull/26917), thanks @Fatcat560!
- Addon-docs: Fix MDX compilation with `@vitejs/plugin-react-swc` and plugins - [#26837](https://github.com/storybookjs/storybook/pull/26837), thanks @JReinhold!
- Automigration: Fix name of VTA addon - [#26816](https://github.com/storybookjs/storybook/pull/26816), thanks @valentinpalkovic!
- Blocks: Add `of` prop to `Subtitle` - [#22552](https://github.com/storybookjs/storybook/pull/22552), thanks @joaonunomota!
- Blocks: Add `of` prop to `Title` - [#23728](https://github.com/storybookjs/storybook/pull/23728), thanks @Sidnioulz!
- CSF: Fix typings for control and other properties of argTypes - [#26824](https://github.com/storybookjs/storybook/pull/26824), thanks @kasperpeulen!
- Controls: Added server channel to create a new story - [#26769](https://github.com/storybookjs/storybook/pull/26769), thanks @valentinpalkovic!
- Controls: Fix crashing when docgen extraction partially fails - [#26862](https://github.com/storybookjs/storybook/pull/26862), thanks @yannbf!
- Controls: Add UI to create new story files - [#26875](https://github.com/storybookjs/storybook/pull/26875), thanks @valentinpalkovic!
- Core: Drop unneeded `UPDATE_STORY_ARGS` which was for SSv6 - [#25993](https://github.com/storybookjs/storybook/pull/25993), thanks @tmeasday!
- Core: Ensure that simultaneous onStoriesChanged don't clobber each other - [#26882](https://github.com/storybookjs/storybook/pull/26882), thanks @tmeasday!
- Core: Fix filters not being applied in WebKit - [#26949](https://github.com/storybookjs/storybook/pull/26949), thanks @JReinhold!
- Core: Implement file formatter - [#26809](https://github.com/storybookjs/storybook/pull/26809), thanks @valentinpalkovic!
- Core: Save from controls - [#26827](https://github.com/storybookjs/storybook/pull/26827), thanks @ndelangen!
- Dependencies: Upgrade @storybook/csf to 0.1.5 - [#26958](https://github.com/storybookjs/storybook/pull/26958), thanks @Cherry!
- Doc Tools: Signature Type Error Handling - [#26774](https://github.com/storybookjs/storybook/pull/26774), thanks @ethriel3695!
- Docs: Fix providerImportSource extension - [#26868](https://github.com/storybookjs/storybook/pull/26868), thanks @bashmish!
- MDX: Don't transform `http://` links - [#26488](https://github.com/storybookjs/storybook/pull/26488), thanks @JReinhold!
- Next.js: Move sharp into optional deps - [#26787](https://github.com/storybookjs/storybook/pull/26787), thanks @shuta13!
- Next.js: Support v14.2 useParams functionality - [#26874](https://github.com/storybookjs/storybook/pull/26874), thanks @yannbf!
- Portable Stories: Warn when rendering stories without cleaning up first - [#27008](https://github.com/storybookjs/storybook/pull/27008), thanks @JReinhold!
- React: Support v19 in `react-dom-shim` - [#26898](https://github.com/storybookjs/storybook/pull/26898), thanks @Tobbe!
- Test: Remove chai as dependency of @storybook/test - [#26852](https://github.com/storybookjs/storybook/pull/26852), thanks @kasperpeulen!
- Test: Support module mocking with conditional subpath imports in `package.json`  - [#26688](https://github.com/storybookjs/storybook/pull/26688), thanks @kasperpeulen!
- UI: Fix not re-rendering tabs on state change - [#26899](https://github.com/storybookjs/storybook/pull/26899), thanks @lifeiscontent!
- UI: Fix sidebar search hanging when selecting a story in touch mode - [#26807](https://github.com/storybookjs/storybook/pull/26807), thanks @JReinhold!
- Vite: Merge assetsInclude property with Storybook default values - [#26860](https://github.com/storybookjs/storybook/pull/26860), thanks @yuemori!

## 8.1.0-alpha.7

- CLI: Add --config-dir flag to add command - [#26771](https://github.com/storybookjs/storybook/pull/26771), thanks @eric-blue!
- CLI: Add Visual Tests addon install auto-migration when upgrading to 8.0.x - [#26766](https://github.com/storybookjs/storybook/pull/26766), thanks @ndelangen!
- Controls: Add Channels API to search for files in the project root - [#26726](https://github.com/storybookjs/storybook/pull/26726), thanks @valentinpalkovic!
- Test: Make spies reactive so that they can be logged by addon-actions - [#26740](https://github.com/storybookjs/storybook/pull/26740), thanks @kasperpeulen!
- Vue: Disable controls for events, slots, and expose - [#26751](https://github.com/storybookjs/storybook/pull/26751), thanks @shilman!
- Webpack: Bump webpack-dev-middleware to patch high security issue - [#26655](https://github.com/storybookjs/storybook/pull/26655), thanks @jwilliams-met!

## 8.1.0-alpha.6

- CLI: Add --config-dir flag to migrate command - [#26721](https://github.com/storybookjs/storybook/pull/26721), thanks @yannbf!
- Core: Add `duration` and `onClick` support to Notification API and improve Notification UI - [#26696](https://github.com/storybookjs/storybook/pull/26696), thanks @ghengeveld!
- Dependency: Bump es-module-lexer - [#26737](https://github.com/storybookjs/storybook/pull/26737), thanks @valentinpalkovic!
- Dependency: Update globby dependency - [#26733](https://github.com/storybookjs/storybook/pull/26733), thanks @valentinpalkovic!
- Dependency: Update postcss-loader in Next.js framework - [#26707](https://github.com/storybookjs/storybook/pull/26707), thanks @valentinpalkovic!
- Next.js: Fix next/font usage on Windows machines - [#26700](https://github.com/storybookjs/storybook/pull/26700), thanks @valentinpalkovic!
- Webpack: Fix sourcemap generation in webpack react-docgen-loader - [#26676](https://github.com/storybookjs/storybook/pull/26676), thanks @valentinpalkovic!

## 8.1.0-alpha.5

- Addon-docs: Fix `react-dom/server` imports breaking stories and docs - [#26557](https://github.com/storybookjs/storybook/pull/26557), thanks @JReinhold!
- Args: Add possibility to mark controls as read-only - [#26577](https://github.com/storybookjs/storybook/pull/26577), thanks @valentinpalkovic!
- Automigrations: Add migration note about new react-docgen default - [#26620](https://github.com/storybookjs/storybook/pull/26620), thanks @valentinpalkovic!
- Automigrations: Fix missing support for mts vite config - [#26441](https://github.com/storybookjs/storybook/pull/26441), thanks @drik98!
- CLI: Automigrations copy edits - [#26342](https://github.com/storybookjs/storybook/pull/26342), thanks @joevaugh4n!
- CLI: Improve Yarn berry error parsing - [#26616](https://github.com/storybookjs/storybook/pull/26616), thanks @yannbf!
- Codemods: Escape filename given as argument - [#26430](https://github.com/storybookjs/storybook/pull/26430), thanks @YukiKitagata!
- NextJS: Support path aliases when no base url is set - [#26651](https://github.com/storybookjs/storybook/pull/26651), thanks @yannbf!
- Node: Safe use of `document` for preview - [#24248](https://github.com/storybookjs/storybook/pull/24248), thanks @DylanPiercey!
- React-Docgen: Make sure to be able to handle empty unions - [#26639](https://github.com/storybookjs/storybook/pull/26639), thanks @kasperpeulen!
- Test: Add @storybook/test as dev dependency - [#26458](https://github.com/storybookjs/storybook/pull/26458), thanks @arnabsen!
- Theming: Update emotion dependencies - [#26623](https://github.com/storybookjs/storybook/pull/26623), thanks @SimenB!
- Viewport: Fix missing style - [#26530](https://github.com/storybookjs/storybook/pull/26530), thanks @jpzwarte!
- Webpack: Hide runtime errors - [#23175](https://github.com/storybookjs/storybook/pull/23175), thanks @donaldpipowitch!

## 8.1.0-alpha.4

- Addon Docs: Support Stencil based display names in source snippets - [#26592](https://github.com/storybookjs/storybook/pull/26592), thanks @yannbf!
- Angular: Add type support for Angular's input signals - [#26413](https://github.com/storybookjs/storybook/pull/26413), thanks @valentinpalkovic!
- Angular: Add type support for Angular's output signals - [#26546](https://github.com/storybookjs/storybook/pull/26546), thanks @valentinpalkovic!
- CLI: Instruct the correct auto-migration command - [#26515](https://github.com/storybookjs/storybook/pull/26515), thanks @ndelangen!
- CLI: Throw an error when running upgrade command in incorrect cwd - [#26585](https://github.com/storybookjs/storybook/pull/26585), thanks @yannbf!
- CSF: Allow default export without title or component attributes - [#26516](https://github.com/storybookjs/storybook/pull/26516), thanks @kasperpeulen!
- Core: Fix preloading too early - [#26442](https://github.com/storybookjs/storybook/pull/26442), thanks @ndelangen!
- UI: Replace the icon prop in the Manager API - [#26477](https://github.com/storybookjs/storybook/pull/26477), thanks @cdedreuille!

## 8.1.0-alpha.3

- Addon Docs: Fix [Object object] displayName in some JSX components - [#26566](https://github.com/storybookjs/storybook/pull/26566), thanks @yannbf!
- CLI: Introduce package manager fallback for initializing Storybook in an empty directory with yarn1 - [#26500](https://github.com/storybookjs/storybook/pull/26500), thanks @valentinpalkovic!
- CSF: Make sure loaders/decorators can be used as array - [#26514](https://github.com/storybookjs/storybook/pull/26514), thanks @kasperpeulen!
- Controls: Fix disable condition in ArgControl component - [#26567](https://github.com/storybookjs/storybook/pull/26567), thanks @valentinpalkovic!
- Portable stories: Introduce experimental Playwright CT API and Support for more renderers - [#26063](https://github.com/storybookjs/storybook/pull/26063), thanks @yannbf!
- UI: Fix theming of elements inside bars - [#26527](https://github.com/storybookjs/storybook/pull/26527), thanks @valentinpalkovic!
- UI: Improve empty state of addon panel - [#26481](https://github.com/storybookjs/storybook/pull/26481), thanks @yannbf!

## 8.1.0-alpha.2

- CLI: Automigrate improve upgrade storybook related packages - [#26497](https://github.com/storybookjs/storybook/pull/26497), thanks @ndelangen!
- CLI: Improve `vite-config-file.ts` - [#26375](https://github.com/storybookjs/storybook/pull/26375), thanks @joevaugh4n!
- Controls: Fix number controls do not reset - [#26372](https://github.com/storybookjs/storybook/pull/26372), thanks @jiyiru!
- Core: Optimize clearNotification - [#26415](https://github.com/storybookjs/storybook/pull/26415), thanks @ndelangen!
- Portable stories: Make setProjectAnnotations accept multiple types of imports - [#26316](https://github.com/storybookjs/storybook/pull/26316), thanks @yannbf!
- UI: Add key property to list children in Highlight component - [#26471](https://github.com/storybookjs/storybook/pull/26471), thanks @valentinpalkovic!
- UI: Fix search result color contrast - [#26287](https://github.com/storybookjs/storybook/pull/26287), thanks @winchesHe!

## 8.1.0-alpha.1

- Maintenance: Fix performance regressions  - [#26411](https://github.com/storybookjs/storybook/pull/26411), thanks @kasperpeulen!

## 8.1.0-alpha.0


## 8.0.0-rc.5

- CLI: Automigration fix version detection of upgrading related packages - [#26410](https://github.com/storybookjs/storybook/pull/26410), thanks @ndelangen!

## 8.0.0-rc.4

- Actions: Fix attaching action after a spy is restored to original function - [#26364](https://github.com/storybookjs/storybook/pull/26364), thanks @kasperpeulen!
- CLI: Add explicit actions to header story - [#26352](https://github.com/storybookjs/storybook/pull/26352), thanks @kasperpeulen!
- CLI: Automigration for upgrading storybook related dependencies - [#26377](https://github.com/storybookjs/storybook/pull/26377), thanks @ndelangen!
- CLI: Fix doctor compatibility check - [#26363](https://github.com/storybookjs/storybook/pull/26363), thanks @yannbf!
- CLI: Fix fn reference in preact templates  - [#26384](https://github.com/storybookjs/storybook/pull/26384), thanks @kasperpeulen!
- CLI: Remove duplicated dependency warning - [#26385](https://github.com/storybookjs/storybook/pull/26385), thanks @yannbf!
- CLI: Vite migration link (shorter) - [#26379](https://github.com/storybookjs/storybook/pull/26379), thanks @ndelangen!
- Composition: Fix refs not loading when there's multiple - [#26356](https://github.com/storybookjs/storybook/pull/26356), thanks @ndelangen!
- Dependencies: Broaden `esbuild` version range - [#26405](https://github.com/storybookjs/storybook/pull/26405), thanks @ndelangen!
- Maintenance: Replace `@storybook/testing-library` with `@storybook/test` in monorepo - [#26351](https://github.com/storybookjs/storybook/pull/26351), thanks @ndelangen!
- Maintenance: What's new modal changes - [#26355](https://github.com/storybookjs/storybook/pull/26355), thanks @kasperpeulen!
- Portable Stories: Fix injected root element changing layout - [#26387](https://github.com/storybookjs/storybook/pull/26387), thanks @JReinhold!
- React: Support all React component types in JSX Decorator - [#26382](https://github.com/storybookjs/storybook/pull/26382), thanks @yannbf!

## 8.0.0-rc.3

- Addon-themes: Fix switcher initialization after first start - [#26353](https://github.com/storybookjs/storybook/pull/26353), thanks @valentinpalkovic!
- Build: Upgrade `esbuild` (`0.20.1`) - [#26255](https://github.com/storybookjs/storybook/pull/26255), thanks @43081j!
- Core: Fix path separator issue in check-addon-order - [#26362](https://github.com/storybookjs/storybook/pull/26362), thanks @valentinpalkovic!
- Dependencies: Remove `qs` from `@storybook/manager-api` & `@storybook/channels` - [#26285](https://github.com/storybookjs/storybook/pull/26285), thanks @43081j!
- UI: Fix sidebar scrolling to selected story when state changes - [#26337](https://github.com/storybookjs/storybook/pull/26337), thanks @JReinhold!
- UI: Remove 'left' property from TooltipLinkList and Link components - [#26324](https://github.com/storybookjs/storybook/pull/26324), thanks @valentinpalkovic!
- Viewport: Fix editing when default viewport is set - [#26360](https://github.com/storybookjs/storybook/pull/26360), thanks @shilman!
- Vue: Fix reference error when using re-exports with "vue-component-meta" - [#26303](https://github.com/storybookjs/storybook/pull/26303), thanks @larsrickert!

## 8.0.0-rc.2

- CLI: Add @storybook/addons automigration - [#26295](https://github.com/storybookjs/storybook/pull/26295), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Fix vite config automigration to resolve from project root - [#26262](https://github.com/storybookjs/storybook/pull/26262), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Improve `add` command & add tests - [#26298](https://github.com/storybookjs/storybook/pull/26298), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Update minimum Node.js version requirement - [#26312](https://github.com/storybookjs/storybook/pull/26312), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CSF-tools/Codemods: Upgrade recast - [#26286](https://github.com/storybookjs/storybook/pull/26286), thanks [@43081j](https://github.com/43081j)!
- Controls: Fix type summary when table.type unset - [#26283](https://github.com/storybookjs/storybook/pull/26283), thanks [@shilman](https://github.com/shilman)!
- Core: Add event when serverChannel disconnects - [#26322](https://github.com/storybookjs/storybook/pull/26322), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Fix composition of storybooks on same origin - [#26304](https://github.com/storybookjs/storybook/pull/26304), thanks [@ndelangen](https://github.com/ndelangen)!
- Portable stories: Improve existing APIs, add loaders support - [#26267](https://github.com/storybookjs/storybook/pull/26267), thanks [@yannbf](https://github.com/yannbf)!
- React: Handle TypeScript path aliases in react-docgen loader - [#26273](https://github.com/storybookjs/storybook/pull/26273), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Svelte: Support `5.0.0-next.65` prerelease - [#26188](https://github.com/storybookjs/storybook/pull/26188), thanks [@JReinhold](https://github.com/JReinhold)!
- Upgrade: Add missing isUpgrade parameter to automigrate function - [#26293](https://github.com/storybookjs/storybook/pull/26293), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Vue: Return component from `composeStory` - [#26317](https://github.com/storybookjs/storybook/pull/26317), thanks [@JReinhold](https://github.com/JReinhold)!

## 8.0.0-rc.1

- CLI: Fix addon compatibility check error reporting in storybook dev - [#26258](https://github.com/storybookjs/storybook/pull/26258), thanks [@yannbf](https://github.com/yannbf)!
- Onboarding: Fix manager dist reference - [#26282](https://github.com/storybookjs/storybook/pull/26282), thanks [@shilman](https://github.com/shilman)!
- ReactVite: Docgen ignore un-parsable files - [#26254](https://github.com/storybookjs/storybook/pull/26254), thanks [@ndelangen](https://github.com/ndelangen)!

## 8.0.0-rc.0

Bumping 8.0.0-beta.6 to 8.0.0-rc.0. Please refer to the changelogs of previous beta releases.

## 8.0.0-beta.6

- Addon-onboarding: Move onboarding to monorepo - [#26176](https://github.com/storybookjs/storybook/pull/26176), thanks [@ndelangen](https://github.com/ndelangen)!
- Angular: Fix Storybook startup after init - [#26213](https://github.com/storybookjs/storybook/pull/26213), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Use dedicated tsconfig for compodocs - [#26214](https://github.com/storybookjs/storybook/pull/26214), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Automigration: Fix overflow bug by using a better link - [#26203](https://github.com/storybookjs/storybook/pull/26203), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Automigration: Run the `mdx-to-csf` codemod during automigration - [#26201](https://github.com/storybookjs/storybook/pull/26201), thanks [@ndelangen](https://github.com/ndelangen)!
- Automigrations: Create addon-postcss automigration - [#26228](https://github.com/storybookjs/storybook/pull/26228), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Automigrations: Enhance experience for upgrades from Storybook 6 to 8 - [#26067](https://github.com/storybookjs/storybook/pull/26067), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Automigrations: General fixes for automigrations, blockers and codemods - [#26210](https://github.com/storybookjs/storybook/pull/26210), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Blocks: Fix `Stories` block rendering duplicate stories when globals are changed - [#26110](https://github.com/storybookjs/storybook/pull/26110), thanks [@JReinhold](https://github.com/JReinhold)!
- Builder Vite: Pass on errors about not having a real stats object in smoke tests - [#26195](https://github.com/storybookjs/storybook/pull/26195), thanks [@tmeasday](https://github.com/tmeasday)!
- CLI: Rename `--webpack-stats-json` to `--stats-json` as it works in Vite - [#26128](https://github.com/storybookjs/storybook/pull/26128), thanks [@tmeasday](https://github.com/tmeasday)!
- Codemods: Enhance mdx-to-csf codemod - [#26164](https://github.com/storybookjs/storybook/pull/26164), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Core: Export preview symbols for embedding - [#26224](https://github.com/storybookjs/storybook/pull/26224), thanks [@tmeasday](https://github.com/tmeasday)!
- Docs: Don't show how to setup controls for empty argTypes in doc pages - [#26200](https://github.com/storybookjs/storybook/pull/26200), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Docs: Fix function prop rendering as `noRefCheck` in storybook docs - [#26104](https://github.com/storybookjs/storybook/pull/26104), thanks [@thisisanto](https://github.com/thisisanto)!
- Doctor: Add dynamic check for incompatible Storybook packages - [#26219](https://github.com/storybookjs/storybook/pull/26219), thanks [@yannbf](https://github.com/yannbf)!
- Maintenance: Remove deprecation of `manager-api`'s `types` export - [#26202](https://github.com/storybookjs/storybook/pull/26202), thanks [@ndelangen](https://github.com/ndelangen)!
- Revert "Revert: "Angular: Reduce the warnings from `ts-loader` via stricter list of `includes`"" - [#26226](https://github.com/storybookjs/storybook/pull/26226), thanks [@ndelangen](https://github.com/ndelangen)!
- Revert: "Angular: Reduce the warnings from `ts-loader` via stricter list of `includes`" - [#26208](https://github.com/storybookjs/storybook/pull/26208), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- UI: Improve sidebar performance when switching stories - [#26184](https://github.com/storybookjs/storybook/pull/26184), thanks [@literalpie](https://github.com/literalpie)!
- UI: Update theme switcher to use toggle button for two themes - [#25682](https://github.com/storybookjs/storybook/pull/25682), thanks [@ivoilic](https://github.com/ivoilic)!
- Vue: Improve types for array, union and intersection when using vue-docgen-api - [#26177](https://github.com/storybookjs/storybook/pull/26177), thanks [@larsrickert](https://github.com/larsrickert)!

## 8.0.0-beta.5

- Addon-controls: Dont show "setup controls" if control is disabled or a function - [#26120](https://github.com/storybookjs/storybook/pull/26120), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Addon-interactions: Only mutate arg keys when writable - [#26118](https://github.com/storybookjs/storybook/pull/26118), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- CLI: Fix logic to add `^` packages in upgrade - [#26049](https://github.com/storybookjs/storybook/pull/26049), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Fix addon bundling script - [#26145](https://github.com/storybookjs/storybook/pull/26145), thanks [@ndelangen](https://github.com/ndelangen)!
- Vue3: Fix SourceDecorator Exception - [#25773](https://github.com/storybookjs/storybook/pull/25773), thanks [@chakAs3](https://github.com/chakAs3)!
- Vue: Replace vue-docgen-api with Volar vue-component-meta - [#22285](https://github.com/storybookjs/storybook/pull/22285), thanks [@chakAs3](https://github.com/chakAs3)!

## 8.0.0-beta.4

- Addon-actions: Warn when argTypesRegex is used together with the visual test addon - [#26094](https://github.com/storybookjs/storybook/pull/26094), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Addon-docs: Fix Table of Contents heading leak - [#23677](https://github.com/storybookjs/storybook/pull/23677), thanks [@vmizg](https://github.com/vmizg)!
- CLI: Add `legacyMdx1` & `@storybook/mdx1-csf` automigration - [#26102](https://github.com/storybookjs/storybook/pull/26102), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Add line ignoring storybook's `.log` files upon `init` - [#26099](https://github.com/storybookjs/storybook/pull/26099), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Add support for custom vite config to autoblocker - [#26087](https://github.com/storybookjs/storybook/pull/26087), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Add webpack5 compiler automigration - [#26000](https://github.com/storybookjs/storybook/pull/26000), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Remove argTypesRegex automigration - [#26001](https://github.com/storybookjs/storybook/pull/26001), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- CLI: Remove the logging to file feature from autoblockers - [#26100](https://github.com/storybookjs/storybook/pull/26100), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Add addon removal telemetry - [#26077](https://github.com/storybookjs/storybook/pull/26077), thanks [@shilman](https://github.com/shilman)!
- Core: Fix fail to load `main.ts` error message - [#26035](https://github.com/storybookjs/storybook/pull/26035), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Update ip version to fix CVE-2023-42282 - [#26086](https://github.com/storybookjs/storybook/pull/26086), thanks [@drik98](https://github.com/drik98)!
- Next.js: Support getImageProps API - [#25745](https://github.com/storybookjs/storybook/pull/25745), thanks [@piratetaco](https://github.com/piratetaco)!
- Svelte: Remove deprecated SvelteComponentTyped in favor of SvelteComponent - [#26113](https://github.com/storybookjs/storybook/pull/26113), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Vite: Fix bug that meant we always warned about TS plugin - [#26051](https://github.com/storybookjs/storybook/pull/26051), thanks [@tmeasday](https://github.com/tmeasday)!
- Vite: Fix config typing issue of the `typescript` property - [#26046](https://github.com/storybookjs/storybook/pull/26046), thanks [@ndelangen](https://github.com/ndelangen)!
- Vite: Fix issue getting preview stats with Vite builder - [#26093](https://github.com/storybookjs/storybook/pull/26093), thanks [@tmeasday](https://github.com/tmeasday)!

## 8.0.0-beta.3

- Addon-actions: Add spy to action for explicit actions - [#26033](https://github.com/storybookjs/storybook/pull/26033), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Addon-themes: Make type generic less strict - [#26042](https://github.com/storybookjs/storybook/pull/26042), thanks [@yannbf](https://github.com/yannbf)!
- Addon-docs: Fix pnpm+Vite failing to build with `@storybook/theming` Rollup error - [#26024](https://github.com/storybookjs/storybook/pull/26024), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Refactor to add autoblockers - [#25934](https://github.com/storybookjs/storybook/pull/25934), thanks [@ndelangen](https://github.com/ndelangen)!
- Codemod: Migrate to test package - [#25958](https://github.com/storybookjs/storybook/pull/25958), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Portable stories: Only provide a play function wrapper if it exists - [#25974](https://github.com/storybookjs/storybook/pull/25974), thanks [@yannbf](https://github.com/yannbf)!
- Test: Bump user-event to 14.5.2 - [#25889](https://github.com/storybookjs/storybook/pull/25889), thanks [@kasperpeulen](https://github.com/kasperpeulen)!

## 8.0.0-beta.2

- Core: Fix boolean `true` args in URL getting ignored - [#25950](https://github.com/storybookjs/storybook/pull/25950), thanks [@JReinhold](https://github.com/JReinhold)!
- Core: Move @types packages to dev deps in core-common - [#25387](https://github.com/storybookjs/storybook/pull/25387), thanks [@kyletsang](https://github.com/kyletsang)!
- Maintenance: Rename testing-utils paths to portable-stories - [#25888](https://github.com/storybookjs/storybook/pull/25888), thanks [@yannbf](https://github.com/yannbf)!
- Portable stories: Pass story context to the play function of a composed story - [#25943](https://github.com/storybookjs/storybook/pull/25943), thanks [@yannbf](https://github.com/yannbf)!
- UI: Fix `display=true` warning in console - [#25951](https://github.com/storybookjs/storybook/pull/25951), thanks [@JReinhold](https://github.com/JReinhold)!
- UI: Update deprecated Icons with the new @storybook/icons in addons - [#25822](https://github.com/storybookjs/storybook/pull/25822), thanks [@cdedreuille](https://github.com/cdedreuille)!
- Vite: Add a `rollup-plugin-webpack-stats` to allow stats from preview builds - [#25923](https://github.com/storybookjs/storybook/pull/25923), thanks [@tmeasday](https://github.com/tmeasday)!

## 8.0.0-beta.1

- Addon-docs: Fix MDX components not applied in Vite and theme loading twice - [#25925](https://github.com/storybookjs/storybook/pull/25925), thanks [@JReinhold](https://github.com/JReinhold)!
- Core: Fix React peer dependency warnings - [#25926](https://github.com/storybookjs/storybook/pull/25926), thanks [@JReinhold](https://github.com/JReinhold)!
- Core: Remove CSF batching, as it isn't required any more - [#25872](https://github.com/storybookjs/storybook/pull/25872), thanks [@tmeasday](https://github.com/tmeasday)!
- Next.js: Fix frameworkOptions resolution - [#25907](https://github.com/storybookjs/storybook/pull/25907), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- React Native: Fix init fails when package is already installed - [#25908](https://github.com/storybookjs/storybook/pull/25908), thanks [@dannyhw](https://github.com/dannyhw)!
- React Native: Remove watcher from init - [#25895](https://github.com/storybookjs/storybook/pull/25895), thanks [@dannyhw](https://github.com/dannyhw)!
- Test: Fix jest-dom matcher type imports - [#25869](https://github.com/storybookjs/storybook/pull/25869), thanks [@alitas](https://github.com/alitas)!
- UI: Fix overlapping on the ref button in the sidebar - [#25914](https://github.com/storybookjs/storybook/pull/25914), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Remove keyboard shortcut hint in search bar on mobile viewports - [#25866](https://github.com/storybookjs/storybook/pull/25866), thanks [@tusharwebd](https://github.com/tusharwebd)!

## 8.0.0-beta.0

- CLI: Add Visual Tests addon to `init` - [#25850](https://github.com/storybookjs/storybook/pull/25850), thanks [@shilman](https://github.com/shilman)!
- CLI: Upgrade boxen library - [#25713](https://github.com/storybookjs/storybook/pull/25713), thanks [@yannbf](https://github.com/yannbf)!
- UI: Fix custom tabs not showing in the manager - [#25792](https://github.com/storybookjs/storybook/pull/25792), thanks [@ndelangen](https://github.com/ndelangen)!

## 8.0.0-alpha.17

- CLI: Fix add command for non monorepo deps - [#25791](https://github.com/storybookjs/storybook/pull/25791), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Core: Fix `--test` must be passed for `build.test` values to be set. - [#25828](https://github.com/storybookjs/storybook/pull/25828), thanks [@ndelangen](https://github.com/ndelangen)!
- Test: Fix vitest patch to work with portable stories and upgrade testing-library/jest-dom - [#25840](https://github.com/storybookjs/storybook/pull/25840), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- UI: Fix sidebar top and bottom addons not showing - [#25825](https://github.com/storybookjs/storybook/pull/25825), thanks [@ndelangen](https://github.com/ndelangen)!
- Webpack: Update StorybookConfig import in core-webpack types.ts - [#25740](https://github.com/storybookjs/storybook/pull/25740), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 8.0.0-alpha.16

- CLI: Fix `upgrade` detecting the wrong version of existing Storybooks - [#25752](https://github.com/storybookjs/storybook/pull/25752), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Update init for react native v7 - [#25780](https://github.com/storybookjs/storybook/pull/25780), thanks [@dannyhw](https://github.com/dannyhw)!
- UI: Improve how the addon panel work on mobile - [#25787](https://github.com/storybookjs/storybook/pull/25787), thanks [@cdedreuille](https://github.com/cdedreuille)!

## 8.0.0-alpha.15

- Next.js: Add logger statements for compiler selection - [#25755](https://github.com/storybookjs/storybook/pull/25755), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- React-Native: Fixes for v8 compatibility - [#25678](https://github.com/storybookjs/storybook/pull/25678), thanks [@shilman](https://github.com/shilman)!
- UI: Remove use of React.FC in components - [#25588](https://github.com/storybookjs/storybook/pull/25588), thanks [@ShaunEvening](https://github.com/ShaunEvening)!
- Vue3: Fix support for `onX` and empty attributes in Show Code - [#25219](https://github.com/storybookjs/storybook/pull/25219), thanks [@Tap-Kim](https://github.com/Tap-Kim)!
- Vue3: Introduce portable stories API - [#25443](https://github.com/storybookjs/storybook/pull/25443), thanks [@yannbf](https://github.com/yannbf)!

## 8.0.0-alpha.14

- Addons: Remove Node.js internal aliasing for Node builds - [#25712](https://github.com/storybookjs/storybook/pull/25712), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Automigration: Add removeReactDependency fix to allFixes array - [#25717](https://github.com/storybookjs/storybook/pull/25717), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Codemods: Add support for multiple file extensions in runCodemod function - [#25708](https://github.com/storybookjs/storybook/pull/25708), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Add webpack aliases for OpenTelemetry API - [#25652](https://github.com/storybookjs/storybook/pull/25652), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- UI: Remove `defaultProps` from `Link` component - [#25619](https://github.com/storybookjs/storybook/pull/25619), thanks [@tsvanharen](https://github.com/tsvanharen)!

## 8.0.0-alpha.13

- Next.js: Fix SWC mode activation - [#25670](https://github.com/storybookjs/storybook/pull/25670), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 8.0.0-alpha.12

- Blocks: Fix Controls block not having controls - [#25663](https://github.com/storybookjs/storybook/pull/25663), thanks [@JReinhold](https://github.com/JReinhold)!
- Blocks: Support `subcomponents` in `ArgTypes` and `Controls`, remove `ArgsTable` block - [#25614](https://github.com/storybookjs/storybook/pull/25614), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Fix existing version detection in `upgrade` - [#25642](https://github.com/storybookjs/storybook/pull/25642), thanks [@JReinhold](https://github.com/JReinhold)!
- Core: Add preset with experimental server API - [#25664](https://github.com/storybookjs/storybook/pull/25664), thanks [@shilman](https://github.com/shilman)!
- MDX: Replace remark by rehype plugins - [#25615](https://github.com/storybookjs/storybook/pull/25615), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- React: Fix acorn ecma version warning - [#25634](https://github.com/storybookjs/storybook/pull/25634), thanks [@dannyhw](https://github.com/dannyhw)!
- Shortcuts: Require modifier key to trigger shortcuts (`F`,`A`,`D`,`S`,`T`,`/`) - [#25625](https://github.com/storybookjs/storybook/pull/25625), thanks [@cdedreuille](https://github.com/cdedreuille)!
- Theming: Fix export of module augmentation - [#25643](https://github.com/storybookjs/storybook/pull/25643), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- UI: Add links to documentation and videos in UI - [#25565](https://github.com/storybookjs/storybook/pull/25565), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- Webpack: Use `node:assert` used in `export-order-loader` - [#25622](https://github.com/storybookjs/storybook/pull/25622), thanks [@JReinhold](https://github.com/JReinhold)!

## 8.0.0-alpha.11

- Angular: Remove cached NgModules and introduce a global queue during bootstrapping - [#24982](https://github.com/storybookjs/storybook/pull/24982), thanks [@Marklb](https://github.com/Marklb)!
- CLI: Fix sandbox command versioning - [#25600](https://github.com/storybookjs/storybook/pull/25600), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Support upgrading to canary versions - [#25596](https://github.com/storybookjs/storybook/pull/25596), thanks [@JReinhold](https://github.com/JReinhold)!
- ConfigFile: Fix export specifiers - [#25590](https://github.com/storybookjs/storybook/pull/25590), thanks [@shilman](https://github.com/shilman)!
- Interaction: Replace @storybook/jest by @storybook/test - [#25584](https://github.com/storybookjs/storybook/pull/25584), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Pass jsConfig to SWC Loader and load config with defaults - [#25203](https://github.com/storybookjs/storybook/pull/25203), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Parameters: Remove passArgsFirst flag - [#25585](https://github.com/storybookjs/storybook/pull/25585), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Preset: Remove deprecated config preset - [#25607](https://github.com/storybookjs/storybook/pull/25607), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- React: Refactor RSC out of Next - [#25591](https://github.com/storybookjs/storybook/pull/25591), thanks [@shilman](https://github.com/shilman)!
- Sandboxes: Update wait-on command to use TCP instead of HTTP - [#25541](https://github.com/storybookjs/storybook/pull/25541), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Telejson: Update stringify options in codebase - [#25564](https://github.com/storybookjs/storybook/pull/25564), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- UI: Fix menu icon on the sidebar - [#25587](https://github.com/storybookjs/storybook/pull/25587), thanks [@cdedreuille](https://github.com/cdedreuille)!
- Webpack5: Make export-order-loader compatible with both esm and cjs - [#25540](https://github.com/storybookjs/storybook/pull/25540), thanks [@mlazari](https://github.com/mlazari)!

## 8.0.0-alpha.10

- API: Remove deprecations from manager and preview api - [#25536](https://github.com/storybookjs/storybook/pull/25536), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Addon Controls: Remove unused hideNoControlsWarning type - [#25417](https://github.com/storybookjs/storybook/pull/25417), thanks [@yannbf](https://github.com/yannbf)!
- Addon Remark-GFM: Upgrade remark-gfm - [#25301](https://github.com/storybookjs/storybook/pull/25301), thanks [@yannbf](https://github.com/yannbf)!
- Addon-actions: Fix module resolution for react-native - [#25296](https://github.com/storybookjs/storybook/pull/25296), thanks [@dannyhw](https://github.com/dannyhw)!
- Angular: Remove deprecated Story type - [#25558](https://github.com/storybookjs/storybook/pull/25558), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Add addon `remove` command - [#25538](https://github.com/storybookjs/storybook/pull/25538), thanks [@shilman](https://github.com/shilman)!
- CLI: Check optionalDependencies for storybook versions - [#25406](https://github.com/storybookjs/storybook/pull/25406), thanks [@reyronald](https://github.com/reyronald)!
- CLI: Sandbox script should use current version to init - [#25560](https://github.com/storybookjs/storybook/pull/25560), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Versioned installation of monorepo packages - [#25517](https://github.com/storybookjs/storybook/pull/25517), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Versioned upgrade of monorepo packages - [#25553](https://github.com/storybookjs/storybook/pull/25553), thanks [@JReinhold](https://github.com/JReinhold)!
- Core: Prevent stories lookup in node_modules - [#25214](https://github.com/storybookjs/storybook/pull/25214), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Core: Refactor preview and deprecate story store - [#24926](https://github.com/storybookjs/storybook/pull/24926), thanks [@tmeasday](https://github.com/tmeasday)!
- Doc blocks: Remove deprecated props from Primary block - [#25461](https://github.com/storybookjs/storybook/pull/25461), thanks [@yannbf](https://github.com/yannbf)!
- Doc blocks: Remove deprecated props from Source block - [#25459](https://github.com/storybookjs/storybook/pull/25459), thanks [@yannbf](https://github.com/yannbf)!
- Doc blocks: Remove deprecated props from Story block - [#25460](https://github.com/storybookjs/storybook/pull/25460), thanks [@yannbf](https://github.com/yannbf)!
- Maintenance: Pin TS to >= 4.2 as typefest 2 requires it - [#25548](https://github.com/storybookjs/storybook/pull/25548), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Maintenance: Upgrade to prettier 3 - [#25524](https://github.com/storybookjs/storybook/pull/25524), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Remove deprecated properties from manager-api - [#25578](https://github.com/storybookjs/storybook/pull/25578), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Test: Fix user event being inlined by tsup by using an interface - [#25547](https://github.com/storybookjs/storybook/pull/25547), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Test: Upgrade test package to vitest 1.1.3 - [#25576](https://github.com/storybookjs/storybook/pull/25576), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- UI: Add configurable tags-based exclusion from sidebar/autodocs - [#25328](https://github.com/storybookjs/storybook/pull/25328), thanks [@shilman](https://github.com/shilman)!
- Webpack: Remove deprecated standalone webpackConfig option - [#25481](https://github.com/storybookjs/storybook/pull/25481), thanks [@yannbf](https://github.com/yannbf)!

## 8.0.0-alpha.9

- AutoTitle: Fix case-insensitive trailing duplicate - [#25452](https://github.com/storybookjs/storybook/pull/25452), thanks [@ksugawara61](https://github.com/ksugawara61)!
- CLI: Fix using wrong package managers in existing projects - [#25474](https://github.com/storybookjs/storybook/pull/25474), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Never prompt for ESLint plugin - [#25289](https://github.com/storybookjs/storybook/pull/25289), thanks [@shilman](https://github.com/shilman)!
- CSF-tools: Allow type checking in storySort - [#25265](https://github.com/storybookjs/storybook/pull/25265), thanks [@honzahruby](https://github.com/honzahruby)!
- Core: Remove `storyStoreV7` feature flag - [#24658](https://github.com/storybookjs/storybook/pull/24658), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Remove deprecated createChannel APIs - [#25487](https://github.com/storybookjs/storybook/pull/25487), thanks [@yannbf](https://github.com/yannbf)!
- Node.js: Update version requirement to >= 18.0.0 - [#25516](https://github.com/storybookjs/storybook/pull/25516), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Storysource: Fix import error - [#25391](https://github.com/storybookjs/storybook/pull/25391), thanks [@unional](https://github.com/unional)!
- UI: Fix sidebar top and bottom addon slots - [#25426](https://github.com/storybookjs/storybook/pull/25426), thanks [@ndelangen](https://github.com/ndelangen)!
- Webpack5: Remove babel and SWC compiler from builder - [#25379](https://github.com/storybookjs/storybook/pull/25379), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 8.0.0-alpha.8

- Addon Links: Remove LinkTo from direct import - [#25418](https://github.com/storybookjs/storybook/pull/25418), thanks [@yannbf](https://github.com/yannbf)!
- Addon docs: Remove deprecated parameters - [#25469](https://github.com/storybookjs/storybook/pull/25469), thanks [@yannbf](https://github.com/yannbf)!
- Builder Vite: Remove StorybookViteConfig type in favor of StorybookConfig - [#25441](https://github.com/storybookjs/storybook/pull/25441), thanks [@yannbf](https://github.com/yannbf)!
- Core: Error on explicit actions while rendering or playing - [#25238](https://github.com/storybookjs/storybook/pull/25238), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Core: Remove collapseAll and expandAll methods - [#25486](https://github.com/storybookjs/storybook/pull/25486), thanks [@yannbf](https://github.com/yannbf)!
- Core: Remove storyIndexers in favor of experimental_indexers - [#25468](https://github.com/storybookjs/storybook/pull/25468), thanks [@yannbf](https://github.com/yannbf)!
- Core: Remove unused staticDir type - [#25415](https://github.com/storybookjs/storybook/pull/25415), thanks [@yannbf](https://github.com/yannbf)!
- Doc blocks: Remove deprecated props from Description block - [#25457](https://github.com/storybookjs/storybook/pull/25457), thanks [@yannbf](https://github.com/yannbf)!
- Manager API: Remove deprecated navigateToSettingsPage method - [#25467](https://github.com/storybookjs/storybook/pull/25467), thanks [@yannbf](https://github.com/yannbf)!
- React: Remove deprecated setGlobalConfig portable stories api - [#25442](https://github.com/storybookjs/storybook/pull/25442), thanks [@yannbf](https://github.com/yannbf)!
- TypeScript: Remove deprecated addons module types - [#25485](https://github.com/storybookjs/storybook/pull/25485), thanks [@yannbf](https://github.com/yannbf)!
- Types: Remove DecoratorFn, Story, ComponentStory, ComponentStoryObj, ComponentStoryFn and ComponentMeta types - [#25477](https://github.com/storybookjs/storybook/pull/25477), thanks [@yannbf](https://github.com/yannbf)!
- Types: Remove Framework in favor of Renderer types - [#25476](https://github.com/storybookjs/storybook/pull/25476), thanks [@yannbf](https://github.com/yannbf)!
- UI: Remove deprecated WithTooltip props - [#25440](https://github.com/storybookjs/storybook/pull/25440), thanks [@yannbf](https://github.com/yannbf)!

## 8.0.0-alpha.7

- Addon-Docs: Upgrade to MDX3 - [#25303](https://github.com/storybookjs/storybook/pull/25303), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Add Storyshots migration notice - [#25327](https://github.com/storybookjs/storybook/pull/25327), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Fix regex used in upgrade command - [#25284](https://github.com/storybookjs/storybook/pull/25284), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Remove --use-npm flag - [#25414](https://github.com/storybookjs/storybook/pull/25414), thanks [@yannbf](https://github.com/yannbf)!
- Core: Remove unused warnOnLegacyHierarchySeparator type - [#25416](https://github.com/storybookjs/storybook/pull/25416), thanks [@yannbf](https://github.com/yannbf)!
- Core: Remove vite plugins and drop Vite 3 support - [#25427](https://github.com/storybookjs/storybook/pull/25427), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Maintenance: Add comment to deprecation notice in Button component - [#25411](https://github.com/storybookjs/storybook/pull/25411), thanks [@yannbf](https://github.com/yannbf)!
- UI: Fix about page layout - [#25396](https://github.com/storybookjs/storybook/pull/25396), thanks [@cdedreuille](https://github.com/cdedreuille)!
- Viewport: Store viewport, rotation in globals - [#25423](https://github.com/storybookjs/storybook/pull/25423), thanks [@shilman](https://github.com/shilman)!
- Vite: Fix Vite 5 CJS warnings - [#25005](https://github.com/storybookjs/storybook/pull/25005), thanks [@JReinhold](https://github.com/JReinhold)!

## 8.0.0-alpha.6

- NextJS: Autoconfigure public directory for new projects - [#25279](https://github.com/storybookjs/storybook/pull/25279), thanks [@shilman](https://github.com/shilman)!
- Vite: Fix pre-transform error in Vite 5 - [#25329](https://github.com/storybookjs/storybook/pull/25329), thanks [@yannbf](https://github.com/yannbf)!
- Vue3: Fix pnp by making compiler-core a dependency - [#25311](https://github.com/storybookjs/storybook/pull/25311), thanks [@shilman](https://github.com/shilman)!

## 8.0.0-alpha.5

- Core: Remove the `-s` flag from build & dev - [#25266](https://github.com/storybookjs/storybook/pull/25266), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Skip no-framework error when ignorePreview=true - [#25286](https://github.com/storybookjs/storybook/pull/25286), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Unique outputDir/cacheDir for each configDir - [#25264](https://github.com/storybookjs/storybook/pull/25264), thanks [@ndelangen](https://github.com/ndelangen)!
- Dependencies: Semver dependency fixes - [#25283](https://github.com/storybookjs/storybook/pull/25283), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Mock out `server-only` package for RSC - [#25263](https://github.com/storybookjs/storybook/pull/25263), thanks [@shilman](https://github.com/shilman)!

## 8.0.0-alpha.4

- API: Remove stories.json support - [#25236](https://github.com/storybookjs/storybook/pull/25236), thanks [@shilman](https://github.com/shilman)!
- Addon Docs: Remove `react` peer dependency - [#24881](https://github.com/storybookjs/storybook/pull/24881), thanks [@JReinhold](https://github.com/JReinhold)!
- Addon-docs: Support `<StrictMode />` and `<Suspense />` in source viewer - [#19785](https://github.com/storybookjs/storybook/pull/19785), thanks [@zhyd1997](https://github.com/zhyd1997)!
- Angular: Add random attribute to bootstrapped selector - [#24972](https://github.com/storybookjs/storybook/pull/24972), thanks [@Marklb](https://github.com/Marklb)!
- Angular: Reduce the warnings from `ts-loader` via stricter list of `includes` - [#24531](https://github.com/storybookjs/storybook/pull/24531), thanks [@ndelangen](https://github.com/ndelangen)!
- Blocks: Render colors in the same order as provided - [#25001](https://github.com/storybookjs/storybook/pull/25001), thanks [@kaelig](https://github.com/kaelig)!
- CLI: Add prompt-only automigrate asking for react-removal - [#25215](https://github.com/storybookjs/storybook/pull/25215), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: No longer add react in init - [#25196](https://github.com/storybookjs/storybook/pull/25196), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Set bundle target to `node18` - [#25239](https://github.com/storybookjs/storybook/pull/25239), thanks [@shilman](https://github.com/shilman)!
- SvelteKit: Fix missing `$app` modules - [#25132](https://github.com/storybookjs/storybook/pull/25132), thanks [@paoloricciuti](https://github.com/paoloricciuti)!
- SvelteKit: Support 2.0 modules with mocks - [#25244](https://github.com/storybookjs/storybook/pull/25244), thanks [@paoloricciuti](https://github.com/paoloricciuti)!
- UI: Embed `react-textarea-autosize` types - [#25235](https://github.com/storybookjs/storybook/pull/25235), thanks [@ndelangen](https://github.com/ndelangen)!

## 8.0.0-alpha.3

- Addon-docs: Fix storybook MDX check - [#24696](https://github.com/storybookjs/storybook/pull/24696), thanks [@shilman](https://github.com/shilman)!
- Addons: Remove unused postinstall package - [#25150](https://github.com/storybookjs/storybook/pull/25150), thanks [@shilman](https://github.com/shilman)!
- Angular: Update Angular cli templates - [#25152](https://github.com/storybookjs/storybook/pull/25152), thanks [@Marklb](https://github.com/Marklb)!
- Blocks: Fix Subtitle block for unattached docs pages - [#25157](https://github.com/storybookjs/storybook/pull/25157), thanks [@kripod](https://github.com/kripod)!
- Ember: Fix @storybook/ember - [#23435](https://github.com/storybookjs/storybook/pull/23435), thanks [@francois2metz](https://github.com/francois2metz)!
- Maintenance: Set engines field to Node.js >= 18 for packages - [#25105](https://github.com/storybookjs/storybook/pull/25105), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 8.0.0-alpha.2

- Core: Maintenance changes for NextJS embedding - [#25086](https://github.com/storybookjs/storybook/pull/25086), thanks [@shilman](https://github.com/shilman)!
- Addon-docs: Fix story anchors using encodeURIComponent - [#25062](https://github.com/storybookjs/storybook/pull/25062), thanks [@xyy94813](https://github.com/xyy94813)!
- CLI: Generate a new project on init in empty directory - [#24997](https://github.com/storybookjs/storybook/pull/24997), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- Svelte: Support v5 prereleases - [#24889](https://github.com/storybookjs/storybook/pull/24889), thanks [@allozaur](https://github.com/allozaur)!
- Vue: Remove deprecated vue packages from next - [#25108](https://github.com/storybookjs/storybook/pull/25108), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Vue: Remove unused preset-vue-webpack - [#25151](https://github.com/storybookjs/storybook/pull/25151), thanks [@shilman](https://github.com/shilman)!

## 8.0.0-alpha.1

- Angular: Drop v14.x support - [#25101](https://github.com/storybookjs/storybook/pull/25101), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Fix CSF Plugin - [#25098](https://github.com/storybookjs/storybook/pull/25098), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Build: Fix Angular sandbox - [#23896](https://github.com/storybookjs/storybook/pull/23896), thanks [@Marklb](https://github.com/Marklb)!
- CLI: Improve dependency metadata detection in storybook doctor - [#25037](https://github.com/storybookjs/storybook/pull/25037), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Point the update-notice to the changelog in the suggested version - [#19911](https://github.com/storybookjs/storybook/pull/19911), thanks [@cprecioso](https://github.com/cprecioso)!
- CLI: Typescript strict mode - [#22254](https://github.com/storybookjs/storybook/pull/22254), thanks [@0916dhkim](https://github.com/0916dhkim)!
- CSF: Autotitle fix multiple dots and handle stories.js - [#21840](https://github.com/storybookjs/storybook/pull/21840), thanks [@agriffis](https://github.com/agriffis)!
- Next.js: Add next/font/local declarations support - [#24983](https://github.com/storybookjs/storybook/pull/24983), thanks [@MauricioRobayo](https://github.com/MauricioRobayo)!
- Next.js: Drop Next.js < v13.5 support - [#25104](https://github.com/storybookjs/storybook/pull/25104), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Fix AppRouterProvider usage - [#25032](https://github.com/storybookjs/storybook/pull/25032), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Fix next/font/local usage in babel mode - [#25045](https://github.com/storybookjs/storybook/pull/25045), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Update validateData function for next/font compatibility - [#25061](https://github.com/storybookjs/storybook/pull/25061), thanks [@kkirby](https://github.com/kkirby)!
- NextJS: Add experimental RSC support - [#25091](https://github.com/storybookjs/storybook/pull/25091), thanks [@shilman](https://github.com/shilman)!
- React-Docgen: Make error-handling more gentle - [#25055](https://github.com/storybookjs/storybook/pull/25055), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- React: Change `StoryFnReactReturnType` to `JSX.Element` - [#23204](https://github.com/storybookjs/storybook/pull/23204), thanks [@chakAs3](https://github.com/chakAs3)!
- React: Set `react-docgen` to default TS docgen - [#24165](https://github.com/storybookjs/storybook/pull/24165), thanks [@shilman](https://github.com/shilman)!
- SvelteKit: Fix HMR not working - [#25031](https://github.com/storybookjs/storybook/pull/25031), thanks [@JReinhold](https://github.com/JReinhold)!
- TypeScript: Migrate `@storybook/docs-tools` to strict TS - [#22567](https://github.com/storybookjs/storybook/pull/22567), thanks [@efrenaragon96](https://github.com/efrenaragon96)!
- UI: Add stricter types to the language property of the SyntaxHighlighter - [#22790](https://github.com/storybookjs/storybook/pull/22790), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Viewport: Fix viewport dts files - [#25107](https://github.com/storybookjs/storybook/pull/25107), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Webpack: Fix exclude regex in react-docgen-loader - [#25030](https://github.com/storybookjs/storybook/pull/25030), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 8.0.0-alpha.0

- Addon Viewport: Expose types for user parameter validation - [#24896](https://github.com/storybookjs/storybook/pull/24896), thanks [@piratetaco](https://github.com/piratetaco)!
- Packages: Remove unused/deprecated packages - [#24528](https://github.com/storybookjs/storybook/pull/24528), thanks [@ndelangen](https://github.com/ndelangen)!
- Vite: use user's `build.target` - [#23123](https://github.com/storybookjs/storybook/pull/23123), thanks [@Hoishin](https://github.com/Hoishin)!
- CLI: Remove `sb extract` command - [#24653](https://github.com/storybookjs/storybook/pull/24653), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Improve project root detection logic - [#20791](https://github.com/storybookjs/storybook/pull/20791), thanks [@dobesv](https://github.com/dobesv)!
- Core: Prebundling globalize the core-event sub paths - [#24976](https://github.com/storybookjs/storybook/pull/24976), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Remove `storiesOf`-API - [#24655](https://github.com/storybookjs/storybook/pull/24655), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: `StorybookConfig` `stories`-field support type async function - [#21555](https://github.com/storybookjs/storybook/pull/21555), thanks [@imccausl](https://github.com/imccausl)!
- Dependencies: Update Typescript - [#24970](https://github.com/storybookjs/storybook/pull/24970), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Dependencies: Upgrade monorepo to TS5 - [#24440](https://github.com/storybookjs/storybook/pull/24440), thanks [@ndelangen](https://github.com/ndelangen)!
- TypeScript: Migrate `@storybook/preset-create-react-app` to strict TS - [#22395](https://github.com/storybookjs/storybook/pull/22395), thanks [@kuriacka](https://github.com/kuriacka)!
- Manager: Enable refs filtered via `experimental_setFilter` - [#24211](https://github.com/storybookjs/storybook/pull/24211), thanks [@ndelangen](https://github.com/ndelangen)!
- MDX: Theme `fontCode` not applied consistently when writing MDX - [#23110](https://github.com/storybookjs/storybook/pull/23110), thanks [@gitstart-storybook](https://github.com/gitstart-storybook)!
- UI: Bring back role main - [#24411](https://github.com/storybookjs/storybook/pull/24411), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Fix `IconButton` not being aligned correctly in blocks - [#24529](https://github.com/storybookjs/storybook/pull/24529), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Fix button size on controls - [#24737](https://github.com/storybookjs/storybook/pull/24737), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Fix layout height - [#24370](https://github.com/storybookjs/storybook/pull/24370), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Fix notifications not appearing in new layout - [#24281](https://github.com/storybookjs/storybook/pull/24281), thanks [@jreinhold](https://github.com/jreinhold)!
- UI: Fix theming not updating - [#24399](https://github.com/storybookjs/storybook/pull/24399), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Improved `Button` and `IconButton` - [#24266](https://github.com/storybookjs/storybook/pull/24266), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Keep mobile drawer open on component selection - [#24258](https://github.com/storybookjs/storybook/pull/24258), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Mobile truncate story name - [#24372](https://github.com/storybookjs/storybook/pull/24372), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: New icon library - [#24433](https://github.com/storybookjs/storybook/pull/24433), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Replace `Form.Button` with the new `Button` component - [#24360](https://github.com/storybookjs/storybook/pull/24360), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Screen reader announcing changes for expand/collapse button - [#24984](https://github.com/storybookjs/storybook/pull/24984), thanks [@wjdtjdgns](https://github.com/wjdtjdgns)!
- UI: Upgrade manager to React v18 - [#24514](https://github.com/storybookjs/storybook/pull/24514), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: sidebar UI updates - [#24707](https://github.com/storybookjs/storybook/pull/24707), thanks [@cdedreuille](https://github.com/cdedreuille)!

## 7.6.0-beta.2

- Actions: Fix `@storybook/core-events/preview-errors` dependency missing for Yarn PnP - [#24973](https://github.com/storybookjs/storybook/pull/24973), thanks [@JReinhold](https://github.com/JReinhold)!
- Webpack5: Resolve circular dependency and fix HMR - [#24974](https://github.com/storybookjs/storybook/pull/24974), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.6.0-beta.1

- SvelteKit: Default to log an action for `goto`, `invalidate` and `invalidateAll` - [#24955](https://github.com/storybookjs/storybook/pull/24955), thanks [@paoloricciuti](https://github.com/paoloricciuti)!

## 7.6.0-beta.0

- Next.js: Remove duplicate Fast Refresh plugin init - [#24963](https://github.com/storybookjs/storybook/pull/24963), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Test: Don't attach action to function mock if action was added already - [#24966](https://github.com/storybookjs/storybook/pull/24966), thanks [@tmeasday](https://github.com/tmeasday)!

## 7.6.0-alpha.7

- Actions: Warn on implicit actions - [#24856](https://github.com/storybookjs/storybook/pull/24856), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Addons, core: Make `react` and Storybook packages `devDependencies` where possible - ATTEMPT 2 - [#24834](https://github.com/storybookjs/storybook/pull/24834), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Add "doctor" command - [#22236](https://github.com/storybookjs/storybook/pull/22236), thanks [@yannbf](https://github.com/yannbf)!
- Core: Add deprecation notice for Vite + CommonJS - [#23950](https://github.com/storybookjs/storybook/pull/23950), thanks [@JReinhold](https://github.com/JReinhold)!
- Core: Detect no matching export error in storybook start and build - [#24877](https://github.com/storybookjs/storybook/pull/24877), thanks [@yannbf](https://github.com/yannbf)!
- Core: Fix `useStoryPrepared` hook failing with `undefined` data - [#22631](https://github.com/storybookjs/storybook/pull/22631), thanks [@SpookyJelly](https://github.com/SpookyJelly)!
- Core: Gracefully handle error when parsing preview.js file - [#24858](https://github.com/storybookjs/storybook/pull/24858), thanks [@yannbf](https://github.com/yannbf)!
- Core: Make warnOnIncompatibleAddons fault-tolerant - [#24880](https://github.com/storybookjs/storybook/pull/24880), thanks [@taozhou-glean](https://github.com/taozhou-glean)!
- Dependency: Fix Yarn 4 failing to install due to jscodeshift dependency issue - [#24914](https://github.com/storybookjs/storybook/pull/24914), thanks [@samvv](https://github.com/samvv)!
- Dependency: Update jscodeshift to v0.15.1 - [#24882](https://github.com/storybookjs/storybook/pull/24882), thanks [@epreston](https://github.com/epreston)!
- FastBuild: Fix disabledAddons filter - [#24924](https://github.com/storybookjs/storybook/pull/24924), thanks [@IanVS](https://github.com/IanVS)!
- ManagerAPI: Fix setting status without index, crashes storybook - [#24866](https://github.com/storybookjs/storybook/pull/24866), thanks [@ndelangen](https://github.com/ndelangen)!
- Next.js: Add back image context CommonJS export - [#24885](https://github.com/storybookjs/storybook/pull/24885), thanks [@martinnabhan](https://github.com/martinnabhan)!
- Next.js: Add experimental SWC support - [#24852](https://github.com/storybookjs/storybook/pull/24852), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Fix import path in swc loader - [#24922](https://github.com/storybookjs/storybook/pull/24922), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Svelte: Fix decorators always running twice - [#24921](https://github.com/storybookjs/storybook/pull/24921), thanks [@paoloricciuti](https://github.com/paoloricciuti)!
- SvelteKit: Add experimental page and navigation mocking - [#24795](https://github.com/storybookjs/storybook/pull/24795), thanks [@paoloricciuti](https://github.com/paoloricciuti)!
- Test: Model loaders as before each and restore mocks properly - [#24948](https://github.com/storybookjs/storybook/pull/24948), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- TestBuild: Add env-variable support to `--test` CLI-flag - [#24862](https://github.com/storybookjs/storybook/pull/24862), thanks [@ndelangen](https://github.com/ndelangen)!
- TestBuild: Add tests and rename to camelCase - [#24911](https://github.com/storybookjs/storybook/pull/24911), thanks [@ndelangen](https://github.com/ndelangen)!
- TestBuild: Fix indexer bug - [#24890](https://github.com/storybookjs/storybook/pull/24890), thanks [@ndelangen](https://github.com/ndelangen)!
- Typescript: Add 'skipCompiler' option to TypeScript presets - [#24847](https://github.com/storybookjs/storybook/pull/24847), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.6.0-alpha.6

- Addon: Move Visual Test addon to the code directory - [#24771](https://github.com/storybookjs/storybook/pull/24771), thanks [@cdedreuille](https://github.com/cdedreuille)!
- FastBuild: Improve config loading & naming - [#24837](https://github.com/storybookjs/storybook/pull/24837), thanks [@ndelangen](https://github.com/ndelangen)!
- TestBuild: Revert defaulting to SWC in test build, but keep using esbuild for minification - [#24843](https://github.com/storybookjs/storybook/pull/24843), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Viewport: Add newer device viewports - [#24777](https://github.com/storybookjs/storybook/pull/24777), thanks [@Tomo5524](https://github.com/Tomo5524)!
- Vite: Prevent non-deterministic build output - [#24833](https://github.com/storybookjs/storybook/pull/24833), thanks [@henkerik](https://github.com/henkerik)!

## 7.6.0-alpha.5

- Addons, core: Make `react` and Storybook packages `devDependencies` where possible - [#24676](https://github.com/storybookjs/storybook/pull/24676), thanks [@JReinhold](https://github.com/JReinhold)!
- Angular: Handle nested module metadata - [#24798](https://github.com/storybookjs/storybook/pull/24798), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Include object configured styles - [#24768](https://github.com/storybookjs/storybook/pull/24768), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Support v17 - [#24717](https://github.com/storybookjs/storybook/pull/24717), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- ReactNative: Fix missing assert dep in docs-tools - [#24732](https://github.com/storybookjs/storybook/pull/24732), thanks [@dannyhw](https://github.com/dannyhw)!
- SWC: Add settings for react and preact - [#24805](https://github.com/storybookjs/storybook/pull/24805), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Svelte: Fix source with decorators always showing the `SlotDecorator` component - [#24800](https://github.com/storybookjs/storybook/pull/24800), thanks [@JReinhold](https://github.com/JReinhold)!
- TestBuild: Disable composition when `--test` is `true` - [#24799](https://github.com/storybookjs/storybook/pull/24799), thanks [@ndelangen](https://github.com/ndelangen)!
- TestBuild: Disable docs related stuff for test builds - [#24691](https://github.com/storybookjs/storybook/pull/24691), thanks [@ndelangen](https://github.com/ndelangen)!
- TestBuild: Disable telemetry for test builds - [#24706](https://github.com/storybookjs/storybook/pull/24706), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- TestBuild: Disable warnOnIncompatibleAddons - [#24797](https://github.com/storybookjs/storybook/pull/24797), thanks [@ndelangen](https://github.com/ndelangen)!
- TestBuild: Globalize `@storybook/blocks` if `build.test.emptyBlocks` is `true` - [#24650](https://github.com/storybookjs/storybook/pull/24650), thanks [@ndelangen](https://github.com/ndelangen)!
- TestBuild: Implement builder options for test build - [#24826](https://github.com/storybookjs/storybook/pull/24826), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- TestBuild: No sourcemaps for test builds - [#24804](https://github.com/storybookjs/storybook/pull/24804), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Fix horizontal scroll bar in Canvas hidden by styling - [#24408](https://github.com/storybookjs/storybook/pull/24408), thanks [@yoshi2no](https://github.com/yoshi2no)!
- UI: Logo fixed value - [#24726](https://github.com/storybookjs/storybook/pull/24726), thanks [@black-arm](https://github.com/black-arm)!
- UI: improve A11Y remove redundant styling rules, update icon color - [#24402](https://github.com/storybookjs/storybook/pull/24402), thanks [@tolkadot](https://github.com/tolkadot)!
- Webpack5: Add export-order-loader and remove babel-plugin-named-exports-order - [#24749](https://github.com/storybookjs/storybook/pull/24749), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Webpack5: Add react-docgen loader and remove babel-plugin-react-docgen - [#24762](https://github.com/storybookjs/storybook/pull/24762), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Webpack5: Fix race condition for export-order loader - [#24817](https://github.com/storybookjs/storybook/pull/24817), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Webpack5: Hide critical dependency warning - [#24784](https://github.com/storybookjs/storybook/pull/24784), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.6.0-alpha.4

- CLI: Ensure errors with opening the browser are caught - [#24668](https://github.com/storybookjs/storybook/pull/24668), thanks [@xueyawei](https://github.com/xueyawei)!
- Babel: Update all @babel/\* dependencies - [#24610](https://github.com/storybookjs/storybook/pull/24610), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Catch when prettier failed to prettify main and preview config files - [#24604](https://github.com/storybookjs/storybook/pull/24604), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- CLI: Ignore `addon-onboarding` when checking versions - [#24634](https://github.com/storybookjs/storybook/pull/24634), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Use @storybook/test in template stories - [#24393](https://github.com/storybookjs/storybook/pull/24393), thanks [@yannbf](https://github.com/yannbf)!
- Controls: Improve accessibility of BooleanControl for screen readers - [#24418](https://github.com/storybookjs/storybook/pull/24418), thanks [@danielmarcano](https://github.com/danielmarcano)!
- Dependencies: Update @babel/traverse and @babel/core to fix vulnerability - [#24670](https://github.com/storybookjs/storybook/pull/24670), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Dependencies: Update browserify-sign transitive dependency - [#24674](https://github.com/storybookjs/storybook/pull/24674), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Dependencies: Update nx dependencies to v17 - [#24671](https://github.com/storybookjs/storybook/pull/24671), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Maintenance: Split renderers preview entrypoints - [#24623](https://github.com/storybookjs/storybook/pull/24623), thanks [@ndelangen](https://github.com/ndelangen)!
- Next.js: Add avif support - [#24611](https://github.com/storybookjs/storybook/pull/24611), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Fix forwarding ref for Image component - [#24648](https://github.com/storybookjs/storybook/pull/24648), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Theming: Add theme variable to set the preview background color - [#24575](https://github.com/storybookjs/storybook/pull/24575), thanks [@JReinhold](https://github.com/JReinhold)!
- UI: Fix button contrast-ratio - [#24525](https://github.com/storybookjs/storybook/pull/24525), thanks [@maheshchandra10](https://github.com/maheshchandra10)!
- UI: Update zIndex on NotificationList to fix the notification not being clickable in certain cases - [#24602](https://github.com/storybookjs/storybook/pull/24602), thanks [@yoshi2no](https://github.com/yoshi2no)!

## 7.6.0-alpha.3

- Action: Attach spies on actions across stories when defined in meta - [#24451](https://github.com/storybookjs/storybook/pull/24451), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Addon A11y: Avoid CSP issue - [#24477](https://github.com/storybookjs/storybook/pull/24477), thanks [@Marklb](https://github.com/Marklb)!
- Addon-themes: Fix globals not being set when using absolute path - [#24596](https://github.com/storybookjs/storybook/pull/24596), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Allow Yarn v4 in `link` command - [#24551](https://github.com/storybookjs/storybook/pull/24551), thanks [@yannbf](https://github.com/yannbf)!
- Core-Server: Ignore all node_module folders for watchpack - [#24553](https://github.com/storybookjs/storybook/pull/24553), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Core: Fix pnp support when cache dir is outside working dir - [#24572](https://github.com/storybookjs/storybook/pull/24572), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Manager: Update `store.settings.lastTrackedStoryId` - [#24115](https://github.com/storybookjs/storybook/pull/24115), thanks [@rashidshamloo](https://github.com/rashidshamloo)!
- Next.js: Support v14.0.0 - [#24593](https://github.com/storybookjs/storybook/pull/24593), thanks [@nikospapcom](https://github.com/nikospapcom)!
- Test: Create @storybook/test package based on vitest - [#24392](https://github.com/storybookjs/storybook/pull/24392), thanks [@kasperpeulen](https://github.com/kasperpeulen)!

## 7.6.0-alpha.2

- Actions: Fix missing crypto module crashing React Native - [#24546](https://github.com/storybookjs/storybook/pull/24546), thanks [@dannyhw](https://github.com/dannyhw)!
- Core: Fix post message channel location.search access for React Native - [#24545](https://github.com/storybookjs/storybook/pull/24545), thanks [@dannyhw](https://github.com/dannyhw)!
- ManagerBuilder: Fix `"type": "commonjs"` compatibility - [#24534](https://github.com/storybookjs/storybook/pull/24534), thanks [@ndelangen](https://github.com/ndelangen)!
- React: Upgrade `react-docgen` to v7 - [#24530](https://github.com/storybookjs/storybook/pull/24530), thanks [@shilman](https://github.com/shilman)!

## 7.6.0-alpha.1

- Angular: Add source-map option to builder - [#24466](https://github.com/storybookjs/storybook/pull/24466), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: update wrong type for webpackStatsJson in start-storybook schema.json - [#24494](https://github.com/storybookjs/storybook/pull/24494), thanks [@LucaVazz](https://github.com/LucaVazz)!
- CLI: Add @storybook/addon-designs to non-core list - [#24507](https://github.com/storybookjs/storybook/pull/24507), thanks [@yannbf](https://github.com/yannbf)!
- Doc Blocks: Add support for `of` prop to `Primary` block - [#23849](https://github.com/storybookjs/storybook/pull/23849), thanks [@Wilson2k](https://github.com/Wilson2k)!
- Doc Blocks: Remove `defaultProps` in `Stories` block - [#24506](https://github.com/storybookjs/storybook/pull/24506), thanks [@WouterK12](https://github.com/WouterK12)!
- Themes: Run postinstall in shell for windows - [#24389](https://github.com/storybookjs/storybook/pull/24389), thanks [@Integrayshaun](https://github.com/Integrayshaun)!

## 7.6.0-alpha.0

Empty release identical to `7.5.0`.

## 7.5.0-alpha.7

- Angular: Allow loading standalone directives - [#24448](https://github.com/storybookjs/storybook/pull/24448), thanks [@osnoser1](https://github.com/osnoser1)!
- Svelte: Fix docs generating when using `lang="ts"` or optional chaining - [#24096](https://github.com/storybookjs/storybook/pull/24096), thanks [@j3rem1e](https://github.com/j3rem1e)!
- Vite: Support Vite 5 - [#24395](https://github.com/storybookjs/storybook/pull/24395), thanks [@IanVS](https://github.com/IanVS)!

## 7.5.0-alpha.6

- Angular: Introduce argsToTemplate for property and event Bindings - [#24434](https://github.com/storybookjs/storybook/pull/24434), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Controls: Fix select / multiselect when value contains multiple spaces - [#22334](https://github.com/storybookjs/storybook/pull/22334), thanks [@oxcened](https://github.com/oxcened)!
- Next.js: Support rename font import - [#24406](https://github.com/storybookjs/storybook/pull/24406), thanks [@yoshi2no](https://github.com/yoshi2no)!
- UI: Update ScrollArea with radix - [#24413](https://github.com/storybookjs/storybook/pull/24413), thanks [@cdedreuille](https://github.com/cdedreuille)!
- Web-components: Add Lit3 support - [#24437](https://github.com/storybookjs/storybook/pull/24437), thanks [@shilman](https://github.com/shilman)!

## 7.5.0-alpha.5

- Angular: Add CLI options (debugWebpack, webpackStatsJson, and more) - [#24388](https://github.com/storybookjs/storybook/pull/24388), thanks [@yannbf](https://github.com/yannbf)!
- Angular: Fix Angular 15 support and add zone.js v0.14.x support - [#24367](https://github.com/storybookjs/storybook/pull/24367), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Core: Add class name to Storybook error name - [#24371](https://github.com/storybookjs/storybook/pull/24371), thanks [@yannbf](https://github.com/yannbf)!
- ManagerAPI: Fix bug with story redirection when URL has partial storyId - [#24345](https://github.com/storybookjs/storybook/pull/24345), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Fix Image Context re-use via singleton - [#24146](https://github.com/storybookjs/storybook/pull/24146), thanks [@martinnabhan](https://github.com/martinnabhan)!
- NextJS: Fix default next image loader when src has params - [#24187](https://github.com/storybookjs/storybook/pull/24187), thanks [@json-betsec](https://github.com/json-betsec)!
- React: Upgrade `react-docgen` to 6.0.x and improve argTypes - [#23825](https://github.com/storybookjs/storybook/pull/23825), thanks [@shilman](https://github.com/shilman)!
- Webpack: Display errors on build - [#24377](https://github.com/storybookjs/storybook/pull/24377), thanks [@yannbf](https://github.com/yannbf)!

## 7.5.0-alpha.4

- CLI: Fix Nextjs project detection - [#24346](https://github.com/storybookjs/storybook/pull/24346), thanks [@yannbf](https://github.com/yannbf)!
- Core: Deprecate `storyStoreV6` (including `storiesOf`) and `storyIndexers` - [#23938](https://github.com/storybookjs/storybook/pull/23938), thanks [@JReinhold](https://github.com/JReinhold)!
- Core: Fix Promise cycle bug in useSharedState - [#24268](https://github.com/storybookjs/storybook/pull/24268), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Fix missing favicon during dev - [#24356](https://github.com/storybookjs/storybook/pull/24356), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Change babel plugins from `proposal-...` to `transform-...` - [#24290](https://github.com/storybookjs/storybook/pull/24290), thanks [@roottool](https://github.com/roottool)!
- Nextjs: Improve support for Windows-style paths - [#23695](https://github.com/storybookjs/storybook/pull/23695), thanks [@T99](https://github.com/T99)!
- UI: Fix infinite hook call causing browsers to freeze - [#24291](https://github.com/storybookjs/storybook/pull/24291), thanks [@yannbf](https://github.com/yannbf)!
- UI: Improve contrast ratio between focus / hover - [#24205](https://github.com/storybookjs/storybook/pull/24205), thanks [@chocoscoding](https://github.com/chocoscoding)!
- Vite: Move mdx-plugin from @storybook/builder-vite to @storybook/addon-docs - [#24166](https://github.com/storybookjs/storybook/pull/24166), thanks [@bryanjtc](https://github.com/bryanjtc)!

## 7.5.0-alpha.3

- Build: Filter some manager errors - [#24217](https://github.com/storybookjs/storybook/pull/24217), thanks [@yannbf](https://github.com/yannbf)!
- Build: Migrate @storybook/addon-backgrounds to strict-ts - [#22178](https://github.com/storybookjs/storybook/pull/22178), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Build: Upgrade chromatic bin package - [#24133](https://github.com/storybookjs/storybook/pull/24133), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Change `/Date$/` to `/Dates$/i` - [#24195](https://github.com/storybookjs/storybook/pull/24195), thanks [@arup1221](https://github.com/arup1221)!
- CLI: Fix `sb add` adding duplicative entries - [#24229](https://github.com/storybookjs/storybook/pull/24229), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Throw an error when critical presets fail to load - [#24176](https://github.com/storybookjs/storybook/pull/24176), thanks [@yannbf](https://github.com/yannbf)!
- Core: Unify error when builder is missing - [#24177](https://github.com/storybookjs/storybook/pull/24177), thanks [@yannbf](https://github.com/yannbf)!
- Core: Upgrade `esbuild-register` to `3.5.0` - [#24175](https://github.com/storybookjs/storybook/pull/24175), thanks [@anneau](https://github.com/anneau)!
- Dependencies: Upgrade `file-system-cache` - [#24232](https://github.com/storybookjs/storybook/pull/24232), thanks [@seriouz](https://github.com/seriouz)!
- Indexer: Rename `index` to `createIndex` - [#24075](https://github.com/storybookjs/storybook/pull/24075), thanks [@JReinhold](https://github.com/JReinhold)!
- Maintenance: Regen lockfiles - [#24152](https://github.com/storybookjs/storybook/pull/24152), thanks [@ndelangen](https://github.com/ndelangen)!
- Manager: Fix useAddonState when using a setter function - [#24237](https://github.com/storybookjs/storybook/pull/24237), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Add compatibility with nextjs `13.5` - [#24239](https://github.com/storybookjs/storybook/pull/24239), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Aliases `react` and `react-dom` like `next.js` does - [#23671](https://github.com/storybookjs/storybook/pull/23671), thanks [@sookmax](https://github.com/sookmax)!
- Nextjs: Improve Google Fonts failure error messages and documentation - [#23891](https://github.com/storybookjs/storybook/pull/23891), thanks [@nsheaps](https://github.com/nsheaps)!
- Nextjs: Migrate from config to previewAnnotations - [#24178](https://github.com/storybookjs/storybook/pull/24178), thanks [@yannbf](https://github.com/yannbf)!
- Theming: Add `barHoverColor` - [#20169](https://github.com/storybookjs/storybook/pull/20169), thanks [@julien-deramond](https://github.com/julien-deramond)!
- Types: Allow `null` in value of `experimental_updateStatus` to clear status - [#24206](https://github.com/storybookjs/storybook/pull/24206), thanks [@ndelangen](https://github.com/ndelangen)!
- Types: Don't distribute generic type of Meta and Story - [#24110](https://github.com/storybookjs/storybook/pull/24110), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- UI: Expand sidebar for selected story when using composition - [#23781](https://github.com/storybookjs/storybook/pull/23781), thanks [@joaonunomota](https://github.com/joaonunomota)!
- UI: Fix SVG override fill when path has a fill attribute - [#24156](https://github.com/storybookjs/storybook/pull/24156), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Fix TreeNode alignment when using a different font - [#22221](https://github.com/storybookjs/storybook/pull/22221), thanks [@bdriguesdev](https://github.com/bdriguesdev)!
- UI: Fix custom theme hover-color inconsistency - [#22262](https://github.com/storybookjs/storybook/pull/22262), thanks [@yoshi2no](https://github.com/yoshi2no)!
- UI: Fix keydown shortcut within shadow tree - [#24179](https://github.com/storybookjs/storybook/pull/24179), thanks [@stropitek](https://github.com/stropitek)!
- UI: Improve look and feel of status UI in sidebar - [#24099](https://github.com/storybookjs/storybook/pull/24099), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.5.0-alpha.2

- Angular: Categorize legacy build options error - [#24014](https://github.com/storybookjs/storybook/pull/24014), thanks [@yannbf](https://github.com/yannbf)!
- Builder-Webpack5: Categorize builder error - [#24031](https://github.com/storybookjs/storybook/pull/24031), thanks [@yannbf](https://github.com/yannbf)!
- CI: Inform the user how to dedupe and strip color from info command - [#24087](https://github.com/storybookjs/storybook/pull/24087), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- CLI: Fix packageManager handling in `sb add` - [#24079](https://github.com/storybookjs/storybook/pull/24079), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- CLI: Improve sanitization logic in crash reports - [#24028](https://github.com/storybookjs/storybook/pull/24028), thanks [@yannbf](https://github.com/yannbf)!
- Maintenance: Add more context to explanation in core-events errors - [#24063](https://github.com/storybookjs/storybook/pull/24063), thanks [@yannbf](https://github.com/yannbf)!
- Monorepo: Fix `svelte-vite` detection - [#24085](https://github.com/storybookjs/storybook/pull/24085), thanks [@legnaleurc](https://github.com/legnaleurc)!
- NextJS: Fix Image Context reuse (ensure singleton by externalizing it) - [#23881](https://github.com/storybookjs/storybook/pull/23881), thanks [@martinnabhan](https://github.com/martinnabhan)!
- Source-loader: Fix property key validation - [#24068](https://github.com/storybookjs/storybook/pull/24068), thanks [@MrZillaGold](https://github.com/MrZillaGold)!
- Svelte: Fix generated properties on Svelte event handler - [#24020](https://github.com/storybookjs/storybook/pull/24020), thanks [@j3rem1e](https://github.com/j3rem1e)!
- Telemetry: Add platform info to telemetry event - [#24081](https://github.com/storybookjs/storybook/pull/24081), thanks [@yannbf](https://github.com/yannbf)!
- UI: Fix target id in searchfield label - [#23464](https://github.com/storybookjs/storybook/pull/23464), thanks [@plumpNation](https://github.com/plumpNation)!
- Vue3: Remove console.log in sourceDecorator - [#24062](https://github.com/storybookjs/storybook/pull/24062), thanks [@oruman](https://github.com/oruman)!

## 7.5.0-alpha.1

- Core: Add CJS entrypoints to errors in core events - [#24038](https://github.com/storybookjs/storybook/pull/24038), thanks [@yannbf](https://github.com/yannbf)!

## 7.5.0-alpha.0

- Addon API: Improve the updateStatus API - [#24007](https://github.com/storybookjs/storybook/pull/24007), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Add more information to `storybook info` command - [#24003](https://github.com/storybookjs/storybook/pull/24003), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Add uncaughtException handler - [#24018](https://github.com/storybookjs/storybook/pull/24018), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Remove random commas in storybook upgrade logs - [#22333](https://github.com/storybookjs/storybook/pull/22333), thanks [@joaonunomota](https://github.com/joaonunomota)!
- Doc Blocks: Add `title` to `Meta` prop types - [#23370](https://github.com/storybookjs/storybook/pull/23370), thanks [@iqbalcodes6602](https://github.com/iqbalcodes6602)!
- Docs: Fix TOC import - [#24047](https://github.com/storybookjs/storybook/pull/24047), thanks [@shilman](https://github.com/shilman)!
- Docs: Fix table of contents scroll behavior - [#23986](https://github.com/storybookjs/storybook/pull/23986), thanks [@almoghaimo](https://github.com/almoghaimo)!
- Telemetry: Filter addon options to protect sensitive info - [#24000](https://github.com/storybookjs/storybook/pull/24000), thanks [@shilman](https://github.com/shilman)!
- Types: Remove `@types/react` dep from `@storybook/types` - [#24042](https://github.com/storybookjs/storybook/pull/24042), thanks [@JReinhold](https://github.com/JReinhold)!

## 7.4.0-alpha.2

- Addon-docs: Resolve `mdx-react-shim` & `@storybook/global` correctly - [#23941](https://github.com/storybookjs/storybook/pull/23941), thanks [@ndelangen](https://github.com/ndelangen)!
- Addons: Fix key is not a prop warning - [#23935](https://github.com/storybookjs/storybook/pull/23935), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- CLI: Pass package manager to postinstall - [#23913](https://github.com/storybookjs/storybook/pull/23913), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- CLI: Provide guidance for users who try to initialize Storybook on an empty dir - [#23874](https://github.com/storybookjs/storybook/pull/23874), thanks [@yannbf](https://github.com/yannbf)!
- Logger: Fix double error messages/stack - [#23919](https://github.com/storybookjs/storybook/pull/23919), thanks [@ndelangen](https://github.com/ndelangen)!
- Maintenance: Categorize server errors - [#23912](https://github.com/storybookjs/storybook/pull/23912), thanks [@yannbf](https://github.com/yannbf)!
- Maintenance: Remove need for `react` as peerDependency - [#23897](https://github.com/storybookjs/storybook/pull/23897), thanks [@ndelangen](https://github.com/ndelangen)!
- Maintenance: Remove sourcemaps generation - [#23936](https://github.com/storybookjs/storybook/pull/23936), thanks [@ndelangen](https://github.com/ndelangen)!
- Preset: Add common preset overrides mechanism - [#23915](https://github.com/storybookjs/storybook/pull/23915), thanks [@yannbf](https://github.com/yannbf)!
- UI: Add an experimental API for adding sidebar bottom toolbar - [#23778](https://github.com/storybookjs/storybook/pull/23778), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Add an experimental API for adding sidebar top toolbar - [#23811](https://github.com/storybookjs/storybook/pull/23811), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.4.0-alpha.1

- Build: Migrate @storybook/scripts to strict-ts - [#23818](https://github.com/storybookjs/storybook/pull/23818), thanks [@stilt0n](https://github.com/stilt0n)!
- CLI: Exclude addon-styling from upgrade - [#23841](https://github.com/storybookjs/storybook/pull/23841), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- Core: Add error categorization framework - [#23653](https://github.com/storybookjs/storybook/pull/23653), thanks [@yannbf](https://github.com/yannbf)!
- Core: Fix error thrown if `docs.defaultName` is unset - [#23893](https://github.com/storybookjs/storybook/pull/23893), thanks [@stilt0n](https://github.com/stilt0n)!
- Core: Fix race-condition relating to `addons.setConfig` - [#23802](https://github.com/storybookjs/storybook/pull/23802), thanks [@ndelangen](https://github.com/ndelangen)!
- Maintenance: Move filtering of sidebar into the state - [#23911](https://github.com/storybookjs/storybook/pull/23911), thanks [@ndelangen](https://github.com/ndelangen)!
- Maintenance: Revert "WebpackBuilder: Remove need for `react` as peerDependency" - [#23882](https://github.com/storybookjs/storybook/pull/23882), thanks [@vanessayuenn](https://github.com/vanessayuenn)!
- Manager API: Fix `api.getAddonState`default value - [#23804](https://github.com/storybookjs/storybook/pull/23804), thanks [@sookmax](https://github.com/sookmax)!
- Publish: Don't distribute src files or unnecessary template files - [#23853](https://github.com/storybookjs/storybook/pull/23853), thanks [@shilman](https://github.com/shilman)!
- UI: Add an experimental API for adding sidebar filter functions at runtime - [#23722](https://github.com/storybookjs/storybook/pull/23722), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Removal of experimental components - [#23907](https://github.com/storybookjs/storybook/pull/23907), thanks [@ndelangen](https://github.com/ndelangen)!
- Vue3: Add support for Global Apps install - [#23772](https://github.com/storybookjs/storybook/pull/23772), thanks [@chakAs3](https://github.com/chakAs3)!
- Vue3: Use slot value directly if it's a string in source decorator - [#23784](https://github.com/storybookjs/storybook/pull/23784), thanks [@nasvillanueva](https://github.com/nasvillanueva)!

## 7.4.0-alpha.0

- Index: Fix `*.story.*` CSF indexing - [#23852](https://github.com/storybookjs/storybook/pull/23852), thanks [@shilman](https://github.com/shilman)!

## 7.3.0-alpha.0

- Addons: Deprecate key in addon render function as it is not available anymore - [#23792](https://github.com/storybookjs/storybook/pull/23792), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Build: Support Chrome 100, Safari 15 and Firefox 91 - [#23800](https://github.com/storybookjs/storybook/pull/23800), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- CLI: Update postinstall to look for addon script - [#23791](https://github.com/storybookjs/storybook/pull/23791), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- UI: Update IconButton and add new Toolbar component - [#23795](https://github.com/storybookjs/storybook/pull/23795), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Upgrade Addon Design - [#23806](https://github.com/storybookjs/storybook/pull/23806), thanks [@cdedreuille](https://github.com/cdedreuille)!
- Vue3: Don't assign values to all slots (rollback to v7.0.27) - [#23697](https://github.com/storybookjs/storybook/pull/23697), thanks [@kasperpeulen](https://github.com/kasperpeulen)!

## 7.2.2-alpha.1

- CSF-Tools: Remove prettier from printConfig - [#23766](https://github.com/storybookjs/storybook/pull/23766), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- UI: Improve Link component - [#23767](https://github.com/storybookjs/storybook/pull/23767), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Improve new `Button` component - [#23765](https://github.com/storybookjs/storybook/pull/23765), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Update Button types to allow for no children on iconOnly buttons - [#23735](https://github.com/storybookjs/storybook/pull/23735), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Upgrade Icon component - [#23680](https://github.com/storybookjs/storybook/pull/23680), thanks [@cdedreuille](https://github.com/cdedreuille)!
- WebpackBuilder: Remove need for `react` as peerDependency - [#23496](https://github.com/storybookjs/storybook/pull/23496), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.2.2-alpha.0

- Indexer: Introduce new experimental `indexer` API - #23691, thanks [@JReinhold](https://github.com/jreinhold)!
- Addon-docs, Core, Server: Use new `indexer` API - #23660, thanks [@JReinhold](https://github.com/jreinhold)!
- Server: Add support for tags - #23660, thanks [@JReinhold](https://github.com/jreinhold)!
- Core-server: Improve internal types - #23632, thanks [@JReinhold](https://github.com/jreinhold)!

## 7.2.0-rc.0

- Addon: Create @storybook/addon-themes - [#23524](https://github.com/storybookjs/storybook/pull/23524), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- Angular: Fix initialization of Storybook in Angular 16.1 - [#23598](https://github.com/storybookjs/storybook/pull/23598), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Gracefully shutdown and cleanup execa child processes - [#23538](https://github.com/storybookjs/storybook/pull/23538), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Dependencies: Downgrade `jest-mock` - [#23597](https://github.com/storybookjs/storybook/pull/23597), thanks [@ndelangen](https://github.com/ndelangen)!
- Dependencies: Upgrade simple-update-notifier - [#23396](https://github.com/storybookjs/storybook/pull/23396), thanks [@dartess](https://github.com/dartess)!
- Storyshots: fix broken storyshots with angular - [#23555](https://github.com/storybookjs/storybook/pull/23555), thanks [@mattlewis92](https://github.com/mattlewis92)!
- TypeScript: Added `expanded` to `CoreCommon_StorybookRefs` to fix typescript errors - [#23488](https://github.com/storybookjs/storybook/pull/23488), thanks [@DotwoodMedia](https://github.com/DotwoodMedia)!
- TypeScript: Downgrade to the last version of type-fest that doesn't need typescript 5.0 - [#23574](https://github.com/storybookjs/storybook/pull/23574), thanks [@ndelangen](https://github.com/ndelangen)!
- Vue2: Source Decorator reactivity - [#23149](https://github.com/storybookjs/storybook/pull/23149), thanks [@chakAs3](https://github.com/chakAs3)!

## 7.2.0-alpha.0

- Angular: Make enableProdMode optional - [#23489](https://github.com/storybookjs/storybook/pull/23489), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Router: Support RegExp in Route component - [#23292](https://github.com/storybookjs/storybook/pull/23292), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Improve tabs component, more type correct, allow for FC as title - [#23288](https://github.com/storybookjs/storybook/pull/23288), thanks [@ndelangen](https://github.com/ndelangen)!
- Addons: Improve code quality by using title as FC & sharing state via useAddonState - [#23298](https://github.com/storybookjs/storybook/pull/23298), thanks [@ndelangen](https://github.com/ndelangen)!
- InteractionsAddon: Improve code quality by using title as FC & sharing state via useAddonState - [#23291](https://github.com/storybookjs/storybook/pull/23291), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Add storyStatus to sidebar UI - [#23342](https://github.com/storybookjs/storybook/pull/23342), thanks [@ndelangen](https://github.com/ndelangen)!
- Addon API: Add experimental page addon type - [#23307](https://github.com/storybookjs/storybook/pull/23307), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: refactor Canvas component so we can improve types for PREVIEW addons and TAB addons - [#23311](https://github.com/storybookjs/storybook/pull/23311), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Improve Button layout and props - [#23356](https://github.com/storybookjs/storybook/pull/23356), thanks [@cdedreuille](https://github.com/cdedreuille)!
- Dependencies: Remove references to api and the 2 deprecated channel packages - [#23384](https://github.com/storybookjs/storybook/pull/23384), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Show the story status in the search results - [#23441](https://github.com/storybookjs/storybook/pull/23441), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Create new form elements in the new Core UI (Input, TextArea, Select) - [#23469](https://github.com/storybookjs/storybook/pull/23469), thanks [@cdedreuille](https://github.com/cdedreuille)!
- CLI: Improve support of mono repositories - [#23458](https://github.com/storybookjs/storybook/pull/23458), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.1.0-rc.2

- CLI: Exit when user does not select a storybook project type - [#23201](https://github.com/storybookjs/storybook/pull/23201), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Fix Javascript language detection - [#23426](https://github.com/storybookjs/storybook/pull/23426), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Core: Fix onboarding detection in what's new module - [#23424](https://github.com/storybookjs/storybook/pull/23424), thanks [@yannbf](https://github.com/yannbf)!
- Dependencies: Bump `@sveltejs/vite-plugin-svelte` - [#23233](https://github.com/storybookjs/storybook/pull/23233), thanks [@JReinhold](https://github.com/JReinhold)!
- Telemetry: Add globals usage to project.json - [#23431](https://github.com/storybookjs/storybook/pull/23431), thanks [@shilman](https://github.com/shilman)!

## 7.1.0-rc.1

- Angular: Enable prod mode when Storybook is built - [#23404](https://github.com/storybookjs/storybook/pull/23404), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Fix esm issue in combination with rxjs v6 - [#23405](https://github.com/storybookjs/storybook/pull/23405), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Fix chevron icon on Configure.mdx page - [#23397](https://github.com/storybookjs/storybook/pull/23397), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Settings: Fix dark mode for what's new page - [#23398](https://github.com/storybookjs/storybook/pull/23398), thanks [@kasperpeulen](https://github.com/kasperpeulen)!

## 7.1.0-rc.0

Promote beta to rc without any changes. 🎉

## 7.1.0-beta.3

- CLI: Update Configure.mdx - [#23340](https://github.com/storybookjs/storybook/pull/23340), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- React: Move `typescript` from devDependencies to peerDependencies - [#23179](https://github.com/storybookjs/storybook/pull/23179), thanks [@chakAs3](https://github.com/chakAs3)!
- Settings: Add disable whatsnew UI - [#23381](https://github.com/storybookjs/storybook/pull/23381), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Settings: New about page design - [#23357](https://github.com/storybookjs/storybook/pull/23357), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Svelte-Webpack: Support Svelte v4 - [#23336](https://github.com/storybookjs/storybook/pull/23336), thanks [@JReinhold](https://github.com/JReinhold)!
- UI: Remove css zoom - [#21303](https://github.com/storybookjs/storybook/pull/21303), thanks [@Luk-z](https://github.com/Luk-z)!

## 7.1.0-beta.2

- Next.js: Fix for @nx/react/plugin/storybook with stories containing SVGs - [#23210](https://github.com/storybookjs/storybook/pull/23210), thanks [@daves28](https://github.com/daves28)!
- Yarn: Downgrade yarnpkg packages and support virtual files properly - [#23354](https://github.com/storybookjs/storybook/pull/23354), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.1.0-beta.1

- Addon-docs: Add opt-in table of contents - [#23142](https://github.com/storybookjs/storybook/pull/23142), thanks [@shilman](https://github.com/shilman)!
- SyntaxHighlighter: Expose registerLanguage - [#23166](https://github.com/storybookjs/storybook/pull/23166), thanks [@ndelangen](https://github.com/ndelangen)!
- Yarn: Fix pnp package resolution on Windows - [#23274](https://github.com/storybookjs/storybook/pull/23274), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Yarn: Pin version of @yarnpkg packages to support Node 16 - [#23330](https://github.com/storybookjs/storybook/pull/23330), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.1.0-beta.0

- Settings: Add what's new page, remove release notes - [#23202](https://github.com/storybookjs/storybook/pull/23202), thanks [@kasperpeulen](https://github.com/kasperpeulen)!

## 7.1.0-alpha.44

- Next.js: Fix next/image usage in latest Next.js release - [#23296](https://github.com/storybookjs/storybook/pull/23296), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.1.0-alpha.43

- Addons: Remove deprecated addPanel use and misc improvements - [#23284](https://github.com/storybookjs/storybook/pull/23284), thanks [@ndelangen](https://github.com/ndelangen)!
- CSF-tools: Allow type checking in story title - [#22791](https://github.com/storybookjs/storybook/pull/22791), thanks [@honzahruby](https://github.com/honzahruby)!

## 7.1.0-alpha.42

- CLI: Fix pnp paths logic in storybook metadata - [#23259](https://github.com/storybookjs/storybook/pull/23259), thanks [@yannbf](https://github.com/yannbf)!

## 7.1.0-alpha.41

- Controls: Fix UI to add array items - [#22993](https://github.com/storybookjs/storybook/pull/22993), thanks [@sookmax](https://github.com/sookmax)!
- Next.js: Support disableStaticImages setting - [#23167](https://github.com/storybookjs/storybook/pull/23167), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.1.0-alpha.40

- CLI: Parse pnp paths in storybook metadata - [#23199](https://github.com/storybookjs/storybook/pull/23199), thanks [@yannbf](https://github.com/yannbf)!
- Dependencies: Pin `file-system-cache` to 2.3.0 - [#23221](https://github.com/storybookjs/storybook/pull/23221), thanks [@JReinhold](https://github.com/JReinhold)!
- PNPM: Hide ModuleNotFound error in pnpm pnp mode - [#23195](https://github.com/storybookjs/storybook/pull/23195), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Svelte: Support v4 - [#22905](https://github.com/storybookjs/storybook/pull/22905), thanks [@JReinhold](https://github.com/JReinhold)!

## 7.1.0-alpha.39

- CLI: Add new Configure page to templates - [#23171](https://github.com/storybookjs/storybook/pull/23171), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Fix storybook package manager command in init - [#23169](https://github.com/storybookjs/storybook/pull/23169), thanks [@yannbf](https://github.com/yannbf)!
- React: Add addon-onboarding as part of init - [#22972](https://github.com/storybookjs/storybook/pull/22972), thanks [@yannbf](https://github.com/yannbf)!

## 7.1.0-alpha.38

- CLI: Fix installing user's project before init - [#23145](https://github.com/storybookjs/storybook/pull/23145), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Fix storybook dev after storybook init via subprocess - [#23144](https://github.com/storybookjs/storybook/pull/23144), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Suppress dev-server info table when `--quiet` is true - [#23133](https://github.com/storybookjs/storybook/pull/23133), thanks [@syabro](https://github.com/syabro)!
- Core: Allow `.mjs` extension for CSF stories - [#23125](https://github.com/storybookjs/storybook/pull/23125), thanks [@idesigncode](https://github.com/idesigncode)!
- Core: Fix compat by disabling name mangling in `esbuild` require - [#22486](https://github.com/storybookjs/storybook/pull/22486), thanks [@youngboy](https://github.com/youngboy)!
- Docs: Fix scroll location on docs navigation - [#22714](https://github.com/storybookjs/storybook/pull/22714), thanks [@gitstart-storybook](https://github.com/gitstart-storybook)!
- Interactions: Fix deeply nested nodes in the panel debugger - [#23108](https://github.com/storybookjs/storybook/pull/23108), thanks [@yannbf](https://github.com/yannbf)!

## 7.1.0-alpha.37

- Ecosystem: Prebundle node-logger and make it CJS only - [#23109](https://github.com/storybookjs/storybook/pull/23109), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Fix `useParams` support - [#22946](https://github.com/storybookjs/storybook/pull/22946), thanks [@gitstart-storybook](https://github.com/gitstart-storybook)!
- NextJS: Fix fonts not loading with 3+ words in name - [#23121](https://github.com/storybookjs/storybook/pull/23121), thanks [@ygkn](https://github.com/ygkn)!
- Webpack: Fix channel format for loading status - [#23139](https://github.com/storybookjs/storybook/pull/23139), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.1.0-alpha.36

- CLI: Fix "Invalid version null" issues by improved version detection - [#22642](https://github.com/storybookjs/storybook/pull/22642), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Prebundle boxen to resolve a ESM/CJS incompatibility - [#23080](https://github.com/storybookjs/storybook/pull/23080), thanks [@ndelangen](https://github.com/ndelangen)!
- Telemetry: Count onboarding stories - [#23092](https://github.com/storybookjs/storybook/pull/23092), thanks [@shilman](https://github.com/shilman)!

## 7.1.0-alpha.35

- CLI: Skip builder selection for react native - [#23042](https://github.com/storybookjs/storybook/pull/23042), thanks [@dannyhw](https://github.com/dannyhw)!
- Core: Fix core-common to use node-fetch - [#23077](https://github.com/storybookjs/storybook/pull/23077), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.1.0-alpha.34

- Angular: Fix ivy preset - [#23070](https://github.com/storybookjs/storybook/pull/23070), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Change Button stories layout for React starter templates - [#22951](https://github.com/storybookjs/storybook/pull/22951), thanks [@yannbf](https://github.com/yannbf)!

## 7.1.0-alpha.33

- Bug: Fix for angular 16.1 compatibility - [#23064](https://github.com/storybookjs/storybook/pull/23064), thanks [@ndelangen](https://github.com/ndelangen)!
- Builder-vite: Fix lib/channels dependency - [#23049](https://github.com/storybookjs/storybook/pull/23049), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Improve steps in storybook init - [#22502](https://github.com/storybookjs/storybook/pull/22502), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Run `storybook dev` as part of `storybook init` - [#22928](https://github.com/storybookjs/storybook/pull/22928), thanks [@yannbf](https://github.com/yannbf)!
- Core: Merge channels into a single package - [#23032](https://github.com/storybookjs/storybook/pull/23032), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Unify cache location configurability - [#22079](https://github.com/storybookjs/storybook/pull/22079), thanks [@kubijo](https://github.com/kubijo)!

## 7.1.0-alpha.32

- Build: Remove `babel-core` & upgrade `esbuild` - [#23017](https://github.com/storybookjs/storybook/pull/23017), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Disable esbuild on files imported from `node_modules` - [#23018](https://github.com/storybookjs/storybook/pull/23018), thanks [@tmeasday](https://github.com/tmeasday)!
- Core: Integrate serverChannel into channel - [#22940](https://github.com/storybookjs/storybook/pull/22940), thanks [@ndelangen](https://github.com/ndelangen)!
- React: Lazy import `react-docgen-typescript-plugin` - [#23019](https://github.com/storybookjs/storybook/pull/23019), thanks [@tmeasday](https://github.com/tmeasday)!

## 7.1.0-alpha.31

- Dependencies: Set vue-component-type-helpers to latest - [#23015](https://github.com/storybookjs/storybook/pull/23015), thanks [@ndelangen](https://github.com/ndelangen)!
- Dependencies: Upgrade `nanoid`, prebundle it, upgrade `remark`, cleanup some `.md` files for warnings - [#23005](https://github.com/storybookjs/storybook/pull/23005), thanks [@ndelangen](https://github.com/ndelangen)!
- Dependencies: Use `latest` version of `vue-tsc` & sync versions of `angular` - [#23011](https://github.com/storybookjs/storybook/pull/23011), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.1.0-alpha.30

- Web-components: Fix custom-elements order of property application - [#19183](https://github.com/storybookjs/storybook/pull/19183), thanks [@sonntag-philipp](https://github.com/sonntag-philipp)!
- Dependencies: Remove `shelljs` use - [#22995](https://github.com/storybookjs/storybook/pull/22995), thanks [@ndelangen](https://github.com/ndelangen)!
- Dependencies: Upgrade Jest related packages - [#22979](https://github.com/storybookjs/storybook/pull/22979), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Fix `builder-manager` adding multiple dashes to relative path - [#22974](https://github.com/storybookjs/storybook/pull/22974), thanks [@MarioCadenas](https://github.com/MarioCadenas)!
- Core: Add JSDoc comments to `preview-api` APIs - [#22975](https://github.com/storybookjs/storybook/pull/22975), thanks [@ndelangen](https://github.com/ndelangen)!
- Vue3: Fix source decorator to generate correct story code - [#22518](https://github.com/storybookjs/storybook/pull/22518), thanks [@chakAs3](https://github.com/chakAs3)!
- Core: Add JSDoc comments to `manager-api` APIs - [#22968](https://github.com/storybookjs/storybook/pull/22968), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Improve `of={...}` DocBlock error in story index - [#22782](https://github.com/storybookjs/storybook/pull/22782), thanks [@shilman](https://github.com/shilman)!
- UI: Simplify `overlayscrollbars` component - [#22963](https://github.com/storybookjs/storybook/pull/22963), thanks [@ndelangen](https://github.com/ndelangen)!
- Angular: Add `--open`/`--no-open` flag to `dev` command - [#22964](https://github.com/storybookjs/storybook/pull/22964), thanks [@yannbf](https://github.com/yannbf)!
- Angular: Silence compodoc when running storybook with --quiet - [#22957](https://github.com/storybookjs/storybook/pull/22957), thanks [@yannbf](https://github.com/yannbf)!
- React: Fix decorators to conditionally render children - [#22336](https://github.com/storybookjs/storybook/pull/22336), thanks [@redbugz](https://github.com/redbugz)!
- Addon-measure: Migrate to strict TS - [#22402](https://github.com/storybookjs/storybook/pull/22402), thanks [@efrenaragon96](https://github.com/efrenaragon96)!
- Feature: Add experimental status API - [#22890](https://github.com/storybookjs/storybook/pull/22890), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.1.0-alpha.29 (June 6, 2023)

#### Bug Fixes

- CLI: Fix upgrade notification message [#22933](https://github.com/storybooks/storybook/pull/22933)
- Core: Fix indexing errors by excluding node_modules stories [#22873](https://github.com/storybooks/storybook/pull/22873)

## 7.1.0-alpha.28 (June 6, 2023)

#### Bug Fixes

- Docs: E2E tests for Source block update fix [#22835](https://github.com/storybooks/storybook/pull/22835)
- Docs: Fix Source block snippet updates [#22807](https://github.com/storybooks/storybook/pull/22807)

## 7.1.0-alpha.27 (June 4, 2023)

#### Features

- Webpack: Add option to minify using swc [#22843](https://github.com/storybooks/storybook/pull/22843)

#### Bug Fixes

- Server: Fix .stories.yml support [#22906](https://github.com/storybooks/storybook/pull/22906)
- Storysource: Fix StyledSyntaxHighlighter to wrap long lines [#22541](https://github.com/storybooks/storybook/pull/22541)

#### Maintenance

- TS: Migrate @storybook/web-components to strict TS [#22399](https://github.com/storybooks/storybook/pull/22399)
- TS: Migrate @storybook/addon-storyshots-puppeteer to strict TS [#22407](https://github.com/storybooks/storybook/pull/22407)
- TS: Migrate @storybook/addon-jest to strict TS [#22389](https://github.com/storybooks/storybook/pull/22389)
- TS: Migrate @storybook/addon-mdx-gfm to strict TS [#22659](https://github.com/storybooks/storybook/pull/22659)
- TS: Migrate @storybook/addon-storyshots to strict TS [#22487](https://github.com/storybooks/storybook/pull/22487)

#### Build

- Error on YN0060 - INCOMPATIBLE_PEER_DEPENDENCY [#22398](https://github.com/storybooks/storybook/pull/22398)
- Build: upgrade yarn [#22855](https://github.com/storybooks/storybook/pull/22855)
- Add CODEOWNERS [#22869](https://github.com/storybooks/storybook/pull/22869)

## 7.1.0-alpha.26 (May 31, 2023)

#### Bug Fixes

- Addons: Fix `Addon_BaseAnnotations` type [#22771](https://github.com/storybooks/storybook/pull/22771)
- Viewport: Fix viewport menu [#22829](https://github.com/storybooks/storybook/pull/22829)

#### Maintenance

- NextJS: Fix types [#22836](https://github.com/storybooks/storybook/pull/22836)
- React: Update babel dependencies to fix sandbox creation [#22824](https://github.com/storybooks/storybook/pull/22824)

#### Build

- Build: sort package json files [#22847](https://github.com/storybooks/storybook/pull/22847)
- Build: cleanup the test-storybooks [#22846](https://github.com/storybooks/storybook/pull/22846)
- Build: fix the theme output during development [#22841](https://github.com/storybooks/storybook/pull/22841)
- Build: move deprecated packages [#22753](https://github.com/storybooks/storybook/pull/22753)
- Build: move builders [#22751](https://github.com/storybooks/storybook/pull/22751)

## 7.1.0-alpha.25 (May 26, 2023)

#### Bug Fixes

- Vue3: Fix TS 5.0 compat with vue-component-type-helpers [#22814](https://github.com/storybooks/storybook/pull/22814)

#### Build

- Build: Fix the local storybook [#22805](https://github.com/storybooks/storybook/pull/22805)
- Build: Add more checks to ci:daily workflow [#22815](https://github.com/storybooks/storybook/pull/22815)
- Build: Revert conditional decorator story and downgrade Typescript version [#22812](https://github.com/storybooks/storybook/pull/22812)

## 7.1.0-alpha.24 (May 26, 2023)

#### Bug Fixes

- Vue3: Fix reactive args updates in decorators [#22717](https://github.com/storybooks/storybook/pull/22717)

#### Build

- Build: Update Nx to latest version [#22694](https://github.com/storybooks/storybook/pull/22694)

## 7.1.0-alpha.23 (May 24, 2023)

#### Bug Fixes

- Core: Fix `managerHead` preset in `main.ts` [#22701](https://github.com/storybooks/storybook/pull/22701)

## 7.1.0-alpha.22 (May 24, 2023)

#### Bug Fixes

- Vite: Fix pnpm support by replacing @storybook/global with `window` [#22709](https://github.com/storybooks/storybook/pull/22709)

## 7.1.0-alpha.21 (May 23, 2023)

#### Features

- Webpack: Add option to use swc instead of babel [#22075](https://github.com/storybooks/storybook/pull/22075)

#### Bug Fixes

- UI: Fix `.mp3` support for builder-manager [#22699](https://github.com/storybooks/storybook/pull/22699)
- CLI: Fix support for BROWSER env var [#21473](https://github.com/storybooks/storybook/pull/21473)
- Vite: Fix missing @storybook/global dependency [#22700](https://github.com/storybooks/storybook/pull/22700)
- Next.js: Fix compatibility with Next 13.4.3 [#22697](https://github.com/storybooks/storybook/pull/22697)
- CLI: Fix error parsing on NPM proxy [#22690](https://github.com/storybooks/storybook/pull/22690)
- Core: Only connect to serverChannel in development mode [#22575](https://github.com/storybooks/storybook/pull/22575)
- CLI: Improve error handling when dealing with angular.json files [#22663](https://github.com/storybooks/storybook/pull/22663)
- CLI: Skip prompting for eslint plugin with --yes flag [#22651](https://github.com/storybooks/storybook/pull/22651)
- CLI: Fix upgrade to not upgrade nx packages [#22419](https://github.com/storybooks/storybook/pull/22419)
- CLI: Only handle CTRL + C on init event [#22687](https://github.com/storybooks/storybook/pull/22687)
- Angular: Remove console.log [#22671](https://github.com/storybooks/storybook/pull/22671)

## 7.1.0-alpha.20 (May 20, 2023)

#### Bug Fixes

- CLI: Account for windows paths when copying templates [#22644](https://github.com/storybooks/storybook/pull/22644)
- CLI: Fix pnpm init command [#22635](https://github.com/storybooks/storybook/pull/22635)
- UI: Add legacy font formats [#22576](https://github.com/storybooks/storybook/pull/22576)
- Webpack: Remove the alias for `global` [#22393](https://github.com/storybooks/storybook/pull/22393)

#### Maintenance

- CLI: Reduce installation noise and improve error handling [#22554](https://github.com/storybooks/storybook/pull/22554)
- Actions: Fix type of withActions [#22455](https://github.com/storybooks/storybook/pull/22455)

#### Build

- Build: add discord notification when generating sandboxes fails [#22638](https://github.com/storybooks/storybook/pull/22638)
- Build: set correct ref on sandboxes Github action [#22625](https://github.com/storybooks/storybook/pull/22625)
- Build: Fix sandbox generation scripts [#22620](https://github.com/storybooks/storybook/pull/22620)

## 7.1.0-alpha.19 (May 16, 2023)

#### Bug Fixes

- Normalize paths exposed to vite-builder's `storybook-stories.js` file [#22327](https://github.com/storybooks/storybook/pull/22327)

## 7.1.0-alpha.18 (May 15, 2023)

#### Bug Fixes

- CLI: Fix `getFrameworkPackage` logic [#22559](https://github.com/storybooks/storybook/pull/22559)
- CLI: Remove automigrate reference from init command [#22561](https://github.com/storybooks/storybook/pull/22561)

#### Maintenance

- CLI: Detach automigrate command from storybook init [#22523](https://github.com/storybooks/storybook/pull/22523)

## 7.1.0-alpha.17 (May 12, 2023)

#### Bug Fixes

- CLI: Fix storybook upgrade precheckfailure object [#22517](https://github.com/storybooks/storybook/pull/22517)
- CLI: Throw errors instead of rejecting promises [#22515](https://github.com/storybooks/storybook/pull/22515)
- CSF: Expose story id in composeStories [#22471](https://github.com/storybooks/storybook/pull/22471)
- CLI: Remove unsupported frameworks/renderers and improve builder detection [#22492](https://github.com/storybooks/storybook/pull/22492)

## 7.1.0-alpha.16 (May 11, 2023)

#### Bug Fixes

- Web-components: Fix source decorator to handle document fragments [#22513](https://github.com/storybooks/storybook/pull/22513)
- Angular: Adjust child process I/O for compodoc command [#22441](https://github.com/storybooks/storybook/pull/22441)
- Core: Fix windows path error in StoryStore v6 [#22512](https://github.com/storybooks/storybook/pull/22512)

#### Maintenance

- CLI: Prompt to force initialization when storybook is detected [#22392](https://github.com/storybooks/storybook/pull/22392)
- UI: Fix css inconsistency in Button and Icon components [#22497](https://github.com/storybooks/storybook/pull/22497)

#### Build

- Sandboxes: Pin @vitejs/plugin-react to avoid conflict [#22501](https://github.com/storybooks/storybook/pull/22501)

## 7.1.0-alpha.15 (May 11, 2023)

#### Bug Fixes

- CLI: Do not show a migration summary on sb init [#22109](https://github.com/storybooks/storybook/pull/22109)
- Toolbars: Fix title behavior in UI [#22496](https://github.com/storybooks/storybook/pull/22496)
- UI: Show current search shortcut in search box sidebar [#21619](https://github.com/storybooks/storybook/pull/21619)
- Measure: Deactivate when switching to Docs mode [#21602](https://github.com/storybooks/storybook/pull/21602)
- Outline: Fix additional outline border in docs mode [#21773](https://github.com/storybooks/storybook/pull/21773)

## 7.1.0-alpha.14 (May 9, 2023)

#### Bug Fixes

- CLI: Scope styles in sample components from the CLI templates [#22162](https://github.com/storybooks/storybook/pull/22162)
- CLI: Fix copyTemplate failures on `init` [#22375](https://github.com/storybooks/storybook/pull/22375)
- CLI: Fix server init [#22443](https://github.com/storybooks/storybook/pull/22443)
- Server: Add json indexer [#22460](https://github.com/storybooks/storybook/pull/22460)
- React: Use correct default annotations for composeStories [#22308](https://github.com/storybooks/storybook/pull/22308)
- UI: Fix opacity of list-item color [#22074](https://github.com/storybooks/storybook/pull/22074)

#### Maintenance

- CLI: Refactor package manager methods to be async [#22401](https://github.com/storybooks/storybook/pull/22401)
- Angular: Improve Error message for angular.json not found [#22377](https://github.com/storybooks/storybook/pull/22377)
- TypeScript: Migrate @storybook/instrumenter to strict TS [#22370](https://github.com/storybooks/storybook/pull/22370)
- TypeScript: Migrate @storybook/core-events to strict TS [#22448](https://github.com/storybooks/storybook/pull/22448)
- TypeScript: Migrate @storybook/core-client to strict TS [#22447](https://github.com/storybooks/storybook/pull/22447)
- TypeScript: Migrate @storybook/react-vite and @storybook/preact-vite to strict TS [#22428](https://github.com/storybooks/storybook/pull/22428)
- TypeScript: Migrate @storybook/svelte-vite to strict TS [#22411](https://github.com/storybooks/storybook/pull/22411)
- TypeScript: Migrate @storybook/types to strict TS [#22397](https://github.com/storybooks/storybook/pull/22397)
- TypeScript: Migrate @storybook/addon-storysource to strict TS [#22367](https://github.com/storybooks/storybook/pull/22367)
- TypeScript: Migrate @storybook/client-api to strict TS [#22421](https://github.com/storybooks/storybook/pull/22421)
- TypeScript: Migrate @storybook/sveltekit to strict TS [#22412](https://github.com/storybooks/storybook/pull/22412)
- TypeScript: Migrate @storybook/source-loader to strict TS [#22420](https://github.com/storybooks/storybook/pull/22420)

## 7.1.0-alpha.13 (May 5, 2023)

#### Bug Fixes

- Core: Fix virtual modules excluded for babel-loader [#22331](https://github.com/storybooks/storybook/pull/22331)

#### Maintenance

- Angular: Allow TypeScript 4.0.0 and 5.0.0 [#22391](https://github.com/storybooks/storybook/pull/22391)
- Angular: Enable Angular Unit tests [#22355](https://github.com/storybooks/storybook/pull/22355)
- TypeScript: Migrate @storybook/theming to strict TS [#22376](https://github.com/storybooks/storybook/pull/22376)
- TypeScript: Migrate @storybook/channel-websocket to strict TS [#22364](https://github.com/storybooks/storybook/pull/22364)
- TypeScript: Migrate @storybook/addon-outline to strict TS [#22369](https://github.com/storybooks/storybook/pull/22369)
- TypeScript: Migrate @storybook/addon-viewbook to strict ts [#22339](https://github.com/storybooks/storybook/pull/22339)
- TypeScript: Migrate @storybook/channels to strict TS [#22365](https://github.com/storybooks/storybook/pull/22365)

#### Build

- Add Angular Prerelease sandbox [#22379](https://github.com/storybooks/storybook/pull/22379)

## 7.1.0-alpha.12 (May 3, 2023)

#### Bug Fixes

- Migrate: skip the automigration for gf markdown when user isn't using mdx [#22186](https://github.com/storybooks/storybook/pull/22186)
- UI: Addon panel does not update after disabling/enabling an addon [#22258](https://github.com/storybooks/storybook/pull/22258)
- Typescript: Fix bad typings caused by tsup bug [#22261](https://github.com/storybooks/storybook/pull/22261)
- Core: Fix source snippets for stories with mapped args [#22135](https://github.com/storybooks/storybook/pull/22135)

#### Maintenance

- Telemetry: Persist sessionId across runs [#22325](https://github.com/storybooks/storybook/pull/22325)
- Packaging: Move `types` condition to the front in all `package.json.exports` maps [#22321](https://github.com/storybooks/storybook/pull/22321)
- Packaging: Don't generate ESM dist for preset files [#22330](https://github.com/storybooks/storybook/pull/22330)
- Typescript: Migrate `@storybook/csf-tools` to strict TS [#22312](https://github.com/storybooks/storybook/pull/22312)
- Typescript: Migrate @storybook/postinstall and @storybook/router to strict TS [#22200](https://github.com/storybooks/storybook/pull/22200)
- Maintenance: Fix urls for all packages in package.json [#22101](https://github.com/storybooks/storybook/pull/22101)
- Docs: Improve component typings [#22050](https://github.com/storybooks/storybook/pull/22050)

#### Build

- Build: Comment out flaky test [#22310](https://github.com/storybooks/storybook/pull/22310)
- Build: Migrate `@storybook/web-components-vite` to strict TS [#22309](https://github.com/storybooks/storybook/pull/22309)
- Build: Migrate `@storybook/html-vite` to strict TS [#22293](https://github.com/storybooks/storybook/pull/22293)
- Build: Migrate @storybook/preset-vue-webpack to strict TS [#22320](https://github.com/storybooks/storybook/pull/22320)
- Build: Use `next` branch for sandbox and repro commands [#22238](https://github.com/storybooks/storybook/pull/22238)

## 7.1.0-alpha.11 (April 28, 2023)

#### Features

- Feature: Add support for Angular 16 [#22096](https://github.com/storybooks/storybook/pull/22096)

#### Bug Fixes

- Vue3: Rollback v7 breaking change and keep reactive v6-compatible API [#22229](https://github.com/storybooks/storybook/pull/22229)

#### Maintenance

- Core: Add tests for mapping behaviour in #22169 [#22301](https://github.com/storybooks/storybook/pull/22301)

#### Dependency Upgrades

- Update glob to v10.0.0 [#22171](https://github.com/storybooks/storybook/pull/22171)

## 7.1.0-alpha.10 (April 28, 2023)

#### Bug Fixes

- Vue3: Fix compiler error when there is double tag [#22286](https://github.com/storybooks/storybook/pull/22286)
- Args: Fix multiple mapped args return array of labels [#22169](https://github.com/storybooks/storybook/pull/22169)
- Angular: Fix storyshots by removing deprecated import [#22134](https://github.com/storybooks/storybook/pull/22134)
- Ember: Fix wrong path [#22203](https://github.com/storybooks/storybook/pull/22203)
- CLI: Add web-components webpack5 to missing-babelrc automigration [#22202](https://github.com/storybooks/storybook/pull/22202)
- Docs: Fix inline story style [#21870](https://github.com/storybooks/storybook/pull/21870)

#### Build

- Fix vue-cli/default-js sandbox [#22259](https://github.com/storybooks/storybook/pull/22259)
- Core: Fix `DOCS_RENDERED` test [#22255](https://github.com/storybooks/storybook/pull/22255)
- Add regex to ignore outdated Browserslist in Jest initialization base file [#22260](https://github.com/storybooks/storybook/pull/22260)

## 7.1.0-alpha.9 (April 26, 2023)

#### Features

- NextJS: Allow disabling next/image lazy loading [#21909](https://github.com/storybooks/storybook/pull/21909)
- Core: Allow Flow syntax in stories [#21859](https://github.com/storybooks/storybook/pull/21859)

#### Bug Fixes

- Vue3: Support multiple setup functions [#22170](https://github.com/storybooks/storybook/pull/22170)
- UI: Fix shift + 7 shortcut to focus search field [#22073](https://github.com/storybooks/storybook/pull/22073)
- UI: Fix controls missing when navigating from story [#21967](https://github.com/storybooks/storybook/pull/21967)

#### Maintenance

- Core: Rename manager UI mjs to js [#22247](https://github.com/storybooks/storybook/pull/22247)
- Remove dead code [#22019](https://github.com/storybooks/storybook/pull/22019)
- Vue3: Move TS stories into a separate folder [#22235](https://github.com/storybooks/storybook/pull/22235)

#### Build

- Build: Migrate @storybook/addon-docs to strict-ts [#22180](https://github.com/storybooks/storybook/pull/22180)
- Build: Migrate @storybook/highlight to strict TS [#22181](https://github.com/storybooks/storybook/pull/22181)
- Build: Enable strict TS by default [#22143](https://github.com/storybooks/storybook/pull/22143)

## 7.1.0-alpha.8 (April 24, 2023)

#### Features

- Core: Support custom hosts using window.location server channel URL [#22055](https://github.com/storybooks/storybook/pull/22055)

#### Bug Fixes

- Addon-actions: Fix ESM by upgrading from uuid-browser to uuid [#22037](https://github.com/storybooks/storybook/pull/22037)
- Addon-actions: Fix decorator type [#22175](https://github.com/storybooks/storybook/pull/22175)
- NextJS: Fix tsconfig resolution [#22160](https://github.com/storybooks/storybook/pull/22160)
- Core: Pass parameters in `SET_INDEX` for docs entries [#22154](https://github.com/storybooks/storybook/pull/22154)

#### Maintenance

- CSF: Improve error message for bad default export [#22190](https://github.com/storybooks/storybook/pull/22190)
- CLI: Add addon query-params to list of SB7 incompatible addons [#22095](https://github.com/storybooks/storybook/pull/22095)

#### Build

- Build: Fix sandbox publish script [#22206](https://github.com/storybooks/storybook/pull/22206)
- Build: Fix lit sandboxes [#22201](https://github.com/storybooks/storybook/pull/22201)
- Vite sandboxes: use stable Vite 4.3 [#22183](https://github.com/storybooks/storybook/pull/22183)

## 7.1.0-alpha.7 (April 19, 2023)

#### Bug Fixes

- Vue3: Fix reactive decorators [#21954](https://github.com/storybooks/storybook/pull/21954)

#### Build

- Build: Improve sandboxes commit message [#22136](https://github.com/storybooks/storybook/pull/22136)

## 7.1.0-alpha.6 (April 18, 2023)

#### Bug Fixes

- Core: Restore Docs `useParameter` using `DOCS_PREPARED` [#22118](https://github.com/storybooks/storybook/pull/22118)
- Core: Add new tags to distinguish docs attachment [#22120](https://github.com/storybooks/storybook/pull/22120)
- Core: Fix `module` guard in non-webpack environments [#22085](https://github.com/storybooks/storybook/pull/22085)

#### Build

- Build: Skip docs pages e2e tests for ssv6 examples [#22141](https://github.com/storybooks/storybook/pull/22141)
- Build: Upgrade Playwright to 1.32.3 [#22087](https://github.com/storybooks/storybook/pull/22087)

#### Dependency Upgrades

- Remove unused babel dependencies [#21984](https://github.com/storybooks/storybook/pull/21984)

## 7.1.0-alpha.5 (April 17, 2023)

#### Maintenance

- CLI: Mark qwik as using addon-interactions [#22000](https://github.com/storybooks/storybook/pull/22000)

#### Build

- Revert "Build: Update dangerfile temporarily to check for patch label" [#22108](https://github.com/storybooks/storybook/pull/22108)

## 7.1.0-alpha.4 (April 15, 2023)

#### Bug Fixes

- Docs: Fix source snippets when parameters.docs.source.type = 'code' [#22048](https://github.com/storybooks/storybook/pull/22048)
- CLI: Mention how to setup a monorepo manually in babelrc automigration [#22052](https://github.com/storybooks/storybook/pull/22052)

## 7.1.0-alpha.3 (April 13, 2023)

#### Bug Fixes

- UI: Fix upgrade command in about page [#22056](https://github.com/storybooks/storybook/pull/22056)
- CLI: Fix sandbox command [#21977](https://github.com/storybooks/storybook/pull/21977)

## 7.1.0-alpha.2 (April 12, 2023)

#### Features

- UI: Add remount story shortcut [#21401](https://github.com/storybooks/storybook/pull/21401)

#### Bug Fixes

- CLI: Catch errors thrown on sanity check of SB installs [#22039](https://github.com/storybooks/storybook/pull/22039)

#### Maintenance

- Addon-docs: Remove mdx1-csf as optional peer dep [#22038](https://github.com/storybooks/storybook/pull/22038)
- Telemetry: Add CLI version to context [#21999](https://github.com/storybooks/storybook/pull/21999)

#### Build

- Build: Use vite@beta on sandboxes [#22030](https://github.com/storybooks/storybook/pull/22030)
- Fix e2e tests failing in Firefox [#22022](https://github.com/storybooks/storybook/pull/22022)
- Vite: Use vite 4.3 beta in sandboxes [#21986](https://github.com/storybooks/storybook/pull/21986)

## 7.1.0-alpha.1 (April 11, 2023)

#### Bug Fixes

- React: Fix default export docgen for React.FC and forwardRef [#22024](https://github.com/storybooks/storybook/pull/22024)
- Viewport: Remove transitions when switching viewports [#21963](https://github.com/storybooks/storybook/pull/21963)
- CLI: Fix JsPackageManager typo [#22006](https://github.com/storybooks/storybook/pull/22006)
- Viewport: Fix the `defaultOrientation` config option [#21962](https://github.com/storybooks/storybook/pull/21962)
- UI: Fix story data access for broken About page [#21951](https://github.com/storybooks/storybook/pull/21951)

#### Maintenance

- CLI: Update template code references to 7.0 [#21845](https://github.com/storybooks/storybook/pull/21845)

#### Dependency Upgrades

- React-vite: Fix perf regression by pinning vite-plugin-react-docgen-ts [#22013](https://github.com/storybooks/storybook/pull/22013)
- Use future version of satellite repo dependencies [#22026](https://github.com/storybooks/storybook/pull/22026)

## 7.1.0-alpha.0 (April 5, 2023)

#### Bug Fixes

- Angular: Fix components disappearing on docs page on property change [#21944](https://github.com/storybooks/storybook/pull/21944)
- React: Don't show decorators in JSX snippets [#21907](https://github.com/storybooks/storybook/pull/21907)
- Docs: Include decorators by default in source decorators [#21902](https://github.com/storybooks/storybook/pull/21902)
- CLI: Fix npm list command [#21947](https://github.com/storybooks/storybook/pull/21947)
- Core: Revert Emotion `:first-child` (etc) workarounds [#21213](https://github.com/storybooks/storybook/pull/21213)
- Addon-actions: Fix non-included type file [#21922](https://github.com/storybooks/storybook/pull/21922)
- Addon GFM: Fix node-logger dependency [#21938](https://github.com/storybooks/storybook/pull/21938)

#### Build

- Build: Update trigger circle ci workflow to include main [#21888](https://github.com/storybooks/storybook/pull/21888)
- Build: Update dangerfile temporarily to check for patch label [#21945](https://github.com/storybooks/storybook/pull/21945)
- Build: Re-enable Vue2 Vite sandbox [#21940](https://github.com/storybooks/storybook/pull/21940)
- Build: Fix release badge on repros [#21923](https://github.com/storybooks/storybook/pull/21923)
- Build: fix the workflows to generate sandboxes [#21912](https://github.com/storybooks/storybook/pull/21912)
- Build: bump the node version in CI [#21917](https://github.com/storybooks/storybook/pull/21917)
- Build: no `pnp.cjs` in the root, regen lockfiles [#21908](https://github.com/storybooks/storybook/pull/21908)
- Build: remove pnp sandbox template [#21913](https://github.com/storybooks/storybook/pull/21913)
- Build: make the CI config ready for 7.0 release [#21808](https://github.com/storybooks/storybook/pull/21808)

#### Dependency Upgrades

- Update `@emotion/cache` version [#21941](https://github.com/storybooks/storybook/pull/21941)
