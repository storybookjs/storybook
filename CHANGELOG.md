## 8.2.5

- CPC: Add the globals export for manager - [#28650](https://github.com/storybookjs/storybook/pull/28650), thanks @ndelangen!
- CPC: Correct path to the `@storybook/theming/create` alias - [#28643](https://github.com/storybookjs/storybook/pull/28643), thanks @Averethel!
- Components: Remove external overrides - [#28632](https://github.com/storybookjs/storybook/pull/28632), thanks @kasperpeulen!
- Core: Fix header for MountMustBeDestructuredError message - [#28590](https://github.com/storybookjs/storybook/pull/28590), thanks @0916dhkim!
- Onboarding: Fix code snippet when story name differs from export name - [#28649](https://github.com/storybookjs/storybook/pull/28649), thanks @ghengeveld!
- Telemetry: Add mount, beforeEach, moduleMock stats - [#28624](https://github.com/storybookjs/storybook/pull/28624), thanks @shilman!
- Telemetry: CSF feature usage - [#28622](https://github.com/storybookjs/storybook/pull/28622), thanks @shilman!

## 8.2.4

- CLI: Add diagnostic when the `storybook` package is missing - [#28604](https://github.com/storybookjs/storybook/pull/28604), thanks @kasperpeulen!
- CLI: Make a few automigrations run on all version upgrades - [#28601](https://github.com/storybookjs/storybook/pull/28601), thanks @yannbf!
- CPC: Direct dependencies on shim packages in renderers - [#28599](https://github.com/storybookjs/storybook/pull/28599), thanks @ndelangen!

## 8.2.3

- Bug: Fix invalid docs links in Configure.mdx template page - [#28560](https://github.com/storybookjs/storybook/pull/28560), thanks @kylegach!
- CLI: Add "missing-storybook-dependencies" automigration - [#28579](https://github.com/storybookjs/storybook/pull/28579), thanks @yannbf!
- CPC: Add `theming/create` aliases in docs preset - [#28570](https://github.com/storybookjs/storybook/pull/28570), thanks @ndelangen!
- CPC: Fix incorrect re-export in `core-events` - [#28573](https://github.com/storybookjs/storybook/pull/28573), thanks @ndelangen!
- CPC: Fix Vite builder had wrong conditions - [#28581](https://github.com/storybookjs/storybook/pull/28581), thanks @ndelangen!
- CSF: Fix small typing issue - [#28587](https://github.com/storybookjs/storybook/pull/28587), thanks @valentinpalkovic!
- Portable stories: Remove unused types - [#28548](https://github.com/storybookjs/storybook/pull/28548), thanks @kasperpeulen!
- Webpack: Fix sourceMap generation in csf-tools - [#28585](https://github.com/storybookjs/storybook/pull/28585), thanks @valentinpalkovic!

## 8.2.2

- CPC: Add `ESM` export to `docs-tools` & `node-logger` packages - [#28539](https://github.com/storybookjs/storybook/pull/28539), thanks @ndelangen!
- CPC: Fix missing dependency in `@storybook/addon-interactions` - [#28518](https://github.com/storybookjs/storybook/pull/28518), thanks @ndelangen!
- CPC: Revert renames of panels, addon_ids - [#28524](https://github.com/storybookjs/storybook/pull/28524), thanks @ndelangen!

## 8.2.1

- CPC: Fix type generation - [#28507](https://github.com/storybookjs/storybook/pull/28507), thanks @ndelangen!
- Types: Update type signatures of objects and functions - [#28503](https://github.com/storybookjs/storybook/pull/28503), thanks @valentinpalkovic!

## 8.2.0

Hold onto your hats! Storybook 8.2 has dropped, packed with a treasure trove of new features and bug fixes:

- 🪝 New test hook `beforeAll`
- 🕹️ Enhanced `play` function
- 📦 Portable stories that let you use your stories in other testing tools
- 🎁 Consolidated dependency to bring you better performance in a smaller package
- ✨ Brand new onboarding experience to get you up to speed quicker
- 💯 Hundreds more improvements

<details>
<summary>List of all updates</summary>

- Addon Controls: Fix saving on Windows - [#28485](https://github.com/storybookjs/storybook/pull/28485), thanks @ghengeveld!
- Addon Interactions: Use unique keys when rendering array nodes in panel - [#28423](https://github.com/storybookjs/storybook/pull/28423), thanks @yannbf!
- Addon Onboarding: Add icons for dev/test/doc to the splash screen - [#28389](https://github.com/storybookjs/storybook/pull/28389), thanks @ghengeveld!
- Addon Onboarding: New design and flow based on Save from Controls - [#28327](https://github.com/storybookjs/storybook/pull/28327), thanks @ghengeveld!
- Addon Onboarding: Trigger onboarding during init for Vue and Angular projects - [#28482](https://github.com/storybookjs/storybook/pull/28482), thanks @ghengeveld!
- Addon-A11y: Fix property default assignment - [#27224](https://github.com/storybookjs/storybook/pull/27224), thanks @valentinpalkovic!
- Angular: Allow format configuration of custom source preview - [#28305](https://github.com/storybookjs/storybook/pull/28305), thanks @64BitAsura!
- Angular: Allow outputPath object syntax - [#28144](https://github.com/storybookjs/storybook/pull/28144), thanks @valentinpalkovic!
- Angular: Cleanup types - [#27189](https://github.com/storybookjs/storybook/pull/27189), thanks @valentinpalkovic!
- Angular: Fix enableProdMode setting - [#28415](https://github.com/storybookjs/storybook/pull/28415), thanks @valentinpalkovic!
- Angular: Fix wrong detection of standalone components - [#27353](https://github.com/storybookjs/storybook/pull/27353), thanks @dario-baumberger!
- Angular: Introduce preserveSymlink builder option - [#28145](https://github.com/storybookjs/storybook/pull/28145), thanks @valentinpalkovic!
- Angular: Update outputPath default value in angular-cli-webpack.js - [#28418](https://github.com/storybookjs/storybook/pull/28418), thanks @valentinpalkovic!
- Babel: Ensure story files not transpiled earlier than ES2017 - [#28469](https://github.com/storybookjs/storybook/pull/28469), thanks @kasperpeulen!
- Blocks: Fix reference to storybook core - [#28422](https://github.com/storybookjs/storybook/pull/28422), thanks @yannbf!
- Blocks: Prebundle `tocbot` - [#28318](https://github.com/storybookjs/storybook/pull/28318), thanks @shilman!
- Build: Change require/import order, so that import has higher prio if both are specified - [#27730](https://github.com/storybookjs/storybook/pull/27730), thanks @kasperpeulen!
- Build: Ignore ts stories in cra/default-js sandbox - [#28354](https://github.com/storybookjs/storybook/pull/28354), thanks @valentinpalkovic!
- CLI: Add `--no-dev` option to `init` - [#26918](https://github.com/storybookjs/storybook/pull/26918), thanks @fastfrwrd!
- CLI: Add optional `--dev` and `--no-dev` options to `storybook init` CLI - [#26918](https://github.com/storybookjs/storybook/pull/26918), thanks @fastfrwrd!
- CLI: Add support for Nuxt to project init - [#26884](https://github.com/storybookjs/storybook/pull/26884), thanks @tobiasdiez!
- CLI: Fix CLI always asking all automigrations - [#28238](https://github.com/storybookjs/storybook/pull/28238), thanks @ndelangen!
- CLI: Improve error message when fetching CLI version - [#28289](https://github.com/storybookjs/storybook/pull/28289), thanks @yannbf!
- CLI: Include `@storybook/addon-svelte-csf` when initializing new projects - [#27070](https://github.com/storybookjs/storybook/pull/27070), thanks @benmccann!
- CLI: Prebundle get-npm-tarball-url and @ndelangen/get-tarball - [#28481](https://github.com/storybookjs/storybook/pull/28481), thanks @ndelangen!
- Config: Apply JavaScript-only story glob extensions for JavaScript projects - [#28338](https://github.com/storybookjs/storybook/pull/28338), thanks @valentinpalkovic!
- Controls: Fix date picker control validation and assignment - [#26695](https://github.com/storybookjs/storybook/pull/26695), thanks @leeovictor!
- Controls: Fix grouped Radio controls to have the same name - [#23374](https://github.com/storybookjs/storybook/pull/23374), thanks @srapilly!
- Controls: Throttling makes Color control lagging - [#22615](https://github.com/storybookjs/storybook/pull/22615), thanks @gitstart!
- Core: Add context as a property of the context (self-referencing) - [#28353](https://github.com/storybookjs/storybook/pull/28353), thanks @kasperpeulen!
- Core: Add support for `beforeAll` hook - [#28255](https://github.com/storybookjs/storybook/pull/28255), thanks @ghengeveld!
- Core: Fix startup hang caused by watchStorySpecifiers - [#27016](https://github.com/storybookjs/storybook/pull/27016), thanks @heyimalex!
- Core: Make sure StorybookError message shows up in browser console and interactions panel - [#28464](https://github.com/storybookjs/storybook/pull/28464), thanks @kasperpeulen!
- Core: Migrate from `pkg-dir` to `fd-package-json` - [#28270](https://github.com/storybookjs/storybook/pull/28270), thanks @43081j!
- Core: Refactor phases to run in order `loading` -> `rendering` -> `playing` - [#28431](https://github.com/storybookjs/storybook/pull/28431), thanks @kasperpeulen!
- Core: Remove more `.stories.mdx` handling - [#25973](https://github.com/storybookjs/storybook/pull/25973), thanks @JReinhold!
- Core: Remove util dependency - [#28191](https://github.com/storybookjs/storybook/pull/28191), thanks @43081j!
- CPC: Add `CJS` for `core/components` - [#28440](https://github.com/storybookjs/storybook/pull/28440), thanks @ndelangen!
- CPC: Core Package Consolidation - [#27039](https://github.com/storybookjs/storybook/pull/27039), thanks @ndelangen!
- CSF: Automatically extract componentPath - [#24396](https://github.com/storybookjs/storybook/pull/24396), thanks @shilman!
- CSF: Rename `preview.js` `globals` to `initialGlobals` - [#27517](https://github.com/storybookjs/storybook/pull/27517), thanks @shilman!
- Dependencies: Allow esbuild version 0.21.x - [#28245](https://github.com/storybookjs/storybook/pull/28245), thanks @edoardocavazza!
- Dependency: bump `markdown-to-jsx` to v7.4.5 - [#26694](https://github.com/storybookjs/storybook/pull/26694), thanks @xyy94813!
- Dependency: Bump Express.js - [#26680](https://github.com/storybookjs/storybook/pull/26680), thanks @valentinpalkovic!
- Dependency: Remove node-fetch - [#28160](https://github.com/storybookjs/storybook/pull/28160), thanks @yk-kd!
- Dependency: Upgrade `webpack-virtual-modules` to 0.6.0 - [#27102](https://github.com/storybookjs/storybook/pull/27102), thanks @fyodorovandrei!
- Deps: Migrate from `read-pkg-up` to `fd-package-json` - [#28272](https://github.com/storybookjs/storybook/pull/28272), thanks @43081j!
- Docs-tools: Replace `doctrine` with `jsdoc-type-pratt-parser` - [#26305](https://github.com/storybookjs/storybook/pull/26305), thanks @43081j!
- Docs: Filter mount stories from `Stories` block, error when referenced in MDX - [#28434](https://github.com/storybookjs/storybook/pull/28434), thanks @kasperpeulen!
- Docs: Fix `Typeset` Doc block `fontSizes` type - [#26475](https://github.com/storybookjs/storybook/pull/26475), thanks @noranda!
- Index: Fix MDX to override project-level autodocs - [#28461](https://github.com/storybookjs/storybook/pull/28461), thanks @shilman!
- Indexer: Improve locating stories with specials chars in path - [#22110](https://github.com/storybookjs/storybook/pull/22110), thanks @jankoritak!
- Next: Set default targets for next babel config - [#28443](https://github.com/storybookjs/storybook/pull/28443), thanks @kasperpeulen!
- Next.js: Set `env.bugfixes` in SWC so destructuring is never transpiled - [#28363](https://github.com/storybookjs/storybook/pull/28363), thanks @kasperpeulen!
- React: Export ButtonProps and HeaderProps in CLI templates - [#28487](https://github.com/storybookjs/storybook/pull/28487), thanks @valentinpalkovic!
- SWC: Set default targets for swc that align with our esbuild targets - [#28435](https://github.com/storybookjs/storybook/pull/28435), thanks @kasperpeulen!
- Telemetry: Stop prompting about crash reports in CI - [#28433](https://github.com/storybookjs/storybook/pull/28433), thanks @yannbf!
- Test: Add args to `mount` in react, svelte, and vue renderers - [#28385](https://github.com/storybookjs/storybook/pull/28385), thanks @kasperpeulen!
- Test: Add mount property to the story context - [#28383](https://github.com/storybookjs/storybook/pull/28383), thanks @kasperpeulen!
- Test: Enhance the context with canvas when the test package is used - [#28368](https://github.com/storybookjs/storybook/pull/28368), thanks @kasperpeulen!
- Test: Improve MountMustBeDestructuredError error message - [#28468](https://github.com/storybookjs/storybook/pull/28468), thanks @kasperpeulen!
- Test: Reactive spies preserve the this instance - [#28445](https://github.com/storybookjs/storybook/pull/28445), thanks @kasperpeulen!
- Types: Fix type implementation for `CompatibleString` - [#27180](https://github.com/storybookjs/storybook/pull/27180), thanks @sni-J!
- Vite: Fix asset warning by externalizing sb-common-assets font - [#27110](https://github.com/storybookjs/storybook/pull/27110), thanks @valentinpalkovic!
- Vue3: Enable new hydration mismatch compile time flag - [#27192](https://github.com/storybookjs/storybook/pull/27192), thanks @Cherry!
- Webpack5/Vite: Fix sourcemaps - [#27171](https://github.com/storybookjs/storybook/pull/27171), thanks @valentinpalkovic!

</details>

## 8.1.11

- Telemetry: Detect Node version - [#28299](https://github.com/storybookjs/storybook/pull/28299), thanks @yannbf!
- Test: Upgrade deps of @storybook/test - [#27862](https://github.com/storybookjs/storybook/pull/27862), thanks @kasperpeulen!

## 8.1.10

- Addon-interactions: Fix deprecation warnings - [#28250](https://github.com/storybookjs/storybook/pull/28250), thanks @shilman!
- Test: Upgrade deps of @storybook/test - [#27862](https://github.com/storybookjs/storybook/pull/27862), thanks @kasperpeulen!

## 8.1.9

- Addon-a11y: Workaround for Vite 5.3.0 compat - [#28241](https://github.com/storybookjs/storybook/pull/28241), thanks @shilman!
- CLI: Add `--no-dev` option to `init` - [#26918](https://github.com/storybookjs/storybook/pull/26918), thanks @fastfrwrd!
- CLI: Fix `init --skip-install` - [#28226](https://github.com/storybookjs/storybook/pull/28226), thanks @shilman!

## 8.1.8

- Automigrations: Make VTA "learn more" link clickable - [#28020](https://github.com/storybookjs/storybook/pull/28020), thanks @deiga!
- CLI: Fix `init --skip-install` - [#28226](https://github.com/storybookjs/storybook/pull/28226), thanks @shilman!

## 8.1.7

- Addon-actions: Only log spies with names - [#28091](https://github.com/storybookjs/storybook/pull/28091), thanks @kasperpeulen!
- CLI: Fix typo in React Docgen migration - [#27536](https://github.com/storybookjs/storybook/pull/27536), thanks @jonniebigodes!
- Portable Stories: Add tags to composed story - [#27708](https://github.com/storybookjs/storybook/pull/27708), thanks @yannbf!
- Test: Display toHaveBeenCalledWith expected / received values on failure - [#28088](https://github.com/storybookjs/storybook/pull/28088), thanks @kasperpeulen!

## 8.1.6

- CLI: Only log the UpgradeStorybookToSameVersionError but continue the upgrade as normal - [#27217](https://github.com/storybookjs/storybook/pull/27217), thanks @kasperpeulen!
- Core: Replace ip function with a small helper function to address security concerns - [#27529](https://github.com/storybookjs/storybook/pull/27529), thanks @tony19!
- Tags: Fix unsafe project-level tags lookup - [#27511](https://github.com/storybookjs/storybook/pull/27511), thanks @shilman!
- Vite: Fix stats-plugin to normalize file names with posix paths - [#27218](https://github.com/storybookjs/storybook/pull/27218), thanks @AlexAtVista!

## 8.1.5

- CSF-Tools: Fix export specifier bug - [#27418](https://github.com/storybookjs/storybook/pull/27418), thanks @valentinpalkovic!
- Dependency: Upgrade tempy - [#27366](https://github.com/storybookjs/storybook/pull/27366), thanks @mnigh!
- Tags: Refine composition behavior - [#27379](https://github.com/storybookjs/storybook/pull/27379), thanks @shilman!
- Theming: Fix self-referencing type - [#27155](https://github.com/storybookjs/storybook/pull/27155), thanks @SimenB!

## 8.1.4

- Angular: Revert style adjustments - [#27361](https://github.com/storybookjs/storybook/pull/27361), thanks @valentinpalkovic!
- Svelte: Support latest prerelease - [#27378](https://github.com/storybookjs/storybook/pull/27378), thanks @valentinpalkovic!
- Tags: Fix composition with older storybooks - [#27358](https://github.com/storybookjs/storybook/pull/27358), thanks @shilman!
- Vite: Fix HMR issue for Storybook preview files - [#27256](https://github.com/storybookjs/storybook/pull/27256), thanks @valentinpalkovic!

## 8.1.3

- Angular: Support v18 - [#27237](https://github.com/storybookjs/storybook/pull/27237), thanks @valentinpalkovic!
- Telemetry: Add test packages - [#27226](https://github.com/storybookjs/storybook/pull/27226), thanks @shilman!

## 8.1.2

- Angular: Fix filtering of workspace config styles - [#27108](https://github.com/storybookjs/storybook/pull/27108), thanks @valentinpalkovic!
- Next.js: Avoid interfering with the svgr loader - [#27198](https://github.com/storybookjs/storybook/pull/27198), thanks @seanparmelee!

## 8.1.1

- Docgen: Only add react-docgen info when a component is defined in the file - [#26967](https://github.com/storybookjs/storybook/pull/26967), thanks @glenjamin!
- Docs: Fix MDX Stories block tag-filtering behavior - [#27144](https://github.com/storybookjs/storybook/pull/27144), thanks @shilman!
- Docs: Fix Subtitle block when no `of` prop passed - [#27147](https://github.com/storybookjs/storybook/pull/27147), thanks @JReinhold!
- Next.js: Add typing for NextImage to main framework options type - [#27105](https://github.com/storybookjs/storybook/pull/27105), thanks @valentinpalkovic!
- Next.js: Avoid conflicts with the raw loader - [#27093](https://github.com/storybookjs/storybook/pull/27093), thanks @seanparmelee!
- Types: Fix typing for main.framework/builder fields - [#27088](https://github.com/storybookjs/storybook/pull/27088), thanks @valentinpalkovic!

## 8.1.0

Storybook 8.1 is here with a tone of new features and bug fixes:

- 🏷️ Static tag-based filtering
- 🦺 Type-safe, standards-based module mocking
- 🐣 New `beforeEach` test hook
- 🧳 Portable Stories API for Playwright Component Testing
- 🐕‍🦺 Support the new signal-based input & output functions in Angular
- 2️⃣ Two new ways to create stories: generating them from story controls or from your components directly!

<details>
<summary>List of all updates</summary>

- Addon-actions: Fix falsy args printing as object - 22163 - [#26917](https://github.com/storybookjs/storybook/pull/26917), thanks @Fatcat560!
- Addon-docs: Fix MDX compilation with `@vitejs/plugin-react-swc` and plugins - [#26837](https://github.com/storybookjs/storybook/pull/26837), thanks @JReinhold!
- Addon-docs: Fix `providerImportSource` extension - [#26868](https://github.com/storybookjs/storybook/pull/26868), thanks @bashmish!
- Addon-docs: Fix `react-dom/server` imports breaking stories and docs - [#26557](https://github.com/storybookjs/storybook/pull/26557), thanks @JReinhold!
- Addon-docs: Support Stencil based display names in source snippets - [#26592](https://github.com/storybookjs/storybook/pull/26592), thanks @yannbf!
- Addon-docs: Fix `[Object object]` displayName in some JSX components - [#26566](https://github.com/storybookjs/storybook/pull/26566), thanks @yannbf!
- Angular: Add type support for Angular\'s input signals - [#26413](https://github.com/storybookjs/storybook/pull/26413), thanks @valentinpalkovic!
- Angular: Add type support for Angular\'s output signals - [#26546](https://github.com/storybookjs/storybook/pull/26546), thanks @valentinpalkovic!
- API: Add API access to sidebar renderLabel - [#27099](https://github.com/storybookjs/storybook/pull/27099), thanks @shilman!
- Args: Add possibility to mark controls as read-only - [#26577](https://github.com/storybookjs/storybook/pull/26577), thanks @valentinpalkovic!
- Automigrations: Fix name of VTA addon - [#26816](https://github.com/storybookjs/storybook/pull/26816), thanks @valentinpalkovic!
- Automigrations: Add migration note about new react-docgen default - [#26620](https://github.com/storybookjs/storybook/pull/26620), thanks @valentinpalkovic!
- Automigrations: Fix missing support for mts vite config - [#26441](https://github.com/storybookjs/storybook/pull/26441), thanks @drik98!
- Automigrations: Improve react-docgen automigration prompt - [#27106](https://github.com/storybookjs/storybook/pull/27106), thanks @valentinpalkovic!
- Blocks: Add `of` prop to `Subtitle` - [#22552](https://github.com/storybookjs/storybook/pull/22552), thanks @joaonunomota!
- Blocks: Add `of` prop to `Title` - [#23728](https://github.com/storybookjs/storybook/pull/23728), thanks @Sidnioulz!
- CLI: Add --config-dir flag to add command - [#26771](https://github.com/storybookjs/storybook/pull/26771), thanks @eric-blue!
- CLI: Add --config-dir flag to migrate command - [#26721](https://github.com/storybookjs/storybook/pull/26721), thanks @yannbf!
- CLI: Add main.js `docs.autodocs` automigration - [#27089](https://github.com/storybookjs/storybook/pull/27089), thanks @shilman!
- CLI: Add Visual Tests addon install auto-migration when upgrading to 8.0.x - [#26766](https://github.com/storybookjs/storybook/pull/26766), thanks @ndelangen!
- CLI: Automigrate improve upgrade storybook related packages - [#26497](https://github.com/storybookjs/storybook/pull/26497), thanks @ndelangen!
- CLI: Automigrations copy edits - [#26342](https://github.com/storybookjs/storybook/pull/26342), thanks @joevaugh4n!
- CLI: Fix eslint configuration for string `extends` - [#27097](https://github.com/storybookjs/storybook/pull/27097), thanks @shilman!
- CLI: Improve Yarn berry error parsing - [#26616](https://github.com/storybookjs/storybook/pull/26616), thanks @yannbf!
- CLI: Improve `vite-config-file.ts` - [#26375](https://github.com/storybookjs/storybook/pull/26375), thanks @joevaugh4n!
- CLI: Instruct the correct auto-migration command - [#26515](https://github.com/storybookjs/storybook/pull/26515), thanks @ndelangen!
- CLI: Introduce package manager fallback for initializing Storybook in an empty directory with yarn1 - [#26500](https://github.com/storybookjs/storybook/pull/26500), thanks @valentinpalkovic!
- CLI: Throw an error when running upgrade command in incorrect cwd - [#26585](https://github.com/storybookjs/storybook/pull/26585), thanks @yannbf!
- Codemods: Escape filename given as argument - [#26430](https://github.com/storybookjs/storybook/pull/26430), thanks @YukiKitagata!
- Controls: Add Channels API to search for files in the project root - [#26726](https://github.com/storybookjs/storybook/pull/26726), thanks @valentinpalkovic!
- Controls: Added server channel to create a new story - [#26769](https://github.com/storybookjs/storybook/pull/26769), thanks @valentinpalkovic!
- Controls: Add UI to create new story files - [#26875](https://github.com/storybookjs/storybook/pull/26875), thanks @valentinpalkovic!
- Controls: Fix crashing when docgen extraction partially fails - [#26862](https://github.com/storybookjs/storybook/pull/26862), thanks @yannbf!
- Controls: Fix disable condition in ArgControl component - [#26567](https://github.com/storybookjs/storybook/pull/26567), thanks @valentinpalkovic!
- Controls: Fix number controls do not reset - [#26372](https://github.com/storybookjs/storybook/pull/26372), thanks @jiyiru!
- Core: Add `duration` and `onClick` support to Notification API and improve Notification UI - [#26696](https://github.com/storybookjs/storybook/pull/26696), thanks @ghengeveld!
- Core: Drop unneeded `UPDATE_STORY_ARGS` which was for SSv6 - [#25993](https://github.com/storybookjs/storybook/pull/25993), thanks @tmeasday!
- Core: Ensure that simultaneous onStoriesChanged don\'t clobber each other - [#26882](https://github.com/storybookjs/storybook/pull/26882), thanks @tmeasday!
- Core: Fix filters not being applied in WebKit - [#26949](https://github.com/storybookjs/storybook/pull/26949), thanks @JReinhold!
- Core: Fix preloading too early - [#26442](https://github.com/storybookjs/storybook/pull/26442), thanks @ndelangen!
- Core: Implement file formatter - [#26809](https://github.com/storybookjs/storybook/pull/26809), thanks @valentinpalkovic!
- Core: Optimize clearNotification - [#26415](https://github.com/storybookjs/storybook/pull/26415), thanks @ndelangen!
- Core: Save from controls - [#26827](https://github.com/storybookjs/storybook/pull/26827), thanks @ndelangen!
- CSF: Allow default export without title or component attributes - [#26516](https://github.com/storybookjs/storybook/pull/26516), thanks @kasperpeulen!
- CSF: Fix typings for control and other properties of argTypes - [#26824](https://github.com/storybookjs/storybook/pull/26824), thanks @kasperpeulen!
- CSF: Make sure loaders/decorators can be used as array - [#26514](https://github.com/storybookjs/storybook/pull/26514), thanks @kasperpeulen!
- Dependencies: Upgrade @storybook/csf to 0.1.5 - [#26958](https://github.com/storybookjs/storybook/pull/26958), thanks @Cherry!
- Dependencies: Upgrade `@joshwooding/vite-plugin-react-docgen-typescript` to `0.3.1` - [#26673](https://github.com/storybookjs/storybook/pull/26673), thanks @joshwooding!
- Dependencies: Upgrade `ejs` to `3.1.10` - [#27054](https://github.com/storybookjs/storybook/pull/27054), thanks @RiuSalvi!
- Dependencies: Bump es-module-lexer - [#26737](https://github.com/storybookjs/storybook/pull/26737), thanks @valentinpalkovic!
- Dependencies: Update globby dependency - [#26733](https://github.com/storybookjs/storybook/pull/26733), thanks @valentinpalkovic!
- Dependencies: Update postcss-loader in Next.js framework - [#26707](https://github.com/storybookjs/storybook/pull/26707), thanks @valentinpalkovic!
- Doc Tools: Signature Type Error Handling - [#26774](https://github.com/storybookjs/storybook/pull/26774), thanks @ethriel3695!
- Indexer: Escape special characters in storyImport regex - [#22545](https://github.com/storybookjs/storybook/pull/22545), thanks @VojGin!
- Maintenance: Fix performance regressions - [#26411](https://github.com/storybookjs/storybook/pull/26411), thanks @kasperpeulen!
- MDX: Do not transform `http://` links - [#26488](https://github.com/storybookjs/storybook/pull/26488), thanks @JReinhold!
- Next.js: Fix Compatibility with <v14.0.4 - [#27082](https://github.com/storybookjs/storybook/pull/27082), thanks @JReinhold!
- Next.js: Fix next/font usage on Windows machines - [#26700](https://github.com/storybookjs/storybook/pull/26700), thanks @valentinpalkovic!
- Next.js: Move sharp into optional deps - [#26787](https://github.com/storybookjs/storybook/pull/26787), thanks @shuta13!
- Next.js: Support v14.2 useParams functionality - [#26874](https://github.com/storybookjs/storybook/pull/26874), thanks @yannbf!
- Next.js: Implement next redirect and the RedirectBoundary - [#27050](https://github.com/storybookjs/storybook/pull/27050), thanks @yannbf!
- Next.js: Support path aliases when no base url is set - [#26651](https://github.com/storybookjs/storybook/pull/26651), thanks @yannbf!
- Node: Safe use of `document` for preview - [#24248](https://github.com/storybookjs/storybook/pull/24248), thanks @DylanPiercey!
- Onboarding: Improve UI - [#27074](https://github.com/storybookjs/storybook/pull/27074), thanks @ndelangen!
- Portable stories: Introduce experimental Playwright CT API and Support for more renderers - [#26063](https://github.com/storybookjs/storybook/pull/26063), thanks @yannbf!
- Portable stories: Make setProjectAnnotations accept multiple types of imports - [#26316](https://github.com/storybookjs/storybook/pull/26316), thanks @yannbf!
- Portable Stories: Remove link to missing docs - [#27075](https://github.com/storybookjs/storybook/pull/27075), thanks @JReinhold!
- Portable Stories: Warn when rendering stories without cleaning up first - [#27008](https://github.com/storybookjs/storybook/pull/27008), thanks @JReinhold!
- React-Docgen: Make sure to be able to handle empty unions - [#26639](https://github.com/storybookjs/storybook/pull/26639), thanks @kasperpeulen!
- React: Support v19 betas in peer dependencies - [#26960](https://github.com/storybookjs/storybook/pull/26960), thanks @JReinhold!
- React: Support v19 in `react-dom-shim` - [#26898](https://github.com/storybookjs/storybook/pull/26898), thanks @Tobbe!
- Tags: Add project tags, negation, `dev`/`autodocs`/`test` system tags - [#26634](https://github.com/storybookjs/storybook/pull/26634), thanks @shilman!
- Tags: Fix missing default tags if no `preview.js` - [#27098](https://github.com/storybookjs/storybook/pull/27098), thanks @shilman!
- Test: Add @storybook/test as dev dependency - [#26458](https://github.com/storybookjs/storybook/pull/26458), thanks @arnabsen!
- Test: Make spies reactive so that they can be logged by addon-actions - [#26740](https://github.com/storybookjs/storybook/pull/26740), thanks @kasperpeulen!
- Test: Remove chai as dependency of @storybook/test - [#26852](https://github.com/storybookjs/storybook/pull/26852), thanks @kasperpeulen!
- Test: Support module mocking with conditional subpath imports in `package.json` - [#26688](https://github.com/storybookjs/storybook/pull/26688), thanks @kasperpeulen!
- Theming: Update emotion dependencies - [#26623](https://github.com/storybookjs/storybook/pull/26623), thanks @SimenB!
- Typescript: Add types for `experimental-playwright` entries without `type:bundler` - [#27107](https://github.com/storybookjs/storybook/pull/27107), thanks @ndelangen!
- UI: Add key property to list children in Highlight component - [#26471](https://github.com/storybookjs/storybook/pull/26471), thanks @valentinpalkovic!
- UI: Fix not re-rendering tabs on state change - [#26899](https://github.com/storybookjs/storybook/pull/26899), thanks @lifeiscontent!
- UI: Fix panel layout resizing do not apply when done too fast - [#26460](https://github.com/storybookjs/storybook/pull/26460), thanks @jorge-ji!
- UI: Fix search result color contrast - [#26287](https://github.com/storybookjs/storybook/pull/26287), thanks @winchesHe!
- UI: Fix sidebar search hanging when selecting a story in touch mode - [#26807](https://github.com/storybookjs/storybook/pull/26807), thanks @JReinhold!
- UI: Fix theming of elements inside bars - [#26527](https://github.com/storybookjs/storybook/pull/26527), thanks @valentinpalkovic!
- UI: Improve empty state of addon panel - [#26481](https://github.com/storybookjs/storybook/pull/26481), thanks @yannbf!
- UI: Replace the icon prop in the Manager API - [#26477](https://github.com/storybookjs/storybook/pull/26477), thanks @cdedreuille!
- Viewport: Fix missing style - [#26530](https://github.com/storybookjs/storybook/pull/26530), thanks @jpzwarte!
- Vite: Merge assetsInclude property with Storybook default values - [#26860](https://github.com/storybookjs/storybook/pull/26860), thanks @yuemori!
- Vue: Disable controls for events, slots, and expose - [#26751](https://github.com/storybookjs/storybook/pull/26751), thanks @shilman!
- Webpack: Bump webpack-dev-middleware to patch high security issue - [#26655](https://github.com/storybookjs/storybook/pull/26655), thanks @jwilliams-met!
- Webpack: Fix sourcemap generation in webpack react-docgen-loader - [#26676](https://github.com/storybookjs/storybook/pull/26676), thanks @valentinpalkovic!
- Webpack: Hide runtime errors - [#23175](https://github.com/storybookjs/storybook/pull/23175), thanks @donaldpipowitch!
</details>

## 8.0.10

- MDX: Don't transform `http://` links - [#26488](https://github.com/storybookjs/storybook/pull/26488), thanks @JReinhold!
- React: Support v19 in `react-dom-shim` - [#26898](https://github.com/storybookjs/storybook/pull/26898), thanks @Tobbe!
- Vite: Merge assetsInclude property with Storybook default values - [#26860](https://github.com/storybookjs/storybook/pull/26860), thanks @yuemori!

## 8.0.9

- Addon-docs: Fix MDX compilation when using `@vitejs/plugin-react-swc` with plugins - [#26837](https://github.com/storybookjs/storybook/pull/26837), thanks @JReinhold!
- CSF: Fix typings for control and other properties of argTypes - [#26824](https://github.com/storybookjs/storybook/pull/26824), thanks @kasperpeulen!
- Controls: Fix crashing when docgen extraction partially fails - [#26862](https://github.com/storybookjs/storybook/pull/26862), thanks @yannbf!
- Doc Tools: Signature Type Error Handling - [#26774](https://github.com/storybookjs/storybook/pull/26774), thanks @ethriel3695!
- Next.js: Move sharp into optional deps - [#26787](https://github.com/storybookjs/storybook/pull/26787), thanks @shuta13!
- Nextjs: Support next 14.2 useParams functionality - [#26874](https://github.com/storybookjs/storybook/pull/26874), thanks @yannbf!
- Test: Remove chai as dependency of @storybook/test - [#26852](https://github.com/storybookjs/storybook/pull/26852), thanks @kasperpeulen!
- UI: Fix sidebar search hanging when selecting a story in touch mode - [#26807](https://github.com/storybookjs/storybook/pull/26807), thanks @JReinhold!

## 8.0.8

- Automigration: Fix name of VTA addon - [#26816](https://github.com/storybookjs/storybook/pull/26816), thanks @valentinpalkovic!

## 8.0.7

- CLI: Add Visual Tests addon install auto-migration when upgrading to 8.0.x - [#26766](https://github.com/storybookjs/storybook/pull/26766), thanks @ndelangen!
- Next.js: Move sharp into optional deps - [#26787](https://github.com/storybookjs/storybook/pull/26787), thanks @shuta13!
- Vue: Disable controls for events, slots, and expose - [#26751](https://github.com/storybookjs/storybook/pull/26751), thanks @shilman!
- Webpack: Bump webpack-dev-middleware to patch high security issue - [#26655](https://github.com/storybookjs/storybook/pull/26655), thanks @jwilliams-met!

## 8.0.6

- CLI: Add --config-dir flag to migrate command - [#26721](https://github.com/storybookjs/storybook/pull/26721), thanks @yannbf!
- Next.js: Fix next/font usage on Windows machines - [#26700](https://github.com/storybookjs/storybook/pull/26700), thanks @valentinpalkovic!
- Next.js: Support path aliases when no base url is set - [#26651](https://github.com/storybookjs/storybook/pull/26651), thanks @yannbf!
- Webpack: Fix sourcemap generation in webpack react-docgen-loader - [#26676](https://github.com/storybookjs/storybook/pull/26676), thanks @valentinpalkovic!

## 8.0.5

- Addon-docs: Fix `react-dom/server` imports breaking stories and docs - [#26557](https://github.com/storybookjs/storybook/pull/26557), thanks @JReinhold!
- Automigrations: Fix missing support for mts vite config - [#26441](https://github.com/storybookjs/storybook/pull/26441), thanks @drik98!
- CLI: Improve Yarn berry error parsing - [#26616](https://github.com/storybookjs/storybook/pull/26616), thanks @yannbf!
- React-Docgen: Make sure to be able to handle empty unions - [#26639](https://github.com/storybookjs/storybook/pull/26639), thanks @kasperpeulen!
- Viewport: Fix missing style - [#26530](https://github.com/storybookjs/storybook/pull/26530), thanks @jpzwarte!

## 8.0.4

- Addon Docs: Support Stencil based display names in source snippets - [#26592](https://github.com/storybookjs/storybook/pull/26592), thanks @yannbf!
- CLI: Instruct the correct auto-migration command - [#26515](https://github.com/storybookjs/storybook/pull/26515), thanks @ndelangen!
- CLI: Throw an error when running upgrade command in incorrect cwd - [#26585](https://github.com/storybookjs/storybook/pull/26585), thanks @yannbf!

## 8.0.3

- Bug: Remove redundant component check, as we auto-generate titles from the file system - [#26516](https://github.com/storybookjs/storybook/pull/26516), thanks @kasperpeulen!
- UI: Replace the icon prop in the Manager API - [#26477](https://github.com/storybookjs/storybook/pull/26477), thanks @cdedreuille!

## 8.0.2

- Addon Docs: Fix [Object object] displayName in some JSX components - [#26566](https://github.com/storybookjs/storybook/pull/26566), thanks @yannbf!
- CLI: Add yarn1 package manager fallback for init in empty directory - [#26500](https://github.com/storybookjs/storybook/pull/26500), thanks @valentinpalkovic!
- CSF: Make sure loaders/decorators can be used as array - [#26514](https://github.com/storybookjs/storybook/pull/26514), thanks @kasperpeulen!
- Controls: Fix disable condition in ArgControl component - [#26567](https://github.com/storybookjs/storybook/pull/26567), thanks @valentinpalkovic!
- UI: Add key property to list children in Highlight component - [#26471](https://github.com/storybookjs/storybook/pull/26471), thanks @valentinpalkovic!
- UI: Fix theming of elements inside bars - [#26527](https://github.com/storybookjs/storybook/pull/26527), thanks @valentinpalkovic!
- UI: Improve empty state of addon panel - [#26481](https://github.com/storybookjs/storybook/pull/26481), thanks @yannbf!

## 8.0.1

- Controls: Fix type summary when table.type unset - [#26283](https://github.com/storybookjs/storybook/pull/26283), thanks @shilman!
- Core: Fix addon bundling script - [#26145](https://github.com/storybookjs/storybook/pull/26145), thanks @ndelangen!
- Core: Fix fail to load `main.ts` error message - [#26035](https://github.com/storybookjs/storybook/pull/26035), thanks @ndelangen!
- Maintenance: Fix performance regressions - [#26411](https://github.com/storybookjs/storybook/pull/26411), thanks @kasperpeulen!

## 8.0.0

#### Storybook 8.0 is here

It brings major improvements to Storybook's feature set for testing and documentation, with strengthened framework support across React, Vue, Angular, web-components, Svelte, and more.

- 🩻 Built-in visual testing
- ⚛️ React Server Component support
- 🎛️ Improved controls for React and Vue projects
- ⚡️ Improved Vite architecture, Vitest testing, and Vite 5 support
- 🧪 2-4x faster Storybooks for testing
- ✨ Refreshed desktop UI
- 📲 Rebuilt mobile UX
- 🙅‍♀️ No more React requirement in non-React projects

Please checkout our [Migration Guide](https://storybook.js.org/docs/8.0/migration-guide) to upgrade from earlier versions of Storybook. To see a comprehensive list of changes that went into 8.0, you can refer to the [8.0 prerelease changelogs](https://github.com/storybookjs/storybook/blob/next/CHANGELOG.prerelease.md).

## 7.6.17

- Addon-docs: Fix Table of Contents heading leak - [#23677](https://github.com/storybookjs/storybook/pull/23677), thanks [@vmizg](https://github.com/vmizg)!
- Core: Update ip version to fix CVE-2023-42282 - [#26086](https://github.com/storybookjs/storybook/pull/26086), thanks [@drik98](https://github.com/drik98)!

## 7.6.16

- Addon Themes: Make type generic less strict - [#26042](https://github.com/storybookjs/storybook/pull/26042), thanks [@yannbf](https://github.com/yannbf)!
- Interaction: Make sure that adding spies doesn't cause infinite loops with self referencing args [#26019](https://github.com/storybookjs/storybook/pull/26019), thanks @kasperpeulen!

## 7.6.15

This release accidentally didn't contain anything.

## 7.6.14

- Core: Fix boolean `true` args in URL getting ignored - [#25950](https://github.com/storybookjs/storybook/pull/25950), thanks [@JReinhold](https://github.com/JReinhold)!

## 7.6.13

- Next.js: Fix frameworkOptions resolution - [#25907](https://github.com/storybookjs/storybook/pull/25907), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- React Native: Fix init fails when package is already installed - [#25908](https://github.com/storybookjs/storybook/pull/25908), thanks [@dannyhw](https://github.com/dannyhw)!
- React Native: Remove watcher from init - [#25895](https://github.com/storybookjs/storybook/pull/25895), thanks [@dannyhw](https://github.com/dannyhw)!
- Webpack: Update StorybookConfig import in core-webpack types.ts - [#25740](https://github.com/storybookjs/storybook/pull/25740), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.6.12

- CLI: Fix `upgrade` detecting the wrong version of existing Storybooks - [#25752](https://github.com/storybookjs/storybook/pull/25752), thanks [@JReinhold](https://github.com/JReinhold)!

## 7.6.11

- CLI: Update init for react native v7 - [#25780](https://github.com/storybookjs/storybook/pull/25780), thanks [@dannyhw](https://github.com/dannyhw)!
- Codemods: Add support for multiple file extensions in runCodemod function - [#25708](https://github.com/storybookjs/storybook/pull/25708), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.6.10

- CLI: Fix existing version detection in `upgrade` - [#25642](https://github.com/storybookjs/storybook/pull/25642), thanks [@JReinhold](https://github.com/JReinhold)!
- React: Fix acorn ecma version warning - [#25634](https://github.com/storybookjs/storybook/pull/25634), thanks [@dannyhw](https://github.com/dannyhw)!

## 7.6.9

- ConfigFile: Fix export specifiers - [#25590](https://github.com/storybookjs/storybook/pull/25590), thanks [@shilman](https://github.com/shilman)!
- Webpack5: Make export-order-loader compatible with both esm and cjs - [#25540](https://github.com/storybookjs/storybook/pull/25540), thanks [@mlazari](https://github.com/mlazari)!
- CLI: Support version specifiers in `init`, `upgrade` and `sandbox` - [#25526](https://github.com/storybookjs/storybook/pull/25526), thanks [@ndelangen](https://github.com/ndelangen), [@jreinhold](https://github.com/jreinhold)!

## 7.6.8

- Addon-actions: Fix module resolution for react-native - [#25296](https://github.com/storybookjs/storybook/pull/25296), thanks [@dannyhw](https://github.com/dannyhw)!
- Storysource: Fix import error - [#25391](https://github.com/storybookjs/storybook/pull/25391), thanks [@unional](https://github.com/unional)!

## 7.6.7

- Core: Skip no-framework error when ignorePreview=true - [#25286](https://github.com/storybookjs/storybook/pull/25286), thanks [@ndelangen](https://github.com/ndelangen)!
- Dependencies: Semver dependency fixes - [#25283](https://github.com/storybookjs/storybook/pull/25283), thanks [@ndelangen](https://github.com/ndelangen)!
- Vite: Fix pre-transform error in Vite 5 - [#25329](https://github.com/storybookjs/storybook/pull/25329), thanks [@yannbf](https://github.com/yannbf)!
- Vue3: Fix pnp by making compiler-core a dependency - [#25311](https://github.com/storybookjs/storybook/pull/25311), thanks [@shilman](https://github.com/shilman)!

## 7.6.6

- SvelteKit: Support 2.0 modules with mocks - [#25244](https://github.com/storybookjs/storybook/pull/25244), thanks [@paoloricciuti](https://github.com/paoloricciuti)!

## 7.6.5

- Angular: Update Angular cli templates - [#25152](https://github.com/storybookjs/storybook/pull/25152), thanks [@Marklb](https://github.com/Marklb)!
- Blocks: Fix Subtitle block for unattached docs pages - [#25157](https://github.com/storybookjs/storybook/pull/25157), thanks [@kripod](https://github.com/kripod)!
- SvelteKit: Fix missing `$app` modules - [#25132](https://github.com/storybookjs/storybook/pull/25132), thanks [@paoloricciuti](https://github.com/paoloricciuti)!

## 7.6.4

- Angular: Fix CSF Plugin - [#25098](https://github.com/storybookjs/storybook/pull/25098), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Viewport: Fix viewport dts files - [#25107](https://github.com/storybookjs/storybook/pull/25107), thanks [@kasperpeulen](https://github.com/kasperpeulen)!

## 7.6.3

- Next.js: Fix next/font/local usage in babel mode - [#25045](https://github.com/storybookjs/storybook/pull/25045), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.6.2

- CLI: Improve dependency metadata detection in storybook doctor - [#25037](https://github.com/storybookjs/storybook/pull/25037), thanks [@yannbf](https://github.com/yannbf)!
- React-Docgen: Make error-handling more gentle - [#25055](https://github.com/storybookjs/storybook/pull/25055), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.6.1

- Next.js: Fix AppRouterProvider usage - [#25032](https://github.com/storybookjs/storybook/pull/25032), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- SvelteKit: Fix HMR not working - [#25031](https://github.com/storybookjs/storybook/pull/25031), thanks [@JReinhold](https://github.com/JReinhold)!
- Test: Downgrade @testing-library/user-event to 14.3.0 - [#25004](https://github.com/storybookjs/storybook/pull/25004), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Webpack: Fix exclude regex in react-docgen-loader - [#25030](https://github.com/storybookjs/storybook/pull/25030), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.6.0

Storybook 7.6 is here with increased performance and much more!

- 🔥 Improved SWC support
- 🧪 New test utilities and fast build mode
- 🔼 NextJS SWC + avif support & fixes
- 🤡 SvelteKit page and navigation mocking
- ⚛️ React-docgen upgrade
- 🎨 Controls a11y, background theming, and viewports
- 🩺 CLI: The doctor is in!
- 🚫 Addons: Remove React as a peer dependency
- 🪦 Storyshots and Vue2 deprecated

<details>
  <summary>
    List of all updates
  </summary>

- Actions: Attach spies on actions across stories when defined in meta - [#24451](https://github.com/storybookjs/storybook/pull/24451), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Actions: Fix `@storybook/core-events/preview-errors` dependency missing for Yarn PnP - [#24973](https://github.com/storybookjs/storybook/pull/24973), thanks [@JReinhold](https://github.com/JReinhold)!
- Actions: Fix missing crypto module crashing React Native - [#24546](https://github.com/storybookjs/storybook/pull/24546), thanks [@dannyhw](https://github.com/dannyhw)!
- Actions: Warn on implicit actions - [#24856](https://github.com/storybookjs/storybook/pull/24856), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Addon A11y: Avoid CSP issue - [#24477](https://github.com/storybookjs/storybook/pull/24477), thanks [@Marklb](https://github.com/Marklb)!
- Addon: Move Visual Test addon to the code directory - [#24771](https://github.com/storybookjs/storybook/pull/24771), thanks [@cdedreuille](https://github.com/cdedreuille)!
- Addons, core: Make `react` and Storybook packages `devDependencies` where possible - [#24676](https://github.com/storybookjs/storybook/pull/24676), thanks [@JReinhold](https://github.com/JReinhold)!
- Addons, core: Make `react` and Storybook packages `devDependencies` where possible - ATTEMPT 2 - [#24834](https://github.com/storybookjs/storybook/pull/24834), thanks [@JReinhold](https://github.com/JReinhold)!
- Angular: Add source-map option to builder - [#24466](https://github.com/storybookjs/storybook/pull/24466), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Handle nested module metadata - [#24798](https://github.com/storybookjs/storybook/pull/24798), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Include object configured styles - [#24768](https://github.com/storybookjs/storybook/pull/24768), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Babel: Update all @babel/\* dependencies - [#24610](https://github.com/storybookjs/storybook/pull/24610), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Add "doctor" command - [#22236](https://github.com/storybookjs/storybook/pull/22236), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Add @storybook/addon-designs to non-core list - [#24507](https://github.com/storybookjs/storybook/pull/24507), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Ensure errors with opening the browser are caught - [#24668](https://github.com/storybookjs/storybook/pull/24668), thanks [@xueyawei](https://github.com/xueyawei)!
- CLI: Ignore `addon-onboarding` when checking versions - [#24634](https://github.com/storybookjs/storybook/pull/24634), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Use @storybook/test in template stories - [#24393](https://github.com/storybookjs/storybook/pull/24393), thanks [@yannbf](https://github.com/yannbf)!
- Controls: Improve accessibility of BooleanControl for screen readers - [#24418](https://github.com/storybookjs/storybook/pull/24418), thanks [@danielmarcano](https://github.com/danielmarcano)!
- Core-Server: Ignore all node_module folders for watchpack - [#24553](https://github.com/storybookjs/storybook/pull/24553), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Core: Add deprecation notice for Vite + CommonJS - [#23950](https://github.com/storybookjs/storybook/pull/23950), thanks [@JReinhold](https://github.com/JReinhold)!
- Core: Detect no matching export error in storybook start and build - [#24877](https://github.com/storybookjs/storybook/pull/24877), thanks [@yannbf](https://github.com/yannbf)!
- Core: Fix `useStoryPrepared` hook failing with `undefined` data - [#22631](https://github.com/storybookjs/storybook/pull/22631), thanks [@SpookyJelly](https://github.com/SpookyJelly)!
- Core: Fix pnp support when cache dir is outside working dir - [#24572](https://github.com/storybookjs/storybook/pull/24572), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Core: Fix post message channel location.search access for React Native - [#24545](https://github.com/storybookjs/storybook/pull/24545), thanks [@dannyhw](https://github.com/dannyhw)!
- Core: Gracefully handle error when parsing preview.js file - [#24858](https://github.com/storybookjs/storybook/pull/24858), thanks [@yannbf](https://github.com/yannbf)!
- Core: Make warnOnIncompatibleAddons fault-tolerant - [#24880](https://github.com/storybookjs/storybook/pull/24880), thanks [@taozhou-glean](https://github.com/taozhou-glean)!
- Dependencies: Fix Yarn 4 failing to install due to jscodeshift dependency issue - [#24914](https://github.com/storybookjs/storybook/pull/24914), thanks [@samvv](https://github.com/samvv)!
- Dependencies: Update @babel/traverse and @babel/core to fix vulnerability - [#24670](https://github.com/storybookjs/storybook/pull/24670), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Dependencies: Update browserify-sign transitive dependency - [#24674](https://github.com/storybookjs/storybook/pull/24674), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Dependencies: Update jscodeshift to v0.15.1 - [#24882](https://github.com/storybookjs/storybook/pull/24882), thanks [@epreston](https://github.com/epreston)!
- Dependencies: Update nx dependencies to v17 - [#24671](https://github.com/storybookjs/storybook/pull/24671), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Doc Blocks: Add support for `of` prop to `Primary` block - [#23849](https://github.com/storybookjs/storybook/pull/23849), thanks [@Wilson2k](https://github.com/Wilson2k)!
- Doc Blocks: Remove `defaultProps` in `Stories` block - [#24506](https://github.com/storybookjs/storybook/pull/24506), thanks [@WouterK12](https://github.com/WouterK12)!
- Docs: Changes corresponding to docs design updates - [#24925](https://github.com/storybookjs/storybook/pull/24925), thanks [@kylegach](https://github.com/kylegach)!
- Maintenance: Split renderers preview entrypoints - [#24623](https://github.com/storybookjs/storybook/pull/24623), thanks [@ndelangen](https://github.com/ndelangen)!
- Manager: Update `store.settings.lastTrackedStoryId` - [#24115](https://github.com/storybookjs/storybook/pull/24115), thanks [@rashidshamloo](https://github.com/rashidshamloo)!
- ManagerAPI: Fix setting status without index, crashes storybook - [#24866](https://github.com/storybookjs/storybook/pull/24866), thanks [@ndelangen](https://github.com/ndelangen)!
- ManagerBuilder: Fix `"type": "commonjs"` compatibility - [#24534](https://github.com/storybookjs/storybook/pull/24534), thanks [@ndelangen](https://github.com/ndelangen)!
- Next.js: Add avif support - [#24611](https://github.com/storybookjs/storybook/pull/24611), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Add back image context CommonJS export - [#24885](https://github.com/storybookjs/storybook/pull/24885), thanks [@martinnabhan](https://github.com/martinnabhan)!
- Next.js: Add experimental SWC support - [#24852](https://github.com/storybookjs/storybook/pull/24852), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Fix Fast Refresh config for SWC mode - [#24991](https://github.com/storybookjs/storybook/pull/24991), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Fix forwarding ref for Image component - [#24648](https://github.com/storybookjs/storybook/pull/24648), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Fix import path in swc loader - [#24922](https://github.com/storybookjs/storybook/pull/24922), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Fix react-docgen usage with preset-env settings - [#24993](https://github.com/storybookjs/storybook/pull/24993), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Next.js: Remove duplicate Fast Refresh plugin init - [#24963](https://github.com/storybookjs/storybook/pull/24963), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- React: Upgrade `react-docgen` to v7 - [#24530](https://github.com/storybookjs/storybook/pull/24530), thanks [@shilman](https://github.com/shilman)!
- ReactNative: Fix missing assert dep in docs-tools - [#24732](https://github.com/storybookjs/storybook/pull/24732), thanks [@dannyhw](https://github.com/dannyhw)!
- Svelte: Fix decorators always running twice - [#24921](https://github.com/storybookjs/storybook/pull/24921), thanks [@paoloricciuti](https://github.com/paoloricciuti)!
- Svelte: Fix source with decorators always showing the `SlotDecorator` component - [#24800](https://github.com/storybookjs/storybook/pull/24800), thanks [@JReinhold](https://github.com/JReinhold)!
- SvelteKit: Add experimental page and navigation mocking - [#24795](https://github.com/storybookjs/storybook/pull/24795), thanks [@paoloricciuti](https://github.com/paoloricciuti)!
- SvelteKit: Default to log an action for `goto`, `invalidate` and `invalidateAll` - [#24955](https://github.com/storybookjs/storybook/pull/24955), thanks [@paoloricciuti](https://github.com/paoloricciuti)!
- SWC: Add settings for react and preact - [#24805](https://github.com/storybookjs/storybook/pull/24805), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Test Build: Add env-variable support to `--test` CLI-flag - [#24862](https://github.com/storybookjs/storybook/pull/24862), thanks [@ndelangen](https://github.com/ndelangen)!
- Test Build: Add tests and rename to camelCase - [#24911](https://github.com/storybookjs/storybook/pull/24911), thanks [@ndelangen](https://github.com/ndelangen)!
- Test Build: Disable composition when `--test` is `true` - [#24799](https://github.com/storybookjs/storybook/pull/24799), thanks [@ndelangen](https://github.com/ndelangen)!
- Test Build: Disable docs related stuff for test builds - [#24691](https://github.com/storybookjs/storybook/pull/24691), thanks [@ndelangen](https://github.com/ndelangen)!
- Test Build: Disable telemetry for test builds - [#24706](https://github.com/storybookjs/storybook/pull/24706), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Test Build: Disable warnOnIncompatibleAddons - [#24797](https://github.com/storybookjs/storybook/pull/24797), thanks [@ndelangen](https://github.com/ndelangen)!
- Test Build: Filter out addon-docs from essentials in the test build - [#24994](https://github.com/storybookjs/storybook/pull/24994), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Test Build: Fix disabledAddons filter - [#24924](https://github.com/storybookjs/storybook/pull/24924), thanks [@IanVS](https://github.com/IanVS)!
- Test Build: Fix indexer bug - [#24890](https://github.com/storybookjs/storybook/pull/24890), thanks [@ndelangen](https://github.com/ndelangen)!
- Test Build: Globalize `@storybook/blocks` if `build.test.emptyBlocks` is `true` - [#24650](https://github.com/storybookjs/storybook/pull/24650), thanks [@ndelangen](https://github.com/ndelangen)!
- Test Build: Implement builder options for test build - [#24826](https://github.com/storybookjs/storybook/pull/24826), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Test Build: Improve config loading & naming - [#24837](https://github.com/storybookjs/storybook/pull/24837), thanks [@ndelangen](https://github.com/ndelangen)!
- Test Build: No sourcemaps for test builds - [#24804](https://github.com/storybookjs/storybook/pull/24804), thanks [@ndelangen](https://github.com/ndelangen)!
- Test Build: Revert defaulting to SWC in test build, but keep using esbuild for minification - [#24843](https://github.com/storybookjs/storybook/pull/24843), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Test: Create @storybook/test package based on vitest - [#24392](https://github.com/storybookjs/storybook/pull/24392), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Test: Don\'t attach action to function mock if action was added already - [#24966](https://github.com/storybookjs/storybook/pull/24966), thanks [@tmeasday](https://github.com/tmeasday)!
- Test: Model loaders as before each and restore mocks properly - [#24948](https://github.com/storybookjs/storybook/pull/24948), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Theming: Add theme variable to set the preview background color - [#24575](https://github.com/storybookjs/storybook/pull/24575), thanks [@JReinhold](https://github.com/JReinhold)!
- Typescript: Add \'skipCompiler\' option to TypeScript presets - [#24847](https://github.com/storybookjs/storybook/pull/24847), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- UI: Fix horizontal scroll bar in Canvas hidden by styling - [#24408](https://github.com/storybookjs/storybook/pull/24408), thanks [@yoshi2no](https://github.com/yoshi2no)!
- UI: improve A11Y remove redundant styling rules, update icon color - [#24402](https://github.com/storybookjs/storybook/pull/24402), thanks [@tolkadot](https://github.com/tolkadot)!
- UI: Logo fixed value - [#24726](https://github.com/storybookjs/storybook/pull/24726), thanks [@black-arm](https://github.com/black-arm)!
- UI: Update zIndex on NotificationList to fix the notification not being clickable in certain cases - [#24602](https://github.com/storybookjs/storybook/pull/24602), thanks [@yoshi2no](https://github.com/yoshi2no)!
- Viewport: Add newer device viewports - [#24777](https://github.com/storybookjs/storybook/pull/24777), thanks [@Tomo5524](https://github.com/Tomo5524)!
- Vite: Prevent non-deterministic build output - [#24833](https://github.com/storybookjs/storybook/pull/24833), thanks [@henkerik](https://github.com/henkerik)!
- Webpack: Add export-order-loader and remove babel-plugin-named-exports-order - [#24749](https://github.com/storybookjs/storybook/pull/24749), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Webpack: Add react-docgen loader and remove babel-plugin-react-docgen - [#24762](https://github.com/storybookjs/storybook/pull/24762), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Webpack: Fix race condition for export-order loader - [#24817](https://github.com/storybookjs/storybook/pull/24817), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Webpack: Hide critical dependency warning - [#24784](https://github.com/storybookjs/storybook/pull/24784), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Webpack: Only load babel config when babel-loader is used - [#25002](https://github.com/storybookjs/storybook/pull/25002), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Webpack: Resolve circular dependency and fix HMR - [#24974](https://github.com/storybookjs/storybook/pull/24974), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
</details>

## 7.5.2

- Addon-themes: Fix globals not being set when using absolute path - [#24596](https://github.com/storybookjs/storybook/pull/24596), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Allow Yarn v4 in `link` command - [#24551](https://github.com/storybookjs/storybook/pull/24551), thanks [@yannbf](https://github.com/yannbf)!
- Next.js: Support v14.0.0 - [#24593](https://github.com/storybookjs/storybook/pull/24593), thanks [@nikospapcom](https://github.com/nikospapcom)!

## 7.5.1

- Angular: update wrong type for webpackStatsJson in start-storybook schema.json - [#24494](https://github.com/storybookjs/storybook/pull/24494), thanks [@LucaVazz](https://github.com/LucaVazz)!
- Themes: Run postinstall in shell for windows - [#24389](https://github.com/storybookjs/storybook/pull/24389), thanks [@Integrayshaun](https://github.com/Integrayshaun)!

## 7.5.0

Storybook 7.5 enhances your Storybook experience with several key updates:

- 💃🏼 Now supports Lit 3.0 and Vite 5
- 👻 storiesOf and storyStoreV6 officially deprecated
- 🔨 Fix Webpack5 build errors not being propagated
- 🀄 Support rename font import for Next.js
- ⬆️ Upgrade react-docgen to 6.0.x and improve argTypes
- ✨ Many Angular improvements such as introducing argsToTemplate , new schema debugging options, support for standalone directives, etc.
<details>
  <summary>
    List of all updates
  </summary>

- Angular: Introduce argsToTemplate for property and event Bindings - [#24434](https://github.com/storybookjs/storybook/pull/24434), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Add schema options (debugWebpack, webpackStatsJson, and more) - [#24388](https://github.com/storybookjs/storybook/pull/24388), thanks [@yannbf](https://github.com/yannbf)!
- Angular: Categorize legacy build options error - [#24014](https://github.com/storybookjs/storybook/pull/24014), thanks [@yannbf](https://github.com/yannbf)!
- Angular: Fix Angular 15 support and add zone.js v0.14.x support - [#24367](https://github.com/storybookjs/storybook/pull/24367), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Allow loading standalone directives - [#24448](https://github.com/storybookjs/storybook/pull/24448), thanks [@osnoser1](https://github.com/osnoser1)!
- CLI: Inform the user how to dedupe and strip color from info command - [#24087](https://github.com/storybookjs/storybook/pull/24087), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- CLI: Add more information to storybook info command - [#24003](https://github.com/storybookjs/storybook/pull/24003), thanks [@JReinhold](https://github.com/JReinhold)!
- CLI: Change /Date$/ to /Dates$/i - [#24195](https://github.com/storybookjs/storybook/pull/24195), thanks [@arup1221](https://github.com/arup1221)!
- CLI: Improve sanitization logic in crash reports - [#24028](https://github.com/storybookjs/storybook/pull/24028), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Remove random commas in storybook upgrade logs - [#22333](https://github.com/storybookjs/storybook/pull/22333), thanks [@joaonunomota](https://github.com/joaonunomota)!
- Controls: Fix select / multiselect when value contains multiple spaces - [#22334](https://github.com/storybookjs/storybook/pull/22334), thanks [@oxcened](https://github.com/oxcened)!
- Core: Add class name to Storybook error name - [#24371](https://github.com/storybookjs/storybook/pull/24371), thanks [@yannbf](https://github.com/yannbf)!
- Core: Deprecate storyStoreV6 (including storiesOf) and storyIndexers - [#23938](https://github.com/storybookjs/storybook/pull/23938), thanks [@JReinhold](https://github.com/JReinhold)!
- Doc Blocks: Add title to Meta prop types - [#23370](https://github.com/storybookjs/storybook/pull/23370), thanks [@iqbalcodes6602](https://github.com/iqbalcodes6602)!
- ManagerAPI: Fix bug with story redirection when URL has partial storyId - [#24345](https://github.com/storybookjs/storybook/pull/24345), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Support rename font import - [#24406](https://github.com/storybookjs/storybook/pull/24406), thanks [@yoshi2no](https://github.com/yoshi2no)!
- NextJS: Change babel plugins from proposal-... to transform-... - [#24290](https://github.com/storybookjs/storybook/pull/24290), thanks [@roottool](https://github.com/roottool)!
- NextJS: Fix default next image loader when src has params - [#24187](https://github.com/storybookjs/storybook/pull/24187), thanks [@json-betsec](https://github.com/json-betsec)!
- NextJS: Fix Image Context re-use via singleton - [#24146](https://github.com/storybookjs/storybook/pull/24146), thanks [@martinnabhan](https://github.com/martinnabhan)!
- NextJS: Improve support for Windows-style paths - [#23695](https://github.com/storybookjs/storybook/pull/23695), thanks [@T99](https://github.com/T99)!
- React: Upgrade `react-docgen` to `6.0.x` and improve argTypes - [#23825](https://github.com/storybookjs/storybook/pull/23825), thanks [@shilman](https://github.com/shilman)!
- Svelte: Fix docs generating when using `lang="ts"` or optional chaining - [#24096](https://github.com/storybookjs/storybook/pull/24096), thanks [@j3rem1e](https://github.com/j3rem1e)!
- UI: Filter some manager errors - [#24217](https://github.com/storybookjs/storybook/pull/24217), thanks [@yannbf](https://github.com/yannbf)!
- UI: Update ScrollArea with radix - [#24413](https://github.com/storybookjs/storybook/pull/24413), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Improve contrast ratio between focus / hover - [#24205](https://github.com/storybookjs/storybook/pull/24205), thanks [@chocoscoding](https://github.com/chocoscoding)!
- UI: Fix className missing in syntaxhighlighter - [#24491](https://github.com/storybookjs/storybook/pull/24491), thanks [@ndelangen](https://github.com/ndelangen)!
- Vite: Move mdx-plugin from `@storybook/builder-vite` to `@storybook/addon-docs` - [#24166](https://github.com/storybookjs/storybook/pull/24166), thanks [@bryanjtc](https://github.com/bryanjtc)!
- Vite: Support Vite 5 - [#24395](https://github.com/storybookjs/storybook/pull/24395), thanks [@IanVS](https://github.com/IanVS)!
- Web-components: Add Lit3 support - [#24437](https://github.com/storybookjs/storybook/pull/24437), thanks [@shilman](https://github.com/shilman)!
- Webpack: Display errors on build - [#24377](https://github.com/storybookjs/storybook/pull/24377), thanks [@yannbf](https://github.com/yannbf)!
- Webpack: Categorize builder error - [#24031](https://github.com/storybookjs/storybook/pull/24031), thanks [@yannbf](https://github.com/yannbf)!
- Webpack: Use logger.warn on warnings - [#24472](https://github.com/storybookjs/storybook/pull/24472), thanks [@yannbf](https://github.com/yannbf)!
</details>

## 7.4.6

- CLI: Fix Nextjs project detection - [#24346](https://github.com/storybookjs/storybook/pull/24346), thanks [@yannbf](https://github.com/yannbf)!
- Core: Fix missing favicon during dev - [#24356](https://github.com/storybookjs/storybook/pull/24356), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.4.5

- UI: Fix infinite hook call causing browsers to freeze - [#24291](https://github.com/storybookjs/storybook/pull/24291), thanks [@yannbf](https://github.com/yannbf)!

## 7.4.4

- Core: Fix Promise cycle bug in useSharedState - [#24268](https://github.com/storybookjs/storybook/pull/24268), thanks [@ndelangen](https://github.com/ndelangen)!
- Manager: Fix useAddonState when using a setter function - [#24237](https://github.com/storybookjs/storybook/pull/24237), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.4.3

- CLI: Fix `sb add` adding duplicative entries - [#24229](https://github.com/storybookjs/storybook/pull/24229), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Add compatibility with nextjs `13.5` - [#24239](https://github.com/storybookjs/storybook/pull/24239), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Aliases `react` and `react-dom` like `next.js` does - [#23671](https://github.com/storybookjs/storybook/pull/23671), thanks [@sookmax](https://github.com/sookmax)!
- Types: Allow `null` in value of `experimental_updateStatus` to clear status - [#24206](https://github.com/storybookjs/storybook/pull/24206), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.4.2

- Addon API: Improve the updateStatus API - [#24007](https://github.com/storybookjs/storybook/pull/24007), thanks [@ndelangen](https://github.com/ndelangen)!
- Nextjs: Migrate from config to previewAnnotations - [#24178](https://github.com/storybookjs/storybook/pull/24178), thanks [@yannbf](https://github.com/yannbf)!
- UI: Fix SVG override fill when path has a fill attribute - [#24156](https://github.com/storybookjs/storybook/pull/24156), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Improve look and feel of status UI in sidebar - [#24099](https://github.com/storybookjs/storybook/pull/24099), thanks [@ndelangen](https://github.com/ndelangen)!

## 7.4.1

- CLI: Add uncaughtException handler - [#24018](https://github.com/storybookjs/storybook/pull/24018), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Fix packageManager handling in `sb add` - [#24079](https://github.com/storybookjs/storybook/pull/24079), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- Core: Add CJS entrypoints to errors in core events - [#24038](https://github.com/storybookjs/storybook/pull/24038), thanks [@yannbf](https://github.com/yannbf)!
- Docs: Fix TOC import - [#24047](https://github.com/storybookjs/storybook/pull/24047), thanks [@shilman](https://github.com/shilman)!
- Telemetry: Filter addon options to protect sensitive info - [#24000](https://github.com/storybookjs/storybook/pull/24000), thanks [@shilman](https://github.com/shilman)!
- Types: Remove `@types/react` dep from `@storybook/types` - [#24042](https://github.com/storybookjs/storybook/pull/24042), thanks [@JReinhold](https://github.com/JReinhold)!
- Vue3: Remove console.log in sourceDecorator - [#24062](https://github.com/storybookjs/storybook/pull/24062), thanks [@oruman](https://github.com/oruman)!

## 7.4.0

- Addon-docs: Resolve `mdx-react-shim` & `@storybook/global` correctly - [#23941](https://github.com/storybookjs/storybook/pull/23941), thanks [@ndelangen](https://github.com/ndelangen)!
- Addons: Fix key is not a prop warning - [#23935](https://github.com/storybookjs/storybook/pull/23935), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- Build: Migrate @storybook/scripts to strict-ts - [#23818](https://github.com/storybookjs/storybook/pull/23818), thanks [@stilt0n](https://github.com/stilt0n)!
- CLI: Exclude addon-styling from upgrade - [#23841](https://github.com/storybookjs/storybook/pull/23841), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- CLI: Improve autotitle stories format handling in GFM automigration - [#23964](https://github.com/storybookjs/storybook/pull/23964), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Install latest version of non-core addon - [#23956](https://github.com/storybookjs/storybook/pull/23956), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- CLI: Pass package manager to postinstall - [#23913](https://github.com/storybookjs/storybook/pull/23913), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- CLI: Provide guidance for users who try to initialize Storybook on an empty dir - [#23874](https://github.com/storybookjs/storybook/pull/23874), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Set server init generator to use Webpack5 - [#23971](https://github.com/storybookjs/storybook/pull/23971), thanks [@yannbf](https://github.com/yannbf)!
- Core: Add error categorization framework - [#23653](https://github.com/storybookjs/storybook/pull/23653), thanks [@yannbf](https://github.com/yannbf)!
- Core: Fix error thrown if `docs.defaultName` is unset - [#23893](https://github.com/storybookjs/storybook/pull/23893), thanks [@stilt0n](https://github.com/stilt0n)!
- Core: Fix indexing for non-prefixed `stories.*` stories - [#23974](https://github.com/storybookjs/storybook/pull/23974), thanks [@shilman](https://github.com/shilman)!
- Core: Fix race-condition relating to `addons.setConfig` - [#23802](https://github.com/storybookjs/storybook/pull/23802), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Throw an error when detecting empty stories field - [#23942](https://github.com/storybookjs/storybook/pull/23942), thanks [@yannbf](https://github.com/yannbf)!
- Dependencies: Upgrade `escodegen` to fix security issue - [#23973](https://github.com/storybookjs/storybook/pull/23973), thanks [@shilman](https://github.com/shilman)!
- Index: Fix `*.story.*` CSF indexing - [#23852](https://github.com/storybookjs/storybook/pull/23852), thanks [@shilman](https://github.com/shilman)!
- Logger: Fix double error messages/stack - [#23919](https://github.com/storybookjs/storybook/pull/23919), thanks [@ndelangen](https://github.com/ndelangen)!
- Maintenance: Categorize server errors - [#23912](https://github.com/storybookjs/storybook/pull/23912), thanks [@yannbf](https://github.com/yannbf)!
- Maintenance: Move filtering of sidebar into the state - [#23911](https://github.com/storybookjs/storybook/pull/23911), thanks [@ndelangen](https://github.com/ndelangen)!
- Maintenance: Remove need for `react` as peerDependency - [#23897](https://github.com/storybookjs/storybook/pull/23897), thanks [@ndelangen](https://github.com/ndelangen)!
- Maintenance: Remove sourcemaps generation - [#23936](https://github.com/storybookjs/storybook/pull/23936), thanks [@ndelangen](https://github.com/ndelangen)!
- Maintenance: Revert "WebpackBuilder: Remove need for `react` as peerDependency" - [#23882](https://github.com/storybookjs/storybook/pull/23882), thanks [@vanessayuenn](https://github.com/vanessayuenn)!
- Manager API: Fix `api.getAddonState`default value - [#23804](https://github.com/storybookjs/storybook/pull/23804), thanks [@sookmax](https://github.com/sookmax)!
- Preset: Add common preset overrides mechanism - [#23915](https://github.com/storybookjs/storybook/pull/23915), thanks [@yannbf](https://github.com/yannbf)!
- Publish: Don't distribute src files or unnecessary template files - [#23853](https://github.com/storybookjs/storybook/pull/23853), thanks [@shilman](https://github.com/shilman)!
- Shortcuts: Execute preventDefault only if keyboard shortcuts are enabled - [#23412](https://github.com/storybookjs/storybook/pull/23412), thanks [@Spielboerg](https://github.com/Spielboerg)!
- Types: Fix `React.ReactElement` not found - [#23967](https://github.com/storybookjs/storybook/pull/23967), thanks [@abu-osos](https://github.com/abu-osos)!
- UI: Add an experimental API for adding sidebar bottom toolbar - [#23778](https://github.com/storybookjs/storybook/pull/23778), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Add an experimental API for adding sidebar filter functions at runtime - [#23722](https://github.com/storybookjs/storybook/pull/23722), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Add an experimental API for adding sidebar top toolbar - [#23811](https://github.com/storybookjs/storybook/pull/23811), thanks [@ndelangen](https://github.com/ndelangen)!
- UI: Removal of experimental components - [#23907](https://github.com/storybookjs/storybook/pull/23907), thanks [@ndelangen](https://github.com/ndelangen)!
- Vue3: Add support for Global Apps install - [#23772](https://github.com/storybookjs/storybook/pull/23772), thanks [@chakAs3](https://github.com/chakAs3)!
- Vue3: Use slot value directly if it's a string in source decorator - [#23784](https://github.com/storybookjs/storybook/pull/23784), thanks [@nasvillanueva](https://github.com/nasvillanueva)!

## 7.3.2

- Maintenance: Revert "WebpackBuilder: Remove need for `react` as peerDependency" - [#23882](https://github.com/storybookjs/storybook/pull/23882), thanks [@vanessayuenn](https://github.com/vanessayuenn)!

## 7.3.1

- Index: Fix `*.story.*` CSF indexing - [#23852](https://github.com/storybookjs/storybook/pull/23852), thanks [@shilman](https://github.com/shilman)!

## 7.3.0

- ✨ Indexer: Introduce new experimental `indexer` API - #23691, thanks [@JReinhold](https://github.com/jreinhold)!
- ✨ CLI: Update postinstall to look for addon script - [#23791](https://github.com/storybookjs/storybook/pull/23791), thanks [@Integrayshaun](https://github.com/Integrayshaun)!
- ✨ Server: Add support for tags - #23660, thanks [@JReinhold](https://github.com/jreinhold)!
- 🐛 CSF-Tools: Remove prettier from printConfig - [#23766](https://github.com/storybookjs/storybook/pull/23766), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- 🐛 Build: Support Chrome 100, Safari 15 and Firefox 91 - [#23800](https://github.com/storybookjs/storybook/pull/23800), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- 🐛 Vue3: Don't automatically assign values to all slots - [#23697](https://github.com/storybookjs/storybook/pull/23697), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- 🐛 Core: Fix `composeStories` typings - [#23577](https://github.com/storybookjs/storybook/pull/23577), thanks [@yannbf](https://github.com/yannbf)!
- 🐛 WebpackBuilder: Remove need for `react` as peerDependency - [#23496](https://github.com/storybookjs/storybook/pull/23496), thanks [@ndelangen](https://github.com/ndelangen)!
- 🔧 Addon-docs, Core, Server: Use new `indexer` API - #23660, thanks [@JReinhold](https://github.com/jreinhold)!
- 🔧 Core-server: Improve internal types - #23632, thanks [@JReinhold](https://github.com/jreinhold)!
- 🔧 UI: Improve Link component - [#23767](https://github.com/storybookjs/storybook/pull/23767), thanks [@cdedreuille](https://github.com/cdedreuille)!
- 🔧 UI: Improve new `Button` component - [#23765](https://github.com/storybookjs/storybook/pull/23765), thanks [@cdedreuille](https://github.com/cdedreuille)!
- 🔧 UI: Update Button types to allow for no children on iconOnly buttons - [#23735](https://github.com/storybookjs/storybook/pull/23735), thanks [@cdedreuille](https://github.com/cdedreuille)!
- 🔧 UI: Upgrade Icon component - [#23680](https://github.com/storybookjs/storybook/pull/23680), thanks [@cdedreuille](https://github.com/cdedreuille)!
- 🔧 Addons: Deprecate key in addon render function as it is not available anymore - [#23792](https://github.com/storybookjs/storybook/pull/23792), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- 🔧 UI: Update IconButton and add new Toolbar component - [#23795](https://github.com/storybookjs/storybook/pull/23795), thanks [@cdedreuille](https://github.com/cdedreuille)!

## 7.2.3

- Build: Support Chrome 100, Safari 15 and Firefox 91 - [#23800](https://github.com/storybookjs/storybook/pull/23800), thanks [@kasperpeulen](https://github.com/kasperpeulen)!

## 7.2.2

- CSF-Tools: Remove prettier from printConfig - [#23766](https://github.com/storybookjs/storybook/pull/23766), thanks [@kasperpeulen](https://github.com/kasperpeulen)!

## 7.2.1

- Addon docs: Add safe check in Webpack preset - [#23687](https://github.com/storybookjs/storybook/pull/23687), thanks [@yannbf](https://github.com/yannbf)!
- Autodocs: Fix docs pages ignoring `meta.id` when calculating their ID - [#23520](https://github.com/storybookjs/storybook/pull/23520), thanks [@sookmax](https://github.com/sookmax)!
- CLI: Fix error logging being swallowed from dev/build failures - [#23689](https://github.com/storybookjs/storybook/pull/23689), thanks [@yannbf](https://github.com/yannbf)!
- Channels: Remove self-referencing in `package.json` - [#23681](https://github.com/storybookjs/storybook/pull/23681), thanks [@stof](https://github.com/stof)!
- UI: Fix ArgsTable empty state on docs - [#23688](https://github.com/storybookjs/storybook/pull/23688), thanks [@cdedreuille](https://github.com/cdedreuille)!
- UI: Improve controls addon - [#23635](https://github.com/storybookjs/storybook/pull/23635), thanks [@cdedreuille](https://github.com/cdedreuille)!

## 7.2.0

This month, we're going to experiment with our launch cycle by making smaller but more frequent releases. Our goal is to bring you new features more quickly, while also smoothing the upgrade process.

Storybook 7.2 is the first of these new, faster releases:

- Automigration: Fix wrap-require automigration for common js main.js files - [#23644](https://github.com/storybookjs/storybook/pull/23644), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CSF Tools: Use recast for printing in csf-tools - [#23427](https://github.com/storybookjs/storybook/pull/23427), thanks [@kasperpeulen](https://github.com/kasperpeulen)!
- CSF-tools: Parse stories using typescript keywords 'satisfies' and 'as' - [#23638](https://github.com/storybookjs/storybook/pull/23638), thanks [@joaonunomota](https://github.com/joaonunomota)!
- Core: Fix channelOptions for serverChannel - [#23615](https://github.com/storybookjs/storybook/pull/23615), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Add `@babel/core` as a dependency - [#22450](https://github.com/storybookjs/storybook/pull/22450), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Vite: Fix config loading - project directory - [#22240](https://github.com/storybookjs/storybook/pull/22240), thanks [@nVitius](https://github.com/nVitius)!
- Angular: Fix initialization of Storybook in Angular 16.1 - [#23598](https://github.com/storybookjs/storybook/pull/23598), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Dependencies: Downgrade `jest-mock` - [#23597](https://github.com/storybookjs/storybook/pull/23597), thanks [@ndelangen](https://github.com/ndelangen)!
- Dependencies: Upgrade simple-update-notifier - [#23396](https://github.com/storybookjs/storybook/pull/23396), thanks [@dartess](https://github.com/dartess)!
- Storyshots: fix broken storyshots with angular - [#23555](https://github.com/storybookjs/storybook/pull/23555), thanks [@mattlewis92](https://github.com/mattlewis92)!
- TypeScript: Added `expanded` to `CoreCommon_StorybookRefs` to fix typescript errors - [#23488](https://github.com/storybookjs/storybook/pull/23488), thanks [@DotwoodMedia](https://github.com/DotwoodMedia)!
- TypeScript: Downgrade to the last version of type-fest that doesn't need typescript 5.0 - [#23574](https://github.com/storybookjs/storybook/pull/23574), thanks [@ndelangen](https://github.com/ndelangen)!
- Vue2: Source Decorator reactivity - [#23149](https://github.com/storybookjs/storybook/pull/23149), thanks [@chakAs3](https://github.com/chakAs3)!
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

## 7.1.1

- Angular: Make enableProdMode optional - [#23489](https://github.com/storybookjs/storybook/pull/23489), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Gracefully shutdown and cleanup execa child processes - [#23538](https://github.com/storybookjs/storybook/pull/23538), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Improve support of mono repositories - [#23458](https://github.com/storybookjs/storybook/pull/23458), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!

## 7.1.0 (July 18, 2023)

Storybook 7.1 is here! 🎉

- 🏄‍♀️ [**In-app onboarding**](https://storybook.js.org/blog/in-app-tour-for-new-users/) to help you set up new projects
- 💅 [**Zero-config styling support**](https://storybook.js.org/blog/zero-config-support-for-tailwind-mui-styled-components-and-emotion/) for major libraries
- 🗃️ [**API reference documentation**](https://storybook.js.org/blog/docs-updates/) and TypeScript-first snippets
- 📇 [**Table of Contents for docs**](https://storybook.js.org/docs/7.1/react/writing-docs/autodocs#generate-a-table-of-contents)
- 🎨 [**Figma** **Design addon**](https://github.com/storybookjs/addon-designs) official support
- 📗 **Vue3 source snippets** and reactivity improvements
- 💯 **Hundreds more** fixes and improvements

  7.1 contains hundreds more fixes, features, and tweaks. Browse the changelogs matching `7.1.0-alpha.*`, `7.1.0-beta.*`, and `7.1.0-rc.*` for the full list of changes.

For a better upgrade experience, please use one of the following commands:

npm or yarn 1:
`npx storybook@latest upgrade`

pnpm:
`pnpm dlx storybook@latest upgrade`

yarn berry:
`yarn dlx storybook@latest upgrade`

## 7.0.27

- Angular: Enable prod mode when Storybook is built - [#23404](https://github.com/storybookjs/storybook/pull/23404), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- Angular: Fix esm issue in combination with rxjs v6 - [#23405](https://github.com/storybookjs/storybook/pull/23405), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- CLI: Exit when user does not select a storybook project type - [#23201](https://github.com/storybookjs/storybook/pull/23201), thanks [@yannbf](https://github.com/yannbf)!
- Next.js: Fix for @nx/react/plugin/storybook with SVGs - [#23210](https://github.com/storybookjs/storybook/pull/23210), thanks [@daves28](https://github.com/daves28)!
- Svelte-Webpack: Support Svelte v4 - [#23336](https://github.com/storybookjs/storybook/pull/23336), thanks [@JReinhold](https://github.com/JReinhold)!

## 7.0.26

- Next.js: Fix next/image usage in latest Next.js release - [#23296](https://github.com/storybookjs/storybook/pull/23296), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- NextJS: Fix `useParams` support - [#22946](https://github.com/storybookjs/storybook/pull/22946), thanks [@gitstart-storybook](https://github.com/gitstart-storybook)!
- NextJS: Allow disabling next/image lazy loading - [#21909](https://github.com/storybookjs/storybook/pull/21909), thanks [@martinnabhan](https://github.com/martinnabhan)

## 7.0.25

- CLI: Fix pnp paths logic in storybook metadata - [#23259](https://github.com/storybookjs/storybook/pull/23259), thanks [@yannbf](https://github.com/yannbf)!
- Controls: Fix UI to add array items - [#22993](https://github.com/storybookjs/storybook/pull/22993), thanks [@sookmax](https://github.com/sookmax)!
- Next.js: Support disableStaticImages setting - [#23167](https://github.com/storybookjs/storybook/pull/23167), thanks [@valentinpalkovic](https://github.com/valentinpalkovic)!
- React: Fix decorators to conditionally render children - [#22336](https://github.com/storybookjs/storybook/pull/22336), thanks [@redbugz](https://github.com/redbugz)!

## 7.0.24

- CLI: Parse pnp paths in storybook metadata - [#23199](https://github.com/storybookjs/storybook/pull/23199), thanks [@yannbf](https://github.com/yannbf)!
- Dependencies: Pin `file-system-cache` to 2.3.0 - [#23221](https://github.com/storybookjs/storybook/pull/23221), thanks [@JReinhold](https://github.com/JReinhold)!
- Svelte: Support v4 - [#22905](https://github.com/storybookjs/storybook/pull/22905), thanks [@JReinhold](https://github.com/JReinhold)!

## 7.0.23

- Core: Fix compat by disabling name mangling in `esbuild` require - [#22486](https://github.com/storybookjs/storybook/pull/22486), thanks [@youngboy](https://github.com/youngboy)!
- Core: Prebundle node-logger and make it CJS only - [#23109](https://github.com/storybookjs/storybook/pull/23109), thanks [@ndelangen](https://github.com/ndelangen)!
- NextJS: Fix fonts not loading with 3+ words in name - [#23121](https://github.com/storybookjs/storybook/pull/23121), thanks [@ygkn](https://github.com/ygkn)!
- Telemetry: Count onboarding stories - [#23092](https://github.com/storybookjs/storybook/pull/23092), thanks [@shilman](https://github.com/shilman)!

## 7.0.22

- CLI: Prebundle boxen to resolve a ESM/CJS incompatibility - [#23080](https://github.com/storybookjs/storybook/pull/23080), thanks [@ndelangen](https://github.com/ndelangen)!
- Core: Fix core-common to use node-fetch - [#23077](https://github.com/storybookjs/storybook/pull/23077), thanks [@ndelangen](https://github.com/ndelangen)!
- Telemetry: Count onboarding stories - [#23092](https://github.com/storybookjs/storybook/pull/23092), thanks [@shilman](https://github.com/shilman)!

## 7.0.21

- Angular: Fix 16.1 compatibility - [#23064](https://github.com/storybookjs/storybook/pull/23064), thanks [@ndelangen](https://github.com/ndelangen)!
- Angular: Fix ivy preset - [#23070](https://github.com/storybookjs/storybook/pull/23070), thanks [@ndelangen](https://github.com/ndelangen)!
- CLI: Improve steps in storybook init - [#22502](https://github.com/storybookjs/storybook/pull/22502), thanks [@yannbf](https://github.com/yannbf)!
- CLI: Skip builder selection for react native - [#23042](https://github.com/storybookjs/storybook/pull/23042), thanks [@dannyhw](https://github.com/dannyhw)!
- Core: Fix `builder-manager` adding multiple dashes to relative path - [#22974](https://github.com/storybookjs/storybook/pull/22974), thanks [@MarioCadenas](https://github.com/MarioCadenas)!
- Core: Improve `of={...}` DocBlock error in story index - [#22782](https://github.com/storybookjs/storybook/pull/22782), thanks [@shilman](https://github.com/shilman)!
- Dependencies: Set vue-component-type-helpers to latest - [#23015](https://github.com/storybookjs/storybook/pull/23015), thanks [@ndelangen](https://github.com/ndelangen)!
- Vue3: Fix source decorator to generate correct story code - [#22518](https://github.com/storybookjs/storybook/pull/22518), thanks [@chakAs3](https://github.com/chakAs3)!
- Web-components: Fix custom-elements order of property application - [#19183](https://github.com/storybookjs/storybook/pull/19183), thanks [@sonntag-philipp](https://github.com/sonntag-philipp)!

## 7.0.20 (June 8, 2023)

#### Bug Fixes

- Server: Fix .stories.yml support [#22906](https://github.com/storybooks/storybook/pull/22906)
- Docs: Fix Source block snippet updates [#22835](https://github.com/storybooks/storybook/pull/22835)
- Core: Fix indexing errors by excluding node_modules stories [#22873](https://github.com/storybooks/storybook/pull/22873)
- CLI: Fix upgrade notification message [#22933](https://github.com/storybooks/storybook/pull/22933)
- Angular: Add --open/--no-open flag to dev command [#22964](https://github.com/storybooks/storybook/pull/22964)
- Angular: Silence compodoc when running storybook with --quiet [#22957](https://github.com/storybooks/storybook/pull/22957)

#### Maintenance

- Core: Improve MDX of error in story index [#22782](https://github.com/storybooks/storybook/pull/22782)

#### Build

- Build: Fix the theme output during development [#22841](https://github.com/storybooks/storybook/pull/22841)
- Revert "Docs: E2E tests for Source block update fix" [#22934](https://github.com/storybookjs/storybook/pull/22934)

## 7.0.19 (June 8, 2023)

Bad release

## 7.0.18 (May 26, 2023)

#### Bug Fixes

- Vue3: Fix TS 5.0 compat with vue-component-type-helpers [#22814](https://github.com/storybooks/storybook/pull/22814)
- Vue3: Fix reactive args updates in decorators [#22717](https://github.com/storybooks/storybook/pull/22717)
- Vue3: Revert v7 breaking change, restore reactive v6-compat API [#22692](https://github.com/storybooks/storybook/pull/22692)

#### Build

- Build: Add more checks to ci:daily workflow [#22815](https://github.com/storybooks/storybook/pull/22815)
- Build: Fix Nextjs E2E tests [#22816](https://github.com/storybooks/storybook/pull/22816)
- Build: Bring back new Vue3 tests to main [#22685](https://github.com/storybooks/storybook/pull/22685)

## 7.0.17 (May 24, 2023)

#### Bug Fixes

- Vite: Fix pnpm support by replacing @storybook/global with `window` [#22709](https://github.com/storybooks/storybook/pull/22709)
- Core: Fix `managerHead` preset in `main.ts` [#22701](https://github.com/storybooks/storybook/pull/22701)

## 7.0.16 (May 24, 2023)

Accidental no-op

## 7.0.15 (May 24, 2023)

#### Bug Fixes

- UI: Fix `.mp3` support for builder-manager [#22699](https://github.com/storybooks/storybook/pull/22699)
- Vite: Fix missing @storybook/global dependency [#22700](https://github.com/storybooks/storybook/pull/22700)
- NextJS: Fix compatibility with Next 13.4.3 [#22697](https://github.com/storybooks/storybook/pull/22697)

## 7.0.14 (May 23, 2023)

#### Bug Fixes

- Core: Only connect to serverChannel in development mode [#22575](https://github.com/storybooks/storybook/pull/22575)
- CLI: Fix error parsing on NPM proxy [#22690](https://github.com/storybooks/storybook/pull/22690)

#### Maintenance

- Core: Create server channel from window.location [#22055](https://github.com/storybooks/storybook/pull/22055)

## 7.0.13 (May 22, 2023)

#### Bug Fixes

- Angular: Fix process I/O for compodoc command [#22441](https://github.com/storybooks/storybook/pull/22441)
- CLI: Improve error handling when dealing with angular.json files [#22663](https://github.com/storybooks/storybook/pull/22663)
- CLI: Skip prompting for eslint plugin with --yes flag [#22651](https://github.com/storybooks/storybook/pull/22651)
- CLI: Account for windows paths when copying templates [#22644](https://github.com/storybooks/storybook/pull/22644)
- CLI: Fix pnpm init command [#22635](https://github.com/storybooks/storybook/pull/22635)
- UI: Add legacy font formats [#22576](https://github.com/storybooks/storybook/pull/22576)
- Webpack: Remove the alias for `global` [#22393](https://github.com/storybooks/storybook/pull/22393)

#### Maintenance

- Angular: Enable unit tests [#22355](https://github.com/storybooks/storybook/pull/22355)
- CLI: Reduce installation noise and improve error handling [#22554](https://github.com/storybooks/storybook/pull/22554)
- CLI: Only handle CTRL + C on init event [#22687](https://github.com/storybooks/storybook/pull/22687)
- CLI: Don't touch nx packages on upgrade [#22419](https://github.com/storybooks/storybook/pull/22419)

#### Build

- Build: Add discord notification when generating sandboxes fails [#22638](https://github.com/storybooks/storybook/pull/22638)
- Build: Set correct ref on sandboxes Github action [#22625](https://github.com/storybooks/storybook/pull/22625)
- Build: Fix sandbox generation scripts [#22620](https://github.com/storybooks/storybook/pull/22620)

## 7.0.12 (May 15, 2023)

#### Bug Fixes

- Core: Fix source snippets for stories with mapped args [#22135](https://github.com/storybooks/storybook/pull/22135)
- CLI: Fix `getFrameworkPackage` logic [#22559](https://github.com/storybooks/storybook/pull/22559)
- CLI: Remove automigrate reference from init command [#22561](https://github.com/storybooks/storybook/pull/22561)

#### Maintenance

- CLI: Detach automigrate command from storybook init [#22523](https://github.com/storybooks/storybook/pull/22523)

## 7.0.11 (May 12, 2023)

#### Bug Fixes

- Toolbars: Fix title behavior in UI [#22496](https://github.com/storybooks/storybook/pull/22496)
- CLI: Fix storybook upgrade precheckfailure object [#22517](https://github.com/storybooks/storybook/pull/22517)
- CLI: Throw errors instead of rejecting promises [#22515](https://github.com/storybooks/storybook/pull/22515)
- CLI: Remove unsupported frameworks/renderers and improve builder detection [#22492](https://github.com/storybooks/storybook/pull/22492)
- Web-components: Fix source decorator to handle document fragments [#22513](https://github.com/storybooks/storybook/pull/22513)
- Core: Fix windows path error in StoryStore v6 [#22512](https://github.com/storybooks/storybook/pull/22512)
- CLI: Do not show a migration summary on sb init [#22109](https://github.com/storybooks/storybook/pull/22109)
- UI: Show current search shortcut in search box sidebar [#21619](https://github.com/storybooks/storybook/pull/21619)
- Outline: Fix additional outline border in docs mode [#21773](https://github.com/storybooks/storybook/pull/21773)
- Measure: Deactivate when switching to Docs mode [#21602](https://github.com/storybooks/storybook/pull/21602)
- CSF: Expose story id in composeStories [#22471](https://github.com/storybooks/storybook/pull/22471)
- CLI: Prompt to force initialization when storybook folder is detected [#22392](https://github.com/storybooks/storybook/pull/22392)
- UI: Fix css inconsistency in Button and Icon components [#22497](https://github.com/storybooks/storybook/pull/22497)

## 7.0.10 (May 9, 2023)

#### Bug Fixes

- CLI: Fix copyTemplate failures on `init` [#22375](https://github.com/storybooks/storybook/pull/22375)
- CLI: Fix server init [#22443](https://github.com/storybooks/storybook/pull/22443)
- CLI: Scope styles in sample components from the CLI templates [#22162](https://github.com/storybooks/storybook/pull/22162)
- React: Use correct default annotations for composeStories [#22308](https://github.com/storybooks/storybook/pull/22308)
- Server: Add json indexer [#22460](https://github.com/storybooks/storybook/pull/22460)
- UI: Fix opacity from list-item color [#22074](https://github.com/storybooks/storybook/pull/22074)

#### Maintenance

- CLI: Refactor package manager methods to be async [#22401](https://github.com/storybooks/storybook/pull/22401)
- Improve Error message for Angular.json file not found [#22377](https://github.com/storybooks/storybook/pull/22377)

## 7.0.9 (May 5, 2023)

#### Bug Fixes

- Core: Fix virtual modules excluded for babel-loader [#22331](https://github.com/storybooks/storybook/pull/22331)

#### Maintenance

- Angular: Allow TypeScript 4.0.0 and 5.0.0 [#22391](https://github.com/storybooks/storybook/pull/22391)

## 7.0.8 (May 3, 2023)

#### Bug Fixes

- Typescript: Fix bad typings caused by tsup bug [#22261](https://github.com/storybooks/storybook/pull/22261)
- Migrate: skip the automigration for gf markdown when user isn't using mdx [#22186](https://github.com/storybooks/storybook/pull/22186)
- UI: Addon panel does not update after disabling/enabling an addon [#22258](https://github.com/storybooks/storybook/pull/22258)
- Vue3: Fix compiler error when there is double tag [#22286](https://github.com/storybooks/storybook/pull/22286)
- Args: Fix multiple mapped args return array of labels [#22169](https://github.com/storybooks/storybook/pull/22169)
- CLI: Add web-components webpack5 to missing-babelrc automigration [#22202](https://github.com/storybooks/storybook/pull/22202)
- Docs: Fix inline story style [#21870](https://github.com/storybooks/storybook/pull/21870)
- UI: Fix shift + 7 shortcut to focus search field [#22073](https://github.com/storybooks/storybook/pull/22073)
- UI: Fix controls missing when navigating from story [#21967](https://github.com/storybooks/storybook/pull/21967)
- NextJS: Fix tsconfig resolution [#22160](https://github.com/storybooks/storybook/pull/22160)

#### Maintenance

- Telemetry: Persist sessionId across runs [#22325](https://github.com/storybooks/storybook/pull/22325)
- Packaging: Move `types` condition to the front in all `package.json.exports` maps [#22321](https://github.com/storybooks/storybook/pull/22321)
- Core: Rename manager UI mjs to js [#22247](https://github.com/storybooks/storybook/pull/22247)
- Angular: Add support for Angular 16 [#22096](https://github.com/storybooks/storybook/pull/22096)
- Packaging: Don't generate ESM dist for preset files [#22330](https://github.com/storybooks/storybook/pull/22330)
- Packaging: Fix url for all packages in package.json [#22101](https://github.com/storybooks/storybook/pull/22101)
- Add regex to ignore outdated Browserslist in Jest initialization base file [#22260](https://github.com/storybooks/storybook/pull/22260)

## 7.0.7 (April 24, 2023)

#### Bug Fixes

- Core: Pass parameters in `SET_INDEX` for docs entries [#22154](https://github.com/storybooks/storybook/pull/22154)
- Addon-actions: Fix ESM by upgrading from uuid-browser to uuid [#22037](https://github.com/storybooks/storybook/pull/22037)
- Addon-actions: Fix decorator type [#22175](https://github.com/storybooks/storybook/pull/22175)
- Core: Add new tags to distinguish docs attachment [#22120](https://github.com/storybooks/storybook/pull/22120)
- Core: Restore Docs `useParameter` using `DOCS_PREPARED` [#22118](https://github.com/storybooks/storybook/pull/22118)

#### Maintenance

- CSF: Improve error message for bad default export [#22190](https://github.com/storybooks/storybook/pull/22190)
- CLI: Add addon query-params to list of SB7 incompatible addons [#22095](https://github.com/storybooks/storybook/pull/22095)
- UI: Add remount story shortcut [#21401](https://github.com/storybooks/storybook/pull/21401)

#### Build

- Build: Fix lit sandboxes [#22201](https://github.com/storybooks/storybook/pull/22201)
- Build: Fix sandbox publish script [#22206](https://github.com/storybooks/storybook/pull/22206)

## 7.0.6 (April 19, 2023)

#### Bug Fixes

- Core: Fix `module` guard in non-webpack environments [#22085](https://github.com/storybooks/storybook/pull/22085)

#### Maintenance

- CLI: Mark qwik as using addon-interactions [#22000](https://github.com/storybooks/storybook/pull/22000)

#### Build

- Build: Upgrade Playwright to 1.32.3 [#22087](https://github.com/storybooks/storybook/pull/22087)

## 7.0.5 (April 15, 2023)

#### Bug Fixes

- Docs: Fix source snippets when parameters.docs.source.type = 'code' [#22048](https://github.com/storybooks/storybook/pull/22048)
- CLI: Mention how to setup a monorepo manually in babelrc automigration [#22052](https://github.com/storybooks/storybook/pull/22052)
- UI: Fix upgrade command in about page [#22056](https://github.com/storybooks/storybook/pull/22056)
- CLI: Fix CLI sandbox command [#21977](https://github.com/storybooks/storybook/pull/21977)

## 7.0.4 (April 12, 2023)

Storybook 7.0 is here! 🎉

- ⚡️ [First-class Vite](https://storybook.js.org/blog/first-class-vite-support-in-storybook/)
- 🔼 [Zero-config NextJS](https://storybook.js.org/blog/integrate-nextjs-and-storybook-automatically/)
- 🇸 [Zero-config SvelteKit](https://storybook.js.org/blog/storybook-for-sveltekit/)
- 🏗️ [Frameworks API](https://storybook.js.org/blog/framework-api/)
- 3️⃣ [Component Story Format v3](https://storybook.js.org/blog/storybook-csf3-is-here/)
- 🛡️ [Improved type safety](https://storybook.js.org/blog/improved-type-safety-in-storybook-7/)
- 📚 [Docs overhaul with MDx2 support](https://storybook.js.org/blog/storybook-7-docs/)
- ☂️ [Code coverage for interaction testing](https://storybook.js.org/blog/code-coverage-with-the-storybook-test-runner/)
- 🖼️ [UI design refresh](https://storybook.js.org/blog/7-0-design-alpha/)
- 🏛️ [Improved stability](https://storybook.js.org/blog/storybook-ecosystem-ci/)

  7.0 contains hundreds more fixes, features, and tweaks. Browse the changelogs matching `7.0.0-alpha.*`, `7.0.0-beta.*`, and `7.0.0-rc.*` for the full list of changes.

See our [Migration guide](https://storybook.js.org/migration-guides/7.0) to upgrade from earlier versions of Storybook.

#### Bug Fixes

- CLI: Catch errors thrown on sanity check of SB installs [#22039](https://github.com/storybooks/storybook/pull/22039)

#### Dependency Upgrades

- Addon-docs: Remove mdx1-csf as optional peer dep [#22038](https://github.com/storybooks/storybook/pull/22038)

## 7.0.3 (April 12, 2023)

#### Bug Fixes

- React: Fix default export docgen for React.FC and forwardRef [#22024](https://github.com/storybooks/storybook/pull/22024)
- Viewport: Remove transitions when switching viewports [#21963](https://github.com/storybooks/storybook/pull/21963)
- CLI: Fix JsPackageManager typo [#22006](https://github.com/storybooks/storybook/pull/22006)
- Viewport: Fix the `defaultOrientation` config option [#21962](https://github.com/storybooks/storybook/pull/21962)
- UI: Fix story data access for broken About page [#21951](https://github.com/storybooks/storybook/pull/21951)
- Angular: Fix components disappearing on docs page on property change [#21944](https://github.com/storybooks/storybook/pull/21944)
- React: Don't show decorators in JSX snippets [#21907](https://github.com/storybooks/storybook/pull/21907)
- Addon-docs: Include decorators by default in source decorators [#21902](https://github.com/storybooks/storybook/pull/21902)
- CLI: Fix npm list command [#21947](https://github.com/storybooks/storybook/pull/21947)
- Core: Revert Emotion `:first-child` (etc) workarounds [#21213](https://github.com/storybooks/storybook/pull/21213)

#### Maintenance

- UI: Add remount story shortcut [#21401](https://github.com/storybooks/storybook/pull/21401)
- Telemetry: Add CLI version to context [#21999](https://github.com/storybooks/storybook/pull/21999)
- CLI: Update template code references to 7.0 [#21845](https://github.com/storybooks/storybook/pull/21845)
- Addon-actions: Fix non-included type file [#21922](https://github.com/storybooks/storybook/pull/21922)
- Addon GFM: Fix node-logger dependency [#21938](https://github.com/storybooks/storybook/pull/21938)

#### Dependency Upgrades

- React-vite: Fix perf regression by pinning vite-plugin-react-docgen-ts [#22013](https://github.com/storybooks/storybook/pull/22013)
- Update `@emotion/cache` version [#21941](https://github.com/storybooks/storybook/pull/21941)

## 7.0.2 (April 3, 2023)

Storybook 7.0 is here! 🎉

- ⚡️ [First-class Vite](https://storybook.js.org/blog/first-class-vite-support-in-storybook/)
- 🔼 [Zero-config NextJS](https://storybook.js.org/blog/integrate-nextjs-and-storybook-automatically/)
- 🇸 [Zero-config SvelteKit](https://storybook.js.org/blog/storybook-for-sveltekit/)
- 🏗️ [Frameworks API](https://storybook.js.org/blog/framework-api/)
- 3️⃣ [Component Story Format v3](https://storybook.js.org/blog/storybook-csf3-is-here/)
- 🛡️ [Improved type safety](https://storybook.js.org/blog/improved-type-safety-in-storybook-7/)
- 📚 [Docs overhaul with MDx2 support](https://storybook.js.org/blog/storybook-7-docs/)
- ☂️ [Code coverage for interaction testing](https://storybook.js.org/blog/code-coverage-with-the-storybook-test-runner/)
- 🖼️ [UI design refresh](https://storybook.js.org/blog/7-0-design-alpha/)
- 🏛️ [Improved stability](https://storybook.js.org/blog/storybook-ecosystem-ci/)

  7.0 contains hundreds more fixes, features, and tweaks. Browse the changelogs matching `7.0.0-alpha.*`, `7.0.0-beta.*`, and `7.0.0-rc.*` for the full list of changes.

See our [Migration guide](https://storybook.js.org/migration-guides/7.0) to upgrade from earlier versions of Storybook.

#### Bug Fixes

- CLI: Improve incompatible addons logic [#21883](https://github.com/storybooks/storybook/pull/21883)

## 7.0.1 (April 3, 2023)

#### Bug Fixes

- CLI: Always send error events if init doesn't succeed [#21879](https://github.com/storybooks/storybook/pull/21879)
- CLI: Warn when community addons are incompatible with Storybook 7 [#21863](https://github.com/storybooks/storybook/pull/21863)
- CLI: Fix migration summary message [#21862](https://github.com/storybooks/storybook/pull/21862)
- CLI: Fix link to new framework API migrations [#21875](https://github.com/storybooks/storybook/pull/21875)

#### Maintenance

- Angular: Remove deprecated `component`/`propsMeta` from story [#21807](https://github.com/storybooks/storybook/pull/21807)
- Remove deprecated flags and properties [#21852](https://github.com/storybooks/storybook/pull/21852)

#### Dependencies

- Fix codemod dependency conflict [#21876](https://github.com/storybooks/storybook/pull/21876)
- Upgrade satellite repos for 7.0 [#21881](https://github.com/storybooks/storybook/pull/21881)

## 7.0.0 (March 31, 2023)

Storybook 7.0 is here! 🎉

- ⚡️ [First-class Vite](https://storybook.js.org/blog/first-class-vite-support-in-storybook/)
- 🔼 [Zero-config NextJS](https://storybook.js.org/blog/integrate-nextjs-and-storybook-automatically/)
- 🇸 [Zero-config SvelteKit](https://storybook.js.org/blog/storybook-for-sveltekit/)
- 🏗️ [Frameworks API](https://storybook.js.org/blog/framework-api/)
- 3️⃣ [Component Story Format v3](https://storybook.js.org/blog/storybook-csf3-is-here/)
- 🛡️ [Improved type safety](https://storybook.js.org/blog/improved-type-safety-in-storybook-7/)
- 📚 [Docs overhaul with MDx2 support](https://storybook.js.org/blog/storybook-7-docs/)
- ☂️ [Code coverage for interaction testing](https://storybook.js.org/blog/code-coverage-with-the-storybook-test-runner/)
- 🖼️ [UI design refresh](https://storybook.js.org/blog/7-0-design-alpha/)
- 🏛️ [Improved stability](https://storybook.js.org/blog/storybook-ecosystem-ci/)

  7.0 contains hundreds more fixes, features, and tweaks. Browse the changelogs matching `7.0.0-alpha.*`, `7.0.0-beta.*`, and `7.0.0-rc.*` for the full list of changes.

See our [Migration guide](https://storybook.js.org/migration-guides/7.0) to upgrade from earlier versions of Storybook.

Full announcement and proper release to the `latest` npm tag coming soon. 😘

## 7.0.0-rc.11 (March 31, 2023)

#### Features

- CLI: Update stories glob in mdx codemod and not in mdx automigration [#21809](https://github.com/storybooks/storybook/pull/21809)

#### Bug Fixes

- TS: Make sure components with interfaces or no props don't raise decorator assignability issues [#21833](https://github.com/storybooks/storybook/pull/21833)
- Angular: Export applicationConfig decorator and adjust documentation for usage [#21851](https://github.com/storybooks/storybook/pull/21851)
- Vite: Polyfill global by default [#21832](https://github.com/storybooks/storybook/pull/21832)
- NextJS: Add explicit require.resolve calls to nextjs webpack loader config [#21834](https://github.com/storybooks/storybook/pull/21834)
- Angular: Fix support on Windows when Storystore v7 is disabled [#21830](https://github.com/storybooks/storybook/pull/21830)
- Angular: Fix module imported twice [#21770](https://github.com/storybooks/storybook/pull/21770)

#### Maintenance

- CLI: Fix duplicated dependency warning for major version differences [#21850](https://github.com/storybooks/storybook/pull/21850)
- Vite: downgrade remark related dependencies [#21836](https://github.com/storybooks/storybook/pull/21836)

#### Build

- Build: Remove workflow we no longer use [#21829](https://github.com/storybooks/storybook/pull/21829)

## 7.0.0-rc.10 (March 29, 2023)

#### Features

- CLI: Warn the user for duplicated versions after automigrate [#21791](https://github.com/storybooks/storybook/pull/21791)

#### Bug Fixes

- Addon-docs: Add `remark-slug` and `remark-external-links` to Vite builder [#21796](https://github.com/storybooks/storybook/pull/21796)
- Blocks: Add children prop types [#21803](https://github.com/storybooks/storybook/pull/21803)

#### Maintenance

- CLI: Upgrade to latest storybook/react-native version [#21811](https://github.com/storybooks/storybook/pull/21811)

## 7.0.0-rc.9 (March 29, 2023)

#### Bug Fixes

- CLI: Don't inline template functions in CSF2 to 3 codemod [#21539](https://github.com/storybooks/storybook/pull/21539)
- ArgTypes: Fix JSdoc missing deprecated tag [#21794](https://github.com/storybooks/storybook/pull/21794)
- UI: Scroll to highlighted search result [#21692](https://github.com/storybooks/storybook/pull/21692)
- Actions: Fix clearing number of actions [#21760](https://github.com/storybooks/storybook/pull/21760)
- UI: Fix cannot read properties of undefined at SearchResults [#21728](https://github.com/storybooks/storybook/pull/21728)
- CLI: Fix an issue where port can be NaN [#21785](https://github.com/storybooks/storybook/pull/21785)
- Docs: Exclude decorators by default from source [#21722](https://github.com/storybooks/storybook/pull/21722)
- Docs: Fix ArgsTable crashing on subcomponents [#21769](https://github.com/storybooks/storybook/pull/21769)
- Docs: Make Source `transform` API consistent [#21749](https://github.com/storybooks/storybook/pull/21749)

#### Maintenance

- Telemetry: Count components [#21774](https://github.com/storybooks/storybook/pull/21774)

#### Dependency Upgrades

- Vite: Unpin rollup version [#21748](https://github.com/storybooks/storybook/pull/21748)
- Upgrade slash package to v5.x [#21786](https://github.com/storybooks/storybook/pull/21786)

## 7.0.0-rc.8 (March 25, 2023)

#### Bug Fixes

- TypeScript: Fix missing env in StorybookConfig [#21732](https://github.com/storybooks/storybook/pull/21732)
- Composition: Fix src of iframe unless the version changes [#21713](https://github.com/storybooks/storybook/pull/21713)
- Composition: Fix the ref loading state showing up as empty instead [#21690](https://github.com/storybooks/storybook/pull/21690)

#### Build

- Build: Add e2e-tests-dev task [#21546](https://github.com/storybooks/storybook/pull/21546)
- Build: Fix CI after github.com SSH change [#21764](https://github.com/storybooks/storybook/pull/21764)

## 7.0.0-rc.7 (March 23, 2023)

#### Bug Fixes

- Svelte: Remount when resetting args in controls [#21659](https://github.com/storybooks/storybook/pull/21659)
- CLI: Fix support for env vars when running `dev`/`build` commands [#21152](https://github.com/storybooks/storybook/pull/21152)

#### Maintenance

- Core: upgrade esbuild, remove watch option from options [#21727](https://github.com/storybooks/storybook/pull/21727)

## 7.0.0-rc.6 (March 23, 2023)

#### Bug Fixes

- CLI: Fix sb add / mdx-gfm for addons with non-serializable values [#21731](https://github.com/storybooks/storybook/pull/21731)
- CSF-plugin: Fix sourcemaps [#21704](https://github.com/storybooks/storybook/pull/21704)
- React: Fix TS docgen for Functional Components [#21693](https://github.com/storybooks/storybook/pull/21693)
- TypeScript: Add previewMainTemplate option to StorybookConfig [#21620](https://github.com/storybooks/storybook/pull/21620)
- UI: Fix titles for addons/controls/panel tabs to support render fns and JSX elements [#21650](https://github.com/storybooks/storybook/pull/21650)
- UI: Fix active state for menu iconbutton [#21666](https://github.com/storybooks/storybook/pull/21666)
- CLI: Update renderer templates to provide correct typescript examples [#21647](https://github.com/storybooks/storybook/pull/21647)
- Composition: Fix various CORS issues [#21682](https://github.com/storybooks/storybook/pull/21682)
- Composition: Fix version switcher [#21621](https://github.com/storybooks/storybook/pull/21621)

#### Dependency Upgrades

- Pin rollup version to 3.19.1 [#21723](https://github.com/storybooks/storybook/pull/21723)

## 7.0.0-rc.5 (March 20, 2023)

#### Bug Fixes

- UI: Fix IconButton to be in active state when corresponding menu is open [#21622](https://github.com/storybooks/storybook/pull/21622)
- Angular: Fix `sb init` library support [#21675](https://github.com/storybooks/storybook/pull/21675)
- CLI: Fix Vue3 template CSS [#21674](https://github.com/storybooks/storybook/pull/21674)
- Core: fix storySort not reading from `.mjs` & `.cjs` files [#21637](https://github.com/storybooks/storybook/pull/21637)
- Core: Fix cts/mts file extensions for config files [#21465](https://github.com/storybooks/storybook/pull/21465)
- Core: Fix conflicting staticDirs case when -s flag is used [#21591](https://github.com/storybooks/storybook/pull/21591)
- Angular: Fix source preview for angular stories [#21609](https://github.com/storybooks/storybook/pull/21609)

## 7.0.0-rc.4 (March 17, 2023)

#### Features

- Angular: Add "assets" build option [#21116](https://github.com/storybooks/storybook/pull/21116)

#### Bug Fixes

- React: Fix missing framework options in shim [#21644](https://github.com/storybooks/storybook/pull/21644)
- Docs: Update MDX `Link` component to be more user friendly [#21570](https://github.com/storybooks/storybook/pull/21570)
- Links: Update LinkTo component [#21569](https://github.com/storybooks/storybook/pull/21569)
- Vite: Allow vue files in importfn [#21550](https://github.com/storybooks/storybook/pull/21550)
- Controls: Fix glitchy range control [#21459](https://github.com/storybooks/storybook/pull/21459)
- CLI: Fix styling regression on CLI starter Introduction.mdx file [#21466](https://github.com/storybooks/storybook/pull/21466)
- Addon-docs: Fix csf-plugin for Angular [#21629](https://github.com/storybooks/storybook/pull/21629)
- Vite: Fix alias array converted incorrectly to an object [#21480](https://github.com/storybooks/storybook/pull/21480)
- UI: Default white preview background [#21593](https://github.com/storybooks/storybook/pull/21593)
- Vite: Fix dev and yarn pnp by adding lodash files to optimizeDeps.include [#21535](https://github.com/storybooks/storybook/pull/21535)
- Composition: Fix blank page when ref is missing but specified in url [#21598](https://github.com/storybooks/storybook/pull/21598)
- Core: Disable cache in dev-mode [#21574](https://github.com/storybooks/storybook/pull/21574)
- Vite: Fix react-vite and projects with absolute path preview entries on Windows [#21545](https://github.com/storybooks/storybook/pull/21545)
- UI: Change the way of preloading fonts [#21599](https://github.com/storybooks/storybook/pull/21599)
- Core: Add preload and prefetch links for runtime.mjs and related files [#21594](https://github.com/storybooks/storybook/pull/21594)
- React: Fix type inconsistencies in composeStories [#21575](https://github.com/storybooks/storybook/pull/21575)
- UI: Fix WithTooltip to use visible prop instead of defaultVisible [#21589](https://github.com/storybooks/storybook/pull/21589)

#### Maintenance

- Blocks: Iprove error messages [#21615](https://github.com/storybooks/storybook/pull/21615)

#### Build

- Build: Regen lockfiles [#21576](https://github.com/storybooks/storybook/pull/21576)
- Build: Fix coverage job in CircleCI [#21633](https://github.com/storybooks/storybook/pull/21633)
- Vite: Update sandbox template for vue2 script [#20750](https://github.com/storybooks/storybook/pull/20750)

## 7.0.0-rc.3 (March 14, 2023)

#### Bug Fixes

- Revert "CLI: Upgrade non-core storybook packages better" [#21583](https://github.com/storybooks/storybook/pull/21583)
- CLI: Fix loading main.cjs files in automigration [#21582](https://github.com/storybooks/storybook/pull/21582)
- Outline: Fixed a typo [#21515](https://github.com/storybooks/storybook/pull/21515)

#### Maintenance

- CLI: Improve MDX codemod message regarding Story.id deprecation [#21541](https://github.com/storybooks/storybook/pull/21541)

## 7.0.0-rc.2 (March 13, 2023)

#### Bug Fixes

- CLI: Fix MDX codemod to update imports even when no stories are extracted [#21549](https://github.com/storybooks/storybook/pull/21549)
- NextJS: Support next/font in Next v13.2.4 [#21560](https://github.com/storybooks/storybook/pull/21560)

#### Build

- Fix 'yarn build' command on windows systems [#21531](https://github.com/storybooks/storybook/pull/21531)

## 7.0.0-rc.1 (March 10, 2023)

#### Bug Fixes

- Revert "Merge pull request #21486 from storybookjs/norbert/wrap-for-pnp" [#21532](https://github.com/storybooks/storybook/pull/21532)
- Revert "Merge pull request #21497 from storybookjs/tom/21432-replace-… [#21526](https://github.com/storybooks/storybook/pull/21526)
- Csf-tools: Update babelParse to use legacy decorator syntax [#21506](https://github.com/storybooks/storybook/pull/21506)

## 7.0.0-rc.0 (March 10, 2023)

#### Bug Fixes

- CLI: Upgrade non-core storybook packages better [#21508](https://github.com/storybooks/storybook/pull/21508)
- Svelte: Pass all arguments to configure through to fix StoryStoreV6 [#21491](https://github.com/storybooks/storybook/pull/21491)
- Core: Fix project root detection in yarn PnP without git [#21461](https://github.com/storybooks/storybook/pull/21461)
- Telemetry: Replace isomorphic-unfetch with node-fetch in telemetry [#21497](https://github.com/storybooks/storybook/pull/21497)
- Core: Fix builders/renderer PnP support [#21486](https://github.com/storybooks/storybook/pull/21486)
- CLI: Require main.js without cache in automigrations [#21498](https://github.com/storybooks/storybook/pull/21498)

#### Maintenance

- CLI: Filter out internal static dir logging [#21137](https://github.com/storybooks/storybook/pull/21137)
- Docs: Error if you try to index an MDX file in ssv6 [#21495](https://github.com/storybooks/storybook/pull/21495)

#### Build

- Build: add slash to fix windows test [#21518](https://github.com/storybooks/storybook/pull/21518)

## 7.0.0-beta.64 (March 9, 2023)

#### Bug Fixes

- Vite: Fix HMR of preview.js [#21485](https://github.com/storybooks/storybook/pull/21485)
- Vite: Make sure we update the vite import map when .mdx is added [#21490](https://github.com/storybooks/storybook/pull/21490)
- Docs: Don't allow passing `of={}` with undefined prop [#21452](https://github.com/storybooks/storybook/pull/21452)
- Composition: Restore support for v2 stories.json [#21354](https://github.com/storybooks/storybook/pull/21354)

## 7.0.0-beta.63 (March 9, 2023)

#### Bug Fixes

- Story Index: Fix storySort parsing for parameters variable [#21481](https://github.com/storybooks/storybook/pull/21481)
- React/Vite: Add some missing types [#21449](https://github.com/storybooks/storybook/pull/21449)
- Docs: Cleanup with Promise instead of setTimeout [#21476](https://github.com/storybooks/storybook/pull/21476)
- Docs: Re-render MDX files when you fix a thrown error [#21454](https://github.com/storybooks/storybook/pull/21454)
- CLI: Fix mdx-to-csf codemod blocks imports [#21448](https://github.com/storybooks/storybook/pull/21448)

#### Maintenance

- CLI: Copy tweaks for automigrations [#21475](https://github.com/storybooks/storybook/pull/21475)
- CLI: Warn the user when stories glob does not match any file [#21392](https://github.com/storybooks/storybook/pull/21392)
- Docs: Use `Of` type in `useOf` argument [#21442](https://github.com/storybooks/storybook/pull/21442)
- Telemetry: Is interactive shell [#21436](https://github.com/storybooks/storybook/pull/21436)

## 7.0.0-beta.62 (March 6, 2023)

#### Bug Fixes

- Vite: Add react docgen types [#21338](https://github.com/storybooks/storybook/pull/21338)
- Core: Print errors in `withTelemetry` before prompting [#21407](https://github.com/storybooks/storybook/pull/21407)
- Add Angular Builder Codemods [#21409](https://github.com/storybooks/storybook/pull/21409)
- Docs: Use async import rather than require in docs [#21402](https://github.com/storybooks/storybook/pull/21402)
- Docs: Don't warn if we find the same entry twice [#21403](https://github.com/storybooks/storybook/pull/21403)
- Telemetry: Ensure we report errors even when unexpected things happen [#21416](https://github.com/storybooks/storybook/pull/21416)
- CLI: Fix versions.ts to install latest prerelease packages [#21418](https://github.com/storybooks/storybook/pull/21418)
- Core: Remove pointless `module.hot.decline()` in addons [#21421](https://github.com/storybooks/storybook/pull/21421)
- Docs: Allow ArgTable usage unattached [#21371](https://github.com/storybooks/storybook/pull/21371)

#### Maintenance

- Addon-docs: Polish styling for 7.0 [#21255](https://github.com/storybooks/storybook/pull/21255)

## 7.0.0-beta.61 (March 4, 2023)

#### Features

- Docs: Show MDX errors using our error overlay [#21369](https://github.com/storybooks/storybook/pull/21369)

#### Bug Fixes

- Core: Remove state deprecation warnings by default [#21367](https://github.com/storybooks/storybook/pull/21367)
- Core: Fix default export storySort handling [#21389](https://github.com/storybooks/storybook/pull/21389)
- Vue3: Add slot TS types [#21359](https://github.com/storybooks/storybook/pull/21359)
- Docs: Fix issue with referencing non-story files with names similar or equal to docs files [#21348](https://github.com/storybooks/storybook/pull/21348)

#### Maintenance

- Docs: Update invalid `<Meta of={}>` error to be more helpful. [#21365](https://github.com/storybooks/storybook/pull/21365)

#### Dependency Upgrades

- Upgrade react-docgen-typescript-plugin for TS4.8 [#21380](https://github.com/storybooks/storybook/pull/21380)

## 7.0.0-beta.60 (March 3, 2023)

#### Bug Fixes

- Core: Fix storySort parsing in preview.js with default export [#21353](https://github.com/storybooks/storybook/pull/21353)
- CLI: Remove the workspace root flag from the install command for yarn2 [#21356](https://github.com/storybooks/storybook/pull/21356)
- Svelte/Vite: Prevent crash when no svelte.config file [#21339](https://github.com/storybooks/storybook/pull/21339)
- Use stable Next.js v13.2.0 next/font [#21247](https://github.com/storybooks/storybook/pull/21247)

#### Dependency Upgrades

- Bump version of get-tarball [#21355](https://github.com/storybooks/storybook/pull/21355)

## 7.0.0-beta.59 (March 2, 2023)

#### Bug Fixes

- CLI: Improve yarn/pnpm workspaces support for adding dependencies in CLI [#21331](https://github.com/storybooks/storybook/pull/21331)
- Core: Fix `manager.js` ignored when `sideEffects:false` in `package.json` [#21335](https://github.com/storybooks/storybook/pull/21335)
- Vite: Fix glob path creation for Windows [#21305](https://github.com/storybookjs/storybook/pull/21305)

## 7.0.0-beta.58 (March 1, 2023)

#### Bug Fixes

- UI: Fix enableShortcuts, exclude it from being persisted [#21291](https://github.com/storybooks/storybook/pull/21291)
- NextJS: Fix type references in Next.js >= 13.2.0 [#21304](https://github.com/storybooks/storybook/pull/21304)
- CLI: Fix formatting of autodocs-true automigration [#21314](https://github.com/storybooks/storybook/pull/21314)
- Docs: Remove warning when browsing away in React [#21214](https://github.com/storybooks/storybook/pull/21214)

#### Maintenance

- CLI: Fix security report around `download-tarball` package [#21201](https://github.com/storybooks/storybook/pull/21201)
- CSF-Tools/Codemods: Un-bundle babel, limit semver range of babel packages [#21326](https://github.com/storybooks/storybook/pull/21326)

## 7.0.0-beta.57 (March 1, 2023)

#### Bug Fixes

- CSF-tools/Codemods: Pre-bundle all babel related packages [#21301](https://github.com/storybooks/storybook/pull/21301)
- UI: Fix height adjustment in ZoomElement in Safari [#21174](https://github.com/storybooks/storybook/pull/21174)

## 7.0.0-beta.56 (March 1, 2023)

#### Bug Fixes

- Core: Improve framework field validation [#21299](https://github.com/storybooks/storybook/pull/21299)
- SvelteKit: Only disable SSR when building, not serving [#21290](https://github.com/storybooks/storybook/pull/21290)
- CLI: Account for legacy framework values in automigration [#21184](https://github.com/storybooks/storybook/pull/21184)
- TypeScript: Add `env` type to BuilderOptions [#21173](https://github.com/storybooks/storybook/pull/21173)
- Core: Reverse order of project decorators [#21182](https://github.com/storybooks/storybook/pull/21182)

#### Maintenance

- React-webpack: Fix dependencies to remove peerDep warnings [#21278](https://github.com/storybooks/storybook/pull/21278)

#### Build

- Build: Improve sandbox task logs [#21296](https://github.com/storybooks/storybook/pull/21296)

## 7.0.0-beta.55 (February 27, 2023)

#### Bug Fixes

- NextJS: Fix next/babel preset [#21104](https://github.com/storybooks/storybook/pull/21104)
- CLI: Pass config dir from upgrade to automigration [#21270](https://github.com/storybooks/storybook/pull/21270)
- Docs: Show errors when stories throw in docs [#21212](https://github.com/storybooks/storybook/pull/21212)
- CLI: Fix performance regression of storybook dev [#21269](https://github.com/storybooks/storybook/pull/21269)

#### Build

- Build: Remove jest_workaround swc package by adding extra jest.mock functions [#21249](https://github.com/storybooks/storybook/pull/21249)
- Build: Upgrade playwright & re-enable bench [#21241](https://github.com/storybooks/storybook/pull/21241)

## 7.0.0-beta.54 (February 24, 2023)

#### Features

- Core: Add `preview.js` default export support [#21227](https://github.com/storybooks/storybook/pull/21227)
- TypeScript: Add preview type and update CLI template [#21205](https://github.com/storybooks/storybook/pull/21205)
- Autodocs: Hide Stories block when only primary story exists [#21178](https://github.com/storybooks/storybook/pull/21178)
- CLI: Add automigration for GFM in MDX [#21186](https://github.com/storybooks/storybook/pull/21186)

#### Bug Fixes

- Docs: Remove `react-dom@18` warning in docs [#21197](https://github.com/storybooks/storybook/pull/21197)
- mdx-to-csf codemod: Fix wrong export referenced in generated mdx [#21226](https://github.com/storybooks/storybook/pull/21226)
- Preact: Enable ts plugin by default [#21225](https://github.com/storybooks/storybook/pull/21225)
- pnpm: Fix run command for pnpm API [#21165](https://github.com/storybooks/storybook/pull/21165)
- Angular: Properly destroy component when switching to another Story [#21219](https://github.com/storybooks/storybook/pull/21219)
- CLI: Fix SvelteKit automigration package name [#21210](https://github.com/storybooks/storybook/pull/21210)
- Angular: Initialize .storybook without references to root in sub projects [#21202](https://github.com/storybooks/storybook/pull/21202)

#### Maintenance

- CLI: Only run useful automigrations on init [#21203](https://github.com/storybooks/storybook/pull/21203)

#### Build

- Build: Disable broken cra-bench [#21238](https://github.com/storybooks/storybook/pull/21238)
- Revert "Remove vue-cli as sandbox template is currently busted" [#21237](https://github.com/storybooks/storybook/pull/21237)
- Build: Add mixed exports test case to composeConfigs [#21230](https://github.com/storybooks/storybook/pull/21230)
- Build: pass debug option to sandbox generate task [#21200](https://github.com/storybooks/storybook/pull/21200)
- Build: add @storybook/bench [#21199](https://github.com/storybooks/storybook/pull/21199)
- Build: Fix Playwright to v1.30.0 [#21194](https://github.com/storybooks/storybook/pull/21194)

## 7.0.0-beta.53 (February 22, 2023)

#### Features

- Codemod: Convert `.stories.mdx` to MDX and CSF [#21073](https://github.com/storybooks/storybook/pull/21073)

#### Bug Fixes

- Csf Tools: Fix overriding scalar named export values [#21190](https://github.com/storybooks/storybook/pull/21190)
- Csf Tools: Support satisfies and as TS operator with module.exports [#21188](https://github.com/storybooks/storybook/pull/21188)
- Core: try harder to resolve `.mjs` files for the browser entries [#21161](https://github.com/storybooks/storybook/pull/21161)
- CLI: Fix jscodeshift error: env: node\r: No such file or directory [#21180](https://github.com/storybooks/storybook/pull/21180)
- Angular: Fix NG0800 error [#21181](https://github.com/storybooks/storybook/pull/21181)
- Addon-docs: Fix style bleeding [#21150](https://github.com/storybooks/storybook/pull/21150)
- CLI: Improve how automigrations read `main.js` [#21168](https://github.com/storybooks/storybook/pull/21168)

#### Build

- Build: Add check step to `ci:daily` workflow [#21169](https://github.com/storybooks/storybook/pull/21169)

## 7.0.0-beta.52 (February 21, 2023)

#### Features

- Core: Coalesce multiple indexing errors into one [#21114](https://github.com/storybooks/storybook/pull/21114)
- Core: Don't crash when there are errors indexing [#21112](https://github.com/storybooks/storybook/pull/21112)

#### Bug Fixes

- CLI: Fix CRA init, ensure the new version of the preset [#21166](https://github.com/storybooks/storybook/pull/21166)
- Angular: Fix 'isStandalone' function not available error [#21167](https://github.com/storybooks/storybook/pull/21167)
- Angular: Fix constructor dependencies [#21059](https://github.com/storybooks/storybook/pull/21059)
- NextJS: Add missing dependencies to fix pnpm [#21162](https://github.com/storybooks/storybook/pull/21162)

## 7.0.0-beta.51 (February 20, 2023)

#### Features

- CLI: Improve monorepo support in `automigrate` and revamp framework-related migrations [#20647](https://github.com/storybooks/storybook/pull/20647)

#### Bug Fixes

- UI: Correctly detect Safari in browser supports CSS Zoom [#21163](https://github.com/storybooks/storybook/pull/21163)
- Web-components: Fix StorybookConfig of webcomponents-webpack5 [#21144](https://github.com/storybooks/storybook/pull/21144)
- Storysource: Fallback to the `docs.source.originalSource` parameter [#21159](https://github.com/storybooks/storybook/pull/21159)
- UI: Fix skip to canvas link style [#21021](https://github.com/storybooks/storybook/pull/21021)
- Vue2: Fix events to use bracket notation [#20754](https://github.com/storybooks/storybook/pull/20754)

### Maintenance

- Maintenance: Fix type errors on automigrate `check` step [#21164](https://github.com/storybooks/storybook/pull/21164)
- Core: Rename `framework` parameter to `renderer` [#21108](https://github.com/storybooks/storybook/pull/21108)
- Docs: Remove `DocsOptions.disable` [#21098](https://github.com/storybooks/storybook/pull/21098)

## 7.0.0-beta.50 (February 18, 2023)

#### Bug Fixes

- Revert upgrade to react-docgen-typescript-plugin [#21147](https://github.com/storybooks/storybook/pull/21147)
- Revert Vite fix storysource addon support [#21146](https://github.com/storybooks/storybook/pull/21146)
- UI: Fix Canvas zoom height [#21138](https://github.com/storybooks/storybook/pull/21138)
- Addon-interaction: Fix tooltips don't disappear correctly [#21105](https://github.com/storybooks/storybook/pull/21105)
- UI: Fix CSS zoom in Safari [#21069](https://github.com/storybooks/storybook/pull/21069)

#### Maintenance

- Storysource: Rename "Story" tab to "Code" [#21132](https://github.com/storybooks/storybook/pull/21132)
- TypeScript: Fix `@ts-expect-error` strict types [#20981](https://github.com/storybooks/storybook/pull/20981)
- UI: Update border color to match Design System proposal [#20660](https://github.com/storybooks/storybook/pull/20660)
- CLI: Don't render issue template reproduction section with shell [#21128](https://github.com/storybooks/storybook/pull/21128)

#### Dependency Upgrades

- Vite: Update dep range for @storybook/mdx1-csf [#21123](https://github.com/storybooks/storybook/pull/21123)

## 7.0.0-beta.49 (February 17, 2023)

#### Bug Fixes

- NextJS: Fix static dirs lookup [#21119](https://github.com/storybooks/storybook/pull/21119)
- Svelte/Vue: Use Vite by default [#21002](https://github.com/storybooks/storybook/pull/21002)
- Storyshots: Fix issue with default export in main.js [#21097](https://github.com/storybooks/storybook/pull/21097)
- Args: Fix boolean arg types parsing and encoding [#21102](https://github.com/storybooks/storybook/pull/21102)

#### Maintenance

- CRA: Add CRA preset to monorepo [#21107](https://github.com/storybooks/storybook/pull/21107)
- Web-components: Drop lit1 support [#21106](https://github.com/storybooks/storybook/pull/21106)
- NextJS: Fix some dependency warnings [#21117](https://github.com/storybooks/storybook/pull/21117)
- Types: Remove unnecessary dependencies [#20993](https://github.com/storybooks/storybook/pull/20993)

#### Build

- Build: regen lockfiles [#21126](https://github.com/storybooks/storybook/pull/21126)

## 7.0.0-beta.48 (February 15, 2023)

#### Features

- Interactions: Add debugger to the addon panel [#21088](https://github.com/storybooks/storybook/pull/21088)

#### Bug Fixes

- CLI: Fix pnp support & add auto-detection [#21046](https://github.com/storybooks/storybook/pull/21046)
- Vite: Fix storysource addon support [#21096](https://github.com/storybooks/storybook/pull/21096)
- NextJS: Fix dynamic source snippets [#21029](https://github.com/storybooks/storybook/pull/21029)
- Addon-docs: Fix source snippets for duplicate source blocks [#20915](https://github.com/storybooks/storybook/pull/20915)

#### Maintenance

- TypeScript: Fix some unsound type check errors [#21081](https://github.com/storybooks/storybook/pull/21081)

#### Build

- Build: Fix yarn build command [#21099](https://github.com/storybooks/storybook/pull/21099)
- Tech: upgrades [#21086](https://github.com/storybooks/storybook/pull/21086)

#### Dependency Upgrades

- Remove unused dependencies from core-common [#20994](https://github.com/storybooks/storybook/pull/20994)
- Upgrade react-docgen-typescript-plugin [#21095](https://github.com/storybooks/storybook/pull/21095)

## 7.0.0-beta.47 (February 14, 2023)

#### Features

- Vite: Support legacyMdx1 fallback flag [#20823](https://github.com/storybooks/storybook/pull/20823)
- CLI: Automigration to update `mdx` stories config [#21035](https://github.com/storybooks/storybook/pull/21035)

#### Bug Fixes

- Vue3: Fix CSF2 support with decorators [#20995](https://github.com/storybooks/storybook/pull/20995)
- CLI: Do not use modern TS assets in legacy TS projects [#20458](https://github.com/storybooks/storybook/pull/20458)
- CLI: Fix conflicts in static dirs [#21064](https://github.com/storybooks/storybook/pull/21064)

#### Maintenance

- CLI: Update init script for react-native v6.5 [#20719](https://github.com/storybooks/storybook/pull/20719)
- CLI: Re-enable vue-vite in new-frameworks automigration [#20970](https://github.com/storybooks/storybook/pull/20970)

## 7.0.0-beta.46 (February 10, 2023)

#### Features

- CLI: Add Solid integration [#20991](https://github.com/storybooks/storybook/pull/20991)
- Viewport: Add `defaultOrientation` parameter [#21048](https://github.com/storybooks/storybook/pull/21048)

#### Bug Fixes

- CLI: Account for pnp when creating main.js in `storybook init` [#21049](https://github.com/storybooks/storybook/pull/21049)
- Core: Detect mdx2 errors and provide guidance to fix them [#20917](https://github.com/storybooks/storybook/pull/20917)
- Angular: provideHttpClient when HttpClientModule is present in the imports array [#21028](https://github.com/storybooks/storybook/pull/21028)

#### Build

- Build: Allow `stories` folder to be served by vite sandboxes [#21022](https://github.com/storybooks/storybook/pull/21022)

## 7.0.0-beta.45 (February 9, 2023)

#### Features

- UI: Menu design upgrade [#20898](https://github.com/storybooks/storybook/pull/20898)

#### Bug Fixes

- Vite: Use posix paths for glob [#21013](https://github.com/storybooks/storybook/pull/21013)

#### Maintenance

- Telemetry: Hash error messages [#20990](https://github.com/storybooks/storybook/pull/20990)

## 7.0.0-beta.44 (February 7, 2023)

#### Features

- Feature: Add woff2 support for builder-manager [#20962](https://github.com/storybooks/storybook/pull/20962)
- Feature: Add super early node version check [#20964](https://github.com/storybooks/storybook/pull/20964)
- Csf-tools: Add `satisfies` support to ConfigFile [#20936](https://github.com/storybooks/storybook/pull/20936)

#### Bug Fixes

- Angular: Fix changeDetectorRef should be defined [#20984](https://github.com/storybooks/storybook/pull/20984)
- Angular: Fix standalone components to be included in the imports array [#20983](https://github.com/storybooks/storybook/pull/20983)
- CLI: Fix Introduction MDX for Next.js and Typescript [#20798](https://github.com/storybooks/storybook/pull/20798)
- CLI: Fix detection of JS projects with type checking [#20944](https://github.com/storybooks/storybook/pull/20944)
- UI: Fix fonts missing/warnings [#20957](https://github.com/storybooks/storybook/pull/20957)
- Core: Undo AST main.js check in validateConfigFile [#20952](https://github.com/storybooks/storybook/pull/20952)
- Csf-tools: Fix error handling for storySort variable references [#20930](https://github.com/storybooks/storybook/pull/20930)

#### Maintenance

- Core: Fix missing dependency for core-server [#20989](https://github.com/storybooks/storybook/pull/20989)
- CLI: Add a default background to newly initialized storybooks [#20982](https://github.com/storybooks/storybook/pull/20982)
- Svelte/Vite: Remove `svelte-options` [#20942](https://github.com/storybooks/storybook/pull/20942)
- Vite: Correctly preserve existing vite envPrefix config [#20918](https://github.com/storybooks/storybook/pull/20918)

#### Dependencies

- Deps: Upgrade glob-promise [#20959](https://github.com/storybooks/storybook/pull/20959)
- Deps: Update glob for storyshots [#20954](https://github.com/storybooks/storybook/pull/20954)

#### Build

- Build: upgrade yarn [#20986](https://github.com/storybooks/storybook/pull/20986)
- Build: add more sandboxes to CI tests [#20892](https://github.com/storybooks/storybook/pull/20892)

## 7.0.0-beta.43 (February 4, 2023)

#### Bug Fixes

- Core: Fix globs on windows [#20929](https://github.com/storybooks/storybook/pull/20929)
- Revert addon-docs: update story index generator [#20809](https://github.com/storybooks/storybook/pull/20809)

## 7.0.0-beta.42 (February 4, 2023)

#### Features

- CLI: Add type annotations in javascript main config files [#20887](https://github.com/storybooks/storybook/pull/20887)
- UI: Tab Improvements [#20783](https://github.com/storybooks/storybook/pull/20783)

#### Build

- Build: fix next [#20924](https://github.com/storybooks/storybook/pull/20924)

#### Dependency Upgrades

- Upgrade jscodeshift to 0.14.0 [#20925](https://github.com/storybooks/storybook/pull/20925)
- Upgrade glob to 8.1.0 [#20927](https://github.com/storybooks/storybook/pull/20927)

## 7.0.0-beta.41 (February 3, 2023)

#### Features

- UI: Add nunito sans font [#20846](https://github.com/storybooks/storybook/pull/20846)

#### Bug Fixes

- Vite/Addon-docs: Fix customization of MDX plugins [#20116](https://github.com/storybooks/storybook/pull/20116)
- Angular: Support NoopAnimationsModule [#20868](https://github.com/storybooks/storybook/pull/20868)
- Core: Fix index error handling [#20906](https://github.com/storybooks/storybook/pull/20906)
- Outline: Fix outline initial state [#20818](https://github.com/storybooks/storybook/pull/20818)

#### Maintenance

- CLI: Remove the deprecated `--no-manager-cache` flag [#20895](https://github.com/storybooks/storybook/pull/20895)

#### Build

- Build: Change `rootDir` in TS plugin [#20911](https://github.com/storybooks/storybook/pull/20911)
- Build: Improve task log and error messages for event log [#20902](https://github.com/storybooks/storybook/pull/20902)
- Build: minor fixes [#20894](https://github.com/storybooks/storybook/pull/20894)

## 7.0.0-beta.40 (February 2, 2023)

#### Features

- Addo-docs: Turn on autodocs for CSF with attached meta [#20867](https://github.com/storybooks/storybook/pull/20867)

#### Bug Fixes

- Vue3: Fix args losing reactivity when using decorators [#20854](https://github.com/storybooks/storybook/pull/20854)
- Doc Blocks: Fix styling and parameter bugs [#20803](https://github.com/storybooks/storybook/pull/20803)
- Addon-docs: Export controls from doc blocks [#20806](https://github.com/storybooks/storybook/pull/20806)
- Webpack: Support builder options from framework [#20842](https://github.com/storybooks/storybook/pull/20842)

## 7.0.0-beta.39 (February 1, 2023)

#### Features

- Core: return address of dev server from buildDevStandalone [#20820](https://github.com/storybooks/storybook/pull/20820)
- Addons: Fix env variables not available inside addons [#20834](https://github.com/storybooks/storybook/pull/20834)
- CLI: Add warning when main config does not use default exports [#20802](https://github.com/storybooks/storybook/pull/20802)

#### Bug Fixes

- SvelteKit: Disable failing `vite-plugin-sveltekit-guard` [#20870](https://github.com/storybooks/storybook/pull/20870)

#### Maintenance

- Core: Remove core-js as a dependency [#20833](https://github.com/storybooks/storybook/pull/20833)

#### Build

- Build: cleanup CI config [#20853](https://github.com/storybooks/storybook/pull/20853)
- Change forceReRender story to forceRemount [#20752](https://github.com/storybooks/storybook/pull/20752)

## 7.0.0-beta.38 (January 31, 2023)

#### Features

- CLI: Generate main config with default exports [#20797](https://github.com/storybooks/storybook/pull/20797)

#### Bug Fixes

- CLI: Only add dependencies on sb init if they do not exist [#20811](https://github.com/storybooks/storybook/pull/20811)
- CLI: Install prerelease of @storybook/testing-library in CLI starters [#20819](https://github.com/storybooks/storybook/pull/20819)

#### Dependency Upgrades

- Update lazy-universal-dotenv & regen lockfile [#20832](https://github.com/storybooks/storybook/pull/20832)
- Instrumenter: Remove unused core-js dependency [#20831](https://github.com/storybooks/storybook/pull/20831)

## 7.0.0-beta.37 (January 31, 2023)

Failed publish

## 7.0.0-beta.36 (January 28, 2023)

#### Features

- Core: Story context is prepared before for supporting fine grained updates [#20755](https://github.com/storybooks/storybook/pull/20755)
- Addon-docs: New Markdown block [#20796](https://github.com/storybooks/storybook/pull/20796)
- Addon-docs: Disable Markdown transclusion and support ?raw .md files [#20790](https://github.com/storybooks/storybook/pull/20790)

#### Bug Fixes

- Addon-docs: Allow using `<Source code=".." />` unattached. [#20807](https://github.com/storybooks/storybook/pull/20807)
- Vite: Replace vite-plugin-externals with custom plugin [#20698](https://github.com/storybooks/storybook/pull/20698)
- Sveltekit: Ensure SSR is disabled [#20804](https://github.com/storybooks/storybook/pull/20804)

## 7.0.0-beta.35 (January 27, 2023)

#### Bug Fixes

- Storysource: Support CSF3 object exports, co-exist with addon-docs [#20799](https://github.com/storybooks/storybook/pull/20799)
- Vite: Do not pre-bundle @vitejs/plugin-vue [#20787](https://github.com/storybooks/storybook/pull/20787)
- CLI: Fix new-frameworks automigration in angular projects [#20788](https://github.com/storybooks/storybook/pull/20788)

## 7.0.0-beta.34 (January 26, 2023)

#### Features

- Addon-docs: Add legacy transitional support for MDX1 [#20747](https://github.com/storybooks/storybook/pull/20747)

#### Bug Fixes

- CLI: Fix global flag corner case [#20776](https://github.com/storybooks/storybook/pull/20776)
- Csf-tools: Fix ConfigFile string literal property handling [#20785](https://github.com/storybooks/storybook/pull/20785)
- Angular: Ensure docsMode flag has effect [#20711](https://github.com/storybooks/storybook/pull/20711)
- Angular: Use Providers in boostrapApplication option [#20746](https://github.com/storybooks/storybook/pull/20746)
- WebComponents: Fix Button type error [#20722](https://github.com/storybooks/storybook/pull/20722)

#### Build

- Verify consistency of anonymous id [#20781](https://github.com/storybooks/storybook/pull/20781)
- Build: fix playwright unsynced version in CI [#20778](https://github.com/storybooks/storybook/pull/20778)
- Upgrade playwright [#20777](https://github.com/storybooks/storybook/pull/20777)

#### Dependency Upgrades

- Deps: Upgrade fs-extra to 11.1.0 [#20772](https://github.com/storybooks/storybook/pull/20772)

## 7.0.0-beta.33 (January 24, 2023)

#### Features

- Addon-docs: Allow `<Story/>` to reference the first story [#20765](https://github.com/storybooks/storybook/pull/20765)

#### Bug Fixes

- Angular: Fix issue if BrowserAnimationsModule is imported [#20709](https://github.com/storybooks/storybook/pull/20709)
- Core: Fix issue with inconsistent CSF ordering in sandboxes [#20705](https://github.com/storybooks/storybook/pull/20705)
- Fixed paths in generated main.cjs for the default sandbox on Windows [#20724](https://github.com/storybooks/storybook/pull/20724)
- Blocks: Ignore known blocks with global CSS selector [#20757](https://github.com/storybooks/storybook/pull/20757)

#### Maintenance

- Docs: Make reference stories consistent [#20759](https://github.com/storybooks/storybook/pull/20759)
- Blocks: New Canvas API [#20723](https://github.com/storybooks/storybook/pull/20723)

#### Build

- Fix vue sandbox: remove the lang=ts in a file, that should remain agnostic [#20768](https://github.com/storybooks/storybook/pull/20768)
- Build: do not treat check as a cache-able operation && cleanup [#20762](https://github.com/storybooks/storybook/pull/20762)

## 7.0.0-beta.32 (January 24, 2023)

#### Features

- CLI: Add init support for qwik projects [#20411](https://github.com/storybooks/storybook/pull/20411)

#### Bug Fixes

- Vue3: Fix reactive args + many vue app creation issue [#20712](https://github.com/storybooks/storybook/pull/20712)
- Docs: Allow "declaring" stories with `story={}` [#20702](https://github.com/storybooks/storybook/pull/20702)
- Addon-links: Fix the d.ts file, deprecate LinkTo [#20671](https://github.com/storybooks/storybook/pull/20671)
- CLI: Fix package execution for npm package manager [#20708](https://github.com/storybooks/storybook/pull/20708)

#### Maintenance

- Upgrade react-popper-tooltip [#20736](https://github.com/storybooks/storybook/pull/20736)
- CLI: Upgrade automigrations to use new safe helpers [#20693](https://github.com/storybooks/storybook/pull/20693)
- Csf-tools: Add helpers to get name from node path [#20691](https://github.com/storybooks/storybook/pull/20691)
- Build: remove preact-webpack5 from babelrc automigration [#20706](https://github.com/storybooks/storybook/pull/20706)

#### Build

- Fix windows snapshot [#20707](https://github.com/storybooks/storybook/pull/20707)

## 7.0.0-beta.31 (January 20, 2023)

#### Features

- Docs: Added source stories and updated API [#20603](https://github.com/storybooks/storybook/pull/20603)
- Docs: Implement Controls block [#20683](https://github.com/storybooks/storybook/pull/20683)
- Docs: Created `ArgTypes` component and stories [#20664](https://github.com/storybooks/storybook/pull/20664)
- Docs: Show primary story description and headline in autodocs [#20604](https://github.com/storybooks/storybook/pull/20604)

#### Bug Fixes

- Source-loader: Fix export default variable references [#20688](https://github.com/storybooks/storybook/pull/20688)

#### Maintenance

- CLI: Make missing-babelrc an automatic migration [#20689](https://github.com/storybooks/storybook/pull/20689)
- Addon-docs: Update story index generator glob [#20679](https://github.com/storybooks/storybook/pull/20679)
- Docs: Move validation logic into `context.resolveOf` [#20662](https://github.com/storybooks/storybook/pull/20662)
- Csf-plugin: Move source to docs.source.originalSource [#20665](https://github.com/storybooks/storybook/pull/20665)

#### Build

- Fix ui example story [#20692](https://github.com/storybooks/storybook/pull/20692)

## 7.0.0-beta.30 (January 18, 2023)

#### Features

- UI: Add Sun, Moon, Sidebyside, and stacked icons [#20621](https://github.com/storybooks/storybook/pull/20621)
- Angular: Add multi-project setup for ng workspaces [#20559](https://github.com/storybooks/storybook/pull/20559)
- Addon-docs: Support @deprecated jsdoc tag [#20154](https://github.com/storybooks/storybook/pull/20154)
- Csf-plugin: Support meta description comments [#20632](https://github.com/storybooks/storybook/pull/20632)

#### Bug Fixes

- Core: Fix `core` preset default value [#20646](https://github.com/storybooks/storybook/pull/20646)
- Addon-docs: Fix issue with unattached `.mdx` files [#20661](https://github.com/storybooks/storybook/pull/20661)
- Webpack: aAd error catching when template is not set [#20669](https://github.com/storybooks/storybook/pull/20669)
- Addons: Fix Viewport resetting shortcut key not working [#20167](https://github.com/storybooks/storybook/pull/20167)
- Core: Show "booting" progress until story is specified or errors [#20425](https://github.com/storybooks/storybook/pull/20425)
- Vue: Update events binding in Vue render [#19860](https://github.com/storybooks/storybook/pull/19860)
- Addon-actions: Fix webpack hot reload code in manager bundle [#20649](https://github.com/storybooks/storybook/pull/20649)
- UI: Fix HMR issue in Manager UI [#20654](https://github.com/storybooks/storybook/pull/20654)

#### Maintenance

- Docs: Refactor props of Story block [#20530](https://github.com/storybooks/storybook/pull/20530)
- Vite: TypeScript type cleanup [#20642](https://github.com/storybooks/storybook/pull/20642)

#### Build

- Add required jobs to daily workflow [#20263](https://github.com/storybooks/storybook/pull/20263)
- Fix typings files to ensure this the check command succeeds [#20598](https://github.com/storybooks/storybook/pull/20598)

#### Dependency Upgrades

- Svelte: Remove babel/core peer dep [#20650](https://github.com/storybooks/storybook/pull/20650)

## 7.0.0-beta.29 (January 17, 2023)

#### Features

- CLI: Add codemod to upgrade deprecated types [#20618](https://github.com/storybooks/storybook/pull/20618)
- CLI: overhaul `storybook repro` command and rename it to `storybook sandbox` [#20507](https://github.com/storybooks/storybook/pull/20507)
- Vue3: Add source decorator vue template and setup script + supports of multi slots [#20498](https://github.com/storybooks/storybook/pull/20498)

#### Bug Fixes

- Angular: Fix handling of docsMode option in angular builder [#20608](https://github.com/storybooks/storybook/pull/20608)
- UI: Bring back support for `favicon.ico` [#20612](https://github.com/storybooks/storybook/pull/20612)
- CLI: Fix missing css import on Vue3 button [#20470](https://github.com/storybooks/storybook/pull/20470)
- Codemods: Fix `csf-2-to-3` ignores Typescript types [#20273](https://github.com/storybooks/storybook/pull/20273)
- NextJS: Fix image loader [#20615](https://github.com/storybooks/storybook/pull/20615)
- Storyshots: Fix transpilation [#20630](https://github.com/storybooks/storybook/pull/20630)

#### Maintenance

- React: Change deprecated `React.VFC` to `React.FC` [#20619](https://github.com/storybooks/storybook/pull/20619)

#### Dependency Upgrades

- Upgrade babel-loader to ^9.0.0 [#20577](https://github.com/storybooks/storybook/pull/20577)

## 7.0.0-beta.28 (January 14, 2023)

#### Maintenance

- CSF: Remove deprecated ArgTypes.defaultValue [#19492](https://github.com/storybooks/storybook/pull/19492)

#### Dependency Upgrades

- Addon-controls: Fix version of preview api [#20622](https://github.com/storybooks/storybook/pull/20622)

## 7.0.0-beta.27 (January 14, 2023)

#### Features

- CLI: Add "missing-babelrc" automigration [#20341](https://github.com/storybooks/storybook/pull/20341)

#### Bug Fixes

- Angular: Fix isStandaloneComponent check [#20295](https://github.com/storybooks/storybook/pull/20295)
- Blocks: Do not copy code snippet when text inside preview is selected [#19788](https://github.com/storybooks/storybook/pull/19788)
- Vue: Fix type.name check in extractArgTypes [#19956](https://github.com/storybooks/storybook/pull/19956)
- TypeScript: Add children to CanvasProps [#20451](https://github.com/storybooks/storybook/pull/20451)
- CLI: Fix angular/core version in init using devDependencies [#20609](https://github.com/storybooks/storybook/pull/20609)

#### Maintenance

- Svelte: don't add `svelte-loader` nor `svelte` when initializing Svelte projects [#18799](https://github.com/storybooks/storybook/pull/18799)
- Core: prepareMeta function similar to prepareStory [#20592](https://github.com/storybooks/storybook/pull/20592)

#### Build

- Build: Enable Scorecard Github Action and Badge [#19755](https://github.com/storybooks/storybook/pull/19755)
- Build: Add e2e test for static JSON files [#19463](https://github.com/storybooks/storybook/pull/19463)

## 7.0.0-beta.26 (January 14, 2023)

#### Features

- Core: Expose port from buildDevStandalone [#20575](https://github.com/storybooks/storybook/pull/20575)
- CLI: Add auto-migration for MDX html-type comments to JS-type comments [#20349](https://github.com/storybooks/storybook/pull/20349)

#### Bug Fixes

- API: Fix typing on useArgs [#20610](https://github.com/storybooks/storybook/pull/20610)
- Addon-docs: Fix docs crash by simplifying element before stringify [#19188](https://github.com/storybooks/storybook/pull/19188)
- Vite: Fix duplicate code in preview [#20594](https://github.com/storybooks/storybook/pull/20594)
- Addons: Warn when addon is not installed [#20455](https://github.com/storybooks/storybook/pull/20455)
- Blocks: Handle undefined extractComponentDescription [#20590](https://github.com/storybooks/storybook/pull/20590)

#### Maintenance

- CLI: Fix removal of --no-dll flag [#20589](https://github.com/storybooks/storybook/pull/20589)
- SvelteKit: Automatically support Kit-specific features [#20239](https://github.com/storybooks/storybook/pull/20239)

#### Build

- Build: Fix issue with jest projects matching `ui/node_modules` [#20601](https://github.com/storybooks/storybook/pull/20601)
- TypeScript: Fix typings files to ensure check command succeeds [#20605](https://github.com/storybooks/storybook/pull/20605)
- CLI: Fix repros creation not working on windows [#20606](https://github.com/storybooks/storybook/pull/20606)
- Build: Fix template stories to make them work with stricter Typescript settings [#20591](https://github.com/storybooks/storybook/pull/20591)
- Build: Allow creating internal templates that extend others and pass `main.js` options [#20054](https://github.com/storybooks/storybook/pull/20054)

## 7.0.0-beta.25 (January 12, 2023)

#### Features

- Vue3: Rendering slots passed from controls [#20536](https://github.com/storybooks/storybook/pull/20536)

#### Bug Fixes

- Core: Export build from core-server instead of standalone [#20574](https://github.com/storybooks/storybook/pull/20574)

#### Maintenance

- Blocks: New Description API, introduce useOf [#20563](https://github.com/storybooks/storybook/pull/20563)

## 7.0.0-beta.24 (January 11, 2023)

#### Maintenance

- Migrations: Add `preact-vite` to new frameworks automigration [#20542](https://github.com/storybooks/storybook/pull/20542)

#### Build

- Build: remove unneeded dependencies & upgrades [#20533](https://github.com/storybooks/storybook/pull/20533)
- Build: upgrade verdaccio [#20561](https://github.com/storybooks/storybook/pull/20561)
- Build: remove usage of enzyme [#20534](https://github.com/storybooks/storybook/pull/20534)

## 7.0.0-beta.23 (January 10, 2023)

#### Features

- Composition: Add basic auth support [#20488](https://github.com/storybooks/storybook/pull/20488)

#### Bug Fixes

- UI: Fix managerEntries containing long paths with hidden folders [#20550](https://github.com/storybooks/storybook/pull/20550)
- Addon-docs: Fix attachment logic [#20531](https://github.com/storybooks/storybook/pull/20531)

#### Maintenance

- Addon-docs: Move reactPeerCheck to docs package [#20560](https://github.com/storybooks/storybook/pull/20560)
- Addon-docs: Rename `storyByModuleExport` to `resolveModuleExport` [#20517](https://github.com/storybooks/storybook/pull/20517)
- Telemetry: Filter out example stories/docs from summary [#20553](https://github.com/storybooks/storybook/pull/20553)
- Telemetry: Count play function usage [#20541](https://github.com/storybooks/storybook/pull/20541)
- Telemetry: Add pageStoryCount [#20539](https://github.com/storybooks/storybook/pull/20539)
- Vite/Vue3: Pre-bundle @vitejs/plugin-vue [#20343](https://github.com/storybooks/storybook/pull/20343)

#### Build

- Build: downgrade slash to non-ESM [#20543](https://github.com/storybooks/storybook/pull/20543)

#### Other

- Update GH action to use "linear-ghaction" label for sync [#20546](https://github.com/storybooks/storybook/pull/20546)

## 7.0.0-beta.22 (January 10, 2023)

Failed publish

## 7.0.0-beta.21 (January 9, 2023)

#### Maintenance

- Ember: Build with tsc [#20524](https://github.com/storybooks/storybook/pull/20524)
- Storyshots: Build with tsc [#20523](https://github.com/storybooks/storybook/pull/20523)

#### Dependencies

- Downgrade find-cache-dir [#20532](https://github.com/storybooks/storybook/pull/20532)

#### Build

- Build: Cleanup babel prepare related code & dependencies [#20156](https://github.com/storybooks/storybook/pull/20156)
- Build: Create a tsc prepare script, use it for angular framework, add ESM to angular dist [#20516](https://github.com/storybooks/storybook/pull/20516)
- Build: Fix InternalCanvas story tests [#20521](https://github.com/storybooks/storybook/pull/20521)

## 7.0.0-beta.20 (January 6, 2023)

#### Bug Fixes

- Telemetry: Move 'dev'/'build' events to the end of the process [#20380](https://github.com/storybooks/storybook/pull/20380)
- Blocks: Export Unstyled block in index.ts [#20489](https://github.com/storybooks/storybook/pull/20489)
- Vite: Fix missing await in builder [#20409](https://github.com/storybooks/storybook/pull/20409)

#### Maintenance

- Build: use tsup for csf-plugin [#20150](https://github.com/storybooks/storybook/pull/20150)
- Migration: Update autodocs migration to deal with `docs.docsPage` [#20379](https://github.com/storybooks/storybook/pull/20379)

#### Build

- Blocks: Use example Button for stories [#20483](https://github.com/storybooks/storybook/pull/20483)
- Build: cleanup prep script where possible [#20151](https://github.com/storybooks/storybook/pull/20151)
- cleanup CI config [#20510](https://github.com/storybooks/storybook/pull/20510)
- Build: Fix CI parallelism [#20476](https://github.com/storybooks/storybook/pull/20476)
- Web-components: Restore missing script stories [#20477](https://github.com/storybooks/storybook/pull/20477)

## 7.0.0-beta.19 (January 1, 2023)

#### Features

- NextJS: Add next/head support [#20436](https://github.com/storybooks/storybook/pull/20436)

#### Bug Fixes

- CLI: Do not use legacy-peer-deps for npm [#20456](https://github.com/storybooks/storybook/pull/20456)
- CLI: Use closest lockfile to determine package manager [#20464](https://github.com/storybooks/storybook/pull/20464)
- CLI: Use correct package manager for automigrate [#20428](https://github.com/storybooks/storybook/pull/20428)
- CLI: Add prop-types dependency if not using TypeScript [#20449](https://github.com/storybooks/storybook/pull/20449)
- CLI: Add peer dependency on react [#20459](https://github.com/storybooks/storybook/pull/20459)

#### Maintenance

- Vue3: Add TS / legacy TS CLI templates [#20434](https://github.com/storybooks/storybook/pull/20434)
- Core: Delete outdated onerror handler [#20462](https://github.com/storybooks/storybook/pull/20462)

#### Build

- Build: Add extensions to lodash imports [#20443](https://github.com/storybooks/storybook/pull/20443)

## 7.0.0-beta.18 (January 1, 2023)

Bad npm publish

## 7.0.0-beta.17 (December 30, 2022)

#### Bug Fixes

- Svelte: Do not warn about .svelte files in storyStoreV7 [#20442](https://github.com/storybooks/storybook/pull/20442)
- Core: Fix import paths on Windows [#20430](https://github.com/storybooks/storybook/pull/20430)
- UI: Set min-height relative to the viewport and the zoom level. [#20352](https://github.com/storybooks/storybook/pull/20352)

#### Maintenance

- Docs: Use `stories-mdx` and `autodocs` tags instead of `standalone: false` in index [#20424](https://github.com/storybooks/storybook/pull/20424)
- Docs: Use `'stories-mdx'` tag to indicate story defined in MDX file [#20417](https://github.com/storybooks/storybook/pull/20417)
- Preact-Vite: Minor readme and dependency cleanups [#20432](https://github.com/storybooks/storybook/pull/20432)

#### Build

- Tech: ESLint allow devDependencies imports in prebundled packages [#20440](https://github.com/storybooks/storybook/pull/20440)
- Fix yarn task command on Windows machines [#20431](https://github.com/storybooks/storybook/pull/20431)

## 7.0.0-beta.16 (December 29, 2022)

#### Features

- Preact-Vite: Add framework [#20390](https://github.com/storybooks/storybook/pull/20390)

#### Maintenance

- NextJS: Fix unnecessary addon-actions dev dep [#20426](https://github.com/storybooks/storybook/pull/20426)

## 7.0.0-beta.15 (December 24, 2022)

#### Bug Fixes

- Codemods: Fix peer dependency issue [#20399](https://github.com/storybooks/storybook/pull/20399)
- Core: Wrap manager entries to handle exports using a cache directory [#20331](https://github.com/storybooks/storybook/pull/20331)
- UI: fix deprecated ReactDOM.findDOMNode calls [#20368](https://github.com/storybooks/storybook/pull/20368)

#### Maintenance

- Build: Use tsup for core-server [#20134](https://github.com/storybooks/storybook/pull/20134)

#### Build

- Build: Make tests use SWC, not babel [#20397](https://github.com/storybooks/storybook/pull/20397)
- Build: Fix trim vulnerability [#20371](https://github.com/storybooks/storybook/pull/20371)

## 7.0.0-beta.14 (December 23, 2022)

#### Features

- CLI: Write into a log file if automigrations fail [#20310](https://github.com/storybooks/storybook/pull/20310)
- CLI: Add nodejs check in automigrations [#20342](https://github.com/storybooks/storybook/pull/20342)

#### Bug Fixes

- UI: Disable React.strictmode to avoid findNode deprecation warnings [#20345](https://github.com/storybooks/storybook/pull/20345)
- Vite: Fix peerDep warning by updating `@joshwooding/vite-plugin-react-docgen-typescript` [#20359](https://github.com/storybooks/storybook/pull/20359)

#### Maintenance

- Don't allow setting `Meta of={X}` if `X` is tagged with `'autodocs'` [#20373](https://github.com/storybooks/storybook/pull/20373)
- Rename `docsPage` => `autodocs` [#20364](https://github.com/storybooks/storybook/pull/20364)
- Rename `docsOptions.enabled` to `docsOptions.disable` [#20363](https://github.com/storybooks/storybook/pull/20363)
- Angular: Switch to default to inlineStories=true [#20118](https://github.com/storybooks/storybook/pull/20118)
- Types: Add Addon_OptionsParameterV7 type [#20384](https://github.com/storybooks/storybook/pull/20384)

#### Build

- Build: regen lockfiles [#20386](https://github.com/storybooks/storybook/pull/20386)
- Build: fix prettydocs CI flakyness [#20385](https://github.com/storybooks/storybook/pull/20385)
- Build: Update Playwright to 1.29.1 [#20372](https://github.com/storybooks/storybook/pull/20372)
- Build: store extra metadata for each sandbox test [#20365](https://github.com/storybooks/storybook/pull/20365)
- Build: Remove the non-cross-platform dash-S option [#20360](https://github.com/storybooks/storybook/pull/20360)
- Build: sync issues of `next` packages [#20354](https://github.com/storybooks/storybook/pull/20354)

## 6.5.15 (December 20, 2022)

#### Bug Fixes

- Support Angular 15.0.4 [#20287](https://github.com/storybooks/storybook/pull/20287)
- CLI: execute automigrations when pressing enter in the prompts [#20208](https://github.com/storybooks/storybook/pull/20208)

## 7.0.0-beta.13 (December 20, 2022)

#### Features

- Angular: Support compodoc output arg [#20338](https://github.com/storybooks/storybook/pull/20338)
- NextJS: Support @next/font [#20291](https://github.com/storybooks/storybook/pull/20291)
- NextJS: Support useSelectedLayoutSegment and useSelectedLayoutSegments [#20330](https://github.com/storybooks/storybook/pull/20330)
- Preview Api: export `userOrAutoTitle` function [#20325](https://github.com/storybooks/storybook/pull/20325)

#### Bug Fixes

- Fix: peer dependency warning for `vite-react` [#20328](https://github.com/storybooks/storybook/pull/20328)
- UI: swap `react-sizeme` for `react-resize-detector` [#20333](https://github.com/storybooks/storybook/pull/20333)
- Vite: Detect React SWC plugin [#20335](https://github.com/storybooks/storybook/pull/20335)
- CLI: Fix automigrate filtering [#20329](https://github.com/storybooks/storybook/pull/20329)
- Vite: Include user config `optimizeDeps` in final `optimizeDeps` [#20313](https://github.com/storybooks/storybook/pull/20313)

#### Maintenance

- Tech: improve global types [#20184](https://github.com/storybooks/storybook/pull/20184)
- CLI: Fix sb migrate csf-2-to-3 for multiple file extensions [#20290](https://github.com/storybooks/storybook/pull/20290)
- CLI: Replace `update-notifier` with `simple-update-notifier` [#20266](https://github.com/storybooks/storybook/pull/20266)

#### Build

- Build: remove borders in task error message [#20305](https://github.com/storybooks/storybook/pull/20305)
- Build: Fix pretty-docs CI job [#20319](https://github.com/storybooks/storybook/pull/20319)
- Build: Update Playwright to 1.29 [#20318](https://github.com/storybooks/storybook/pull/20318)

#### Dependencies

- NextJS: Make addon-actions a regular dependency [#20324](https://github.com/storybooks/storybook/pull/20324)
- NextJS: Fix addon-actions peerdependency [#20324](https://github.com/storybooks/storybook/pull/20324)
- Vite-react: Fix peer dependency warning [#20328](https://github.com/storybooks/storybook/pull/20328)

## 7.0.0-beta.12 (December 16, 2022)

#### Other

- Revert "Core: Wrap manager entries to handle exports" [#20311](https://github.com/storybooks/storybook/pull/20311)

## 7.0.0-beta.11 (December 16, 2022)

#### Features

- CLI: Improve automigration to show prompt-only migrations [#20292](https://github.com/storybooks/storybook/pull/20292)

#### Bug Fixes

- Angular: Fix webpackStatsJson types in angular-builder [#20296](https://github.com/storybooks/storybook/pull/20296)
- Fix: addon-storysource has no managerEntry, but defines a register and preset [#20304](https://github.com/storybooks/storybook/pull/20304)

#### Maintenance

- Core: Wrap manager entries to handle exports [#20308](https://github.com/storybooks/storybook/pull/20308)
- Core: improve manager-entries failure message [#20306](https://github.com/storybooks/storybook/pull/20306)
- Telemetry: Fix flakey test [#20282](https://github.com/storybooks/storybook/pull/20282)

#### Dependency Upgrades

- Vite: Make vite a peer dependency, update plugins [#20281](https://github.com/storybooks/storybook/pull/20281)
- Vite/Svelte: Remove addon-svelte-csf dep [#20280](https://github.com/storybooks/storybook/pull/20280)

## 7.0.0-beta.10 (December 16, 2022)

#### Build

- Build: compile detection was using a non-conforming package, causing cache to miss always. [#20297](https://github.com/storybooks/storybook/pull/20297)

#### Dependency Upgrades

- React-vite: Pin react-docgen version [#20300](https://github.com/storybooks/storybook/pull/20300)

## 7.0.0-beta.9 (December 16, 2022)

#### Features

- CLI: Add interactive babel config file generation [#20234](https://github.com/storybooks/storybook/pull/20234)
- CLI: Add automigration summary [#20276](https://github.com/storybooks/storybook/pull/20276)

#### Bug Fixes

- UI: Fix `enableShortcuts` support in `manager.ts` [#20264](https://github.com/storybooks/storybook/pull/20264)
- UI: Ensure manager entries load even if preceding ones failed [#20286](https://github.com/storybooks/storybook/pull/20286)
- Addon-viewport: Fix composition support [#20289](https://github.com/storybooks/storybook/pull/20289)
- Support Angular 15.0.4 [#20287](https://github.com/storybooks/storybook/pull/20287)
- Fix: peerDependencies issues reported [#20279](https://github.com/storybooks/storybook/pull/20279)

#### Build

- Build: ui/.storybook should not import from dist [#20284](https://github.com/storybooks/storybook/pull/20284)
- Build: bundle script a bit less repetitive, add a completion indicator [#20277](https://github.com/storybooks/storybook/pull/20277)
- Build: regen lockfiles [#20278](https://github.com/storybooks/storybook/pull/20278)

## 7.0.0-beta.8 (December 14, 2022)

#### Features

- Addon-docs: Use jsxOptions instead of mdxBabelOptions [#20271](https://github.com/storybooks/storybook/pull/20271)

#### Maintenance

- Svelte-vite: remove `svelteOptions` in automigration [#20270](https://github.com/storybooks/storybook/pull/20270)

#### Build

- Fix handling of inverted yes flag in `task` steps [#20268](https://github.com/storybooks/storybook/pull/20268)

## 7.0.0-beta.7 (December 14, 2022)

#### Features

- CLI: Add Next.js framework automigration [#19574](https://github.com/storybooks/storybook/pull/19574)

#### Bug Fixes

- Don't export renderer from framework [#20259](https://github.com/storybooks/storybook/pull/20259)
- Upgrade sb dep as well in sb upgrade [#20258](https://github.com/storybooks/storybook/pull/20258)
- Vite: Make the bail function work if the server fails to start [#20243](https://github.com/storybooks/storybook/pull/20243)
- Csf-tools: Fix local vars handling in MDX-generated CSF [#20255](https://github.com/storybooks/storybook/pull/20255)
- Csf-plugin: Fix spurious storiesOf warnings [#20256](https://github.com/storybooks/storybook/pull/20256)
- Core: Remove unnecessary peer deps [#20231](https://github.com/storybooks/storybook/pull/20231)
- Fix issues with running SSv6 [#20253](https://github.com/storybooks/storybook/pull/20253)
- Core: Fix config.base relative paths [#20232](https://github.com/storybooks/storybook/pull/20232)
- Fix: vite devmode with storyStoreV6 by ensuring singleton via global [#20207](https://github.com/storybooks/storybook/pull/20207)

#### Maintenance

- Addon-docs: Upgrade mdx2-csf and use its JSX handling [#20261](https://github.com/storybooks/storybook/pull/20261)
- Vite: Use mdx2 babel pre-processing [#20241](https://github.com/storybooks/storybook/pull/20241)
- Addon-docs: Restore deprecated blocks entry point [#20246](https://github.com/storybooks/storybook/pull/20246)

#### Build

- Add Next 12 sandbox [#20092](https://github.com/storybooks/storybook/pull/20092)

#### Dependency Upgrades

- Add optional TypeScript peer dependency [#20244](https://github.com/storybooks/storybook/pull/20244)

## 7.0.0-beta.6 (December 14, 2022)

#### Dependency Upgrades

- Vite: Use Vite 3 (temporarily) [#20216](https://github.com/storybooks/storybook/pull/20216)

## 7.0.0-beta.5 (December 13, 2022)

#### Features

- CLI: Split sb-scripts into two different migrations [#20223](https://github.com/storybooks/storybook/pull/20223)

#### Bug Fixes

- Vite: Support async Vite plugins [#20194](https://github.com/storybooks/storybook/pull/20194)
- Telemetry: Don't send boot event when cliOptions.disableTelemetry is passed [#20144](https://github.com/storybooks/storybook/pull/20144)

#### Maintenance

- CLI: Add React peer dep runtime check [#20206](https://github.com/storybooks/storybook/pull/20206)

#### Dependency Upgrades

- Upgrade esbuild [#20199](https://github.com/storybooks/storybook/pull/20199)

## 7.0.0-beta.4 (December 13, 2022)

#### Features

- Re-enable TS 4.9 CLI templates [#20159](https://github.com/storybooks/storybook/pull/20159)

#### Bug Fixes

- CLI: execute automigrations when pressing enter in the prompts [#20208](https://github.com/storybooks/storybook/pull/20208)
- Interactions: Fix storyId access in instrumenter [#20201](https://github.com/storybooks/storybook/pull/20201)
- Typescript: Fix bug with meta not working well as generic parameter for StoryObj [#20165](https://github.com/storybooks/storybook/pull/20165)
- SvelteKit: Support `v1.0.0-next.574` and above [#20181](https://github.com/storybooks/storybook/pull/20181)

#### Build

- Svelte: Fix argTypes inference in Button component [#20212](https://github.com/storybooks/storybook/pull/20212)
- React-Vite: Ignore React MDX stories in sandbox [#20210](https://github.com/storybooks/storybook/pull/20210)

## 7.0.0-beta.3 (December 10, 2022)

#### Bug Fixes

- CLI: Fix sb migrate codemods [#20191](https://github.com/storybooks/storybook/pull/20191)
- Measure: Fix measure not working on disabled elements [#19985](https://github.com/storybooks/storybook/pull/19985)

#### Maintenance

- SvelteKit: Automigration [#20094](https://github.com/storybooks/storybook/pull/20094)
- Tech: change `package.json` engines fields, set to minimal node16 and up [#20170](https://github.com/storybooks/storybook/pull/20170)

## 7.0.0-beta.2 (December 9, 2022)

#### Bug Fixes

- Core: Catch and do nothing to avoid triggering unhandled exception problems [#20177](https://github.com/storybooks/storybook/pull/20177)
- Controls: Fix color control not resetting when initial value is defined [#20049](https://github.com/storybooks/storybook/pull/20049)
- Core: Fix typescript.checkOptions not a valid interface [#20166](https://github.com/storybooks/storybook/pull/20166)
- NextJS: Fixlogic around `next/future/image` [#20173](https://github.com/storybooks/storybook/pull/20173)

#### Maintenance

- Revert "Revert "Telemetry: Add precedingUpgrade data to dev/build/error events"" [#20176](https://github.com/storybooks/storybook/pull/20176)
- Telemetry: Add `chromatic` to addons list [#20143](https://github.com/storybooks/storybook/pull/20143)
- Vite: Support vite 4 [#20139](https://github.com/storybooks/storybook/pull/20139)

## 7.0.0-beta.1 (December 9, 2022)

#### Bug Fixes

- Revert "Telemetry: Add precedingUpgrade data to dev/build/error events" [#20168](https://github.com/storybooks/storybook/pull/20168)
- Controls: Fix file controls not resetting [#19998](https://github.com/storybooks/storybook/pull/19998)

#### Dependency Upgrades

- Upgrade express to fix security warning [#20152](https://github.com/storybooks/storybook/pull/20152)

## 7.0.0-beta.0 (December 8, 2022)

We made it to beta, folks! 🎉

SB7 overhauls our build architecture, modernizes our output to ESM only, promotes Vite to a first-class peer to Webpack, rethinks our Docs addon, cleans up the UI, and contains hundreds of improvements at every level of the stack. We've been sharing some of these changes on [the Storybook blog](https://storybook.js.org/blog/) and will share more over the coming weeks.

Beta means that we don't have any more major changes on the radar for 7.0 and it's mostly stabilization from here on out. The core team is doing some basic testing now, and once we have a good QA plan, we'd love your help to make that happen. Please keep an eye out on the blog and on our [Twitter](https://twitter.com/storybookjs) or Mastadon (coming soon!) or [Discord](https://discord.gg/storybook) if you're interested in helping.

#### Bug Fixes

- Extend Angular Zone.js peer dependency range [#20107](https://github.com/storybooks/storybook/pull/20107)
- Vite: Fix static source handling for addon-docs [#20147](https://github.com/storybooks/storybook/pull/20147)
- Controls: Arrow keys don't work on number controls [#19954](https://github.com/storybooks/storybook/pull/19954)

## 7.0.0-alpha.62 (December 8, 2022)

#### Bug Fixes

- Fix new-frameworks automigration failing to read frameworkOptions field [#20128](https://github.com/storybooks/storybook/pull/20128)
- Fix Next.js lower than 12.2.0 [#20129](https://github.com/storybooks/storybook/pull/20129)
- Fix iframe.html not available upon early browser opening [#20123](https://github.com/storybooks/storybook/pull/20123)

#### Maintenance

- Add args generic to CSFExports [#20135](https://github.com/storybooks/storybook/pull/20135)
- Modernize favicon [#20130](https://github.com/storybooks/storybook/pull/20130)
- Telemetry: Add precedingUpgrade data to dev/build/error events [#20136](https://github.com/storybooks/storybook/pull/20136)
- CLI: Replace addon-docs Meta with blocks and add blocks dep [#20133](https://github.com/storybooks/storybook/pull/20133)
- CLI: Fix upgrade --prerelease to upgrade to the next tag [#20126](https://github.com/storybooks/storybook/pull/20126)

## 7.0.0-alpha.61 (December 7, 2022)

#### Features

- NextJS: Support next/navigation in Next.js v13 [#20065](https://github.com/storybooks/storybook/pull/20065)

#### Maintenance

- Vite/MDX: Fix mdx compiler for vite [#20121](https://github.com/storybooks/storybook/pull/20121)
- Fix more peerDependencies issues [#20120](https://github.com/storybooks/storybook/pull/20120)

## 7.0.0-alpha.60 (December 7, 2022)

#### Bug Fixes

- Deal with a lot of different edge cases for git URLs [#20115](https://github.com/storybooks/storybook/pull/20115)

#### Maintenance

- Clean up babelModeV7 migration and code [#20117](https://github.com/storybooks/storybook/pull/20117)
- Fix peer dependencies for npm8/pnpm/yarn pnp [#20110](https://github.com/storybooks/storybook/pull/20110)
- Remove peer deps from core-common [#20109](https://github.com/storybooks/storybook/pull/20109)

#### Build

- Add more linting config to vs-code settings.json [#20101](https://github.com/storybooks/storybook/pull/20101)

## 7.0.0-alpha.59 (December 6, 2022)

#### Features

- CSF: Add satisfies support to csf-tools [#20088](https://github.com/storybooks/storybook/pull/20088)

#### Bug Fixes

- Next.js: only set next/future/image mocks from version 12.2 [#20098](https://github.com/storybooks/storybook/pull/20098)
- Core: Batch the loading of CSF files for `extract()` etc [#20055](https://github.com/storybooks/storybook/pull/20055)
- Fix SSR in external docs via `node` exports [#20083](https://github.com/storybooks/storybook/pull/20083)
- CLI: Improve sb-scripts automigration logic [#20035](https://github.com/storybooks/storybook/pull/20035)

#### Maintenance

- Revert "Telemetry: Add precedingUpgrade data to dev/build events" [#20105](https://github.com/storybooks/storybook/pull/20105)
- Telemetry: Instrument init event [#20097](https://github.com/storybooks/storybook/pull/20097)

#### Build

- Fix next [#20106](https://github.com/storybooks/storybook/pull/20106)
- Build: Run sb init locally in sandbox creation [#20100](https://github.com/storybooks/storybook/pull/20100)
- Build: Add missing dependencies to manager, unify TS to ~4.9.3 [#20021](https://github.com/storybooks/storybook/pull/20021)

#### Dependency Upgrades

- Bump store2 to 2.14.2 license clarification [#19899](https://github.com/storybooks/storybook/pull/19899)

## 7.0.0-alpha.58 (December 5, 2022)

#### Features

- Add `--tag` option to `upgrade` script [#20075](https://github.com/storybooks/storybook/pull/20075)
- HTML: Add `html-vite` framework [#19698](https://github.com/storybooks/storybook/pull/19698)
- SvelteKit: Create framework [#20039](https://github.com/storybooks/storybook/pull/20039)

#### Maintenance

- Core: Remove postcss feature flag [#20003](https://github.com/storybooks/storybook/pull/20003)
- Telemetry: Add precedingUpgrade data to dev/build events [#20084](https://github.com/storybooks/storybook/pull/20084)
- Core: make managerEntries load as ESM, for improved tree-shaking [#20070](https://github.com/storybooks/storybook/pull/20070)

## 7.0.0-alpha.57 (December 3, 2022)

#### Bug Fixes

- Vite: Reinstate (deprecated) `StorybookViteConfig` [#20057](https://github.com/storybooks/storybook/pull/20057)
- Docs: using targeted styles, not components to style MDX [#19958](https://github.com/storybooks/storybook/pull/19958)
- Docs: Return to filtering toolbars in docs mode, but don't filter menu [#19959](https://github.com/storybooks/storybook/pull/19959)
- Angular: Don't set `argType.defaultValue` in angular/compodoc [#19935](https://github.com/storybooks/storybook/pull/19935)
- NextJS: Support next/image component in v12/13 properly [#20028](https://github.com/storybooks/storybook/pull/20028)
- Svelte: Use JSDocs in JS CLI templates and put manual enum arg type back as it is not inferred [#20042](https://github.com/storybooks/storybook/pull/20042)

#### Maintenance

- CLI: Add a new `version-update` check telemetry event [#20074](https://github.com/storybooks/storybook/pull/20074)
- CLI: Add upgrade telemetry details [#20064](https://github.com/storybooks/storybook/pull/20064)
- Core: added .entries property to error thrown when duplicate stories are present [#20038](https://github.com/storybooks/storybook/pull/20038)

#### Build

- Improve framework version specific story handling [#20027](https://github.com/storybooks/storybook/pull/20027)
- Fix repro templates script [#20063](https://github.com/storybooks/storybook/pull/20063)
- Build: replace image placeholder url in example stories for nextjs [#20069](https://github.com/storybooks/storybook/pull/20069)
- Build: improve inDevelopment mode for yarn task [#20067](https://github.com/storybooks/storybook/pull/20067)
- Build: revamp interactions e2e test [#20060](https://github.com/storybooks/storybook/pull/20060)

#### Dependency Upgrades

- Build: Update jest pretty-format to 29 [#20047](https://github.com/storybooks/storybook/pull/20047)

## 7.0.0-alpha.56 (December 1, 2022)

#### Bug Fixes

- Addon-interactions: Fix duplicated elements in the panel [#20004](https://github.com/storybooks/storybook/pull/20004)
- Core: Fix ability to use component-level play functions [#17817](https://github.com/storybooks/storybook/pull/17817)
- CLI: Fix `docsPage` automatic migration [#19982](https://github.com/storybooks/storybook/pull/19982)

#### Build

- e2e: change onClick to click to support svelte examples [#20034](https://github.com/storybooks/storybook/pull/20034)

## 7.0.0-alpha.55 (November 30, 2022)

#### Features

- CLI: Add TS 4.9 CLI templates [#19986](https://github.com/storybooks/storybook/pull/19986)
- CLI: Remove render functions and infer argTypes for svelte CLI templates [#20007](https://github.com/storybooks/storybook/pull/20007)

#### Bug Fixes

- Svelte: Fix decorators with slots [#19987](https://github.com/storybooks/storybook/pull/19987)
- Core: Open browser after manager is ready [#20005](https://github.com/storybooks/storybook/pull/20005)
- Core: Add backwards support for manager-api package rename [#20006](https://github.com/storybooks/storybook/pull/20006)
- Vite: Fix prebundling [#19978](https://github.com/storybooks/storybook/pull/19978)

#### Maintenance

- Maintenance: Use typescript legacy templates until our ecosystem fully supports ts 4.9 [#20032](https://github.com/storybooks/storybook/pull/20032)
- CLI: Rollback next TS 4.9 templates as the next babel preset doesn't support satisfies [#20029](https://github.com/storybooks/storybook/pull/20029)
- Addon-docs: Use `.mdx` globs in templates and defaults [#19795](https://github.com/storybooks/storybook/pull/19795)
- Types: Rationalize story-based types and de-prefix [#19919](https://github.com/storybooks/storybook/pull/19919)
- API: Export the controlOrMetaKey fn from manager-api [#19972](https://github.com/storybooks/storybook/pull/19972)
- Blocks: Description stories [#19806](https://github.com/storybooks/storybook/pull/19806)

#### Build

- Upgrade yarn [#20025](https://github.com/storybooks/storybook/pull/20025)
- Build: Add a retry mechanism for exports file generation [#20018](https://github.com/storybooks/storybook/pull/20018)
- Build: Rollback forking off git-shallow-clone-orb [#20020](https://github.com/storybooks/storybook/pull/20020)
- Build: Clean up @storybook/preview dependencies [#19997](https://github.com/storybooks/storybook/pull/19997)
- No unused locals in tsconfig to disable deepscan [#20012](https://github.com/storybooks/storybook/pull/20012)
- Build: generate the `exports.ts` file in a single pass without `exec` [#20002](https://github.com/storybooks/storybook/pull/20002)
- Build a mechanism to E2E telemetry [#19946](https://github.com/storybooks/storybook/pull/19946)
- Add debug to chromatic task [#19933](https://github.com/storybooks/storybook/pull/19933)
- Build: Sanitise user input in github workflow [#19980](https://github.com/storybooks/storybook/pull/19980)
- Blocks: Add story for Canvas `className` prop, cleanup UI SB `preview.tsx [#19886](https://github.com/storybooks/storybook/pull/19886)
- Change export-generating script to use exec util instead of shelljs [#19979](https://github.com/storybooks/storybook/pull/19979)
- Regen lockfiles [#19967](https://github.com/storybooks/storybook/pull/19967)

#### Dependency Upgrades

- Build: Upgrade jest-specific-snapshot [#19996](https://github.com/storybooks/storybook/pull/19996)
- Upgrade telejson [#19983](https://github.com/storybooks/storybook/pull/19983)

## 7.0.0-alpha.54 (November 25, 2022)

#### Bug Fixes

- Vite: Support environment variables in viteFinal define config [#19905](https://github.com/storybooks/storybook/pull/19905)

#### Maintenance

- Build: split `lib/addons` into manager & preview part, move code to `manager-api` [#19952](https://github.com/storybooks/storybook/pull/19952)
- TypeScript: Satisfy stricter compilerOption rules [#19953](https://github.com/storybooks/storybook/pull/19953)
- API: Rename `api` to `manager-api` [#19944](https://github.com/storybooks/storybook/pull/19944)
- API: Add `preview-api` package [#19749](https://github.com/storybooks/storybook/pull/19749)

#### Build

- Build: Improve security in Github actions [#19949](https://github.com/storybooks/storybook/pull/19949)

#### Dependencies

- NextJS: Add Next13 peer dependency [#19932](https://github.com/storybooks/storybook/pull/19932)

## 7.0.0-alpha.53 (November 24, 2022)

#### Bug Fixes

- Angular: Fix "**webpack_require**.nmd is not a function" in v15 [#19937](https://github.com/storybooks/storybook/pull/19937)
- Controls: Exclude `{ table: { disable: true } }` from panel count [#19877](https://github.com/storybooks/storybook/pull/19877)

#### Maintenance

- Core: Prebundle the preview [#19718](https://github.com/storybooks/storybook/pull/19718)
- Builder-vite: Build with tsup [#19895](https://github.com/storybooks/storybook/pull/19895)
- Components: Fix missing export [#19923](https://github.com/storybooks/storybook/pull/19923)

#### Build

- Remove the fix we added when enhanced-resolve was broken [#19942](https://github.com/storybooks/storybook/pull/19942)
- Fix CI which was broken by enhanced-resolve [#19936](https://github.com/storybooks/storybook/pull/19936)
- Drop `inDevelopment` from `cra/default-js` [#19934](https://github.com/storybooks/storybook/pull/19934)
- Fix execa import in get-report-message [#19913](https://github.com/storybooks/storybook/pull/19913)

## 7.0.0-alpha.52 (November 21, 2022)

#### Bug Fixes

- NextJS: Fix v13 `next/link` [#19834](https://github.com/storybooks/storybook/pull/19834)
- Docs: Fix ordering of entries in `Stories` block [#19907](https://github.com/storybooks/storybook/pull/19907)

#### Build

- Maintenance: fix execa usage in build and check scripts [#19909](https://github.com/storybooks/storybook/pull/19909)
- Use execa 6.x in `scripts` [#19759](https://github.com/storybooks/storybook/pull/19759)
- Build: Create a generate task and use in the sandbox process [#19840](https://github.com/storybooks/storybook/pull/19840)

#### Dependency Upgrades

- Upgrade docs-mdx to fix yarn pnp [#19835](https://github.com/storybooks/storybook/pull/19835)

## 7.0.0-alpha.51 (November 19, 2022)

#### Bug Fixes

- NextJS: Fix out-of-the-box babel handling [#19842](https://github.com/storybooks/storybook/pull/19842)
- NextJS: Fix import url on windows [#19798](https://github.com/storybooks/storybook/pull/19798)
- UI: Fix panel invisible for any addon listed after the interactions panel [#19771](https://github.com/storybooks/storybook/pull/19771)
- Core: Bail preview builder on failure [#19849](https://github.com/storybooks/storybook/pull/19849)
- Core: Fix double esbuild-register register [#19852](https://github.com/storybooks/storybook/pull/19852)
- Composition: Fix regression in the `#root` to `#storybook-root` change [#19848](https://github.com/storybooks/storybook/pull/19848)
- UI: Fix `showPanel=false` doesn't work on mobile view [#19807](https://github.com/storybooks/storybook/pull/19807)

#### Maintenance

- CLI: Replace degit with giget [#19870](https://github.com/storybooks/storybook/pull/19870)
- Build: Bundle lib/channel-websocket with tsup [#19694](https://github.com/storybooks/storybook/pull/19694)
- Maintenance: Upgrade monorepo to TS 4.9 [#19869](https://github.com/storybooks/storybook/pull/19869)

#### Build

- Build: Downgrade @types/node [#19890](https://github.com/storybooks/storybook/pull/19890)
- Maintenance: Add angular 14 template and skip test runner on angular 15 for now [#19871](https://github.com/storybooks/storybook/pull/19871)
- Build: Upgrade Jest to 29 [#19863](https://github.com/storybooks/storybook/pull/19863)
- Build: Fix chromatic version to 6.11.2 in local scripts [#19889](https://github.com/storybooks/storybook/pull/19889)
- Build: Pin chromatic version to 6.11.2 to temporary fix flakiness [#19874](https://github.com/storybooks/storybook/pull/19874)

#### Dependency Upgrades

- Bump mdx2-csf dependency [#19885](https://github.com/storybooks/storybook/pull/19885)

## 7.0.0-alpha.50 (November 17, 2022)

#### Features

- Expose more CSF types in all renderers [#19833](https://github.com/storybooks/storybook/pull/19833)
- CSF: Renamed Framework to Renderer [#19802](https://github.com/storybooks/storybook/pull/19802)

#### Bug Fixes

- Next.js: use file path instead of image contents for next-image-loader-stub [#19858](https://github.com/storybooks/storybook/pull/19858)
- TypeScript: Fix type inference bug with decorators [#19839](https://github.com/storybooks/storybook/pull/19839)
- Vite: Keep using absolute path node_modules splitting [#19836](https://github.com/storybooks/storybook/pull/19836)
- Vite: Fix preview annotation paths on Windows [#19822](https://github.com/storybooks/storybook/pull/19822)
- Fix csf-plugin ignoring options [#19823](https://github.com/storybooks/storybook/pull/19823)
- Controls: Checkbox does not update when using useArgs hook [#19508](https://github.com/storybooks/storybook/pull/19508)

#### Maintenance

- Jest: switch from Parameters to StorybookInternalParameters [#19853](https://github.com/storybooks/storybook/pull/19853)
- Blocks: Story stories [#19805](https://github.com/storybooks/storybook/pull/19805)
- Blocks: Canvas stories [#19804](https://github.com/storybooks/storybook/pull/19804)
- Tech: TypeScript should check stories and tests as well [#19831](https://github.com/storybooks/storybook/pull/19831)

#### Build

- UI Storybook: Disable sourcemaps when building in CI [#19862](https://github.com/storybooks/storybook/pull/19862)
- Build: Increase max node memory for jobs [#19856](https://github.com/storybooks/storybook/pull/19856)
- CI: improve error reporting mechanism [#19841](https://github.com/storybooks/storybook/pull/19841)
- Fix tests on Windows [#19777](https://github.com/storybooks/storybook/pull/19777)
- Build: Fix benchmark to run on local packages [#19832](https://github.com/storybooks/storybook/pull/19832)
- CI: Report failures on discord [#19801](https://github.com/storybooks/storybook/pull/19801)

## 7.0.0-alpha.49 (November 13, 2022)

#### Bug Fixes

- Essentials: Fix preview annotations for Vite pnpm support [#19689](https://github.com/storybooks/storybook/pull/19689)

#### Maintenance

- Build: convert addon-docs to use ts-up [#19790](https://github.com/storybooks/storybook/pull/19790)
- Core: Allow overriding WebView and UrlStore [#19623](https://github.com/storybooks/storybook/pull/19623)
- Storyshots: Support .cjs and .mjs file extensions [#19726](https://github.com/storybooks/storybook/pull/19726)

#### Build

- Build: less noise when compiling [#19808](https://github.com/storybooks/storybook/pull/19808)
- Build: Upgrade bench to `next` [#19791](https://github.com/storybooks/storybook/pull/19791)
- Maintenance: improve error feedback when tasks fail in CI [#19786](https://github.com/storybooks/storybook/pull/19786)
- UI: Enable TurboSnap for UI Storybook [#19767](https://github.com/storybooks/storybook/pull/19767)
- CI: Use a new cadence (ci, pr, merged, daily) and trigger CircleCI from github actions [#19768](https://github.com/storybooks/storybook/pull/19768)
- Maintenance: provide expected failure metadata in junit reports [#19775](https://github.com/storybooks/storybook/pull/19775)

## 7.0.0-alpha.48 (November 7, 2022)

#### Breaking Changes

- Preact: Make preact use inline stories (without iframe) by default in docs [#19741](https://github.com/storybooks/storybook/pull/19741)

#### Features

- Angular: Undo template gen removal during deprecation property removal [#19614](https://github.com/storybooks/storybook/pull/19614)
- CSF-tools: Support main.js default exports [#19738](https://github.com/storybooks/storybook/pull/19738)
- Addon-docs: Disable play functions in docs mode unless you set `parameters.docs.autoplay` [#19659](https://github.com/storybooks/storybook/pull/19659)
- Addon-docs: Add docsPage `automatic` to create docs entries for all components [#19713](https://github.com/storybooks/storybook/pull/19713)
- CLI: Add docsPage to all Button/Header story templates [#19715](https://github.com/storybooks/storybook/pull/19715)

#### Bug Fixes

- Svelte: Fix docs rendering [#19705](https://github.com/storybooks/storybook/pull/19705)
- React: Expose ReactFramework type [#19704](https://github.com/storybooks/storybook/pull/19704)

#### Maintenance

- Core: Update index generation to use tags to detect MDX stories [#19712](https://github.com/storybooks/storybook/pull/19712)
- CI: Fix cross OS github actions [#19754](https://github.com/storybooks/storybook/pull/19754)
- Blocks: Redo stories for controls [#19744](https://github.com/storybooks/storybook/pull/19744)
- Blocks: Setup and create example story for blocks with context [#19740](https://github.com/storybooks/storybook/pull/19740)
- Client-api: Fix export from store [#19720](https://github.com/storybooks/storybook/pull/19720)
- Pull renderer+builder from framework's package.json + a known list [#19717](https://github.com/storybooks/storybook/pull/19717)
- CLI: Add automigration to set docsPage = 'automatic' for existing Storybooks [#19716](https://github.com/storybooks/storybook/pull/19716)
- Builder-webpack5: Use import.meta.webpackHot instead of module.hot for check [#19686](https://github.com/storybooks/storybook/pull/19686)
- Fix: Point to correct .d.ts files from export maps [#19724](https://github.com/storybooks/storybook/pull/19724)
- CLI: Remove deprecated `-s` flag on `sb init` [#19585](https://github.com/storybooks/storybook/pull/19585)

#### Build

- Build: Fix eslint formatting in scripts [#19765](https://github.com/storybooks/storybook/pull/19765)
- Sandboxes: Fix up stories entry to allow HMR [#19750](https://github.com/storybooks/storybook/pull/19750)
- Fix prepare script on Windows machines [#19762](https://github.com/storybooks/storybook/pull/19762)
- CI: Fix fix handle-release-branches workflow [#19756](https://github.com/storybooks/storybook/pull/19756)
- Build: Cancel workflow in CI on steps failure [#19748](https://github.com/storybooks/storybook/pull/19748)
- CI: Schedule a daily job that runs all sandboxes [#19699](https://github.com/storybooks/storybook/pull/19699)
- Build: Delete node_modules in repro generation [#19734](https://github.com/storybooks/storybook/pull/19734)
- Fix: dts facade generator did not support deep links [#19723](https://github.com/storybooks/storybook/pull/19723)
- Build: Re-enable test-runner for vue-cli [#19706](https://github.com/storybooks/storybook/pull/19706)

#### Dependency Upgrades

- Upgrade mdx2-csf to fix mdxSource generation [#19766](https://github.com/storybooks/storybook/pull/19766)
- Dependencies: Bump prettier dependency, cleanup config [#19672](https://github.com/storybooks/storybook/pull/19672)
- Vue: Add babel loader 9.0.0 to vue-webpack5 peer dependencies [#19697](https://github.com/storybooks/storybook/pull/19697)

## 7.0.0-alpha.47 (November 1, 2022)

#### Features

- CSF-tools: Turn story comments into docs descriptions [#19684](https://github.com/storybooks/storybook/pull/19684)
- CLI: Migrate CLI templates to CSF3 [#19665](https://github.com/storybooks/storybook/pull/19665)
- Vite: Set default `base` for subfolder deployments [#19383](https://github.com/storybooks/storybook/pull/19383)

#### Bug Fixes

- Disable keyboard shortcuts during (docs) play functions and add tests [#19668](https://github.com/storybooks/storybook/pull/19668)

#### Maintenance

- Addon-docs: Replace source-loader with csf-plugin [#19680](https://github.com/storybooks/storybook/pull/19680)
- CLI: Move all templates out of cli into renderers [#19664](https://github.com/storybooks/storybook/pull/19664)
- Addon-docs: Remove mdx-compiler-plugin [#19681](https://github.com/storybooks/storybook/pull/19681)

## 7.0.0-alpha.46 (October 28, 2022)

#### Features

- Addon-docs: Don't show docspage unless the user opts in [#19627](https://github.com/storybooks/storybook/pull/19627)
- Core: Allow setting tags in storiesOf via parameters. [#19642](https://github.com/storybooks/storybook/pull/19642)

#### Bug Fixes

- Addon-docs: Fix React Profiler in source snippets [#19004](https://github.com/storybooks/storybook/pull/19004)

#### Maintenance

- Telemetry: Measure version update check [#19660](https://github.com/storybooks/storybook/pull/19660)
- Build: Bundle lib/preview-web with ts-up [#19655](https://github.com/storybooks/storybook/pull/19655)
- CSF-tools: Make ESM node compatible [#19661](https://github.com/storybooks/storybook/pull/19661)
- Telemetry: Measure docs usage [#19648](https://github.com/storybooks/storybook/pull/19648)
- Go back to `csf@next` [#19657](https://github.com/storybooks/storybook/pull/19657)

#### Build

- Build: Reduce parallelism in check task [#19662](https://github.com/storybooks/storybook/pull/19662)

## 7.0.0-alpha.45 (October 28, 2022)

#### Bug Fixes

- Svelte: Fix regression causing all stories to error [#19653](https://github.com/storybooks/storybook/pull/19653)
- CSF: Fix `StoryObj<typeof Cmp>` to work the same as old ComponentStoryObj [#19651](https://github.com/storybooks/storybook/pull/19651)

#### Maintenance

- Core: Misc dead code removal [#19654](https://github.com/storybooks/storybook/pull/19654)
- Addon-actions: Move decorator to its own entrypoint [#19650](https://github.com/storybooks/storybook/pull/19650)

#### Build

- Build: Reduce resource classes [#19652](https://github.com/storybooks/storybook/pull/19652)

## 7.0.0-alpha.44 (October 27, 2022)

#### Features

- Add tags to story and index [#19625](https://github.com/storybooks/storybook/pull/19625)
- CSF tools: Add tags support [#19626](https://github.com/storybooks/storybook/pull/19626)
- Vue2: Improve CSF3 types [#19603](https://github.com/storybooks/storybook/pull/19603)
- Vue3: Improve CSF3 types [#19602](https://github.com/storybooks/storybook/pull/19602)

#### Bug Fixes

- Core: Fix v6 store when no explicit renderer [#19624](https://github.com/storybooks/storybook/pull/19624)
- CLI/React native: Fix addons template to import register instead of manager [#19620](https://github.com/storybooks/storybook/pull/19620)

#### Maintenance

- Build-storybook: Only copy .mjs files for manager build [#19647](https://github.com/storybooks/storybook/pull/19647)
- Rename storybook/ui to storybook/manager [#19635](https://github.com/storybooks/storybook/pull/19635)
- Addons: Support SSR by not using global.window to store hooks context [#19631](https://github.com/storybooks/storybook/pull/19631)
- Breaking: Final few deprecations removal in a batch [#19553](https://github.com/storybooks/storybook/pull/19553)
- TypeScript: Misc types improvements [#19633](https://github.com/storybooks/storybook/pull/19633)
- TypeScript: Restructure storybook types [#19580](https://github.com/storybooks/storybook/pull/19580)
- TypeScript: cleanup types [#19621](https://github.com/storybooks/storybook/pull/19621)

#### Build

- Build: Reduce CI usage by 60% [#19644](https://github.com/storybooks/storybook/pull/19644)
- Remove `netlify.toml` [#19645](https://github.com/storybooks/storybook/pull/19645)
- Small fixes for `check` task [#19643](https://github.com/storybooks/storybook/pull/19643)
- Storybook for `@storybook/blocks` only [#19630](https://github.com/storybooks/storybook/pull/19630)
- Fix broken stories in UI Storybook [#19632](https://github.com/storybooks/storybook/pull/19632)
- Ugrade eslint [#19601](https://github.com/storybooks/storybook/pull/19601)
- Integrate standalone Storybook with Chromatic [#19619](https://github.com/storybooks/storybook/pull/19619)

## 7.0.0-alpha.43 (October 25, 2022)

#### Bug Fixes

- Core: Add `renderer` field to frameworks, and use to drive v6 store entrypoints [#19595](https://github.com/storybooks/storybook/pull/19595)
- Core: Add new SET_INDEX event [#19590](https://github.com/storybooks/storybook/pull/19590)
- CLI: Don't run MDX2 automigration on node_modules [#19611](https://github.com/storybooks/storybook/pull/19611)
- Core: Ensure preview annotations are resolved relative to the cwd [#19594](https://github.com/storybooks/storybook/pull/19594)
- Core: Fix addon URLs on Windows [#19589](https://github.com/storybooks/storybook/pull/19589)

#### Maintenance

- Vite: Tidy up mdx-plugin [#19563](https://github.com/storybooks/storybook/pull/19563)
- Web-components/Vite: remove unused dependencies [#19583](https://github.com/storybooks/storybook/pull/19583)

#### Build

- Remove DocBlocks example Storybook [#19616](https://github.com/storybooks/storybook/pull/19616)
- Move and include `@storybook/blocks` in standalone Storybook [#19615](https://github.com/storybooks/storybook/pull/19615)
- Move and include `@storybook/components` in standalone Storybook [#19598](https://github.com/storybooks/storybook/pull/19598)
- Move examples -> test-storybooks [#19599](https://github.com/storybooks/storybook/pull/19599)
- MDX iframe stories [#19586](https://github.com/storybooks/storybook/pull/19586)

#### Dependency Upgrades

- Upgrade mdx2-csf to next [#19600](https://github.com/storybooks/storybook/pull/19600)

## 7.0.0-alpha.42 (October 24, 2022)

#### Features

- Svelte: Improve CSF3 types [#19512](https://github.com/storybooks/storybook/pull/19512)

#### Maintenance

- Telemetry: Use a wrapper around all CLI commands to send boot and error events [#19566](https://github.com/storybooks/storybook/pull/19566)

#### Build

- Add ability to run tasks from code dir [#19588](https://github.com/storybooks/storybook/pull/19588)
- Make the reporter dynamic [#19587](https://github.com/storybooks/storybook/pull/19587)
- Add vite-react benchmark [#19558](https://github.com/storybooks/storybook/pull/19558)

#### Dependency Upgrades

- Fix test-runner version conflicts [#19581](https://github.com/storybooks/storybook/pull/19581)

## 7.0.0-alpha.41 (October 21, 2022)

#### Features

- Add `@storybook/nextjs` framework [#19382](https://github.com/storybooks/storybook/pull/19382)
- CLI: Enable `@storybook/nextjs` framework [#19478](https://github.com/storybooks/storybook/pull/19478)
- CLI: Automigrate from MDX1 to MDX2 [#19568](https://github.com/storybooks/storybook/pull/19568)

#### Maintenance

- Remove warning of removed feature in lib/client-api [#19544](https://github.com/storybooks/storybook/pull/19544)
- Remove vite-plugin-svelte-kit when detected [#19522](https://github.com/storybooks/storybook/pull/19522)

#### Build

- Delete Svelte example [#19549](https://github.com/storybooks/storybook/pull/19549)
- Fix circle test results [#19552](https://github.com/storybooks/storybook/pull/19552)

#### Dependency Upgrades

- Update the version of the "update-notifier" package [#19569](https://github.com/storybooks/storybook/pull/19569)

## 7.0.0-alpha.40 (October 20, 2022)

#### Breaking Changes

- Addon-docs: Upgrade to MDXv2 [#19495](https://github.com/storybooks/storybook/pull/19495)

#### Bug Fixes

- Addon-docs: Don't generate docs page entries for CSF files with no stories [#19529](https://github.com/storybooks/storybook/pull/19529)

#### Maintenance

- Remove deprecate features from preview-web [#19540](https://github.com/storybooks/storybook/pull/19540)
- Remove deprecated features in lib/api [#19539](https://github.com/storybooks/storybook/pull/19539)
- Remove default selection in docblocks [#19537](https://github.com/storybooks/storybook/pull/19537)

#### Build

- Remove .git folder when generating repros [#19535](https://github.com/storybooks/storybook/pull/19535)
- Some task runner tweaks + move test-runner into sandbox task. [#19505](https://github.com/storybooks/storybook/pull/19505)
- Build builder-webpack5 with ts-up [#19435](https://github.com/storybooks/storybook/pull/19435)

## 7.0.0-alpha.39 (October 19, 2022)

#### Breaking Changes

- Addons: Remove deprecations [#19524](https://github.com/storybooks/storybook/pull/19524)

#### Features

- Core: Throw an error if renderer is used as framework [#19452](https://github.com/storybooks/storybook/pull/19452)
- CLI: Add pnpm support [#19425](https://github.com/storybooks/storybook/pull/19425)
- CLI: support .json in eslint-plugin migration [#19511](https://github.com/storybooks/storybook/pull/19511)

#### Bug Fixes

- Vite/React: Align with webpack react docgen [#19399](https://github.com/storybooks/storybook/pull/19399)
- Core: Direct logs to stdout [#19434](https://github.com/storybooks/storybook/pull/19434)
- Telemetry: Send start/build events even when there is no generator [#19507](https://github.com/storybooks/storybook/pull/19507)
- Core: Fix inconsistent telemetry debug [#19509](https://github.com/storybooks/storybook/pull/19509)

#### Maintenance

- Addon-docs: Define children for DocsContainer [#19437](https://github.com/storybooks/storybook/pull/19437)
- Convert issue templates to forms [#19370](https://github.com/storybooks/storybook/pull/19370)
- Change once.warn to deprecate when that is the actual intent [#19521](https://github.com/storybooks/storybook/pull/19521)
- Cleanup framework angular dependencies [#19389](https://github.com/storybooks/storybook/pull/19389)
- Frameworks: Don't re-export renderer types from frameworks [#19510](https://github.com/storybooks/storybook/pull/19510)
- Core: Remove storyStore.getSelection [#19491](https://github.com/storybooks/storybook/pull/19491)
- CLI: rename "latest" to "v13" app name in angular v13 repro template [#19498](https://github.com/storybooks/storybook/pull/19498)

#### Build

- Improve misc build parts [#19520](https://github.com/storybooks/storybook/pull/19520)
- Build: Bundle addons/storysource with ts-up [#19482](https://github.com/storybooks/storybook/pull/19482)
- Build: Bundle lib/docs-tools & lib/instrumenter with ts-up [#19206](https://github.com/storybooks/storybook/pull/19206)
- Actions: update actions/setup-node to v3 [#19444](https://github.com/storybooks/storybook/pull/19444)
- Actions: update actions/checkout to v3 [#19441](https://github.com/storybooks/storybook/pull/19441)
- Build: Bundle lib/codemod with ts-up [#19398](https://github.com/storybooks/storybook/pull/19398)
- Build: Bundle addons/highlight with ts-up [#19483](https://github.com/storybooks/storybook/pull/19483)
- Enable preact templates and remove `preact-kitchen-sink` [#19454](https://github.com/storybooks/storybook/pull/19454)

#### Dependency Upgrades

- Addon-docs: Make babel-loader an optional peer dependency [#19385](https://github.com/storybooks/storybook/pull/19385)
- Add missing addons/docs dependency for fs-extra [#19493](https://github.com/storybooks/storybook/pull/19493)

## 7.0.0-alpha.38 (October 15, 2022)

#### Bug Fixes

- Vite: Fix bail not being defined for vite builder [#19405](https://github.com/storybooks/storybook/pull/19405)

#### Maintenance

- Breaking: Remove onBeforeRender [#19489](https://github.com/storybooks/storybook/pull/19489)
- Breaking: Upgrade to use node 16 everywhere [#19458](https://github.com/storybooks/storybook/pull/19458)
- Breaking: Remove the old showRoots config option [#19440](https://github.com/storybooks/storybook/pull/19440)
- CLI: Make the button component accept a label prop, (not children) [#19461](https://github.com/storybooks/storybook/pull/19461)
- Remove `angular-cli` example [#19202](https://github.com/storybooks/storybook/pull/19202)
- Breakimg: Remove the html entrypoint of lib/components [#19487](https://github.com/storybooks/storybook/pull/19487)
- Vite: Add partial SvelteKit support [#19338](https://github.com/storybooks/storybook/pull/19338)

#### Build

- Angular: Add angular 14 sandbox template [#19181](https://github.com/storybooks/storybook/pull/19181)
- Storybook for Storybook - step 1: `ui/manager` [#19465](https://github.com/storybooks/storybook/pull/19465)
- Don't pass the full path to repro generators [#19480](https://github.com/storybooks/storybook/pull/19480)
- Bundle lib/channel-postmessage with ts-up [#19388](https://github.com/storybooks/storybook/pull/19388)
- Disable smoke test [#19475](https://github.com/storybooks/storybook/pull/19475)
- Remove angular example from monorepo [#19467](https://github.com/storybooks/storybook/pull/19467)
- Add angular 13 repro template [#19428](https://github.com/storybooks/storybook/pull/19428)
- Add a TypeScript check task and configure ci to run it [#19471](https://github.com/storybooks/storybook/pull/19471)
- Add Preact/Webpack templates and update renderer/preset (2) [#19451](https://github.com/storybooks/storybook/pull/19451)
- Disable another smoke test [#19466](https://github.com/storybooks/storybook/pull/19466)

#### Dependency Upgrades

- Ipgrade chromatic [#19468](https://github.com/storybooks/storybook/pull/19468)

## 7.0.0-alpha.37 (October 13, 2022)

#### Features

- React: Sound arg types for CSF3 [#19238](https://github.com/storybooks/storybook/pull/19238)
- Vite: Add web-components/lit framework support [#19164](https://github.com/storybooks/storybook/pull/19164)
- UI: Update colors for 7.0 [#19023](https://github.com/storybooks/storybook/pull/19023)

#### Bug Fixes

- Server: Ensure consistent route handling by always starting `managerBuilder` before `previewBuilder` [#19406](https://github.com/storybooks/storybook/pull/19406)
- UI: Fix addon URL escaping in manager [#19375](https://github.com/storybooks/storybook/pull/19375)
- CLI: remove `npx` usage from storybook scripts [#19366](https://github.com/storybooks/storybook/pull/19366)
- Webpack5: Fix lazy compilation/fscache builderOptions when base config is disabled [#19387](https://github.com/storybooks/storybook/pull/19387)

#### Maintenance

- Breaking: remove the deprecated Preview component [#19445](https://github.com/storybooks/storybook/pull/19445)
- Breaking: remove deprecated channel apis [#19443](https://github.com/storybooks/storybook/pull/19443)
- Breaking: remove framework angulars storymodule story-component handling [#19442](https://github.com/storybooks/storybook/pull/19442)
- Breaking: remove deprecated glob fixing [#19438](https://github.com/storybooks/storybook/pull/19438)
- Refactor bootstrap+sandbox into "task" framework [#19275](https://github.com/storybooks/storybook/pull/19275)
- CI: Fix test-runner build step [#19255](https://github.com/storybooks/storybook/pull/19255)
- Angular: Drop support for angular < 13 [#19368](https://github.com/storybooks/storybook/pull/19368)
- Build: Add installScripts step in bootstrap command [#19270](https://github.com/storybooks/storybook/pull/19270)
- Vite: Move default cache dir to node_modules/.cache [#19384](https://github.com/storybooks/storybook/pull/19384)

#### Build

- Addon-docs: Refactor MDX examples to sandboxes [#19301](https://github.com/storybooks/storybook/pull/19301)
- Undo accidental push of tom/sb-557-typescript-2 [#19450](https://github.com/storybooks/storybook/pull/19450)
- Ensure we kill all controllers before exiting [#19449](https://github.com/storybooks/storybook/pull/19449)
- Examples: Remove official-storybook [#19343](https://github.com/storybooks/storybook/pull/19343)
- Build: Improve template stories [#19402](https://github.com/storybooks/storybook/pull/19402)
- Vue: Delete vue-cli/vue-kitchen-sink examples [#19429](https://github.com/storybooks/storybook/pull/19429)
- React: Remove react-ts example [#19424](https://github.com/storybooks/storybook/pull/19424)
- Web-components: Port template stories and delete web-components-kitchen-sink [#19430](https://github.com/storybooks/storybook/pull/19430)
- remove html-kitchen-sink example [#19360](https://github.com/storybooks/storybook/pull/19360)
- add template for html-webpack5 [#19377](https://github.com/storybooks/storybook/pull/19377)
- use a single version of yarn [#19417](https://github.com/storybooks/storybook/pull/19417)
- fix build command for netlify [#19418](https://github.com/storybooks/storybook/pull/19418)
- Re-enable `svelte-vite/default-ts` template [#19369](https://github.com/storybooks/storybook/pull/19369)
- Only persist the (single) built sandbox [#19372](https://github.com/storybooks/storybook/pull/19372)

#### Dependency Upgrades

- Replace @storybook/semver with semver [#19292](https://github.com/storybooks/storybook/pull/19292)
- Upgrade playwright [#19416](https://github.com/storybooks/storybook/pull/19416)

## 7.0.0-alpha.36 (October 13, 2022)

Bad publish

## 7.0.0-alpha.35 (October 5, 2022)

#### Features

- Angular: Disable ngcc when not needed [#19307](https://github.com/storybooks/storybook/pull/19307)
- Vite: Add vue-vite framework for Vue2 [#19230](https://github.com/storybooks/storybook/pull/19230)
- Storyshots-puppeteer: Add browserLaunchOptions to CommonConfig [#18927](https://github.com/storybooks/storybook/pull/18927)

#### Bug Fixes

- Vite: Fix svelte docgen and svelte-native stories [#19339](https://github.com/storybooks/storybook/pull/19339)
- CLI: Exclude @storybook/testing-react from outdated check [#19272](https://github.com/storybooks/storybook/pull/19272)
- Interactions: Fix path to checkActionsLoaded [#19334](https://github.com/storybooks/storybook/pull/19334)
- Webpack: Fix resolution of webpack config relating to resolve fallbacks (assert) [#19358](https://github.com/storybooks/storybook/pull/19358)
- Vite: Add vite framework plugin if not found [#19259](https://github.com/storybooks/storybook/pull/19259)
- Vue2: Fix play function `within` & args updating in decorators [#19207](https://github.com/storybooks/storybook/pull/19207)

#### Maintenance

- Addon-docs: Remove STORYBOOK_REACT_CLASSES and global/globals.ts [#19300](https://github.com/storybooks/storybook/pull/19300)
- Cleanup premature merge [#19332](https://github.com/storybooks/storybook/pull/19332)
- CLI: Update sb add for main.js [#19312](https://github.com/storybooks/storybook/pull/19312)
- React: Move argType stories to template/stories folder [#19265](https://github.com/storybooks/storybook/pull/19265)

#### Build

- Build: Add react17 + webpack5 template [#19342](https://github.com/storybooks/storybook/pull/19342)
- Build: Add react18 + webpack5 template [#19341](https://github.com/storybooks/storybook/pull/19341)
- Build: Forward parameters in nx command execution [#19283](https://github.com/storybooks/storybook/pull/19283)
- Build: cleanup after moving to tsup [#19268](https://github.com/storybooks/storybook/pull/19268)
- Build: change the vue e2e test to use webpack5, since we stopped supporting webpack4 in 7.0 [#19257](https://github.com/storybooks/storybook/pull/19257)
- Build: Add vue-cli/vue2 repro template [#19314](https://github.com/storybooks/storybook/pull/19314)
- Build: Bundle addons-actions with ts-up [#18775](https://github.com/storybooks/storybook/pull/18775)
- Build: Bundle lib/addons with ts-up [#18805](https://github.com/storybooks/storybook/pull/18805)
- Build: improve the tsconfig [#19346](https://github.com/storybooks/storybook/pull/19346)
- Build: Bundle lib/telemetry with ts-up [#19317](https://github.com/storybooks/storybook/pull/19317)
- Build: Bundle lib/store with tsup [#19308](https://github.com/storybooks/storybook/pull/19308)
- Build: Bundle lib/source-loader with ts-up [#19313](https://github.com/storybooks/storybook/pull/19313)
- Build: Bundle lib/csf-tools with ts-up [#18914](https://github.com/storybooks/storybook/pull/18914)
- Build: Bundle lib/core-client with ts-up [#19276](https://github.com/storybooks/storybook/pull/19276)
- Build: Bundle lib/client-api with ts-up [#19271](https://github.com/storybooks/storybook/pull/19271)
- Build: Bundle lib/postinstall with ts-up [#19327](https://github.com/storybooks/storybook/pull/19327)
- Build: Add react18 + webpack5 template [#19341](https://github.com/storybooks/storybook/pull/19341)
- Build: Remove cypress from monorepo [#19303](https://github.com/storybooks/storybook/pull/19303)
- Build: Disable smoke test on cra/default-ts [#19352](https://github.com/storybooks/storybook/pull/19352)
- Build: Fix prepare bundle on Windows [#19243](https://github.com/storybooks/storybook/pull/19243)
- Build: Bundle addons/essentials with ts-up [#19322](https://github.com/storybooks/storybook/pull/19322)

## 7.0.0-alpha.34 (September 27, 2022)

#### Features

- Vite: Export storybook utilities from frameworks for better pnpm support [#19216](https://github.com/storybooks/storybook/pull/19216)

#### Bug Fixes

- Vite: Do not add Webpack loaders when using Vite builder [#19263](https://github.com/storybooks/storybook/pull/19263)
- Source-loader: Fix invalid call to CSF sanitize [#18930](https://github.com/storybooks/storybook/pull/18930)
- Svelte: generate preview file with js extension always [#19253](https://github.com/storybooks/storybook/pull/19253)
- UI: Fix react runtime for addons in manager [#19226](https://github.com/storybooks/storybook/pull/19226)
- Svelte: Fix button component not accepting the onClick handler [#19249](https://github.com/storybooks/storybook/pull/19249)
- Vite: Support runStep in Vite builder SSv6 [#19235](https://github.com/storybooks/storybook/pull/19235)
- Angular: Alias decorateStory as applyDecorators [#19189](https://github.com/storybooks/storybook/pull/19189)
- UI: Recalculate height of ZoomElement when child element updates [#15472](https://github.com/storybooks/storybook/pull/15472)
- UI: Fix copy button copying outdated snippet [#18888](https://github.com/storybooks/storybook/pull/18888)
- UI: Fix clipboard issue [#18999](https://github.com/storybooks/storybook/pull/18999)
- CLI: Do not remove framework dependency in automigration [#19129](https://github.com/storybooks/storybook/pull/19129)
- TS: Type `storyIdToEntry` explicitly [#19123](https://github.com/storybooks/storybook/pull/19123)

#### Maintenance

- Vue3: Add generic renderer stories & delete vue3 example [#19219](https://github.com/storybooks/storybook/pull/19219)
- Build: Remove unused angular_modern_inline_rendering [#19254](https://github.com/storybooks/storybook/pull/19254)
- Build: bundle csf-tools with tsup [#19141](https://github.com/storybooks/storybook/pull/19141)
- Build: Enforce @ts-expect-error via eslint [#19198](https://github.com/storybooks/storybook/pull/19198)
- Vue: Add repro template for vue-cli [#19165](https://github.com/storybooks/storybook/pull/19165)
- Build: Link renderer-specific stories inside the sandbox's real stories dir [#19185](https://github.com/storybooks/storybook/pull/19185)
- Build: Remove `cra-kitchen-sink` example [#19179](https://github.com/storybooks/storybook/pull/19179)
- Build: Fix the check script [#19184](https://github.com/storybooks/storybook/pull/19184)
- Build: Build lib/node-logger with ts-up [#19173](https://github.com/storybooks/storybook/pull/19173)
- Build: Fix sandbox running multiple versions of react [#19156](https://github.com/storybooks/storybook/pull/19156)
- Build: fix playwright version again [#19250](https://github.com/storybooks/storybook/pull/19250)
- Build: upgrade playwright version (and lock it) [#19227](https://github.com/storybooks/storybook/pull/19227)

#### Dependency Upgrades

- Remove @nicolo-ribaudo/chokidar-2 [#19244](https://github.com/storybooks/storybook/pull/19244)

## 7.0.0-alpha.33 (September 13, 2022)

#### Features

- Core: Add a new `throwPlayFunctionExceptions` parameter [#19143](https://github.com/storybooks/storybook/pull/19143)

#### Bug Fixes

- Fix issue in instrumenter with `waitFor` [#19145](https://github.com/storybooks/storybook/pull/19145)
- Core: Fix static dirs targeting same destination [#19064](https://github.com/storybooks/storybook/pull/19064)
- React: Fix issue with react 18 implementation [#19125](https://github.com/storybooks/storybook/pull/19125)
- CLI: Fix spawning child processes on windows [#19019](https://github.com/storybooks/storybook/pull/19019)
- Vite: Ensure we set `DOCS_OPTIONS` in the vite builder [#19127](https://github.com/storybooks/storybook/pull/19127)

#### Maintenance

- Build: Bundle @storybook/cli with tsup [#19138](https://github.com/storybooks/storybook/pull/19138)
- Examples: Remove `cra-ts-essentials` [#19170](https://github.com/storybooks/storybook/pull/19170)
- Added some basic interactions stories [#19153](https://github.com/storybooks/storybook/pull/19153)
- Presets: Replace `config` with `previewAnnotations`, remove `previewEntries` [#19152](https://github.com/storybooks/storybook/pull/19152)
- Addon-links: Move stories into addon [#19124](https://github.com/storybooks/storybook/pull/19124)
- Addon-a11y: Move stories into addon [#19114](https://github.com/storybooks/storybook/pull/19114)
- Toolbars: Generic example stories [#19166](https://github.com/storybooks/storybook/pull/19166)
- TypeScript: Revert a few @ts-expect-errors [#19168](https://github.com/storybooks/storybook/pull/19168)
- Addon-docs: Generic stories for DocsPage [#19162](https://github.com/storybooks/storybook/pull/19162)
- Controls: Generic stories for sorting [#19161](https://github.com/storybooks/storybook/pull/19161)
- Build: Generic stories for addon-controls [#19149](https://github.com/storybooks/storybook/pull/19149)
- remove node12 from the matrix [#19147](https://github.com/storybooks/storybook/pull/19147)
- Build libs/router with ts-up [#19140](https://github.com/storybooks/storybook/pull/19140)
- Build: Bundle addon-interactions with tsup [#19139](https://github.com/storybooks/storybook/pull/19139)
- Generic stories for remaining core features [#19118](https://github.com/storybooks/storybook/pull/19118)
- Add parameter, loader and decorator stories to `lib/store` [#19105](https://github.com/storybooks/storybook/pull/19105)
- Convert @ts-ignore to @ts-expect-error [#19122](https://github.com/storybooks/storybook/pull/19122)

#### Dependency Upgrades

- Upgrade emotion deps again [#19054](https://github.com/storybooks/storybook/pull/19054)

## 7.0.0-alpha.31 (September 7, 2022)

#### Maintenance

- Doc blocks: Update ArgTable Reset button to use IconButton [#19052](https://github.com/storybooks/storybook/pull/19052)
- UI: Update a handful of icons [#19084](https://github.com/storybooks/storybook/pull/19084)
- Build: Update to latest nx [#19078](https://github.com/storybooks/storybook/pull/19078)
- Vite: Fix plugin types [#19095](https://github.com/storybooks/storybook/pull/19095)

#### Dependency Upgrades

- Chore: Remove unused dependencies in /lib [#19100](https://github.com/storybooks/storybook/pull/19100)

## 7.0.0-alpha.30 (September 6, 2022)

#### Bug Fixes

- CLI: Fix include rendererAssets in npm bundle [#19115](https://github.com/storybooks/storybook/pull/19115)

#### Maintenance

- CLI: remove outdated comment in Angular starter [#19097](https://github.com/storybooks/storybook/pull/19097)

#### Dependency Upgrades

- Remove deprecated `stable` dependency [#19103](https://github.com/storybooks/storybook/pull/19103)
- Svelte: Update sveltedoc dependencies [#19111](https://github.com/storybooks/storybook/pull/19111)
- Deps: Remove core-js from most packages [#19098](https://github.com/storybooks/storybook/pull/19098)
- Deps: Upgrade react-element-to-jsx-string and react-inspector for React 18 [#19104](https://github.com/storybooks/storybook/pull/19104)

## 7.0.0-alpha.29 (September 2, 2022)

#### Bug Fixes

- CLI/Vite: Don't add babel dependencies during init [#19088](https://github.com/storybooks/storybook/pull/19088)
- CLI: Fix sb init to use renderer assets instead of frameworks [#19091](https://github.com/storybooks/storybook/pull/19091)
- Core: Ensure if a docs render is torndown during preparation, it throws [#19071](https://github.com/storybooks/storybook/pull/19071)

#### Maintenance

- Addon-viewport: Move stories into addon [#19086](https://github.com/storybooks/storybook/pull/19086)
- Addon-backgrounds: Move stories into addon [#19085](https://github.com/storybooks/storybook/pull/19085)
- Addon-actions: Move stories into addon [#19082](https://github.com/storybooks/storybook/pull/19082)
- Build: Exit yarn bootstrap with nonzero code if failed [#19089](https://github.com/storybooks/storybook/pull/19089)
- Vite: cleanup custom plugins [#19087](https://github.com/storybooks/storybook/pull/19087)
- Build: Prefix generic addon stories in sandbox storybooks [#19092](https://github.com/storybooks/storybook/pull/19092)

## 7.0.0-alpha.28 (September 2, 2022)

#### Features

- Vite: Automatically use vite.config.js [#19026](https://github.com/storybooks/storybook/pull/19026)

#### Bug Fixes

- CLI: Fix race condition in sb init [#19083](https://github.com/storybooks/storybook/pull/19083)
- Vite: Fix framework option checks, and SSv6 [#19062](https://github.com/storybooks/storybook/pull/19062)
- Core: Fix WebProjectAnnotations export in preview-web for back-compat [#19048](https://github.com/storybooks/storybook/pull/19048)
- Blocks: Fix Checkbox control update when using useArgs hook

#### Maintenance

- Update to new TS reference format (?) [#19072](https://github.com/storybooks/storybook/pull/19072)
- Build: Conditionally force vite rebuilds in sandbox [#19063](https://github.com/storybooks/storybook/pull/19063)
- Build: Fix CRA bench [#19066](https://github.com/storybooks/storybook/pull/19066)

## 7.0.0-alpha.27 (August 31, 2022)

#### Features

- Vite: Set `resolve.preserveSymlinks` based on env vars [#19039](https://github.com/storybooks/storybook/pull/19039)

#### Bug Fixes

- Core: Restore `/preview` etc package exports; return unresolved path from presets. [#19045](https://github.com/storybooks/storybook/pull/19045)

#### Maintenance

- Core: Add previewHead and previewBody to StorybookConfig interface [#19047](https://github.com/storybooks/storybook/pull/19047)
- Build: Fix the sb-bench CI step [#19029](https://github.com/storybooks/storybook/pull/19029)
- Remove sandbox from `.ignore` [#19040](https://github.com/storybooks/storybook/pull/19040)
- Build: Use new test runner with builtin junit [#19028](https://github.com/storybooks/storybook/pull/19028)

#### Dependency Upgrades

- Vite: Clean up framework dependencies / unused files [#19035](https://github.com/storybooks/storybook/pull/19035)

## 7.0.0-alpha.26 (August 26, 2022)

#### Features

- CLI: Add react, vue3, and svelte vite to new-frameworks automigration [#19016](https://github.com/storybooks/storybook/pull/19016)
- Svelte: Add svelte-vite framework [#18978](https://github.com/storybooks/storybook/pull/18978)

#### Bug Fixes

- Core: Fix default story glob [#19018](https://github.com/storybooks/storybook/pull/19018)

#### Dependency Upgrades

- React-vite: update/cleanup dependencies [#19025](https://github.com/storybooks/storybook/pull/19025)
- Remove babel-loader from core-common [#19022](https://github.com/storybooks/storybook/pull/19022)

## 7.0.0-alpha.25 (August 25, 2022)

#### Features

- Vite: Add builder-vite, react-vite, and vue3-vite [#19007](https://github.com/storybooks/storybook/pull/19007)

#### Maintenance

- CI: use runner with playwright installed for cra_bench [#18951](https://github.com/storybooks/storybook/pull/18951)
- Replace rollup-plugin-node-polyfills to analogs [#18975](https://github.com/storybooks/storybook/pull/18975)

## 7.0.0-alpha.24 (August 24, 2022)

#### Breaking changes

- Preview: Rename Storybook DOM root IDs [#10638](https://github.com/storybooks/storybook/pull/10638)

#### Features

- Interactions: Add `step` function and support multiple levels of nesting [#18555](https://github.com/storybooks/storybook/pull/18555)

#### Bug Fixes

- Addon-docs: Fix canvas support expand code for non-story [#18808](https://github.com/storybooks/storybook/pull/18808)
- Components: Avoid including line numbers when copying the code [#18725](https://github.com/storybooks/storybook/pull/18725)
- Vue: Fix enum check in extractArgTypes [#18959](https://github.com/storybooks/storybook/pull/18959)
- Core: Fix frameworkOptions preset [#18979](https://github.com/storybooks/storybook/pull/18979)

#### Maintenance

- Addon-a11y: Remove achromatomaly color filter [#18852](https://github.com/storybooks/storybook/pull/18852)
- Build: Use ts-up to build core-webpack [#18912](https://github.com/storybooks/storybook/pull/18912)
- Build: Use ts-up to build addon-viewport [#18943](https://github.com/storybooks/storybook/pull/18943)
- Build: Improve generate-repros-next [#19001](https://github.com/storybooks/storybook/pull/19001)
- Examples: Remove refs in angular example [#18986](https://github.com/storybooks/storybook/pull/18986)
- Build: Use ts-up to build client-logger [#18893](https://github.com/storybooks/storybook/pull/18893)
- Generate-repros: Run local registry on `--local-registry` option [#18997](https://github.com/storybooks/storybook/pull/18997)
- Build: Remove unused bootstrap --cleanup [#18981](https://github.com/storybooks/storybook/pull/18981)
- CLI: Fix local repro publishing [#18977](https://github.com/storybooks/storybook/pull/18977)
- Build: Run verdaccio on 6001 to enable web UI [#18983](https://github.com/storybooks/storybook/pull/18983)
- CLI: determine whether to add interactive stories from `renderer` rather than `framework` [#18968](https://github.com/storybooks/storybook/pull/18968)
- CLI: Auto-accept migrations when running `generate-repros-next` [#18969](https://github.com/storybooks/storybook/pull/18969)

## 7.0.0-alpha.23 (August 18, 2022)

#### Features

- UI: Polish canvas and sidebar for 7.0 [#18894](https://github.com/storybooks/storybook/pull/18894)

#### Maintenance

- Sandbox: Add ability to run from local repro [#18950](https://github.com/storybooks/storybook/pull/18950)
- Repros: Add ability to generate repros using local registry [#18948](https://github.com/storybooks/storybook/pull/18948)
- CLI: Move write/read package json into JsPackageManager [#18942](https://github.com/storybooks/storybook/pull/18942)

## 7.0.0-alpha.22 (August 18, 2022)

Failed publish to npm

## 7.0.0-alpha.21 (August 17, 2022)

#### Maintenance

- UI: Update every icon for v7 design [#18809](https://github.com/storybooks/storybook/pull/18809)

## 7.0.0-alpha.20 (August 16, 2022)

#### Features

- CLI: Automigration for new frameworks [#18919](https://github.com/storybooks/storybook/pull/18919)

#### Bug Fixes

- UI: Fix the order of addons appearing in prebuilt manager [#18918](https://github.com/storybooks/storybook/pull/18918)

#### Maintenance

- Exit sandbox gracefully on cancel [#18936](https://github.com/storybooks/storybook/pull/18936)
- Disable telemetry in monorepo and CI [#18935](https://github.com/storybooks/storybook/pull/18935)
- Convert cypress e2e tests to playwright [#18932](https://github.com/storybooks/storybook/pull/18932)
- CI: Refactor to use tasks [#18922](https://github.com/storybooks/storybook/pull/18922)
- Angular: Add renderer components / stories [#18934](https://github.com/storybooks/storybook/pull/18934)
- Examples: Add angular repro template and refactor [#18931](https://github.com/storybooks/storybook/pull/18931)

## 7.0.0-alpha.19 (August 12, 2022)

#### Features

- CLI: add "storybook scripts 7.0" automigrate command [#18769](https://github.com/storybooks/storybook/pull/18769)
- Interactions: Run conditionally based on query param [#18706](https://github.com/storybooks/storybook/pull/18706)

#### Bug Fixes

- API: Return defaultValue in useParameter if story is not prepared [#18887](https://github.com/storybooks/storybook/pull/18887)
- Store: always call composeConfigs in setProjectAnnotations [#18916](https://github.com/storybooks/storybook/pull/18916)
- CLI: install the same version as the user in sb-scripts automigration [#18917](https://github.com/storybooks/storybook/pull/18917)
- Theming: Add `create` export for lib/theming [#18906](https://github.com/storybooks/storybook/pull/18906)
- Telemetry: Improve addon extraction logic [#18868](https://github.com/storybooks/storybook/pull/18868)
- UI: Add image support to builder-manager [#18857](https://github.com/storybooks/storybook/pull/18857)
- ArgTypes: Fix check for undefined before [#18710](https://github.com/storybooks/storybook/pull/18710)

#### Maintenance

- Build: use ts-up to build addon-toolbars [#18847](https://github.com/storybooks/storybook/pull/18847)
- Build: Use ts-up to build channels [#18882](https://github.com/storybooks/storybook/pull/18882)
- Build: Use ts-up to build addon-links [#18908](https://github.com/storybooks/storybook/pull/18908)
- CLI: Fix remove dependencies logic [#18905](https://github.com/storybooks/storybook/pull/18905)
- CLI: Add uninstall deps to jsPackageManager [#18900](https://github.com/storybooks/storybook/pull/18900)
- Examples: Improve sandbox command error handling and debugging [#18869](https://github.com/storybooks/storybook/pull/18869)
- Examples: Change to self-hosted placeholder images [#18878](https://github.com/storybooks/storybook/pull/18878)
- CLI: add --no-init to repro-next command [#18866](https://github.com/storybooks/storybook/pull/18866)
- Build: Got verdaccio working, borrowing heavily from the old repro command [#18844](https://github.com/storybooks/storybook/pull/18844)
- Core-server: Move webpack to be a devDependency [#18856](https://github.com/storybooks/storybook/pull/18856)

## 7.0.0-alpha.18 (August 2, 2022)

#### Features

- CLI: Add temporary sb repro-next command that only degits repros [#18834](https://github.com/storybooks/storybook/pull/18834)
- Interactions: Add step function to play context [#18673](https://github.com/storybooks/storybook/pull/18673)
- UI: Add preloading to stories highlighted in the sidebar [#17964](https://github.com/storybooks/storybook/pull/17964)

#### Bug Fixes

- UI: Fix refs with authentication being broken if the fetch for `iframe.html` succeeds (but with a request to authenticate) [#18160](https://github.com/storybooks/storybook/pull/18160)
- HTML: Fix missing ability to set `docs.extractArgTypes` [#18831](https://github.com/storybooks/storybook/pull/18831)
- React: Fix callback behavior in `react@18` [#18737](https://github.com/storybooks/storybook/pull/18737)
- CLI: Throw error on failure in sb init [#18816](https://github.com/storybooks/storybook/pull/18816)
- CLI: Fix package.json version detection [#18806](https://github.com/storybooks/storybook/pull/18806)

#### Maintenance

- Build: Use ts-up to build `addon-outline` [#18842](https://github.com/storybooks/storybook/pull/18842)
- Core: Fix default framework options handling [#18676](https://github.com/storybooks/storybook/pull/18676)
- Build: Use tsup to build `addon-measure` and fix related imports in `examples/official-storybook` [#18837](https://github.com/storybooks/storybook/pull/18837)
- Build: Use tsup to build addon-jest [#18836](https://github.com/storybooks/storybook/pull/18836)
- Examples: Use `repro-next` in the example script! [#18839](https://github.com/storybooks/storybook/pull/18839)
- Examples: Rename `example` => `sandbox` [#18838](https://github.com/storybooks/storybook/pull/18838)
- Examples: Use a set of test components in addon stories [#18825](https://github.com/storybooks/storybook/pull/18825)
- Examples: Copy example stories over from renderer + addons [#18824](https://github.com/storybooks/storybook/pull/18824)
- Examples: Set `resolve.symlinks` based on node option [#18827](https://github.com/storybooks/storybook/pull/18827)
- Examples: Add command to publish repros + GH action [#18800](https://github.com/storybooks/storybook/pull/18800)
- Examples: Create a new `yarn example` command [#18781](https://github.com/storybooks/storybook/pull/18781)
- Build: Fix yarn build command [#18817](https://github.com/storybooks/storybook/pull/18817)
- Build: Use tsup to build core-event [#18798](https://github.com/storybooks/storybook/pull/18798)

## 7.0.0-alpha.17 (July 27, 2022)

#### Features

- Addon-docs: Support DocsPage in v6 store [#18763](https://github.com/storybooks/storybook/pull/18763)

#### Bug Fixes

- Preact: Typescript pragma fix [#15564](https://github.com/storybooks/storybook/pull/15564)
- Core: Clear addon cache directory before starting the manager [#18731](https://github.com/storybooks/storybook/pull/18731)
- UI: Pass full docs options to manager [#18762](https://github.com/storybooks/storybook/pull/18762)
- Preview: Fix standalone MDX files not HMR-ing [#18747](https://github.com/storybooks/storybook/pull/18747)

#### Maintenance

- CLI: Add next-repro command [#18787](https://github.com/storybooks/storybook/pull/18787)
- Build: Remove old scripts that are no longer used [#18790](https://github.com/storybooks/storybook/pull/18790)
- Build: Addon-backgrounds with ts-up [#18784](https://github.com/storybooks/storybook/pull/18784)
- Build: Addon-controls with tsup [#18786](https://github.com/storybooks/storybook/pull/18786)
- Build: Use updated circleci node images [#18785](https://github.com/storybooks/storybook/pull/18785)
- Build: Move all code into a `code` directory [#18759](https://github.com/storybooks/storybook/pull/18759)
- Build: Lint css, html, json, md, mdx, yml files [#18735](https://github.com/storybooks/storybook/pull/18735)

## 7.0.0-alpha.16 (July 25, 2022)

#### Bug Fixes

- Addon docs: Pass remarks plugins to mdx loader [#18740](https://github.com/storybooks/storybook/pull/18740)
- Preview: Ensure docs container re-renders when globals change [#18711](https://github.com/storybooks/storybook/pull/18711)
- Core: Set other manager-side constants in build [#18728](https://github.com/storybooks/storybook/pull/18728)
- CLI: Fix detection of type: module when initializing storybook [#18714](https://github.com/storybooks/storybook/pull/18714)
- UI: Include full URL in the "Copy Canvas Link" button [#17498](https://github.com/storybooks/storybook/pull/17498)
- Toolbars: Fallback to name if title and icon are unspecified [#17430](https://github.com/storybooks/storybook/pull/17430)
- CLI: Fix addons register in RN template [#18693](https://github.com/storybooks/storybook/pull/18693)
- Index: Support `{ csfData as default }` CSF exports [#18588](https://github.com/storybooks/storybook/pull/18588)
- Svelte: Always create main with cjs extension [#18648](https://github.com/storybooks/storybook/pull/18648)

#### Maintenance

- Build addons/a11y with ts-up [#18772](https://github.com/storybooks/storybook/pull/18772)
- Typescript: Drop Emotion 10 types in lib/theming [#18598](https://github.com/storybooks/storybook/pull/18598)
- Tests: Don't run the docs e2e in `react@18` [#18736](https://github.com/storybooks/storybook/pull/18736)
- Addon-docs: Localize channel to docs context [#18730](https://github.com/storybooks/storybook/pull/18730)
- Addon-docs: Move DocsRenderer back to addon-docs [#18708](https://github.com/storybooks/storybook/pull/18708)
- Addon-docs: Remove `AddContext` from mdx packages [#18709](https://github.com/storybooks/storybook/pull/18709)
- Preview: Simplify docsMode [#18729](https://github.com/storybooks/storybook/pull/18729)
- Examples: Upgrade @storybook/jest in examples [#18582](https://github.com/storybooks/storybook/pull/18582)
- Svelte: Make `svelte-loader` optional dependency [#18645](https://github.com/storybooks/storybook/pull/18645)
- Build: Fix dts-localize script for windows [#18664](https://github.com/storybooks/storybook/pull/18664)

#### Dependency Upgrades

- Storyshots: Allow react-test-renderer 18 [#18296](https://github.com/storybooks/storybook/pull/18296)
- Core: Remove unnecessary webpack dependency [#18651](https://github.com/storybooks/storybook/pull/18651)

## 7.0.0-alpha.15 (July 25, 2022)

Failed publish

## 7.0.0-alpha.14 (July 25, 2022)

Failed publish

## 7.0.0-alpha.13 (July 11, 2022)

### Features

- UI: Remove docs tab ([#18677](https://github.com/storybookjs/storybook/pull/18677))

### Bug Fixes

- Index: Don't prepend `titlePrefix` to a docs entry that references a CSF file's title ([#18634](https://github.com/storybookjs/storybook/pull/18634))

### Maintenance

- Addon-dcos: Refactor DocsRender/Context ([#18635](https://github.com/storybookjs/storybook/pull/18635))
- Instrumenter: `SyncPayload` type for `sync` event ([#18674](https://github.com/storybookjs/storybook/pull/18674))

## 7.0.0-alpha.12 (July 7, 2022)

### Features

- Addon-docs: Produce docs page entries in the index ([#18574](https://github.com/storybookjs/storybook/pull/18574))
- Svelte: Supports action auto configuration ([#18174](https://github.com/storybookjs/storybook/pull/18174))
- Addon-docs: Add docs index configuration via main.js ([#18573](https://github.com/storybookjs/storybook/pull/18573))
- Preview: Handle new docs-page index entries ([#18595](https://github.com/storybookjs/storybook/pull/18595))

### Bug Fixes

- CLI: Remove addon-actions install from `sb init` ([#18255](https://github.com/storybookjs/storybook/pull/18255))
- Angular: Fix compodoc with spaces in workspace root ([#18140](https://github.com/storybookjs/storybook/pull/18140))
- Core: Add type guard for globalWindow ([#18251](https://github.com/storybookjs/storybook/pull/18251))
- Core: Fix builder stats typings to be optional ([#18377](https://github.com/storybookjs/storybook/pull/18377))

### Maintenance

- Core: Async load presets, replace interpret with esbuild-register ([#18619](https://github.com/storybookjs/storybook/pull/18619))
- Build: Improve linting a bit ([#18642](https://github.com/storybookjs/storybook/pull/18642))

### Dependency Upgrades

- Deps: Use `dequal` for equality checks ([#18608](https://github.com/storybookjs/storybook/pull/18608))

## 7.0.0-alpha.11 (July 6, 2022)

### Features

- Interactions: Show exceptions by non-instrumented code in panel ([#16592](https://github.com/storybookjs/storybook/pull/16592))

### Maintenance

- Build: Add linter for ejs ([#18637](https://github.com/storybookjs/storybook/pull/18637))
- Core: Improve interopRequireDefault ([#18638](https://github.com/storybookjs/storybook/pull/18638))
- Core: Pre-built manager using esbuild ([#18550](https://github.com/storybookjs/storybook/pull/18550))
- Build: Add check-packages script plus misc improvements ([#18633](https://github.com/storybookjs/storybook/pull/18633))
- Core: Typing useArgs ([#17735](https://github.com/storybookjs/storybook/pull/17735))
- Build: Add a check script to each package ([#18603](https://github.com/storybookjs/storybook/pull/18603))
- Build: Use playwright in benchmark ([#18606](https://github.com/storybookjs/storybook/pull/18606))

## 7.0.0-alpha.10 (July 2, 2022)

### Features

- Addon-docs: Include Vue methods in ArgsTable ([#18609](https://github.com/storybookjs/storybook/pull/18609))
- UI: Fix default theme according to preferred color scheme ([#17311](https://github.com/storybookjs/storybook/pull/17311))
- Storyshots: Add SnapshotsWithOptionsArgType ([#15712](https://github.com/storybookjs/storybook/pull/15712))
- Controls: Add max length config to text control ([#14396](https://github.com/storybookjs/storybook/pull/14396))

### Bug Fixes

- CLI/HTML: Improve HTML typescript stories ([#18618](https://github.com/storybookjs/storybook/pull/18618))
- Controls: Throttle color controls and make `updateArgs` and `resetArgs` stable ([#18335](https://github.com/storybookjs/storybook/pull/18335))
- Controls: Silence unexpected control type enum for color matchers ([#16334](https://github.com/storybookjs/storybook/pull/16334))
- UI: Stop add-on Draggable from overlapping the vertical scrollbar when stories overflow ([#17663](https://github.com/storybookjs/storybook/pull/17663))
- React: Fix source snippet decorator for story functions with suspense ([#17915](https://github.com/storybookjs/storybook/pull/17915))
- Core: Avoid logging an object on compilation errors ([#15885](https://github.com/storybookjs/storybook/pull/15885))
- UI: Fix router handling of URLs containing "settings" ([#16245](https://github.com/storybookjs/storybook/pull/16245))
- UI: Fix viewMode handling on navigation ([#16912](https://github.com/storybookjs/storybook/pull/16912))
- UI: Fix loading title ([#17935](https://github.com/storybookjs/storybook/pull/17935))

### Maintenance

- Examples/Vue: Fix missing a vue-template-compiler dependency ([#17485](https://github.com/storybookjs/storybook/pull/17485))
- Fix homepage core-server ([#18121](https://github.com/storybookjs/storybook/pull/18121))
- UI: Replace references to `themes.normal` with `themes.light` ([#17034](https://github.com/storybookjs/storybook/pull/17034))

### Dependency Upgrades

- Upgrade file-system-cache to 2.0.0 and remove custom types ([#18253](https://github.com/storybookjs/storybook/pull/18253))
- Security: Update x-default-browser and fix issue with package. ([#18277](https://github.com/storybookjs/storybook/pull/18277))
- Update puppeteer dependencies version ([#15163](https://github.com/storybookjs/storybook/pull/15163))
- Upgrade react-syntax-highlighter to v15.5.0 ([#18009](https://github.com/storybookjs/storybook/pull/18009))

## 7.0.0-alpha.9 (July 2, 2022)

Failed publish

## 7.0.0-alpha.8 (June 29, 2022)

### Features

- Webpack: Support .cjs extension ([#18502](https://github.com/storybookjs/storybook/pull/18502))

### Maintenance

- Docs2: Extract doc blocks into a separate package ([#18587](https://github.com/storybookjs/storybook/pull/18587))

## 7.0.0-alpha.7 (June 29, 2022)

### Features

- TypeScript: Re-structure types for frameworks and presets ([#18504](https://github.com/storybookjs/storybook/pull/18504))
- UI: Add parent wildcard sortOrder ([#18243](https://github.com/storybookjs/storybook/pull/18243))

### Bug Fixes

- UI: Fix typo in CSS pseudo selector ([#17708](https://github.com/storybookjs/storybook/pull/17708))
- UI: Fix sidebar a11y by moving aria-expanded attribute to button ([#18354](https://github.com/storybookjs/storybook/pull/18354))
- CLI: Hook up the npm7 migration ([#18522](https://github.com/storybookjs/storybook/pull/18522))

### Maintenance

- Build: Use TSUP to compile `core-common` ([#18546](https://github.com/storybookjs/storybook/pull/18546))
- Build: Use TSUP to compile the presets ([#18544](https://github.com/storybookjs/storybook/pull/18544))
- Build: Use TSUP to compile the frameworks ([#18543](https://github.com/storybookjs/storybook/pull/18543))
- Build: Use TSUP to compile the renderers ([#18534](https://github.com/storybookjs/storybook/pull/18534))
- Essentials: Add highlight addon ([#17800](https://github.com/storybookjs/storybook/pull/17800))
- Core: Replace `cpy` with `fs-extra` copy/copyFile ([#18497](https://github.com/storybookjs/storybook/pull/18497))
- Build: Enable Template.bind({}) TS support in our repo ([#18540](https://github.com/storybookjs/storybook/pull/18540))
- Turn on strict types in store + preview-web ([#18536](https://github.com/storybookjs/storybook/pull/18536))
- Addon-highlight: Convert to simplified addon style ([#17991](https://github.com/storybookjs/storybook/pull/17991))

### Dependency Upgrades

- Upgrade @storybook/testing-library to `0.0.14-next.0` ([#18539](https://github.com/storybookjs/storybook/pull/18539))

## 7.0.0-alpha.6 (June 21, 2022)

### Bug Fixes

- Interactions: Reset instrumenter state on HMR ([#18516](https://github.com/storybookjs/storybook/pull/18516))
- Interactions: Prevent showing child exception while parent is still playing ([#18518](https://github.com/storybookjs/storybook/pull/18518))

### Maintenance

- Docs2 core: Fetch `index.json` for composition ([#18521](https://github.com/storybookjs/storybook/pull/18521))
- Addon-docs: Switch Meta block to receive all module exports ([#18514](https://github.com/storybookjs/storybook/pull/18514))
- Re-add deprecated fields to lib/api ([#18488](https://github.com/storybookjs/storybook/pull/18488))
- Core: Handle v3 index in composition ([#18498](https://github.com/storybookjs/storybook/pull/18498))
- Story index: Ensure that `extract` script works and SBs can be composed into v6 storybooks ([#18409](https://github.com/storybookjs/storybook/pull/18409))
- Docs2: Handle new docs entries in the preview ([#18099](https://github.com/storybookjs/storybook/pull/18099))
- Docs2: Refactor manager to use new index data ([#18023](https://github.com/storybookjs/storybook/pull/18023))

## 7.0.0-alpha.5 (June 20, 2022)

### Bug Fixes

- Core: Allow a teardown function to be returned from `renderToDOM` ([#18457](https://github.com/storybookjs/storybook/pull/18457))
- CLI: Add npm7 migration for legacy peer deps ([#18510](https://github.com/storybookjs/storybook/pull/18510))
- Interactions: Fix broken UI on nested interactions ([#18499](https://github.com/storybookjs/storybook/pull/18499))

### Maintenance

- Build: Upgrade yarn to 3.2.1 ([#18511](https://github.com/storybookjs/storybook/pull/18511))

## 7.0.0-alpha.4 (June 19, 2022)

### Breaking Changes

- Core: Remove standalone node APIs ([#18089](https://github.com/storybookjs/storybook/pull/18089))

### Maintenance

- Build: Add logFilters to yarn config ([#18500](https://github.com/storybookjs/storybook/pull/18500))
- Build: Set typescript strict-mode ([#18493](https://github.com/storybookjs/storybook/pull/18493))

## 7.0.0-alpha.3 (June 17, 2022)

### Features

- Interactions: Collapse child interactions ([#18484](https://github.com/storybookjs/storybook/pull/18484))

### Bug Fixes

- Interactions: Fix `waitFor` behavior while debugging ([#18460](https://github.com/storybookjs/storybook/pull/18460))
- UI: Fix display skip to sidebar button ([#18479](https://github.com/storybookjs/storybook/pull/18479))

### Maintenance

- CLI: Use `storybook` instead of `sb` ([#18430](https://github.com/storybookjs/storybook/pull/18430))
- Components: Re-bundle the syntax highlighter ([#18425](https://github.com/storybookjs/storybook/pull/18425))

## 7.0.0-alpha.2 (June 15, 2022)

### Features

- UI: Update manager to respect `parameters.docsOnly` in `stories.json` ([#18433](https://github.com/storybookjs/storybook/pull/18433))
- CLI: Add additional files api to sb repro ([#18389](https://github.com/storybookjs/storybook/pull/18389))

### Bug Fixes

- Core: Fix process is not defined when using components ([#18469](https://github.com/storybookjs/storybook/pull/18469))
- Story index: Warn on `storyName` in CSF3 exports ([#18464](https://github.com/storybookjs/storybook/pull/18464))
- Telemetry: Strip out preset from addon name ([#18442](https://github.com/storybookjs/storybook/pull/18442))

### Maintenance

- CLI: Improve to be more async & cleanup ([#18475](https://github.com/storybookjs/storybook/pull/18475))
- 7.0.0 pnp support ([#18461](https://github.com/storybookjs/storybook/pull/18461))
- Build: Use playright version of sb-bench ([#18458](https://github.com/storybookjs/storybook/pull/18458))
- Angular: Support Angular 14 standalone components ([#18272](https://github.com/storybookjs/storybook/pull/18272))
- Build: Fix prebundle script on Windows ([#18365](https://github.com/storybookjs/storybook/pull/18365))
- Scripts: Clean verdaccio cache when running locally ([#18359](https://github.com/storybookjs/storybook/pull/18359))
- Core: fix PnP compatibility for @storybook/ui and @storybook/router packages ([#18412](https://github.com/storybookjs/storybook/pull/18412))

## 7.0.0-alpha.1 (June 7, 2022)

### Bug Fixes

- CLI: Fix `init` to install correct version of sb/storybook ([#18417](https://github.com/storybookjs/storybook/pull/18417))

## 7.0.0-alpha.0 (June 7, 2022)

### Breaking Changes

- Build chain upgrades: TS4, Webpack5, modern ESM, TSUP ([#18205](https://github.com/storybookjs/storybook/pull/18205))
- Create frameworks & rename renderers ([#18201](https://github.com/storybookjs/storybook/pull/18201))
- Core-webpack: Factor out webpack dependencies ([#18114](https://github.com/storybookjs/storybook/pull/18114))
- Core: Remove start-/build-storybook from all frameworks ([#17899](https://github.com/storybookjs/storybook/pull/17899))

### Features

- Core: Add pluggable indexers ([#18355](https://github.com/storybookjs/storybook/pull/18355))
- CLI: Add dev/build commands ([#17898](https://github.com/storybookjs/storybook/pull/17898))
- CLI: Add support for angular/cli v14 ([#18334](https://github.com/storybookjs/storybook/pull/18334))

### Bug Fixes

- Vue/Vue3: Fix decorators in StoryStoreV7 ([#18375](https://github.com/storybookjs/storybook/pull/18375))
- Preview: Default select to `viewMode` story ([#18370](https://github.com/storybookjs/storybook/pull/18370))

### Maintenance

- Core: Split webpack presets out of frameworks ([#18018](https://github.com/storybookjs/storybook/pull/18018))
- Core: Renderer refactor ([#17982](https://github.com/storybookjs/storybook/pull/17982))
- Core: Allow builders to be set in presets ([#18182](https://github.com/storybookjs/storybook/pull/18182))
- Core: Minimize webpack deps ([#18024](https://github.com/storybookjs/storybook/pull/18024))
- Core: Make renderers presets ([#18004](https://github.com/storybookjs/storybook/pull/18004))
- Examples: Simplify sb usage in package.json scripts ([#18065](https://github.com/storybookjs/storybook/pull/18065))

# Older versions

For older versions of the changelog, see [CHANGELOG.v6.md](./CHANGELOG.v6.md), [CHANGELOG.v1-5.md](./CHANGELOG.v1-5.md)
