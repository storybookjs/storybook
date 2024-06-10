- MDX: Upgrade csf-mdx libraries ([#18300](https://github.com/storybookjs/storybook/pull/18300))
- security: update x-default-browser ([#18157](https://github.com/storybookjs/storybook/pull/18157))

## 6.5.0-rc.1 (May 18, 2022)

### Bug Fixes

- CLI: Improve webpack version and add detection of nextjs ([#18220](https://github.com/storybookjs/storybook/pull/18220))
- ArgsTable: Gracefully handle conditional args failures ([#18248](https://github.com/storybookjs/storybook/pull/18248))
- Controls: Fix reset button broken for !undefined URL values ([#18231](https://github.com/storybookjs/storybook/pull/18231))
- Vue3: Add support for TSX in single file components ([#18038](https://github.com/storybookjs/storybook/pull/18038))

## 6.5.0-rc.0 (May 17, 2022)

### Features

- Addon-a11y: Show % of users in toolbar menu ([#18003](https://github.com/storybookjs/storybook/pull/18003))

### Bug Fixes

- Web-components: Clean Lit Expression comments in story source ([#18108](https://github.com/storybookjs/storybook/pull/18108))
- Vue: Map args correctly in CSF3 implicit render function ([#18209](https://github.com/storybookjs/storybook/pull/18209))
- Vue3: Fix CSF3 implicit render function when storyStoreV7 is enabled ([#18208](https://github.com/storybookjs/storybook/pull/182)

### Maintenance

- CLI: Don't throw is Ctrl + C was pressed when selecting a package in the build command ([#18195](https://github.com/storybookjs/storybook/pull/18195))
- Build: Cleanup noise from unit tests ([#18196](https://github.com/storybookjs/storybook/pull/18196))

### Dependency Upgrades

- Fixed PnP compatibility for bundled components package ([#18015](https://github.com/storybookjs/storybook/pull/18015))

## 6.5.0-beta.8 (May 11, 2022)

### Bug Fixes

- Composition: Fix metadata.json incorrectly overriding main.js refs versions ([#18185](https://github.com/storybookjs/storybook/pull/18185))

### Maintenance

- Examples: Set channelOptions to disallow function serialization ([#18071](https://github.com/storybookjs/storybook/pull/18071))

### Dependency Upgrades

- Upgrade to telejson 6 ([#18164](https://github.com/storybookjs/storybook/pull/18164))

## 6.5.0-beta.7 (May 9, 2022)

### Features

- CSF3: Add title prefix support for stories with custom titles ([#17724](https://github.com/storybookjs/storybook/pull/17724))

### Bug Fixes

- Components: Fix race conditions in SyntaxHighlighter ([#18158](https://github.com/storybookjs/storybook/pull/18158))

### Maintenance

- API: Deprecate isToolshown, rename to showToolbar ([#18131](https://github.com/storybookjs/storybook/pull/18131))

## 6.5.0-beta.6 (May 6, 2022)

### Bug Fixes

- Controls: Fix undefined args handling ([#18135](https://github.com/storybookjs/storybook/pull/18135))

### Maintenance

- CLI: Update Introduction.stories.mdx template to be MDX2-friendly ([#18141](https://github.com/storybookjs/storybook/pull/18141))

### Dependency Upgrades

- Remove jest from cli peerDependencies ([#18149](https://github.com/storybookjs/storybook/pull/18149))

## 6.5.0-beta.5 (May 4, 2022)

### Bug Fixes

- Core: Fix anonymous ID generation ([#18133](https://github.com/storybookjs/storybook/pull/18133))

## 6.5.0-beta.4 (May 4, 2022)

### Features

- UI: Add a parent level toolbar exclusion key for tabs ([#18106](https://github.com/storybookjs/storybook/pull/18106))
- Addon-a11y: Display a11y issues number in addon tab title ([#17983](https://github.com/storybookjs/storybook/pull/17983))

### Bug Fixes

- Addon-docs: Fix Canvas block CURRENT_SELECTION handling ([#18130](https://github.com/storybookjs/storybook/pull/18130))
- Telemetry: Add safecheck for crash reports ([#18129](https://github.com/storybookjs/storybook/pull/18129))
- Addon-a11y: Fix a11y params > element use ([#17989](https://github.com/storybookjs/storybook/pull/17989))

## 6.5.0-beta.3 (May 4, 2022)

### Bug Fixes

- UI: Externalize `react-syntax-highlighter` from components ([#18127](https://github.com/storybookjs/storybook/pull/18127))

## 6.5.0-beta.2 (May 2, 2022)

### Features

- Core: Add optional telemetry and crash reporting ([#18046](https://github.com/storybookjs/storybook/pull/18046))

### Bug Fixes

- Controls: Fix URL deserialization for argTypes with mapping ([#18124](https://github.com/storybookjs/storybook/pull/18124))
- Core: Fix telemetry project root detection ([#18125](https://github.com/storybookjs/storybook/pull/18125))
- React: Fix version detection for older versions of `react-dom` ([#18105](https://github.com/storybookjs/storybook/pull/18105))
- CLI: Add non-monorepo testing tools to exclude lists ([#18092](https://github.com/storybookjs/storybook/pull/18092))

### Maintenance

- Examples: Update example to restore 6.4 auto-title behavior in UI ([#18109](https://github.com/storybookjs/storybook/pull/18109))
- CLI: Remove git.io URL ([#18070](https://github.com/storybookjs/storybook/pull/18070))
- UI: Make panel position a persistent preference ([#18036](https://github.com/storybookjs/storybook/pull/18036))

### Dependency Upgrades

- React: Fix jest-specific-snapshot dev dependency ([#18095](https://github.com/storybookjs/storybook/pull/18095))

## 6.5.0-beta.1 (April 28, 2022)

### Features

- Toolbars: Add dynamicTitle option ([#17789](https://github.com/storybookjs/storybook/pull/17789))
- Angular: Add webpackStatsJson to angular-builder ([#18001](https://github.com/storybookjs/storybook/pull/18001))
- CLI/Vue: add interactions to vue cli template ([#18021](https://github.com/storybookjs/storybook/pull/18021))
- CLI/HTML: Add interactions to cli template ([#18014](https://github.com/storybookjs/storybook/pull/18014))

### Bug Fixes

- CSF: Re-apply TArgs to render type ([#18075](https://github.com/storybookjs/storybook/pull/18075))
- CLI: await generators for proper install ([#18053](https://github.com/storybookjs/storybook/pull/18053))
- Core: Fix story index for CSF default exports as TS vars ([#18054](https://github.com/storybookjs/storybook/pull/18054))
- Core: Fix single-story hoisting regression for auto-title changes ([#18052](https://github.com/storybookjs/storybook/pull/18052))

## 6.5.0-beta.0 (April 24, 2022)

### Features

- CLI/Vue3: add interactions to vue3 cli template ([#18031](https://github.com/storybookjs/storybook/pull/18031))
- CLI/Svelte: add interactions to cli template ([#17993](https://github.com/storybookjs/storybook/pull/17993))
- UI: Move the "Rerun interactions" button to Subnav ([#17647](https://github.com/storybookjs/storybook/pull/17647))

## 6.5.0-alpha.64 (April 18, 2022)

### Features

- CLI/Preact: add interactions to cli template ([#17984](https://github.com/storybookjs/storybook/pull/17984))

### Bug Fixes

- Interactions: Fix show length of object value on MethodCall ([#17649](https://github.com/storybookjs/storybook/pull/17649))
- React: Fix React 18 react-dom/client dynamic import syntax ([#17987](https://github.com/storybookjs/storybook/pull/17987))
- Svelte: Fix webpack5/babelModeV7 ([#17939](https://github.com/storybookjs/storybook/pull/17939))

### Maintenance

- Examples: Remove stories from deprecated `options`/`queryparams` addons ([#17977](https://github.com/storybookjs/storybook/pull/17977))
- Chore: Format versions.ts file using repo config ([#17963](https://github.com/storybookjs/storybook/pull/17963))

## 6.5.0-alpha.63 (April 14, 2022)

### Bug Fixes

- Theming: Re-export correct bundled file ([#17956](https://github.com/storybookjs/storybook/pull/17956))
- Core: Support react-dom/client dom hack on Windows machines ([#17946](https://github.com/storybookjs/storybook/pull/17946))

### Maintenance

- CI: set parallelism of nx to 2 ([#17878](https://github.com/storybookjs/storybook/pull/17878))

### Dependency Upgrades

- Run `prebundle` script without `browser: true` in Rollup config ([#17947](https://github.com/storybookjs/storybook/pull/17947))

## 6.4.22 (April 14, 2022)

### Maintenance

- Core: Avoid framework imports from core/client ([#17875](https://github.com/storybookjs/storybook/pull/17875))

## 6.5.0-alpha.62 (April 13, 2022)

Test publish with npm 2FA enabled for addon-jest

## 6.5.0-alpha.61 (April 11, 2022)

### Features

- UI: Add URL parameters to SB to tweak visible UI ([#17891](https://github.com/storybookjs/storybook/pull/17891))

### Maintenance

- Core: Followup changing CJS entrypoints to ESM ([#17927](https://github.com/storybookjs/storybook/pull/17927))

### Dependency Upgrades

- Export `createCache` from `@storybook/theming` ([#17929](https://github.com/storybookjs/storybook/pull/17929))

## 6.4.21 (April 9, 2022)

### Bug Fixes

- Angular: Do not use default for includePaths ([#17876](https://github.com/storybookjs/storybook/pull/17876))
- Controls: Fix date control width in addons panel ([#17780](https://github.com/storybookjs/storybook/pull/17780))
- CLI: Preserve quote style in automigrate ([#17858](https://github.com/storybookjs/storybook/pull/17858))
- CLI: Update the exclude list for upgrade warnings ([#17909](https://github.com/storybookjs/storybook/pull/17909))

## 6.5.0-alpha.60 (April 9, 2022)

### Features

- Core: Add story preloading to optimize lazy compilation ([#17903](https://github.com/storybookjs/storybook/pull/17903))

### Bug Fixes

- UI: Fix pseudo class potential unsafe warning ([#17911](https://github.com/storybookjs/storybook/pull/17911))
- Core: Fix user-supplied project-level `render` in v6 store ([#17885](https://github.com/storybookjs/storybook/pull/17885))

### Dependency Upgrades

- Upgrade polished to 4.2.2 ([#17913](https://github.com/storybookjs/storybook/pull/17913))
- Bump min vue-loader dependency version ([#17912](https://github.com/storybookjs/storybook/pull/17912))

## 6.5.0-alpha.59 (April 7, 2022)

### Maintenance

- CLI: Update the exclude list for upgrade warnings ([#17909](https://github.com/storybookjs/storybook/pull/17909))
- Examples: Added an external-docs example to show the basic use case ([#17807](https://github.com/storybookjs/storybook/pull/17807))

### Dependency Upgrades

- Migration to Emotion 11 ([#17640](https://github.com/storybookjs/storybook/pull/17640))

## 6.5.0-alpha.58 (April 7, 2022)

### Features

- CLI: Add webpack4/5 auto-detection ([#17908](https://github.com/storybookjs/storybook/pull/17908))
- React: Add support for react18's new root API ([#17215](https://github.com/storybookjs/storybook/pull/17215))

### Bug Fixes

- UI: Fix canvas as initialActive for fullscreen mode in mobile ([#17906](https://github.com/storybookjs/storybook/pull/17906))
- UI: Fix mobile fullscreen UI ([#17873](https://github.com/storybookjs/storybook/pull/17873))

### Maintenance

- Core: Avoid framework imports from core/client ([#17875](https://github.com/storybookjs/storybook/pull/17875))
- Webpack: Make manager and preview build processes cancelable ([#17809](https://github.com/storybookjs/storybook/pull/17809))
- Build: Add vite-react to e2e tests ([#17871](https://github.com/storybookjs/storybook/pull/17871))
- CLI: Upgrade vue3 template to use webpack5 builder ([#17896](https://github.com/storybookjs/storybook/pull/17896))
- Build: Exclude @storybook/builder-vite from verdaccio ([#17897](https://github.com/storybookjs/storybook/pull/17897))

## 6.5.0-alpha.57 (April 6, 2022)

### Bug Fixes

- Svelte: Fix dynamic source snippets ([#17866](https://github.com/storybookjs/storybook/pull/17866))
- Angular: Do not use default for includePaths ([#17876](https://github.com/storybookjs/storybook/pull/17876))

### Maintenance

- Addon-docs: assume links starting with "https://" are external ([#17819](https://github.com/storybookjs/storybook/pull/17819))

### Dependency Upgrades

- Unify CSF version ([#17895](https://github.com/storybookjs/storybook/pull/17895))

## 6.5.0-alpha.56 (April 5, 2022)

### Features

- Controls: Rework conditional controls with globals, queries ([#17883](https://github.com/storybookjs/storybook/pull/17883))
- UI: Add Brand target config option ([#17814](https://github.com/storybookjs/storybook/pull/17814))

### Bug Fixes

- Controls: Fix date control width in addons panel ([#17780](https://github.com/storybookjs/storybook/pull/17780))

### Maintenance

- Core: Update some references to use ESM rather than CJS ([#17868](https://github.com/storybookjs/storybook/pull/17868))
- Build: Upgrade from deprecated circleci docker img ([#17832](https://github.com/storybookjs/storybook/pull/17832))
- Build: Parallel e2e (this might be expensive) ([#17842](https://github.com/storybookjs/storybook/pull/17842))
- Build: Add junit summary for CircleCI ([#17867](https://github.com/storybookjs/storybook/pull/17867))

## 6.5.0-alpha.55 (April 3, 2022)

### Features

- CLI: Detect vite project, use vite builder automatically ([#17860](https://github.com/storybookjs/storybook/pull/17860))
- CLI: Default new vite projects to storyStoreV7 ([#17859](https://github.com/storybookjs/storybook/pull/17859))

### Bug Fixes

- Core: Restore preview-web composeConfigs export ([#17861](https://github.com/storybookjs/storybook/pull/17861))
- CLI: Preserve quote style in automigrate ([#17858](https://github.com/storybookjs/storybook/pull/17858))

## 6.4.20 (April 1, 2022)

### Bug Fixes

- CLI: Fix vite/jest issue with mocked global ([#17830](https://github.com/storybookjs/storybook/pull/17830))
- Angular: Fix multiple calls of Input setter ([#17633](https://github.com/storybookjs/storybook/pull/17633))
- Web-components: Fix CSS class usage in CLI template ([#17702](https://github.com/storybookjs/storybook/pull/17702))
- UI: Fix composition support in safari ([#17679](https://github.com/storybookjs/storybook/pull/17679))
- Addon-docs: DocsPage story order should match the index ([#17669](https://github.com/storybookjs/storybook/pull/17669))
- Core: Fix core.builder check ([#17606](https://github.com/storybookjs/storybook/pull/17606))

### Maintenance

- CLI: Add automigration to `@storybook/builder-vite` ([#17829](https://github.com/storybookjs/storybook/pull/17829))

## 6.5.0-alpha.54 (April 1, 2022)

### Dependency Upgrades

- React: Update react and react-dom peerDeps for React18 ([#17853](https://github.com/storybookjs/storybook/pull/17853))

## 6.5.0-alpha.53 (April 1, 2022)

### Features

- Core: Add simplified manager.js/preview.js API for addons ([#17755](https://github.com/storybookjs/storybook/pull/17755))
- Core/React: Add testing utilities ([#17282](https://github.com/storybookjs/storybook/pull/17282))

### Bug Fixes

- Addon-docs: Fix dependencies for yarn pnp ([#17705](https://github.com/storybookjs/storybook/pull/17705))
- Webpack: Expand version ranges of webpack in the apps ([#17834](https://github.com/storybookjs/storybook/pull/17834))
- CLI: Fix vite/jest issue with mocked global ([#17830](https://github.com/storybookjs/storybook/pull/17830))

### Maintenance

- Build: Remove packtracker ([#17841](https://github.com/storybookjs/storybook/pull/17841))
- Build: Swap order of e2e tests around ([#17840](https://github.com/storybookjs/storybook/pull/17840))
- Build: Add weekly check for broken markdown links ([#17799](https://github.com/storybookjs/storybook/pull/17799))
- Build: Switch to use medium+ ([#17837](https://github.com/storybookjs/storybook/pull/17837))

## 6.5.0-alpha.52 (March 31, 2022)

### Bug Fixes

- UI: Add back CacheProvider from emotion to lib/theming ([#17820](https://github.com/storybookjs/storybook/pull/17820))
- Core: Add a feature flag for enabling crossOriginIsolated ([#17815](https://github.com/storybookjs/storybook/pull/17815))
- Angular: Fix multiple calls of Input setter ([#17633](https://github.com/storybookjs/storybook/pull/17633))
- UI: Wait 100ms before showing spinner and fix story overlaying it ([#17753](https://github.com/storybookjs/storybook/pull/17753))

### Maintenance

- CLI: Add automigration to `@storybook/builder-vite` ([#17829](https://github.com/storybookjs/storybook/pull/17829))
- Build: Add setup-node version for danger ([#17826](https://github.com/storybookjs/storybook/pull/17826))
- Add contributing instructions to PULL_REQUEST_TEMPLATE ([#17713](https://github.com/storybookjs/storybook/pull/17713))

## 6.5.0-alpha.51 (March 25, 2022)

### Features

- SyntaxHighlighter: Add prettier for code formatting ([#17746](https://github.com/storybookjs/storybook/pull/17746))

### Maintenance

- Build: Add main overrides to e2e config and possibility to run test runner ([#17778](https://github.com/storybookjs/storybook/pull/17778))

## 6.5.0-alpha.50 (March 23, 2022)

### Features

- Controls: Add conditional controls ([#17536](https://github.com/storybookjs/storybook/pull/17536))
- Core: Add headers to enable SharedArrayBuffer in stories ([#16970](https://github.com/storybookjs/storybook/pull/16970))
- UI: Button for toggling addons panel ([#17714](https://github.com/storybookjs/storybook/pull/17714))

### Bug Fixes

- Core: Ensure simultaneous first access to stories.json waits ([#17785](https://github.com/storybookjs/storybook/pull/17785))
- Reload iframe when the url changes ([#17644](https://github.com/storybookjs/storybook/pull/17644))
- UI: Fix brand logo layout shift ([#16467](https://github.com/storybookjs/storybook/pull/16467))
- UI: Fix nesting issue for refs in sidebar component ([#17726](https://github.com/storybookjs/storybook/pull/17726))
- Core: Fix filesystem cache missing return ([#17748](https://github.com/storybookjs/storybook/pull/17748))
- Addon-docs: Fix binding of the `renderStoryToElement` passed to `DocsRender` ([#17742](https://github.com/storybookjs/storybook/pull/17742))

### Maintenance

- Addon-docs/Vue: Add tests for sourceDecorator vnodeToString ([#17764](https://github.com/storybookjs/storybook/pull/17764))
- Controls: Date control tests ([#17765](https://github.com/storybookjs/storybook/pull/17765))
- Remove mock directories from Jest test coverage ([#17771](https://github.com/storybookjs/storybook/pull/17771))
- fix dts-localize script ([#17747](https://github.com/storybookjs/storybook/pull/17747))

## 6.5.0-alpha.49 (March 17, 2022)

### Bug Fixes

- Addon-docs/Svelte: Fix `HOC.svelte` reference ([#17731](https://github.com/storybookjs/storybook/pull/17731))
- UI: Fix composition support in safari ([#17679](https://github.com/storybookjs/storybook/pull/17679))

## 6.5.0-alpha.48 (March 14, 2022)

### Features

- Addon-docs: Auto-disable docs presets if docs/controls unused ([#17697](https://github.com/storybookjs/storybook/pull/17697))

### Bug Fixes

- Web-components: Fix CSS class usage in CLI template ([#17702](https://github.com/storybookjs/storybook/pull/17702))

### Maintenance

- Addon-docs: Refactor docs support into individual framework packages ([#17695](https://github.com/storybookjs/storybook/pull/17695))

## 6.5.0-alpha.47 (March 10, 2022)

### Bug Fixes

- Webpack4: Fix useExports for angular-cli ([#17674](https://github.com/storybookjs/storybook/pull/17674))
- Core: Ensure that we do not render a story twice if re-rendered during preparing ([#17599](https://github.com/storybookjs/storybook/pull/17599))
- Addon-docs: DocsPage story order should match the index ([#17669](https://github.com/storybookjs/storybook/pull/17669))
- Core: Fix staticDirs path issue on Windows ([#17641](https://github.com/storybookjs/storybook/pull/17641))
- Angular: Set ForkTsCheckerWebpackPlugin to async ([#17389](https://github.com/storybookjs/storybook/pull/17389))
- Core: Fix core.builder check ([#17606](https://github.com/storybookjs/storybook/pull/17606))

### Maintenance

- Examples: Build stories.json for examples that support it ([#17670](https://github.com/storybookjs/storybook/pull/17670))
- Core: Refactor preview rendering out of `PreviewWeb` ([#17598](https://github.com/storybookjs/storybook/pull/17598))
- Prevent lint hook from running on all files ([#17662](https://github.com/storybookjs/storybook/pull/17662))
- TypeScript: Change imports of types to be prefixed ([#17627](https://github.com/storybookjs/storybook/pull/17627))
- Build: Give linting sub-commands a directory to run against ([#17545](https://github.com/storybookjs/storybook/pull/17545))
- TypeScript: remove unnecessary 'as any' ([#17595](https://github.com/storybookjs/storybook/pull/17595))

### Dependency Upgrades

- Update shelljs dependency version ([#17602](https://github.com/storybookjs/storybook/pull/17602))
- Remove unused `uuid` that's also deprecated ([#17615](https://github.com/storybookjs/storybook/pull/17615))

## 6.5.0-alpha.46 (March 5, 2022)

### Bug Fixes

- Addon-interactions: Use 'global' package instead of `global` ([#17614](https://github.com/storybookjs/storybook/pull/17614))

## 6.5.0-alpha.45 (March 2, 2022)

### Bug Fixes

- CSF3: Fix Auto-title to respect file system capitalization ([#17574](https://github.com/storybookjs/storybook/pull/17574))

### Maintenance

- Core: Remove unused babel dependencies ([#17425](https://github.com/storybookjs/storybook/pull/17425))

## 6.5.0-alpha.44 (February 28, 2022)

### Dependency Upgrades

- Fix mdx-csf dependencies to canary dist-tag ([#17592](https://github.com/storybookjs/storybook/pull/17592))

## 6.5.0-alpha.43 (February 28, 2022)

### Features

- Addon-docs: MDX2 support ([#17515](https://github.com/storybookjs/storybook/pull/17515))

### Bug Fixes

- Core: Fix global render fn ([#17577](https://github.com/storybookjs/storybook/pull/17577))
- Addon-interactions: Mock window in browser environments ([#17535](https://github.com/storybookjs/storybook/pull/17535))

## 6.5.0-alpha.42 (February 25, 2022)

### Bug Fixes

- Controls/Essentials/Interactions: Add support for main.cjs/mjs/tsx files ([#17524](https://github.com/storybookjs/storybook/pull/17524))
- Addon-docs: Fix preset handling for builder with options ([#17544](https://github.com/storybookjs/storybook/pull/17544))

## 6.5.0-alpha.41 (February 22, 2022)

### Features

- Addon-Outline: add 'o' keyboard shortcut to toggle the outline addon ([#17530](https://github.com/storybookjs/storybook/pull/17530))

### Bug Fixes

- Addon-docs: Ensure that **DOCS_CONTEXT** cannot be undefined ([#17251](https://github.com/storybookjs/storybook/pull/17251))
- Addon-docs: Account for non-string types when converting enums ([#15822](https://github.com/storybookjs/storybook/pull/15822))
- Addon-actions: Don't override undefined args ([#17505](https://github.com/storybookjs/storybook/pull/17505))

## 6.5.0-alpha.40 (February 19, 2022)

### Features

- Webpack5: Add lazy compilation ([#17501](https://github.com/storybookjs/storybook/pull/17501))

### Maintenance

- Build: Fix CRA repro generator and e2e test in PnP mode ([#17375](https://github.com/storybookjs/storybook/pull/17375))
- UI: Add a custom title story for heading component ([#17487](https://github.com/storybookjs/storybook/pull/17487))

## 6.4.19 (February 12, 2022)

### Features

- CLI/React: Add interactions to cli template ([#17345](https://github.com/storybookjs/storybook/pull/17345))
- CLI/Angular: Add interactions to cli template ([#17437](https://github.com/storybookjs/storybook/pull/17437))

### Bug Fixes

- Core/CLI: Add `extract` function to `PreviewWeb` and use it in `sb extract` if available ([#17447](https://github.com/storybookjs/storybook/pull/17447))
- Core: Ensure we show an error when `configure()` throws ([#17435](https://github.com/storybookjs/storybook/pull/17435))
- Core: Fix `useParameter` with nullish coalescing ([#17327](https://github.com/storybookjs/storybook/pull/17327))
- Addon-links: Fix export statement in react.d.ts ([#17434](https://github.com/storybookjs/storybook/pull/17434))
- Addon-docs: Fix typo in ArgsTable tooltip ([#17404](https://github.com/storybookjs/storybook/pull/17404))

## 6.5.0-alpha.39 (February 11, 2022)

### Features

- CLI: Add addon-interactions to angular template ([#17437](https://github.com/storybookjs/storybook/pull/17437))

### Bug Fixes

- Core: Rename `generated-stories-entry` to `cjs` extension so require works ([#17486](https://github.com/storybookjs/storybook/pull/17486))
- Core/CLI: Add `extract` function to `PreviewWeb` and use it in `sb extract` if available ([#17447](https://github.com/storybookjs/storybook/pull/17447))
- Controls: Fix Boolean control parsing ([#17456](https://github.com/storybookjs/storybook/pull/17456))

### Maintenance

- Fix `ci:matrix` label in CI ([#17457](https://github.com/storybookjs/storybook/pull/17457))

### Dependency Upgrades

- Bump vue-docgen-api to 4.44.15 ([#17465](https://github.com/storybookjs/storybook/pull/17465))

## 6.5.0-alpha.38 (February 8, 2022)

### Bug Fixes

- Addon-links: Fix export statement in react.d.ts ([#17434](https://github.com/storybookjs/storybook/pull/17434))
- Core: Fix `useParameter` with nullish coalescing ([#17327](https://github.com/storybookjs/storybook/pull/17327))
- Core: Ensure we show an error when `configure()` throws ([#17435](https://github.com/storybookjs/storybook/pull/17435))

### Maintenance

- Web-components: Upgrade kitchen sink lockfile ([#17424](https://github.com/storybookjs/storybook/pull/17424))

## 6.5.0-alpha.37 (February 8, 2022)

Failed publish

## 6.5.0-alpha.36 (February 4, 2022)

### Maintenance

- UI: Prebundle `@storybook/components` ([#17304](https://github.com/storybookjs/storybook/pull/17304))

## 6.5.0-alpha.35 (February 4, 2022)

### Features

- CLI/React: Add interactions to cli template ([#17345](https://github.com/storybookjs/storybook/pull/17345))
- CSF3: Handle auto-title redundant filename ([#17421](https://github.com/storybookjs/storybook/pull/17421))

### Bug Fixes

- Addon-docs: Fix typo in ArgsTable tooltip ([#17404](https://github.com/storybookjs/storybook/pull/17404))
- Core: Apply Docs mode to composed storybooks ([#17292](https://github.com/storybookjs/storybook/pull/17292))

### Maintenance

- Core: Move CSF-related logic to its own folder ([#17381](https://github.com/storybookjs/storybook/pull/17381))
- Improve style handling in angular example in monorepo ([#17343](https://github.com/storybookjs/storybook/pull/17343))

## 6.4.18 (February 2, 2022)

### Bug Fixes

- CLI: Pin version of `@mdx-js/react` to 1.x.x until we are compatible ([#17395](https://github.com/storybookjs/storybook/pull/17395))

## 6.5.0-alpha.34 (February 2, 2022)

### Features

- Core: Mock channel if not present ([#17382](https://github.com/storybookjs/storybook/pull/17382))

### Bug Fixes

- CLI: Pin version of `@mdx-js/react` to 1.x.x until we are compatible ([#17395](https://github.com/storybookjs/storybook/pull/17395))

## 6.5.0-alpha.33 (February 1, 2022)

### Maintenance

- UI: Prebundle `@storybook/ui` ([#17301](https://github.com/storybookjs/storybook/pull/17301))

## 6.5.0-alpha.32 (February 1, 2022)

### Maintenance

- Core: Pre-bundle `@storybook/router` to avoid react-router conflict ([#17294](https://github.com/storybookjs/storybook/pull/17294))

## 6.5.0-alpha.31 (February 1, 2022)

### Maintenance

- Web components: add addon-interactions example story ([#17303](https://github.com/storybookjs/storybook/pull/17303))
- Core: Pre-bundle theming to avoid emotion11 conflicts ([#17000](https://github.com/storybookjs/storybook/pull/17000))

## 6.5.0-alpha.30 (January 31, 2022)

### Maintenance

- Build: Enforce stricter types ([#17368](https://github.com/storybookjs/storybook/pull/17368))

## 6.5.0-alpha.29 (January 31, 2022)

### Bug Fixes

- Revert "Angular: Retrieve version from core package" ([#17372](https://github.com/storybookjs/storybook/pull/17372))

## 6.4.17 (January 31, 2022)

### Bug Fixes

- Revert "Angular: Retrieve version from core package" ([#17372](https://github.com/storybookjs/storybook/pull/17372))

## 6.5.0-alpha.28 (January 29, 2022)

### Bug Fixes

- Svelte: Fix missing templates dir in package.json publish files ([#17367](https://github.com/storybookjs/storybook/pull/17367))

## 6.4.16 (January 29, 2022)

### Bug Fixes

- Angular: Workaround for compodoc on windows machines ([#17334](https://github.com/storybookjs/storybook/pull/17334))
- Angular: Use ɵReflectionCapabilities to find component & module metadata ([#17156](https://github.com/storybookjs/storybook/pull/17156))
- Angular: Retrieve version from core package ([#17363](https://github.com/storybookjs/storybook/pull/17363))

## 6.5.0-alpha.27 (January 29, 2022)

### Bug Fixes

- Angular: Workaround for compodoc on windows machines ([#17334](https://github.com/storybookjs/storybook/pull/17334))
- Angular: Retrieve version from core package ([#17363](https://github.com/storybookjs/storybook/pull/17363))

## 6.5.0-alpha.26 (January 28, 2022)

### Bug Fixes

- Revert "Core: Rename `generated-stories-entry` to `cjs` extension so require works" ([#17361](https://github.com/storybookjs/storybook/pull/17361))

## 6.5.0-alpha.25 (January 28, 2022)

### Maintenance

- Build: Overhaul dev script & compile-babel & compile-tsc ([#17338](https://github.com/storybookjs/storybook/pull/17338))

## 6.4.15 (January 28, 2022)

### Bug Fixes

- Angular: Fix runCompodoc for Windows, local Compodoc, and user specified tsconfig ([#16728](https://github.com/storybookjs/storybook/pull/16728))
- Core: Fix negated glob support ([#17328](https://github.com/storybookjs/storybook/pull/17328))

### Maintenance

- Build: Upgrade main yarn ([#17323](https://github.com/storybookjs/storybook/pull/17323))
- CLI: Add version update argument to generate-sb-packages-versions utility ([#17356](https://github.com/storybookjs/storybook/pull/17356))

## 6.5.0-alpha.24 (January 28, 2022)

### Bug Fixes

- Core: Fix negated glob support ([#17328](https://github.com/storybookjs/storybook/pull/17328))

### Maintenance

- CLI/Svelte: Revert template stories from svelte-native to CSF ([#17340](https://github.com/storybookjs/storybook/pull/17340))
- CLI: Add version update argument to generate-sb-packages-versions utility ([#17356](https://github.com/storybookjs/storybook/pull/17356))

## 6.5.0-alpha.23 (January 25, 2022)

### Features

- Vue: Add CSF3 default render function ([#17279](https://github.com/storybookjs/storybook/pull/17279))

### Bug Fixes

- Core: Rename `generated-stories-entry` to `cjs` extension so require works ([#16727](https://github.com/storybookjs/storybook/pull/16727))
- Addon-docs: Fix `BuilderConfig` can be an object ([#17320](https://github.com/storybookjs/storybook/pull/17320))

### Maintenance

- Core: Remove useless unfetch ([#17306](https://github.com/storybookjs/storybook/pull/17306))
- Build: Regen lockfile ([#17283](https://github.com/storybookjs/storybook/pull/17283))

### Dependency Upgrades

- Upgrade node-fetch to latest version ([#17317](https://github.com/storybookjs/storybook/pull/17317))

## 6.4.14 (January 21, 2022)

### Bug Fixes

- CLI: Add `--no-manager-cache` to build-storybook ([#17300](https://github.com/storybookjs/storybook/pull/17300))
- CSF3: Remove `path` from autoTitle browser code ([#17185](https://github.com/storybookjs/storybook/pull/17185))
- Addon-docs: Fix `docs.disable` parameter on DocsPage ([#17256](https://github.com/storybookjs/storybook/pull/17256))
- Core: Fix issue with recursive glob with prior special chars ([#17252](https://github.com/storybookjs/storybook/pull/17252))
- Webpack: Fix for `process` fallback using `require.resolve` ([#17249](https://github.com/storybookjs/storybook/pull/17249))

### Dependency Upgrades

- Upgrade compodoc for colors.js bug ([#17266](https://github.com/storybookjs/storybook/pull/17266))
- Upgrade jscodeshift dependency for colors.js bug ([#17265](https://github.com/storybookjs/storybook/pull/17265))
- Restore prettier >= 2.2.1 to satisfy previous constraints ([#17257](https://github.com/storybookjs/storybook/pull/17257))

## 6.5.0-alpha.22 (January 20, 2022)

### Features

- Svelte: Add CSF3 default render function ([#17276](https://github.com/storybookjs/storybook/pull/17276))
- CLI: Add `--no-manager-cache` to build-storybook ([#17300](https://github.com/storybookjs/storybook/pull/17300))

### Maintenance

- Build: Upgrade yarn to 3.1.1 ([#17281](https://github.com/storybookjs/storybook/pull/17281))

## 6.5.0-alpha.21 (January 18, 2022)

### Features

- Webpack5: Switch to using `import.meta.webpackHot.accept` ([#17270](https://github.com/storybookjs/storybook/pull/17270))

## 6.5.0-alpha.20 (January 18, 2022)

### Dependency Upgrades

- Upgrade compodoc for colors.js bug ([#17266](https://github.com/storybookjs/storybook/pull/17266))
- Upgrade jscodeshift dependency for colors.js bug ([#17265](https://github.com/storybookjs/storybook/pull/17265))
- Restore prettier >= 2.2.1 to satisfy previous constraints ([#17257](https://github.com/storybookjs/storybook/pull/17257))

## 6.5.0-alpha.19 (January 17, 2022)

### Features

- Core: Add IS_STORYBOOK global variable ([#16676](https://github.com/storybookjs/storybook/pull/16676))

### Bug Fixes

- Addon-docs: Fix `docs.disable` parameter on DocsPage ([#17256](https://github.com/storybookjs/storybook/pull/17256))
- Controls: Fix number control update when using useArgs hook ([#17247](https://github.com/storybookjs/storybook/pull/17247))
- Core: Fix issue with recursive glob with prior special chars ([#17252](https://github.com/storybookjs/storybook/pull/17252))

## 6.5.0-alpha.18 (January 16, 2022)

### Bug Fixes

- Webpack: Fix for `process` fallback using `require.resolve` ([#17249](https://github.com/storybookjs/storybook/pull/17249))

### Maintenance

- Official-storybook: Fix ForwardRefButtonInnerPropTypes warning ([#12733](https://github.com/storybookjs/storybook/pull/12733))
- Fix prettier 2.3 formatting across the codebase ([#17242](https://github.com/storybookjs/storybook/pull/17242))

## 6.4.13 (January 15, 2022)

### Bug Fixes

- Core: Fix `staticDirs` favicon handling by refactor ([#17241](https://github.com/storybookjs/storybook/pull/17241))
- Angular: Fix 13.1 and add CI test cases ([#17206](https://github.com/storybookjs/storybook/pull/17206))
- Core: Fix `__namedExportsOrder` warning from preview.js ([#17240](https://github.com/storybookjs/storybook/pull/17240))
- Webpack5: Fix manager.js `process` references ([#17213](https://github.com/storybookjs/storybook/pull/17213))

### Dependency Upgrades

- React: Remove react-dev-utils ([#17022](https://github.com/storybookjs/storybook/pull/17022))
- Fix prettier transpile problems ([#17239](https://github.com/storybookjs/storybook/pull/17239))

## 6.5.0-alpha.17 (January 14, 2022)

### Bug Fixes

- Core: Fix `staticDirs` favicon handling by refactor ([#17241](https://github.com/storybookjs/storybook/pull/17241))
- Core: Fix `__namedExportsOrder` warning from preview.js ([#17240](https://github.com/storybookjs/storybook/pull/17240))

### Dependency Upgrades

- Fix prettier transpile problems ([#17239](https://github.com/storybookjs/storybook/pull/17239))

## 6.5.0-alpha.16 (January 13, 2022)

### Bug Fixes

- Webpack5: Fix named exports order in production mode ([#17229](https://github.com/storybookjs/storybook/pull/17229))

## 6.5.0-alpha.15 (January 12, 2022)

### Bug Fixes

- Angular: Fix 13.1 and add CI test cases ([#17206](https://github.com/storybookjs/storybook/pull/17206))
- Webpack5: Fix manager.js process references ([#17213](https://github.com/storybookjs/storybook/pull/17213))

### Dependency Upgrades

- React: Restore webpack as a dependency, updated webpack 5 docs ([#17207](https://github.com/storybookjs/storybook/pull/17207))

## 6.5.0-alpha.14 (January 11, 2022)

### Bug Fixes

- Angular: Fix void element selectors ([#15495](https://github.com/storybookjs/storybook/pull/15495))

### Dependency Upgrades

- React: Remove webpack from dependencies, types as devDependencies ([#17192](https://github.com/storybookjs/storybook/pull/17192))

## 6.5.0-alpha.13 (January 11, 2022)

### Features

- UI: Set the current story name in the title ([#17177](https://github.com/storybookjs/storybook/pull/17177))

### Bug Fixes

- Core: Retain iframe.html query parameters ([#17136](https://github.com/storybookjs/storybook/pull/17136))
- CSF3: Remove `path` from autoTitle browser code ([#17185](https://github.com/storybookjs/storybook/pull/17185))

### Maintenance

- Build: Fix package.json warnings in JetBrains IDEs ([#17184](https://github.com/storybookjs/storybook/pull/17184))
- Fix github workflow syntax to run unit-tests on push ([#17148](https://github.com/storybookjs/storybook/pull/17148))

## 5.3.22 (January 10, 2022)

### Dependency Upgrades

- Bump cli-table3 to fix colors.js bug in 5.3 ([#17182](https://github.com/storybookjs/storybook/pull/17182))

## 6.3.13 (January 10, 2022)

### Dependency Upgrades

- Bump cli-table3 to fix colors bug ([#17180](https://github.com/storybookjs/storybook/pull/17180))

## 6.4.10 (January 10, 2022)

### Bug Fixes

- Core: Fix process.env assignment ([#17174](https://github.com/storybookjs/storybook/pull/17174))
- Angular: Fix angular 13.1 JIT error and HMR reload ([#17131](https://github.com/storybookjs/storybook/pull/17131))
- Router: Fix navigating to hash links ([#17134](https://github.com/storybookjs/storybook/pull/17134))
- Source-loader: Fix node.declaration edge case ([#17027](https://github.com/storybookjs/storybook/pull/17027))
- Core: Fix debug output on webpack failures ([#16988](https://github.com/storybookjs/storybook/pull/16988))

### Dependency Upgrades

- Bump cli-table3 to fix colors bug ([#17180](https://github.com/storybookjs/storybook/pull/17180))

## 6.5.0-alpha.12 (January 10, 2022)

### Bug Fixes

- Core: Fix process.env assignment ([#17174](https://github.com/storybookjs/storybook/pull/17174))

### Dependency Upgrades

- Bump cli-table3 to fix colors bug ([#17180](https://github.com/storybookjs/storybook/pull/17180))

## 6.5.0-alpha.11 (January 7, 2022)

### Bug Fixes

- Addon-docs: Fix babel-loader resolution based on builder ([#16752](https://github.com/storybookjs/storybook/pull/16752))
- Angular: Use ɵReflectionCapabilities to find component & module metadata ([#17156](https://github.com/storybookjs/storybook/pull/17156))

### Dependency Upgrades

- Update react-syntax-highlighter to fix transitive vulnerability ([#17127](https://github.com/storybookjs/storybook/pull/17127))

## 6.5.0-alpha.10 (January 6, 2022)

### Bug Fixes

- Angular: Fix angular 13.1 JIT error and HMR reload ([#17131](https://github.com/storybookjs/storybook/pull/17131))
- Core: Fix IE support by transpiling more libs to es5 ([#17141](https://github.com/storybookjs/storybook/pull/17141))

## 6.5.0-alpha.9 (January 6, 2022)

### Features

- Allow setting project args/argTypes for v6 store ([#17043](https://github.com/storybookjs/storybook/pull/17043))

### Bug Fixes

- Router: Fix navigating to hash links ([#17134](https://github.com/storybookjs/storybook/pull/17134))

## 6.5.0-alpha.8 (January 6, 2022)

Publish failed

## 6.5.0-alpha.7 (January 4, 2022)

### Bug Fixes

- Addon-measure: Update z-index to fit with libraries with also high z-index ([#15860](https://github.com/storybookjs/storybook/pull/15860))

### Maintenance

- Vue: Fix VueLoaderPlugin import to support vue-loader@16.x ([#14624](https://github.com/storybookjs/storybook/pull/14624))

### Dependency Upgrades

- Upgrade react-syntax-highlighter to pick up security patch upstream in highlight.js ([#17100](https://github.com/storybookjs/storybook/pull/17100))

## 6.5.0-alpha.6 (January 3, 2022)

### Features

- Vue3: Add default render function CSF3 ([#17068](https://github.com/storybookjs/storybook/pull/17068))
- Addon-docs/Vue: Include methods in ArgsTable ([#16975](https://github.com/storybookjs/storybook/pull/16975))

### Bug Fixes

- CLI: Install `lit-html` in new web components project ([#17106](https://github.com/storybookjs/storybook/pull/17106))
- Angular: Fix runCompodoc for Windows, local Compodoc, and user specified tsconfig ([#16728](https://github.com/storybookjs/storybook/pull/16728))

### Dependency Upgrades

- React: Remove react-dev-utils ([#17022](https://github.com/storybookjs/storybook/pull/17022))

## 6.5.0-alpha.5 (December 23, 2021)

### Dependency Upgrades

- Update react-refresh@0.11.0 & react-refresh-webpack-plugin@0.5.3 same as cra5 ([#17056](https://github.com/storybookjs/storybook/pull/17056))

## 6.5.0-alpha.4 (December 18, 2021)

### Bug Fixes

- Angular: Fix for renamed method in angular 13.1 ([#17032](https://github.com/storybookjs/storybook/pull/17032))
- Source-loader: Fix node.declaration edge case ([#17027](https://github.com/storybookjs/storybook/pull/17027))
- Core: Fix debug output on webpack failures ([#16988](https://github.com/storybookjs/storybook/pull/16988))

### Maintenance

- Build: Run unit tests on more node versions, mac, and windows ([#16744](https://github.com/storybookjs/storybook/pull/16744))

### Dependency Upgrades

- Avoid referencing internal Emotion packages in built types ([#16905](https://github.com/storybookjs/storybook/pull/16905))

## 6.5.0-alpha.3 (December 9, 2021)

### Bug Fixes

- Core: Support custom PREVIEW URL for block story iframe ([#16773](https://github.com/storybookjs/storybook/pull/16773))

## 6.5.0-alpha.2 (December 9, 2021)

### Bug Fixes

- UI: Only push the view back to Story if the viewMode is settings ([#16943](https://github.com/storybookjs/storybook/pull/16943))
- Core: Ensure we have a full story index before caching ([#16947](https://github.com/storybookjs/storybook/pull/16947))
- Angular: Fix support for non-roman alphabets in story titles ([#16931](https://github.com/storybookjs/storybook/pull/16931))
- Core: Be explicit about `viewMode` to fix Vue issue ([#16919](https://github.com/storybookjs/storybook/pull/16919))
- Core: Remove unused and occluded types ([#16917](https://github.com/storybookjs/storybook/pull/16917))
- CLI: Fix `sb repro` clobbering .vuerc ([#16897](https://github.com/storybookjs/storybook/pull/16897))
- Core: Fix auto-title in webpack5 ([#16913](https://github.com/storybookjs/storybook/pull/16913))
- Angular: Fix incorrect log ([#16885](https://github.com/storybookjs/storybook/pull/16885))
- Angular: Fix tsConfig paths not resolving for Angular >=12.2 ([#16882](https://github.com/storybookjs/storybook/pull/16882))
- Core: Add feature flag to disable legacy hierarchy separator warning ([#16915](https://github.com/storybookjs/storybook/pull/16915))

### Dependency Upgrades

- Move @types/node to dependencies and accept v16 types ([#16904](https://github.com/storybookjs/storybook/pull/16904))
- Bump lodash to 4.17.21 ([#16883](https://github.com/storybookjs/storybook/pull/16883))

## 6.4.9 (December 9, 2021)

### Bug Fixes

- Core: Ensure we have a full story index before caching ([#16947](https://github.com/storybookjs/storybook/pull/16947))
- Angular: Fix support for non-roman alphabets in story titles ([#16931](https://github.com/storybookjs/storybook/pull/16931))
- Core: Be explicit about `viewMode` to fix Vue issue ([#16919](https://github.com/storybookjs/storybook/pull/16919))
- Core: Remove unused and occluded types ([#16917](https://github.com/storybookjs/storybook/pull/16917))

## 6.4.8 (December 6, 2021)

### Bug Fixes

- Core: Fix auto-title in webpack5 ([#16913](https://github.com/storybookjs/storybook/pull/16913))
- CLI: Fix `sb repro` clobbering .vuerc ([#16897](https://github.com/storybookjs/storybook/pull/16897))

### Maintenance

- Core: Add feature flag to disable legacy hierarchy separator warning ([#16915](https://github.com/storybookjs/storybook/pull/16915))

## 6.4.7 (December 3, 2021)

### Bug Fixes

- Angular: Fix incorrect log ([#16885](https://github.com/storybookjs/storybook/pull/16885))

## 6.4.6 (December 3, 2021)

Npm publish failed.

## 6.4.5 (December 3, 2021)

### Bug Fixes

- Angular: Fix tsConfig paths not resolving for Angular >=12.2 ([#16882](https://github.com/storybookjs/storybook/pull/16882))
- Addon-docs: Fix transclusion crash on webpack rules without test field ([#16873](https://github.com/storybookjs/storybook/pull/16873))

### Dependency Upgrades

- Bump lodash to 4.17.21 ([#16883](https://github.com/storybookjs/storybook/pull/16883))

## 6.5.0-alpha.1 (December 3, 2021)

### Bug Fixes

- CLI: Fix open storybook in default browser ([#16844](https://github.com/storybookjs/storybook/pull/16844))
- Addon-docs: Fix transclusion crash on webpack rules without test field ([#16873](https://github.com/storybookjs/storybook/pull/16873))

### Maintenance

- CLI: Improve `sb repro` directory prompt ([#16854](https://github.com/storybookjs/storybook/pull/16854))

## 6.4.4 (December 2, 2021)

### Bug Fixes

- CLI: Fix mainjsFramework automigrate ([#16866](https://github.com/storybookjs/storybook/pull/16866))

## 6.4.3 (December 1, 2021)

### Bug Fixes

- Don't render with `modernInline` if `inlineStories` is `false` ([#16853](https://github.com/storybookjs/storybook/pull/16853))
- Preview: Don't hide the story while preparing ([#16850](https://github.com/storybookjs/storybook/pull/16850))

## 6.4.2 (December 1, 2021)

### Bug Fixes

- UI: Ensure all classes+animations for our loaders are prefixed ([#16815](https://github.com/storybookjs/storybook/pull/16815))
- Angular: Add back-compat method to find options (styles) in angular.json ([#16832](https://github.com/storybookjs/storybook/pull/16832))

## 6.4.1 (November 30, 2021)

### Bug Fixes

- Core: Fix packageName check in build-dev ([#16823](https://github.com/storybookjs/storybook/pull/16823))
- CSFFile: Fix function exports ([#16829](https://github.com/storybookjs/storybook/pull/16829))

### Maintenance

- Fix `handle-release-branches` workflow ([#16801](https://github.com/storybookjs/storybook/pull/16801))

## 6.4.0 (November 27, 2021)

Storybook 6.4 is here!! 🎉🎉🎉

SB6.4 adds interaction testing and performance re-architecture ahead of a huge 7.0 release.

- ▶️ **Interactive stories** to simulate user behavior and tools to debug it
- ⚡️ **On-demand architecture** for smaller builds and faster load times
- ⛸ **Automigrate + versioned documentation** for easier upgrades
- 📋 **Linter** to enforce Storybook best practices
- 💯 **Hundreds more fixes** and quality of life improvements

More info in the Github issue [Storybook 6.4 Release 🛠](https://github.com/storybookjs/storybook/issues/15355). Release announcement coming soon!!!

## 6.4.0-rc.11 (November 26, 2021)

### Bug Fixes

- Core: Fix breaking change in process/browser ([#16795](https://github.com/storybookjs/storybook/pull/16795))

## 6.4.0-rc.10 (November 26, 2021)

### Bug Fixes

- Core: Allow args/argTypes/component to be set via parameters for storiesOf back-compat ([#16791](https://github.com/storybookjs/storybook/pull/16791))
- Core: Sort the results of `globby` when constructing Story Index ([#16788](https://github.com/storybookjs/storybook/pull/16788))
- Core: Don't log a console error when the story is missing ([#16783](https://github.com/storybookjs/storybook/pull/16783))
- Addon-docs: Wait for the story component to render before emitting ([#16792](https://github.com/storybookjs/storybook/pull/16792))
- Core: Ensure that `context.args` is always set ([#16790](https://github.com/storybookjs/storybook/pull/16790))

## 6.4.0-rc.9 (November 26, 2021)

### Features

- Angular: Add styles and stylePreprocessorOptions to angular builder ([#16675](https://github.com/storybookjs/storybook/pull/16675))

### Bug Fixes

- Interactions: Unlock controls when play function is finished ([#16784](https://github.com/storybookjs/storybook/pull/16784))

### Maintenance

- Misc: Cleanup typescript webpack types ([#16780](https://github.com/storybookjs/storybook/pull/16780))

## 6.4.0-rc.8 (November 25, 2021)

### Bug Fixes

- Interactions: Fix duplicate rows in waitFor ([#16465](https://github.com/storybookjs/storybook/pull/16465))
- Core: Fix channel options so that they are merged in correct order ([#16764](https://github.com/storybookjs/storybook/pull/16764))

### Dependency Upgrades

- Add missing peer dependencies ([#16551](https://github.com/storybookjs/storybook/pull/16551))

## 6.4.0-rc.7 (November 24, 2021)

### Bug Fixes

- Core: Add `./` to start of hidden file & folder paths ([#16723](https://github.com/storybookjs/storybook/pull/16723))

### Dependency Upgrades

- Update peer dependencies for angular 13 support ([#16758](https://github.com/storybookjs/storybook/pull/16758))

## 6.4.0-rc.6 (November 22, 2021)

### Bug Fixes

- CSF: Fix component id handling ([#16746](https://github.com/storybookjs/storybook/pull/16746))
- Addon-docs: Improved loading state ([#16709](https://github.com/storybookjs/storybook/pull/16709))

### Maintenance

- WebComponents: Update Lit peerDep to use Lit 2 stable version ([#16670](https://github.com/storybookjs/storybook/pull/16670))

### Dependency Upgrades

- Upgrade react-router to 6.0.0 ([#16742](https://github.com/storybookjs/storybook/pull/16742))

## 6.4.0-rc.5 (November 19, 2021)

### Bug Fixes

- Core: Restore `stringifyEnvs` utility used by Vite builder ([#16731](https://github.com/storybookjs/storybook/pull/16731))

## 6.4.0-rc.4 (November 19, 2021)

### Bug Fixes

- Core: Fix `process.env` stringification ([#16725](https://github.com/storybookjs/storybook/pull/16725))
- Core: Fix build-storybook sort bug in v6-mode ([#16724](https://github.com/storybookjs/storybook/pull/16724))
- Addon-docs/Angular: fix extractEnumValues undefined error ([#16524](https://github.com/storybookjs/storybook/pull/16524))

### Maintenance

- Angular: update addon interactions example ([#16698](https://github.com/storybookjs/storybook/pull/16698))

### Dependency Upgrades

- Upgrade from node-sass to sass in examples/angular-cli ([#16663](https://github.com/storybookjs/storybook/pull/16663))

## 6.4.0-rc.3 (November 16, 2021)

### Bug Fixes

- Angular: Fix detection of @angular/cli package version ([#16696](https://github.com/storybookjs/storybook/pull/16696))

## 6.4.0-rc.2 (November 16, 2021)

### Features

- Core: Add option to use webpack filesystem cache ([#16219](https://github.com/storybookjs/storybook/pull/16219))

### Bug Fixes

- CLI: Fix automigrate command for eslint with extends as string ([#16687](https://github.com/storybookjs/storybook/pull/16687))
- Core: Bust the prebuilt manager cache if user has set `features` ([#16684](https://github.com/storybookjs/storybook/pull/16684))

### Maintenance

- Build: GH Action for exporting to linear by GH label ([#16683](https://github.com/storybookjs/storybook/pull/16683))

## 6.4.0-rc.1 (November 13, 2021)

### Features

- Angular: Add getWebpackConfig for angular 12.2.x & 13.x.x ([#16644](https://github.com/storybookjs/storybook/pull/16644))

## 6.4.0-rc.0 (November 12, 2021)

Storybook 6.4 is in RC!! 🎉🎉🎉

Hundreds of improvements and fixes, including:

- ▶️ **Interactive stories** to simulate user behavior and tools to debug it
- ⚡️ **On-demand architecture** for smaller builds and faster load times
- ⛸ **Streamlined tooling and documentation** for easier upgrades
- 💯 **Hundreds more fixes** and quality of life improvements

Track the release in the Github: [Storybook 6.4 Release 🛠](https://github.com/storybookjs/storybook/issues/15355)

## 6.4.0-beta.33 (November 12, 2021)

### Features

- UI: Remove `nopreview` and show redbox for any story error ([#16669](https://github.com/storybookjs/storybook/pull/16669))
- CLI: Run automigrate at the end of `sb init` ([#16671](https://github.com/storybookjs/storybook/pull/16671))
- UI: Docs loading state (WIP) ([#16666](https://github.com/storybookjs/storybook/pull/16666))

### Bugs

- Addon-actions: Omit sending window object thru the channel ([#16514](https://github.com/storybookjs/storybook/pull/16514))

### Maintenance

- Build: Fix CI checks ([#16535](https://github.com/storybookjs/storybook/pull/16535))
- Build: Add eslint-plugin-storybook to the repo ([#16662](https://github.com/storybookjs/storybook/pull/16662))

## 6.4.0-beta.32 (November 12, 2021)

### Features

- CLI: Add eslint-plugin-storybook to automigrate ([#16550](https://github.com/storybookjs/storybook/pull/16550))

### Bug Fixes

- Core: Ensure manager caching respects globals ([#16653](https://github.com/storybookjs/storybook/pull/16653))
- Core: Move the websocket channel to a specific path ([#16665](https://github.com/storybookjs/storybook/pull/16665))
- Storyshots: Fix autotitle ([#16568](https://github.com/storybookjs/storybook/pull/16568))

### Maintenance

- Interactions: Use Icon button and add disabled state to IconButton ([#16601](https://github.com/storybookjs/storybook/pull/16601))
- Add handle-release-branches-workflow ([#16580](https://github.com/storybookjs/storybook/pull/16580))
- Addon-interactions: add waitForElementToBeRemoved example ([#16434](https://github.com/storybookjs/storybook/pull/16434))

## 6.4.0-beta.31 (November 10, 2021)

### Features

- Core: Add feature flag to stop storybook from aliasing emotion ([#16613](https://github.com/storybookjs/storybook/pull/16613))

### Bug Fixes

- Core: Fix `staticDirs` and `-s` conflict check ([#16649](https://github.com/storybookjs/storybook/pull/16649))

### Maintenance

- Build: Add node-gyp for M1 macs ([#16645](https://github.com/storybookjs/storybook/pull/16645))

## 6.4.0-beta.30 (November 8, 2021)

### Features

- Args: Add ability to specific argType "targets" ([#16333](https://github.com/storybookjs/storybook/pull/16333))

### Bug Fixes

- Core: Fix sorting by `__namedExportsOrder` ([#16626](https://github.com/storybookjs/storybook/pull/16626))
- Angular: Fix zonejs imports in framework preset ([#16631](https://github.com/storybookjs/storybook/pull/16631))
- Core: Change CSF loading problems from warning to error ([#16632](https://github.com/storybookjs/storybook/pull/16632))
- Core: Fix args values updated from url to control ([#16508](https://github.com/storybookjs/storybook/pull/16508))
- CLI: Fix upgrade error state ([#16622](https://github.com/storybookjs/storybook/pull/16622))

## 6.4.0-beta.29 (November 6, 2021)

### Features

- CSFFile: Handle re-exported stories ([#16607](https://github.com/storybookjs/storybook/pull/16607))

### Bug Fixes

- StoryIndex: Skip files with no default export ([#16606](https://github.com/storybookjs/storybook/pull/16606))
- Addon-docs/Source: Fix disabling show code with null ([#16615](https://github.com/storybookjs/storybook/pull/16615))
- Core: Handle missing websocket in production build ([#16590](https://github.com/storybookjs/storybook/pull/16590))
- Core: Ensure we set `parameters.filePath` in v7 mode ([#16566](https://github.com/storybookjs/storybook/pull/16566))
- Core: Fix behavior around missing stories to be more clear ([#16608](https://github.com/storybookjs/storybook/pull/16608))

## 6.4.0-beta.28 (November 5, 2021)

### Bug Fixes

- Interactions: Fix README link ([#16596](https://github.com/storybookjs/storybook/pull/16596))

## 6.4.0-beta.27 (November 4, 2021)

### Features

- Core: Add 'staticDirs' config option ([#15969](https://github.com/storybookjs/storybook/pull/15969))

### Bug Fixes

- TS: Fix type for Refs so they can be disabled ([#16582](https://github.com/storybookjs/storybook/pull/16582))
- CLI: Add a check for source-dir in `sb extract` ([#16505](https://github.com/storybookjs/storybook/pull/16505))
- UI: Fix links that have no onClick handler ([#16581](https://github.com/storybookjs/storybook/pull/16581))
- Core: Continue running play function on rerender ([#16574](https://github.com/storybookjs/storybook/pull/16574))
- Ensure we always initialize the story store, even when the index errors. ([#16537](https://github.com/storybookjs/storybook/pull/16537))
- Interactions: Fix panel tab icon/count ([#16578](https://github.com/storybookjs/storybook/pull/16578))

### Dependency Upgrades

- Pin the version of `history` for `react-router-dom` compat ([#16560](https://github.com/storybookjs/storybook/pull/16560))

## 6.4.0-beta.26 (November 2, 2021)

### Bug Fixes

- Core: Replace SSE with websockets ([#16504](https://github.com/storybookjs/storybook/pull/16504))
- UI: Upgrade react-router ([#16554](https://github.com/storybookjs/storybook/pull/16554))
- Addon-docs/HTML: Fix source snippetization for DOM elements ([#16553](https://github.com/storybookjs/storybook/pull/16553))

## 6.4.0-beta.25 (November 2, 2021)

### Bug Fixes

- Core: Fix `decorateStory` exports from frameworks that have it ([#16529](https://github.com/storybookjs/storybook/pull/16529))
- Fix v7.0 type exports and update MIGRATION.md ([#16466](https://github.com/storybookjs/storybook/pull/16466))
- UI: Do not display menu toggle when `singleStory=true` ([#15755](https://github.com/storybookjs/storybook/pull/15755))

### Maintenance

- Core: Improve webpack chunk names ([#16513](https://github.com/storybookjs/storybook/pull/16513))

### Dependency Upgrades

- Migrate from micromatch to picomatch ([#16522](https://github.com/storybookjs/storybook/pull/16522))
- Add qs as a dev dependency of the api package ([#16525](https://github.com/storybookjs/storybook/pull/16525))

## 6.4.0-beta.24 (November 2, 2021)

bad npm publish

# 6.4.0-beta.23 (October 29, 2021)

### Features

- Core: Add support for async `getProjectAnnotations` function ([#16495](https://github.com/storybookjs/storybook/pull/16495))

### Bug Fixes

- Addon-docs: Fix centered layout on DocsPage ([#16506](https://github.com/storybookjs/storybook/pull/16506))
- Addon-docs/Angular: Fix missing condition in compodoc resolveTypealias ([#16523](https://github.com/storybookjs/storybook/pull/16523))
- Core: Fix `toImportFn` when dealing with `../`-led paths ([#16474](https://github.com/storybookjs/storybook/pull/16474))

### Maintenance

- UI: Update the toolbar button styles ([#16429](https://github.com/storybookjs/storybook/pull/16429))
- CLI: Fix build selection menu ([#16521](https://github.com/storybookjs/storybook/pull/16521))
- Core: Use synchronous promises to "fake" promises for sync code ([#16517](https://github.com/storybookjs/storybook/pull/16517))
- UI: Improve WithTooltip contrast and positioning ([#16510](https://github.com/storybookjs/storybook/pull/16510))

## 6.4.0-beta.22 (October 28, 2021)

### Bug Fixes

- Addon-docs: Track code-level args changes in `ArgsTable` ([#16488](https://github.com/storybookjs/storybook/pull/16488))

### Maintenance

- Addon-a11y: Lazy load axe-core only when running tests ([#16484](https://github.com/storybookjs/storybook/pull/16484))
- Addon-docs: Lazy load Prettier in Vue and Angular ([#16459](https://github.com/storybookjs/storybook/pull/16459))

## 6.4.0-beta.21 (October 28, 2021)

### Features

- Core: Rerun loaders when args/globals change ([#16476](https://github.com/storybookjs/storybook/pull/16476))
- Interactions: move step debugger behind a feature flag ([#16481](https://github.com/storybookjs/storybook/pull/16481))

### Bug Fixes

- Core: Always update initial args when loading a story ([#16487](https://github.com/storybookjs/storybook/pull/16487))
- Core: Ensure we don't reset `WebPreview` if calling `start()` in v7 mode ([#16475](https://github.com/storybookjs/storybook/pull/16475))
- Core: Save and restore globals on preview init using the channel ([#16469](https://github.com/storybookjs/storybook/pull/16469))

### Maintenance

- CI: Upgrade Cypress and Node.js version used in e2e tests ([#16263](https://github.com/storybookjs/storybook/pull/16263))

### Dependency Upgrades

- Interactions: Use latest package versions ([#16464](https://github.com/storybookjs/storybook/pull/16464))

## 6.4.0-beta.20 (October 26, 2021)

### Bug Fixes

- Interactions: Do not cleanup state when loading initial story ([#16462](https://github.com/storybookjs/storybook/pull/16462))
- Addon-interactions: Add safety check on fileName parameter ([#16454](https://github.com/storybookjs/storybook/pull/16454))
- Core: Fix optional global features in PreviewWeb ([#16448](https://github.com/storybookjs/storybook/pull/16448))

### Maintenance

- UI: Migrate router to react-router ([#16440](https://github.com/storybookjs/storybook/pull/16440))

## 6.4.0-beta.19 (October 22, 2021)

### Bug Fixes

- Core: Fix some slashes for windows ([#16445](https://github.com/storybookjs/storybook/pull/16445))

### Maintenance

- Core: Add typing for StorybookConfig.refs ([#16443](https://github.com/storybookjs/storybook/pull/16443))

## 6.4.0-beta.18 (October 21, 2021)

### Features

- StoryIndex: Detect added/moved directories and batch invalidations ([#16432](https://github.com/storybookjs/storybook/pull/16432))

### Bug Fixes

- Core: Fix module loading support ([#16404](https://github.com/storybookjs/storybook/pull/16404))
- Addon-links: Modernize to be compatible with v7 store ([#16420](https://github.com/storybookjs/storybook/pull/16420))

### Maintenance

- CLI: Improve build-storybooks script in the monorepo ([#16433](https://github.com/storybookjs/storybook/pull/16433))

## 6.4.0-beta.17 (October 21, 2021)

### Features

- Core: Add `core.channelOptions` main.js config ([#16415](https://github.com/storybookjs/storybook/pull/16415))

### Maintenance

- Addon-docs: Lazy load docs to reduce bundle size ([#16412](https://github.com/storybookjs/storybook/pull/16412))
- UI: Update mono font stack ([#16409](https://github.com/storybookjs/storybook/pull/16409))
- UI: Update sidebar hover color to be a refreshing transparent blue ([#16408](https://github.com/storybookjs/storybook/pull/16408))

## 6.4.0-beta.16 (October 20, 2021)

### Bug Fixes

- Core: Consolidate framework presets ([#16417](https://github.com/storybookjs/storybook/pull/16417))
- Addon-a11y: Fix to use `loadStory` over deprecated `fromId` ([#16398](https://github.com/storybookjs/storybook/pull/16398))
- Core: Restore `queryparams` exports in `client-api` ([#16414](https://github.com/storybookjs/storybook/pull/16414))

### Maintenance

- Core: Minor cleanup of `PreviewWeb` ([#16418](https://github.com/storybookjs/storybook/pull/16418))

### Dependency Upgrades

- Update `react-element-to-jsx-string` package ([#16407](https://github.com/storybookjs/storybook/pull/16407))

## 6.4.0-beta.15 (October 19, 2021)

### Features

- Core: Add `framework` field support to main.js ([#16393](https://github.com/storybookjs/storybook/pull/16393))

### Bug Fixes

- Addon-docs: Spread all the old docs context fields ([#16399](https://github.com/storybookjs/storybook/pull/16399))
- Core: Reverse checking of promise so it's OK if we get it wrong ([#16396](https://github.com/storybookjs/storybook/pull/16396))

### Maintenance

- Addon-interactions: Update interaction hover icon ([#16388](https://github.com/storybookjs/storybook/pull/16388))
- Core: Refactor story store to be simpler when getting the index ([#16397](https://github.com/storybookjs/storybook/pull/16397))

## 6.4.0-beta.14 (October 19, 2021)

### Bug Fixes

- Core: Fix bad deprecation link for argType.defaultValue ([#16391](https://github.com/storybookjs/storybook/pull/16391))
- Storyshots/vue3: Fix story render with singleton vue3 app ([#15983](https://github.com/storybookjs/storybook/pull/15983))
- Angular: Fix preset for storyStoreV7 ([#16380](https://github.com/storybookjs/storybook/pull/16380))
- Core: Fix Args combination to allow `undefined` overrides ([#16385](https://github.com/storybookjs/storybook/pull/16385))
- Core: Fix missing FEATURES global ([#16389](https://github.com/storybookjs/storybook/pull/16389))

### Dependency Upgrades

- Upgrade chromatic CLI ([#16320](https://github.com/storybookjs/storybook/pull/16320))

## 6.4.0-beta.13 (October 18, 2021)

### Features

- Core: Listen to story change events as soon as the preview is created ([#16331](https://github.com/storybookjs/storybook/pull/16331))

### Bug Fixes

- Addon-controls: Fix `{control: false}` handling ([#16366](https://github.com/storybookjs/storybook/pull/16366))
- CLI: Fix broken link in react native template ([#16372](https://github.com/storybookjs/storybook/pull/16372))
- UI: Fix scrollbar color to be visible in dark theme ([#16345](https://github.com/storybookjs/storybook/pull/16345))

## 6.4.0-beta.12 (October 15, 2021)

### Features

- Addon-interactions: New addon for step debugging play functions ([#16002](https://github.com/storybookjs/storybook/pull/16002))
- Addon-interactions: Add rewind button to interactions subnav ([#16042](https://github.com/storybookjs/storybook/pull/16042))

## 6.3.12 (October 14, 2021)

### Bug Fixes

- CLI: Force `sb upgrade` to use latest version of `npm-check-updates` ([#16336](https://github.com/storybookjs/storybook/pull/16336))

## 6.4.0-beta.11 (October 14, 2021)

### Features

- Core: Align storyIndex generated by the server and client ([#16311](https://github.com/storybookjs/storybook/pull/16311))
- Core: Render behavior around play functions ([#16208](https://github.com/storybookjs/storybook/pull/16208))
- Angular: Allow to set configuration in angularBrowserTarget ([#16218](https://github.com/storybookjs/storybook/pull/16218))

### Bug Fixes

- CLI: Force `sb upgrade` to use latest version of `npm-check-updates` ([#16336](https://github.com/storybookjs/storybook/pull/16336))

### Maintenance

- Core: Fix broken build ([#16346](https://github.com/storybookjs/storybook/pull/16346))

## 6.4.0-beta.10 (October 13, 2021)

### Features

- Composition: Add expanded option to Refs ([#14345](https://github.com/storybookjs/storybook/pull/14345))
- Core: Add Story Index error handling ([#16319](https://github.com/storybookjs/storybook/pull/16319))

### Bug Fixes

- Core: Fix paths to be relative to working dir in v7 mode ([#16328](https://github.com/storybookjs/storybook/pull/16328))
- Core: Don't fetch `stories.json`, JSON or SSE, if we don't need it ([#16318](https://github.com/storybookjs/storybook/pull/16318))

### Maintenance

- CLI: Add js extension to lit-html imports ([#16244](https://github.com/storybookjs/storybook/pull/16244))
- Story-sort: Catch errors and direct user towards migration docs ([#16242](https://github.com/storybookjs/storybook/pull/16242))

## 6.3.11 (October 12, 2021)

### Bug Fixes

- CLI: Fix CRA version detection crash ([#16308](https://github.com/storybookjs/storybook/pull/16308))

## 6.4.0-beta.9 (October 12, 2021)

### Features

- Webpack5: Don't emit stats unless debugWebpack is set ([#16132](https://github.com/storybookjs/storybook/pull/16132))

### Bug Fixes

- CLI: Fix CRA version detection crash ([#16308](https://github.com/storybookjs/storybook/pull/16308))
- Core: Better story id generation, cope with unusual stories ([#16309](https://github.com/storybookjs/storybook/pull/16309))
- Core: Simplify `DOCS_RENDERED` and only use `STORY_RENDERED` for hooks ([#16310](https://github.com/storybookjs/storybook/pull/16310))
- Core: Fix `extract`, `SET_STORIES` and `getStoriesJsonData` ([#16299](https://github.com/storybookjs/storybook/pull/16299))
- TypeScript: Add `id` to BaseMeta type ([#16216](https://github.com/storybookjs/storybook/pull/16216))
- CSF: Fix support for `X.story` annotations ([#16297](https://github.com/storybookjs/storybook/pull/16297))

## 6.4.0-beta.8 (October 11, 2021)

### Bug Fixes

- Core: Fix multiple invalidations ([#16294](https://github.com/storybookjs/storybook/pull/16294))

### Maintenance

- Add ability to skip cypress tests based on framework ([#16285](https://github.com/storybookjs/storybook/pull/16285))

### Dependency Upgrades

- Addons: Add webpack-env as dependency ([#16302](https://github.com/storybookjs/storybook/pull/16302))
- Upgrade npmlog dependency ([#16289](https://github.com/storybookjs/storybook/pull/16289))

## 6.4.0-beta.7 (October 8, 2021)

### Bug Fixes

- Addon-docs: Always render the `children` of the `Canvas` component ([#16280](https://github.com/storybookjs/storybook/pull/16280))
- Addon-docs: Fix args passing for Vue inline rendering ([#16279](https://github.com/storybookjs/storybook/pull/16279))

## 6.4.0-beta.6 (October 7, 2021)

### Features

- Core: HMR for StoryIndex server ([#16160](https://github.com/storybookjs/storybook/pull/16160))

### Bug Fixes

- Angular: Make types generic for angular's built-in decorators ([#16266](https://github.com/storybookjs/storybook/pull/16266))
- Args: Re-render the whole container when args or globals change ([#16264](https://github.com/storybookjs/storybook/pull/16264))

### Maintenance

- CSF: Add CSF2 play function example ([#16121](https://github.com/storybookjs/storybook/pull/16121))
- Core: Unified story specifiers ([#16220](https://github.com/storybookjs/storybook/pull/16220))

## 6.3.10 (October 6, 2021)

### Bug Fixes

- CLI: Don't upgrade preset-create-react-app if react-scripts < 5 ([#16255](https://github.com/storybookjs/storybook/pull/16255))

## 6.4.0-beta.5 (October 6, 2021)

### Features

- CLI: Add "automigrate" command for configuration issues and migrations ([#16193](https://github.com/storybookjs/storybook/pull/16193))
- Vue: support @values in args table ([#16019](https://github.com/storybookjs/storybook/pull/16019))

### Bug Fixes

- CLI: Don't upgrade preset-create-react-app if react-scripts < 5 ([#16255](https://github.com/storybookjs/storybook/pull/16255))
- Angular: Fix getComponentInputsOutputs for multiple decorators ([#16217](https://github.com/storybookjs/storybook/pull/16217))

### Maintenance

- CSF: Add error handling for CSF story index generation ([#16241](https://github.com/storybookjs/storybook/pull/16241))
- Official-storybook: Fix show source in no-args stories ([#16259](https://github.com/storybookjs/storybook/pull/16259))
- CLI: Remove story format parameter ([#16233](https://github.com/storybookjs/storybook/pull/16233))

## 6.4.0-beta.4 (October 5, 2021)

### Features

- Core: Support v2 compatibility mode in story index ([#16226](https://github.com/storybookjs/storybook/pull/16226))
- Core: Support composing stories in both v6 and v7 modes ([#16224](https://github.com/storybookjs/storybook/pull/16224))
- Web-components: Autogenerate action argTypes for event. ([#16178](https://github.com/storybookjs/storybook/pull/16178))

### Bug Fixes

- Addon-a11y: Fix type of context passed to `axe.run` ([#16129](https://github.com/storybookjs/storybook/pull/16129))
- Addon-docs/Angular: Fix inline story rendering ([#16149](https://github.com/storybookjs/storybook/pull/16149))
- Components: Fix Code component to render children as array ([#15492](https://github.com/storybookjs/storybook/pull/15492))

### Maintenance

- CLI: Remove watch mode from the build-storybook documentation ([#16165](https://github.com/storybookjs/storybook/pull/16165))

## 6.3.9 (October 1, 2021)

### Maintenance

- CLI: Add webpack5 builder to CRA5 `sb init` ([#16194](https://github.com/storybookjs/storybook/pull/16194))

## 6.4.0-beta.3 (October 1, 2021)

### Maintenance

- CLI: Add webpack5 builder to CRA5 `sb init` ([#16194](https://github.com/storybookjs/storybook/pull/16194))

## 6.4.0-beta.2 (October 1, 2021)

### Bug Fixes

- Controls: Hide color control format toggle when no value ([#16186](https://github.com/storybookjs/storybook/pull/16186))

### Dependency Upgrades

- Upgrade boxen to 5.x ([#16190](https://github.com/storybookjs/storybook/pull/16190))
- Upgrade react-dev-utils to 11.0.4 ([#16196](https://github.com/storybookjs/storybook/pull/16196))
- Dependencies: Fix ansi-html vulnerability ([#16155](https://github.com/storybookjs/storybook/pull/16155))

### Maintenance

- CLI: Better scope sample page component styles ([#16185](https://github.com/storybookjs/storybook/pull/16185))

## 6.4.0-beta.1 (September 26, 2021)

### Features

- MDX: Support CSF3 play/render functions ([#16159](https://github.com/storybookjs/storybook/pull/16159))
- Addon-a11y: Export parameter types ([#16128](https://github.com/storybookjs/storybook/pull/16128))

### Bug Fixes

- Addon-docs: Fix loading behavior for Canvas doc block ([#16161](https://github.com/storybookjs/storybook/pull/16161))
- Added index.d.ts for addon-docs/angular ([#16123](https://github.com/storybookjs/storybook/pull/16123))

### Maintenance

- Angular: Remove dead code in client ([#16137](https://github.com/storybookjs/storybook/pull/16137))

## 6.4.0-beta.0 (September 22, 2021)

Storybook 6.4 is in beta! 🎊

SB6.4 adds interaction testing and performance re-architecture in preparation for a huge 7.0 release.

Track the release in the Github: [Storybook 6.4 Release 🛠](https://github.com/storybookjs/storybook/issues/15355)

## 6.4.0-alpha.41 (September 22, 2021)

### Bug Fixes

- Core: Fix `./stories.json` requests in manager for relative paths ([#16114](https://github.com/storybookjs/storybook/pull/16114))
- Core: Fix dotenv handling ([#16105](https://github.com/storybookjs/storybook/pull/16105))
- Addon-docs: Fix embedding selected story in canvas block ([#15915](https://github.com/storybookjs/storybook/pull/15915))

### Maintenance

- Story index server: Add story sorting ([#16102](https://github.com/storybookjs/storybook/pull/16102))
- Refactor `stories-json` to use a caching class ([#16106](https://github.com/storybookjs/storybook/pull/16106))

## 6.4.0-alpha.40 (September 20, 2021)

### Bug Fixes

- Webpack5: Fix output paths ([#16074](https://github.com/storybookjs/storybook/pull/16074))
- Core: Infer docs only stories ([#16101](https://github.com/storybookjs/storybook/pull/16101))
- CSF3: Fix story type back-compat ([#16107](https://github.com/storybookjs/storybook/pull/16107))

## 6.4.0-alpha.39 (September 18, 2021)

### Features

- CSF3: Add auto-title support to on-demand V7/V6 refactor ([#16098](https://github.com/storybookjs/storybook/pull/16098))

## 6.4.0-alpha.38 (September 16, 2021)

### Bug Fixes

- Angular: Fix ng selector issue and dynamically show templates in stories ([#15976](https://github.com/storybookjs/storybook/pull/15976))
- Core: Fix issue with more complex `stories` paths. ([#16078](https://github.com/storybookjs/storybook/pull/16078))

### Maintenance

- Main.js config: Fix Builder type ([#16013](https://github.com/storybookjs/storybook/pull/16013))

## 6.4.0-alpha.37 (September 16, 2021)

### Bug Fixes

- Angular: Fix error handling for angular builder standalone builds ([#15978](https://github.com/storybookjs/storybook/pull/15978))
- Addon-docs: Fix `useStories` to correctly respond to change in `storyId` ([#16046](https://github.com/storybookjs/storybook/pull/16046))

## 6.4.0-alpha.36 (September 15, 2021)

### Bug Fixes

- Addon-docs: Ensure we don't clobber multiple source container state updates ([#16039](https://github.com/storybookjs/storybook/pull/16039))
- Core: Restore deprecation warning for configure ([#16041](https://github.com/storybookjs/storybook/pull/16041))
- Core: Be careful in `FEATURES` check ([#16044](https://github.com/storybookjs/storybook/pull/16044))

## 6.4.0-alpha.35 (September 14, 2021)

### Features

- Core: On demand store ([#15871](https://github.com/storybookjs/storybook/pull/15871))

### Bug Fixes

- UI: Fix ActionButton out of position in Safari ([#15981](https://github.com/storybookjs/storybook/pull/15981))

## 6.4.0-alpha.34 (September 7, 2021)

### Features

- Angular: Support storybook configuration for projects with only angular Library ([#15744](https://github.com/storybookjs/storybook/pull/15744))
- CLI: Show framework name in startup banner ([#15966](https://github.com/storybookjs/storybook/pull/15966))

### Bug Fixes

- CLI: Fix sb link to yarn3 repos ([#15989](https://github.com/storybookjs/storybook/pull/15989))
- Core: Pass proper stack of an error ([#15864](https://github.com/storybookjs/storybook/pull/15864))
- Addon-docs/Angular: Fix default values in ArgsTable ([#15881](https://github.com/storybookjs/storybook/pull/15881))

### Maintenance

- Core: Replaced `process.env` override in `DefinePlugin` config ([#15925](https://github.com/storybookjs/storybook/pull/15925))
- CSF: Infer defaultValue of argtype based on arg ([#15798](https://github.com/storybookjs/storybook/pull/15798))

## 6.3.8 (September 3, 2021)

### Maintenance

- Core: Write JSON stats file in streaming fashion and omit `chunks` for brevity ([#15889](https://github.com/storybookjs/storybook/pull/15889))

## 6.4.0-alpha.33 (September 1, 2021)

### Bug Fixes

- TypeScript: Fix glob pattern used in package `typesVersions` config ([#15918](https://github.com/storybookjs/storybook/pull/15918))

### Maintenance

- Core: Add Babel mode v7 ([#15928](https://github.com/storybookjs/storybook/pull/15928))
- Core: Write JSON stats file in streaming fashion and omit `chunks` for brevity ([#15889](https://github.com/storybookjs/storybook/pull/15889))
- UI: Add playback icons ([#15909](https://github.com/storybookjs/storybook/pull/15909))
- Misc: Generate and push repros to a GitHub repo every night ([#15877](https://github.com/storybookjs/storybook/pull/15877))

### Dependency Upgrades

- Bump cpy to 8.1.2 for security ([#15953](https://github.com/storybookjs/storybook/pull/15953))

## 6.4.0-alpha.32 (August 24, 2021)

### Features

- CLI/Storyshots: Specify custom sb extract Chromium exe ([#15878](https://github.com/storybookjs/storybook/pull/15878))

### Bug Fixes

- Angular: Fix Cannot read property 'selector' of undefined ([#15874](https://github.com/storybookjs/storybook/pull/15874))
- Addon-docs: Fix refs support in Docs pages ([#15890](https://github.com/storybookjs/storybook/pull/15890))

## 6.4.0-alpha.31 (August 23, 2021)

### Features

- UI: Add skip to canvas/sidebar links ([#15740](https://github.com/storybookjs/storybook/pull/15740))
- Controls: Add id to setter button for undefined values ([#15729](https://github.com/storybookjs/storybook/pull/15729))

### Bug Fixes

- CSF3: Normalize windows paths in autoTitle ([#15770](https://github.com/storybookjs/storybook/pull/15770))
- Addon-docs: Fix newline handling in ArgsTable code blocks ([#12882](https://github.com/storybookjs/storybook/pull/12882))

### Maintenance

- Build: Update `caniuse-lite` dependency ([#15863](https://github.com/storybookjs/storybook/pull/15863))

## 6.4.0-alpha.30 (August 14, 2021)

### Maintenance

- CLI: Improve typings of Angular components ([#15832](https://github.com/storybookjs/storybook/pull/15832))
- Controls: Fix `esm is not defined` error with built Storybook ([#15812](https://github.com/storybookjs/storybook/pull/15812))

## 6.4.0-alpha.29 (August 10, 2021)

### Features

- Addon-docs/Angular: Render user defined template as source if it exists ([#15743](https://github.com/storybookjs/storybook/pull/15743))
- Core: Add MDX support to built-in stories.json generation ([#15808](https://github.com/storybookjs/storybook/pull/15808))

### Maintenance

- Controls: Add better icon for reset button ([#15737](https://github.com/storybookjs/storybook/pull/15737))
- Add checkboxes to pull request template ([#15799](https://github.com/storybookjs/storybook/pull/15799))

## 6.4.0-alpha.28 (August 10, 2021)

Fix bad publish of `6.4.0-alpha.27` to the `latest` tag

## 6.3.7 (August 10, 2021)

Fix bad publish of `6.4.0-alpha.27` to the `latest` tag

## 6.4.0-alpha.26 (August 9, 2021)

### Maintenance

- Server: Update example to use options and labels for options controls ([#15789](https://github.com/storybookjs/storybook/pull/15789))
- Controls: Remove ArrayControl ([#15788](https://github.com/storybookjs/storybook/pull/15788))

## 6.4.0-alpha.25 (August 8, 2021)

### Features

- Angular: Add global CSF3 renderer ([#15742](https://github.com/storybookjs/storybook/pull/15742))

### Bug Fixes

- Addon-docs/Angular: Use compodoc rawdescription where available ([#15774](https://github.com/storybookjs/storybook/pull/15774))
- Core: Fix main.js glob resolution for direct paths in stories ([#15775](https://github.com/storybookjs/storybook/pull/15775))

### Maintenance

- CSF: Optionally pass Args generic type from BaseAnnotations to ArgTypes ([#14356](https://github.com/storybookjs/storybook/pull/14356))

## 6.4.0-alpha.24 (August 4, 2021)

### Features

- HTML: Dynamic source snippets ([#15748](https://github.com/storybookjs/storybook/pull/15748))

## 6.4.0-alpha.23 (August 3, 2021)

### Features

- CLI: Add --no-open flag ([#15739](https://github.com/storybookjs/storybook/pull/15739))

### Bug Fixes

- Angular: Fix incomplete property metadata when using inheritance ([#15586](https://github.com/storybookjs/storybook/pull/15586))

### Maintenance

- Build: Upgrade to Yarn 3 ([#15682](https://github.com/storybookjs/storybook/pull/15682))

### Dependency Upgrades

- Lower babel-loader required version ([#14811](https://github.com/storybookjs/storybook/pull/14811))
- Relax prettier version constraint ([#15298](https://github.com/storybookjs/storybook/pull/15298))

## 6.4.0-alpha.22 (July 28, 2021)

### Features

- CSF3: Add auto-titles from standard glob patterns ([#15697](https://github.com/storybookjs/storybook/pull/15697))
- CSF3: Add startCase to auto-generated titles ([#15618](https://github.com/storybookjs/storybook/pull/15618))

### Bug Fixes

- CLI: Fix Svelte CLI template markup ([#15689](https://github.com/storybookjs/storybook/pull/15689))

### Maintenance

- Server: Upgrade to CSF3 ([#15698](https://github.com/storybookjs/storybook/pull/15698))

### Dependency Upgrades

- Fix some transitive peer dependency warnings ([#15687](https://github.com/storybookjs/storybook/pull/15687))
- Upgrade react-refresh plugin to fix fast refresh on Webpack5 ([#15616](https://github.com/storybookjs/storybook/pull/15616))

## 6.3.6 (July 26, 2021)

### Bug Fixes

- CLI: Fix debug webpack output in static build ([#15674](https://github.com/storybookjs/storybook/pull/15674))
- CSF3: Fix custom render function ([#15668](https://github.com/storybookjs/storybook/pull/15668))

## 6.4.0-alpha.21 (July 26, 2021)

### Bug Fixes

- CLI: Fix debug webpack output in static build ([#15674](https://github.com/storybookjs/storybook/pull/15674))
- Controls: Fix boolean toggle style to match underlying value ([#15676](https://github.com/storybookjs/storybook/pull/15676))
- Components: Fix Button to accept href attribute ([#15671](https://github.com/storybookjs/storybook/pull/15671))

## 6.4.0-alpha.20 (July 24, 2021)

### Bug Fixes

- CSF3: Fix custom render function ([#15668](https://github.com/storybookjs/storybook/pull/15668))

### Dependency Upgrades

- Remove glob-base dependency ([#15399](https://github.com/storybookjs/storybook/pull/15399))

## 6.3.5 (July 22, 2021)

### Bug Fixes

- Controls: Don't set arg in validateOptions if it would be `undefined` ([#15654](https://github.com/storybookjs/storybook/pull/15654))
- Trailing comma handling for "-s" command line parameter ([#15615](https://github.com/storybookjs/storybook/pull/15615))
- Controls: Fix color matching behavior for non-string types ([#15549](https://github.com/storybookjs/storybook/pull/15549))
- Composition: Fix refs ordering ([#15527](https://github.com/storybookjs/storybook/pull/15527))

## 6.4.0-alpha.19 (July 22, 2021)

### Features

- Controls: Don't set arg in validateOptions if it would be `undefined` ([#15654](https://github.com/storybookjs/storybook/pull/15654))
- Vue: Add support for tsx ([#11936](https://github.com/storybookjs/storybook/pull/11936))

### Bug Fixes

- CLI: Fix trailing comma handling for "-s" command line parameter ([#15615](https://github.com/storybookjs/storybook/pull/15615))
- Components: Lazy-load syntax highlighter ([#15607](https://github.com/storybookjs/storybook/pull/15607))

### Maintenance

- Controls: Clean up arg unboxing and switch statements ([#14394](https://github.com/storybookjs/storybook/pull/14394))
- Examples: Fix react-ts to be runnable standalone ([#15621](https://github.com/storybookjs/storybook/pull/15621))

## 6.4.0-alpha.18 (July 16, 2021)

### Features

- UI: Allow keyboard shortcut to copy code in preview blocks ([#15559](https://github.com/storybookjs/storybook/pull/15559))

### Maintenance

- Avoid slow regex.match call in renderJsx ([#15581](https://github.com/storybookjs/storybook/pull/15581))

## 6.4.0-alpha.17 (July 15, 2021)

### Features

- Types: Export BaseStoryFn and BaseStoryObject ([#15592](https://github.com/storybookjs/storybook/pull/15592))
- Addon-docs: Add transparency support to color swatch ([#14439](https://github.com/storybookjs/storybook/pull/14439))

## 6.4.0-alpha.16 (July 13, 2021)

### Features

- Addon-backgrounds: Respect user's reduced motion settings ([#13711](https://github.com/storybookjs/storybook/pull/13711))
- CSF: Add CSF3 typings ([#15558](https://github.com/storybookjs/storybook/pull/15558))

### Bug Fixes

- Angular: Fix actions argType auto generation ([#15563](https://github.com/storybookjs/storybook/pull/15563))

## 6.4.0-alpha.15 (July 13, 2021)

### Bug Fixes

- Controls: Fix color matching behavior for non-string types ([#15549](https://github.com/storybookjs/storybook/pull/15549))
- UI: Fix toggle button for custom theming ([#15449](https://github.com/storybookjs/storybook/pull/15449))

### Maintenance

- Build: Fix `publish` step on CircleCI ([#15556](https://github.com/storybookjs/storybook/pull/15556))
- Examples: Add no-manager-cache to all examples ([#15546](https://github.com/storybookjs/storybook/pull/15546))
- Official-storybook: Add example of embedding story object in MDX ([#15533](https://github.com/storybookjs/storybook/pull/15533))

## 6.4.0-alpha.14 (July 11, 2021)

### Features

- Web-components: Dynamic source snippets ([#15337](https://github.com/storybookjs/storybook/pull/15337))

### Maintenance

- Essentials: Add measure addon to monorepo ([#15545](https://github.com/storybookjs/storybook/pull/15545))

## 6.4.0-alpha.13 (July 9, 2021)

### Bug Fixes

- Addon-docs/Angular: Add unique id to Angular stories ([#15501](https://github.com/storybookjs/storybook/pull/15501))
- Composition: Fix refs ordering ([#15527](https://github.com/storybookjs/storybook/pull/15527))

### Maintenance

- Essentials: Add outline addon to monorepo ([#15526](https://github.com/storybookjs/storybook/pull/15526))
- Build: Fix cache setup in GitHub Actions workflow ([#15523](https://github.com/storybookjs/storybook/pull/15523))

## 6.3.4 (July 8, 2021)

### Maintenance

- Addon-docs: Cache DocsContext on window to prevent duplication ([#15428](https://github.com/storybookjs/storybook/pull/15428))

## 6.3.3 (July 7, 2021)

### Bug Fixes

- Webpack5: Quit process after finishing a static build ([#15483](https://github.com/storybookjs/storybook/pull/15483))
- Addon-docs/Angular: Fix numeric args default value handling ([#15491](https://github.com/storybookjs/storybook/pull/15491))
- Angular: Fix circular reference not being handled in moduleMetadata ([#15410](https://github.com/storybookjs/storybook/pull/15410))
- Core: Fix double rebuilds by removing aggregateTimeout ([#15372](https://github.com/storybookjs/storybook/pull/15372))
- CLI: Fix NPM typo ([#15461](https://github.com/storybookjs/storybook/pull/15461))

## 6.4.0-alpha.12 (July 7, 2021)

### Bug Fixes

- Webpack5: Quit process after finishing a static build ([#15483](https://github.com/storybookjs/storybook/pull/15483))
- Addon-docs/Angular: Fix numeric args default value handling ([#15491](https://github.com/storybookjs/storybook/pull/15491))

### Maintenance

- Angular: Make Ivy work by default in the angular-cli example ([#15280](https://github.com/storybookjs/storybook/pull/15280))
- Official-storybook: Fix shortcut for navigating to previous language ([#15489](https://github.com/storybookjs/storybook/pull/15489))
- Addon-docs: Add docs to standalone example ([#7848](https://github.com/storybookjs/storybook/pull/7848))
- Build: Update Yarn cache setup in GitHub Actions workflow ([#15480](https://github.com/storybookjs/storybook/pull/15480))

## 6.4.0-alpha.11 (July 3, 2021)

### Bug Fixes

- UI: Fix sidebar toggle in fullscreen mode ([#15459](https://github.com/storybookjs/storybook/pull/15459))
- Angular: Fix circular reference not being handled in moduleMetadata ([#15410](https://github.com/storybookjs/storybook/pull/15410))

### Maintenance

- Addon-a11y: Reverse help and description labels in accordion ([#15466](https://github.com/storybookjs/storybook/pull/15466))

## 6.4.0-alpha.10 (July 2, 2021)

### Features

- UI: Display menu icon on the toolbar when the sidebar is collapsed ([#15369](https://github.com/storybookjs/storybook/pull/15369))

### Bug Fixes

- Core: Fix double rebuilds by removing aggregateTimeout ([#15372](https://github.com/storybookjs/storybook/pull/15372))
- CLI: Fix NPM typo ([#15461](https://github.com/storybookjs/storybook/pull/15461))

### Maintenance

- Addon-docs: Cache DocsContext on window to prevent duplication ([#15428](https://github.com/storybookjs/storybook/pull/15428))

## 6.3.2 (June 30, 2021)

### Bug Fixes

- Essentials: Update measure and outline. Fix alt+tab issues on windows. ([#15402](https://github.com/storybookjs/storybook/pull/15402))
- Core: Fix decorator context update ([#15408](https://github.com/storybookjs/storybook/pull/15408))
- Revert "Vue3: Update args without re-mounting component" ([#15409](https://github.com/storybookjs/storybook/pull/15409))
- Upgrade bad release of `react-docgen-typescript-plugin` ([#15432](https://github.com/storybookjs/storybook/pull/15432))

## 6.4.0-alpha.9 (June 30, 2021)

### Dependency Upgrades

- Upgrade bad release of `react-docgen-typescript-plugin` ([#15432](https://github.com/storybookjs/storybook/pull/15432))

## 6.4.0-alpha.8 (June 30, 2021)

### Features

- Web-components: Custom Elements Manifest v1 support ([#15138](https://github.com/storybookjs/storybook/pull/15138))

### Bug Fixes

- CSF: Fix auto-title generation for standard config dir ([#15430](https://github.com/storybookjs/storybook/pull/15430))

### Dependency Upgrades

- Upgrade `react-docgen-typescript-plugin` for refresh perf regression ([#15431](https://github.com/storybookjs/storybook/pull/15431))

## 6.4.0-alpha.7 (June 29, 2021)

### Features

- CSF: Generate default titles based on file path ([#15376](https://github.com/storybookjs/storybook/pull/15376))

## 6.4.0-alpha.6 (June 29, 2021)

### Bug Fixes

- Core: Fix decorator context update ([#15408](https://github.com/storybookjs/storybook/pull/15408))
- Revert "Vue3: Update args without re-mounting component" ([#15409](https://github.com/storybookjs/storybook/pull/15409))

## 6.4.0-alpha.5 (June 29, 2021)

### Features

- CSF: Add stories.json generation for CSF3 stories ([#15395](https://github.com/storybookjs/storybook/pull/15395))

### Bug Fixes

- Essentials: Update measure and outline. Fix alt+tab issues on windows. ([#15402](https://github.com/storybookjs/storybook/pull/15402))

## 6.3.1 (June 28, 2021)

### Bug Fixes

- Core: Only use dotenv-webpack when a user has a dotenv file ([#15365](https://github.com/storybookjs/storybook/pull/15365))
- Essentials: Update addon measure and outline ([#15354](https://github.com/storybookjs/storybook/pull/15354))
- Actions: Don't override existing action args ([#15394](https://github.com/storybookjs/storybook/pull/15394))
- Svelte: Fix argType.type.name extraction ([#15332](https://github.com/storybookjs/storybook/pull/15332))
- CSF3: Genericize feature flagging and fix webpack5 ([#15375](https://github.com/storybookjs/storybook/pull/15375))
- Webpack5: Fix warnings typo ([#15374](https://github.com/storybookjs/storybook/pull/15374))
- UI: Fix navigation after no story error ([#15349](https://github.com/storybookjs/storybook/pull/15349))
- CSF3: Rename setup to play ([#15358](https://github.com/storybookjs/storybook/pull/15358))
- Upgrade dotenv-webpack to 7.0.x ([#15343](https://github.com/storybookjs/storybook/pull/15343))

## 6.4.0-alpha.4 (June 28, 2021)

### Bug Fixes

- Actions: Don't override existing action args ([#15394](https://github.com/storybookjs/storybook/pull/15394))

## 6.4.0-alpha.3 (June 26, 2021)

### Bug Fixes

- CSF3: Genericize feature flagging and fix webpack5 ([#15375](https://github.com/storybookjs/storybook/pull/15375))
- Webpack5: Fix warnings typo ([#15374](https://github.com/storybookjs/storybook/pull/15374))

## 6.4.0-alpha.2 (June 25, 2021)

### Bug Fixes

- Core: Only use dotenv-webpack when a user has a dotenv file ([#15365](https://github.com/storybookjs/storybook/pull/15365))

### Maintenance

- CSF3: Rename setup to play ([#15358](https://github.com/storybookjs/storybook/pull/15358))

## 6.4.0-alpha.1 (June 25, 2021)

### Bug Fixes

- Essentials: Update addon measure and outline ([#15354](https://github.com/storybookjs/storybook/pull/15354))
- UI: Fix navigation after no story error ([#15349](https://github.com/storybookjs/storybook/pull/15349))

## 6.4.0-alpha.0 (June 24, 2021)

### Bug Fixes

- Svelte: Fix argType.type.name extraction ([#15332](https://github.com/storybookjs/storybook/pull/15332))

### Dependency Upgrades

- Upgrade dotenv-webpack to 7.0.x ([#15343](https://github.com/storybookjs/storybook/pull/15343))

## 6.3.0 (June 23, 2021)

**[Optimized for UI development](https://github.com/storybookjs/storybook/issues/14397)**

SB6.3 adds new UI development and testing features, while evolving with the JS ecosystem:

- 📐 Layout debugging with Measure and Outline addons
- 🔌 Reuse your stories in unit tests: Jest, Cypress & more
- 🚀 Frameworks: Angular 12 Ivy, Lit2 web components
- 🛠 Builders: Webpack5 stable, Vite community
- 📦 Packaging: Modern ESM

It also contains hundreds more fixes, features, and tweaks. Browse the [changelogs](https://github.com/storybookjs/storybook/blob/next/CHANGELOG.md) matching `6.3.0-alpha.*`, `6.3.0-beta.*`, and `6.3.0-rc.*` for the full list of changes. See [Storybook 6 migration guide](https://storybook.js.org/blog/storybook-6-migration-guide/) to upgrade from `5.x` or [MIGRATION.md](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) for detailed migration instructions.

## 6.3.0-rc.12 (June 23, 2021)

### Features

- CLI: Update types in React typescript templates ([#15292](https://github.com/storybookjs/storybook/pull/15292))

### Maintenance

- Yarn: Disable unnecessary builds ([#15299](https://github.com/storybookjs/storybook/pull/15299))
- Toolbars: Add missing `regenerator-runtime` dependency ([#15312](https://github.com/storybookjs/storybook/pull/15312))

## 6.3.0-rc.11 (June 18, 2021)

### Dependency Upgrades

- Upgrade react-docgen-typescript-plugin per PR#46 ([#15287](https://github.com/storybookjs/storybook/pull/15287))
- Fix peer deps ([#15288](https://github.com/storybookjs/storybook/pull/15288))

## 6.3.0-rc.10 (June 17, 2021)

### Bug Fixes

- Angular: Fix nx project with workspace.json ([#15267](https://github.com/storybookjs/storybook/pull/15267))
- Angular: Fix some Ivy rendering glitches ([#15279](https://github.com/storybookjs/storybook/pull/15279))

## 6.3.0-rc.9 (June 17, 2021)

### Dependency Upgrades

- Bump postcss to 7.0.36 with security fix ([#15276](https://github.com/storybookjs/storybook/pull/15276))
- Fix monorepo peer deps ([#15277](https://github.com/storybookjs/storybook/pull/15277))

## 6.3.0-rc.8 (June 16, 2021)

### Features

- Angular: Add built-in Ivy support instead of relying on addon ([#15229](https://github.com/storybookjs/storybook/pull/15229))

### Bug Fixes

- Addon-docs: Fix MDX compiler export to match new location ([#15266](https://github.com/storybookjs/storybook/pull/15266))
- Addon-viewport: Fix CSS for scale reset on firefox ([#15128](https://github.com/storybookjs/storybook/pull/15128))

## 6.3.0-rc.7 (June 15, 2021)

### Dependency Upgrades

- Upgrade react-docgen-typescript-plugin to RDT 2.0 ([#15247](https://github.com/storybookjs/storybook/pull/15247))

## 6.3.0-rc.6 (June 15, 2021)

### Bug Fixes

- Core: Only call setup function on story navigation ([#15244](https://github.com/storybookjs/storybook/pull/15244))

### Maintenance

- Official-storybook: Add CSF3 setup function demo ([#15245](https://github.com/storybookjs/storybook/pull/15245))

### Dependency Upgrades

- Use @storybook/react-docgen-typescript-plugin canary with PR#45 ([#15243](https://github.com/storybookjs/storybook/pull/15243))

## 6.3.0-rc.5 (June 14, 2021)

### Bug Fixes

- Vue3: Update args without re-mounting component ([#15168](https://github.com/storybookjs/storybook/pull/15168))
- Core: Preserve other query params when changing args/globals ([#15213](https://github.com/storybookjs/storybook/pull/15213))
- UI: Fix range slider value label size changes causing jittering ([#15145](https://github.com/storybookjs/storybook/pull/15145))
- Codemod: Fix dist/node_modules ignore heuristic ([#15222](https://github.com/storybookjs/storybook/pull/15222))
- Core: Fix autoRefs check in manager-webpack ([#15197](https://github.com/storybookjs/storybook/pull/15197))

### Maintenance

- CSF3: Fix v1-style annotations in codemod ([#15230](https://github.com/storybookjs/storybook/pull/15230))
- Core: CSF v3 preview ([#15217](https://github.com/storybookjs/storybook/pull/15217))

## 6.3.0-rc.4 (June 12, 2021)

### Dependency Upgrades

- Vue3: Add vue-loader as a dependency ([#15207](https://github.com/storybookjs/storybook/pull/15207))

## 6.3.0-rc.3 (June 11, 2021)

### Features

- Core: Disable sidebar and don't load refs when `singleStory=true` ([#15201](https://github.com/storybookjs/storybook/pull/15201))

### Bug Fixes

- Angular: Use docsMode to set docs options ([#15194](https://github.com/storybookjs/storybook/pull/15194))

### Maintenance

- Addon-docs: Split out MDX compiler into standalone package ([#15205](https://github.com/storybookjs/storybook/pull/15205))

## 6.3.0-rc.2 (June 10, 2021)

### Features

- Core: Add `shortcuts` URL param to disable keyboard shortcuts ([#15192](https://github.com/storybookjs/storybook/pull/15192))

### Bug Fixes

- Angular: Fix builder runaway process ([#15189](https://github.com/storybookjs/storybook/pull/15189))

## 6.3.0-rc.1 (June 10, 2021)

### Maintenance

- Core: Use named import for @storybook/addons, fixes vite builder ([#15187](https://github.com/storybookjs/storybook/pull/15187))

## 6.3.0-rc.0 (June 9, 2021)

Storybook 6.3 is in RC!! 🎉🎉🎉

Hundreds of improvements and fixes, including:

- **Angular** - Angular12, Ivy, overhauled docs support.
- **Web-components** - Lit2 support.
- **Essentials** - New measure/outline addons for CSS debugging.
- **Addon API** - Keyboard shortcuts for addons. Initial support in viewports, toolbars.
- **Webpack 5** - Official support.
- **Vite builder** - Community support.
- **Modern ESM** - Modern package distribution.

Track the release in the Github: [Storybook 6.3 Release 🛠](https://github.com/storybookjs/storybook/issues/14397)

## 6.3.0-beta.18 (June 9, 2021)

### Features

- Toolbars: Add customizable keyboard navigation shortcuts ([#15169](https://github.com/storybookjs/storybook/pull/15169))

### Bug Fixes

- Controls: Initialize color control on reset ([#15059](https://github.com/storybookjs/storybook/pull/15059))

## 6.3.0-beta.17 (June 8, 2021)

### Bug Fixes

- Measure: Update version to fix hooks issue ([#15167](https://github.com/storybookjs/storybook/pull/15167))

## 6.3.0-beta.16 (June 8, 2021)

### Features

- Angular: Add compodoc to ng builder ([#15165](https://github.com/storybookjs/storybook/pull/15165))

## 6.3.0-beta.15 (June 7, 2021)

### Bug Fixes

- Angular: Clear root / docs-root when navigating from one tab to the other ([#15160](https://github.com/storybookjs/storybook/pull/15160))

## 6.3.0-beta.14 (June 6, 2021)

### Features

- Controls: Style `undefined` range slider different to filled one ([#14973](https://github.com/storybookjs/storybook/pull/14973))

### Dependency Upgrades

- Upgrade to react-docgen-typescript-plugin 1.0.0 ([#15154](https://github.com/storybookjs/storybook/pull/15154))

## 6.3.0-beta.13 (June 6, 2021)

### Maintenance

- CsfFile: Index Meta/Story annotations ([#15152](https://github.com/storybookjs/storybook/pull/15152))
- CLI: Update project template for web-components ([#15149](https://github.com/storybookjs/storybook/pull/15149))
- Build: Fix WC example and e2e tests ([#15146](https://github.com/storybookjs/storybook/pull/15146))

## 6.3.0-beta.12 (June 5, 2021)

### Features

- Essentials: Update measure/outline addons to support ESM and vite builder ([#15144](https://github.com/storybookjs/storybook/pull/15144))

## 6.3.0-beta.11 (June 4, 2021)

### Bug Fixes

- Angular: Fix Ivy rendering to use at most one render promise at a time ([#15139](https://github.com/storybookjs/storybook/pull/15139))
- CSF tools: Refactor test cases ([#15142](https://github.com/storybookjs/storybook/pull/15142))

### Maintenance

- Web Components: Reintegrate `@storybook/lit` into `@storybook/web-components` ([#15042](https://github.com/storybookjs/storybook/pull/15042))

## 6.3.0-beta.10 (June 3, 2021)

### Features

- CLI: Add storybook-addon-angular-ivy to angular install ([#14653](https://github.com/storybookjs/storybook/pull/14653))
- Angular: Ivy rendering for Canvas and Docs ([#15126](https://github.com/storybookjs/storybook/pull/15126))
- Server: Add support for stories written in YAML ([#15049](https://github.com/storybookjs/storybook/pull/15049))

## 6.3.0-beta.9 (June 3, 2021)

### Features

- Essentials: Add measure and outline addons ([#15107](https://github.com/storybookjs/storybook/pull/15107))

## 6.3.0-beta.8 (June 2, 2021)

### Features

- Core: Add `core.disableWebpackDefaults` preset ([#15062](https://github.com/storybookjs/storybook/pull/15062))

### Bug Fixes

- Core: Fix prebuilt manager usage on first run ([#15121](https://github.com/storybookjs/storybook/pull/15121))

## 6.3.0-beta.7 (June 2, 2021)

### Features

- Angular: Add angular builder to start + build storybook ([#15061](https://github.com/storybookjs/storybook/pull/15061))

### Bug Fixes

- CLI: Fix react repro template deps ([#15118](https://github.com/storybookjs/storybook/pull/15118))

## 6.3.0-beta.6 (June 1, 2021)

### Features

- CLI: Add Server template generator ([#13979](https://github.com/storybookjs/storybook/pull/13979))

### Bug Fixes

- CLI: Disable `react_in_yarn_workspace` template for users, keep in e2e ([#15114](https://github.com/storybookjs/storybook/pull/15114))

## 6.3.0-beta.5 (May 30, 2021)

### Bug Fixes

- Vue2: Check types when `typescript.check` is true ([#15089](https://github.com/storybookjs/storybook/pull/15089))
- Update markdown-to-jsx version to fix url links in comments ([#15083](https://github.com/storybookjs/storybook/pull/15083))

### Maintenance

- CLI: Add `SKIP_PREFLIGHT_CHECK` in CRA repro ([#15092](https://github.com/storybookjs/storybook/pull/15092))
- Angular: Disable chromatic for story with dynamic time display ([#15074](https://github.com/storybookjs/storybook/pull/15074))

## 6.3.0-beta.4 (May 28, 2021)

### Bug Fixes

- Addon-docs: Fix MDX source rendering ([#15071](https://github.com/storybookjs/storybook/pull/15071))
- CLI: Add new packages to versions.json ([#15073](https://github.com/storybookjs/storybook/pull/15073))
- Addon-docs: Fix per-story `docs.source` parameter ([#15070](https://github.com/storybookjs/storybook/pull/15070))

## 6.3.0-beta.3 (May 28, 2021)

Failed NPM publish

## 6.3.0-beta.2 (May 27, 2021)

### Features

- Core: Add `globals` URL param and remove from sessionStorage ([#15056](https://github.com/storybookjs/storybook/pull/15056))

### Bug Fixes

- Core: Set `loose: true` in babel/preset-env config ([#15055](https://github.com/storybookjs/storybook/pull/15055))

## 6.3.0-beta.1 (May 26, 2021)

### Bug Fixes

- Core: Fix prebuilt manager ([#15050](https://github.com/storybookjs/storybook/pull/15050))
- Core: Fix storySort `order` with whitespace in story paths ([#15038](https://github.com/storybookjs/storybook/pull/15038))

### Maintenance

- Do not try to named import from global ([#15043](https://github.com/storybookjs/storybook/pull/15043))
- Remove storybook/lit from monorepo ([#15048](https://github.com/storybookjs/storybook/pull/15048))

## 6.3.0-beta.0 (May 26, 2021)

Storybook 6.3 is in beta!! 🎉🎉🎉

Hundreds of improvements and fixes, including:

- **Angular** - Overhauled Angular support.
- **Web-components** - Lit2 support.
- **Webpack 5** - Official support.
- **Vite builder** - Community support.
- **Modern ESM** - Modern package distribution.
- **API** - Keyboard shortcuts for addons.

Track the release in the Github: [Storybook 6.3 Release 🛠](https://github.com/storybookjs/storybook/issues/14397)

## 6.3.0-alpha.45 (May 26, 2021)

### Features

- CLI: Add option to force-build iframe despite custom preview URL ([#15030](https://github.com/storybookjs/storybook/pull/15030))

### Bug Fixes

- Addon-docs: Fix source block tree shaking ([#15035](https://github.com/storybookjs/storybook/pull/15035))
- Addon-a11y: Highlight all elements correctly ([#14935](https://github.com/storybookjs/storybook/pull/14935))

## 6.3.0-alpha.44 (May 25, 2021)

### Features

- Presets: Expand `webpackInstance` to include entire namespace ([#15016](https://github.com/storybookjs/storybook/pull/15016))
- Angular: Add `angularBrowserTarget` option in server ([#14955](https://github.com/storybookjs/storybook/pull/14955))

### Bug Fixes

- Core: Ignore manager cache on config file changes and Storybook upgrade ([#14993](https://github.com/storybookjs/storybook/pull/14993))

## 6.3.0-alpha.43 (May 25, 2021)

### Features

- Web-components: Support lit 2 with back-compat ([#14898](https://github.com/storybookjs/storybook/pull/14898))

### Bug Fixes

- Angular: Use NormalizeOptimization from angular-cli ([#15022](https://github.com/storybookjs/storybook/pull/15022))

### Maintenance

- Build: Fix selectors used in Cypress tests and E2E exit code ([#15021](https://github.com/storybookjs/storybook/pull/15021))

### Dependency Upgrades

- Bump react-docgen-typescript-plugin to 0.7.2-canary.375d65e.0 ([#15024](https://github.com/storybookjs/storybook/pull/15024))

## 6.3.0-alpha.42 (May 24, 2021)

### Dependency Upgrades

- Core: Fix manager builder dependencies for PnP ([#15019](https://github.com/storybookjs/storybook/pull/15019))

## 6.3.0-alpha.41 (May 24, 2021)

### Features

- Addon-docs: Exclude decorators in dynamic source snippets ([#14652](https://github.com/storybookjs/storybook/pull/14652))

## 6.3.0-alpha.40 (May 24, 2021)

Failed NPM publish

## 6.3.0-alpha.39 (May 23, 2021)

Fix stale dependencies appended to [#15001](https://github.com/storybookjs/storybook/pull/15001)

## 6.3.0-alpha.38 (May 23, 2021)

Minor manager webapck5 fixes appended to [#15001](https://github.com/storybookjs/storybook/pull/15001)

## 6.3.0-alpha.37 (May 23, 2021)

### Features

- Core: Support manager build with webpack5 ([#15001](https://github.com/storybookjs/storybook/pull/15001))

### Bug Fixes

- Core: Fix opt-in stories.json generation ([#15003](https://github.com/storybookjs/storybook/pull/15003))

### Maintenance

- Maintenance: Build ESM in watch mode, revert modern ([#15015](https://github.com/storybookjs/storybook/pull/15015))

### Dependency Upgrades

- Storyshots-puppeteer: Remove the usage of GPL-licensed `@wordpress/jest-puppeteer-axe` package ([#15006](https://github.com/storybookjs/storybook/pull/15006))

## 6.3.0-alpha.36 (May 20, 2021)

### Features

- CLI: Add sb link --local option ([#14950](https://github.com/storybookjs/storybook/pull/14950))
- Controls: Add automatic ids to all controls ([#14296](https://github.com/storybookjs/storybook/pull/14296))

### Maintenance

- Build: Improve e2e script ([#14980](https://github.com/storybookjs/storybook/pull/14980))

### Dependency Upgrades

- React: Upgrade to @storybook/react-docgen-typescript-plugin ([#14991](https://github.com/storybookjs/storybook/pull/14991))

## 6.3.0-alpha.35 (May 20, 2021)

### Maintenance

- Core: Feature flag for builtin stories.json support ([#14992](https://github.com/storybookjs/storybook/pull/14992))

### Dependency Upgrades

- React: Upgrade to @storybook/react-docgen-typescript-plugin ([#14991](https://github.com/storybookjs/storybook/pull/14991))

## 6.3.0-alpha.34 (May 19, 2021)

### Features

- Core: Single story option in iframe view ([#14875](https://github.com/storybookjs/storybook/pull/14875))
- Lit: Add typings for @storybook/lit ([#14962](https://github.com/storybookjs/storybook/pull/14962))

### Dependency Upgrades

- Bump telejson to 5.3.2 to use the ESM version ([#14983](https://github.com/storybookjs/storybook/pull/14983))
- CSF: Add undeclared dependency `regenerator-runtime` ([#14979](https://github.com/storybookjs/storybook/pull/14979))

## 6.3.0-alpha.33 (May 18, 2021)

### Bug Fixes

- Controls: Fix controls without options and add warning ([#14976](https://github.com/storybookjs/storybook/pull/14976))
- Core: Add remaining sbmodern exports ([#14977](https://github.com/storybookjs/storybook/pull/14977))

## 6.3.0-alpha.32 (May 18, 2021)

Failed NPM publish

## 6.3.0-alpha.31 (May 18, 2021)

### Features

- Angular: Pass bootstrapOptions to angular ([#14852](https://github.com/storybookjs/storybook/pull/14852))
- Controls: Update all controls to have explicit handling for `undefined` ([#14899](https://github.com/storybookjs/storybook/pull/14899))
- Core: Add args enhancers + use in addon-actions ([#14901](https://github.com/storybookjs/storybook/pull/14901))
- Addon-docs: Remove all defaultValue eval-ing ([#14900](https://github.com/storybookjs/storybook/pull/14900))

## 6.3.0-alpha.30 (May 18, 2021)

### Features

- Core: Built-in static `stories.json` support ([#14945](https://github.com/storybookjs/storybook/pull/14945))

### Maintenance

- Core: Add modern build target to apps aka frameworks ([#14967](https://github.com/storybookjs/storybook/pull/14967))
- Build: Increase CI `build` step to XL ([#14970](https://github.com/storybookjs/storybook/pull/14970))

## 6.3.0-alpha.29 (May 17, 2021)

### Features

- UI: Provide option to hide default toolbar tools ([#14897](https://github.com/storybookjs/storybook/pull/14897))
- Core: Support modern browser target ([#14954](https://github.com/storybookjs/storybook/pull/14954))

### Maintenance

- Core: Remove updateGlobals warning message ([#14949](https://github.com/storybookjs/storybook/pull/14949))
- Controls: Tighten color control inference heuristic and test ([#14684](https://github.com/storybookjs/storybook/pull/14684))

## 6.3.0-alpha.28 (May 15, 2021)

### Bug Fixes

- CLI: Keep Webpack 4 builder for Angular lower than 12 ([#14942](https://github.com/storybookjs/storybook/pull/14942))

## 6.3.0-alpha.27 (May 14, 2021)

### Features

- CLI: Add Angular 12 + docs inline rendering support ([#14928](https://github.com/storybookjs/storybook/pull/14928))

## 6.3.0-alpha.26 (May 14, 2021)

### Bug Fixes

- Addon-controls: Fix duplicate color swatch id's in Color control ([#14925](https://github.com/storybookjs/storybook/pull/14925))

### Maintenance

- CLI: Add preamble instructions to `sb repro` ([#14924](https://github.com/storybookjs/storybook/pull/14924))
- Webpack5: Always set `resolve.fallback.crypto` to `false` ([#14914](https://github.com/storybookjs/storybook/pull/14914))
- Build: Add missing dependencies ([#14919](https://github.com/storybookjs/storybook/pull/14919))
- Build: Put E2E tests back on track ([#14917](https://github.com/storybookjs/storybook/pull/14917))

### Dependency Upgrades

- Addon-storyshots: Make @storybook/react dependency optional ([#14891](https://github.com/storybookjs/storybook/pull/14891))

## 6.3.0-alpha.25 (May 13, 2021)

### Maintenance

- Builder-Webpack5: Use native features instead of plugins ([#14281](https://github.com/storybookjs/storybook/pull/14281))
- CLI: Repro refinements per feedback ([#14888](https://github.com/storybookjs/storybook/pull/14888))

## 6.3.0-alpha.24 (May 11, 2021)

### Features

- CLI: Add repro/link commands for creating/running reproductions ([#14594](https://github.com/storybookjs/storybook/pull/14594))

### Bug Fixes

- UI: Only show addons in mobile if docsOnly is false ([#14810](https://github.com/storybookjs/storybook/pull/14810))

## 6.3.0-alpha.23 (May 11, 2021)

### Bug Fixes

- UI: Fix tab display when there is only one tab ([#14790](https://github.com/storybookjs/storybook/pull/14790))
- Addon-actions: Display DOM Event/CustomEvent data ([#14879](https://github.com/storybookjs/storybook/pull/14879))

### Dependency Upgrades

- Build: Remove outdated `@types/cpy` dependency ([#14880](https://github.com/storybookjs/storybook/pull/14880))

## 6.3.0-alpha.22 (May 10, 2021)

### Features

- Lit: Initial lit2 support ([#14600](https://github.com/storybookjs/storybook/pull/14600))
- React: Add ComponentStory convenience type ([#14780](https://github.com/storybookjs/storybook/pull/14780))

### Maintenance

- Extract addon-knobs from monorepo ([#14874](https://github.com/storybookjs/storybook/pull/14874))
- Extract addon-graphql from monorepo ([#14862](https://github.com/storybookjs/storybook/pull/14862))
- Extract design-assets from monorepo ([#14854](https://github.com/storybookjs/storybook/pull/14854))
- Fix renovate config ([#14868](https://github.com/storybookjs/storybook/pull/14868))
- Extract addon-events from monorepo ([#14855](https://github.com/storybookjs/storybook/pull/14855))
- Extract addon-cssresources from monorepo ([#14860](https://github.com/storybookjs/storybook/pull/14860))
- Extract addon-queryparams from monorepo ([#14861](https://github.com/storybookjs/storybook/pull/14861))
- CLI: Use arg-parser defaults ([#14857](https://github.com/storybookjs/storybook/pull/14857))
- Build: Remove MDX to make chromatic/IE pass in CI ([#14863](https://github.com/storybookjs/storybook/pull/14863))

## 6.3.0-alpha.21 (May 7, 2021)

### Maintenance

- Addon-docs: Fix doc blocks imports to import from ESM/CJS ([#14841](https://github.com/storybookjs/storybook/pull/14841))
- Refactor aurelia into its own repo ([#14801](https://github.com/storybookjs/storybook/pull/14801))
- Delete unmaintained dev-kits ([#14832](https://github.com/storybookjs/storybook/pull/14832))

### Dependency Upgrades

- Storyshots: Make `vue-jest` and `svelte` optional peer dependencies ([#14835](https://github.com/storybookjs/storybook/pull/14835))

## 6.3.0-alpha.20 (May 6, 2021)

### Bug Fixes

- Vue3: Fix components in decorators ([#14809](https://github.com/storybookjs/storybook/pull/14809))
- Accessibility: Adds title to close button on settings page ([#14808](https://github.com/storybookjs/storybook/pull/14808))

### Maintenance

- Refactor marionette into its own repo ([#14802](https://github.com/storybookjs/storybook/pull/14802))
- Refactor rax to its own repo ([#14799](https://github.com/storybookjs/storybook/pull/14799))
- Refactor marko into its own repo ([#14803](https://github.com/storybookjs/storybook/pull/14803))
- Refactor mithril into its own repo ([#14804](https://github.com/storybookjs/storybook/pull/14804))
- Refactor riot to its own repo ([#14800](https://github.com/storybookjs/storybook/pull/14800))
- UI: Styling updates ([#14820](https://github.com/storybookjs/storybook/pull/14820))

## 6.3.0-alpha.19 (May 3, 2021)

### Features

- Addon-toolbars: Add optional label for toolbar items ([#14776](https://github.com/storybookjs/storybook/pull/14776))

### Maintenance

- Core: Remove spurious package.json warning ([#14785](https://github.com/storybookjs/storybook/pull/14785))

## 6.3.0-alpha.18 (May 2, 2021)

### Features

- Angular: Filter out args whose argType are missing a control or action ([#14779](https://github.com/storybookjs/storybook/pull/14779))

### Maintenance

- Addon-docs: Allow doc blocks to CJS imported ([#14769](https://github.com/storybookjs/storybook/pull/14769))

## 6.3.0-alpha.17 (April 30, 2021)

### Features

- Core: Add option to include story names when sorting ([#12520](https://github.com/storybookjs/storybook/pull/12520))
- Addon-actions: Add 'New Action' indicator ([#14728](https://github.com/storybookjs/storybook/pull/14728))
- Addon-docs: Add parameter to show code by default ([#14729](https://github.com/storybookjs/storybook/pull/14729))

### Bug Fixes

- Addon-docs: Add classnames for Preview block ([#14685](https://github.com/storybookjs/storybook/pull/14685))
- UI: Fix toolbar text using theme color ([#14308](https://github.com/storybookjs/storybook/pull/14308))

### Maintenance

- Core: Protect core metadata from decorators ([#13512](https://github.com/storybookjs/storybook/pull/13512))
- Addon-a11y: Reorder color blindness types by most common ([#14768](https://github.com/storybookjs/storybook/pull/14768))

## 6.3.0-alpha.16 (April 29, 2021)

### Bug Fixes

- Core: Fix `features`, `core`, `logLevel` in main.js config types ([#14745](https://github.com/storybookjs/storybook/pull/14745))
- Angular: Fix windows path for tsconfig ([#14747](https://github.com/storybookjs/storybook/pull/14747))

### Maintenance

- Build: Change nx cloud access token to read-only token ([#14744](https://github.com/storybookjs/storybook/pull/14744))

### Dependency Upgrades

- Addon-a11y/Storyshots: Upgrade axe-core to 4.2.0 and related dependencies ([#14749](https://github.com/storybookjs/storybook/pull/14749))

## 6.3.0-alpha.15 (April 28, 2021)

### Features

- Storyshots: Add `beforeAxeTest` hook ([#14563](https://github.com/storybookjs/storybook/pull/14563))
- API: Add addon keyboard shortcuts & create shortcuts for addon-viewport ([#14658](https://github.com/storybookjs/storybook/pull/14658))

### Bug Fixes

- Storyshots/Preact: Add pragma @jsxRuntime classic ([#13849](https://github.com/storybookjs/storybook/pull/13849))
- Core: Don't recreate a bound story function each time we call a decorated story ([#14692](https://github.com/storybookjs/storybook/pull/14692))

### Maintenance

- Build: Add NX bootstrap optimization ([#14535](https://github.com/storybookjs/storybook/pull/14535))

## 6.2.9 (April 23, 2021)

### Bug Fixes

- Angular: set the @ViewChild with a non-empty value in StorybookWrapperComponent ([#14586](https://github.com/storybookjs/storybook/pull/14586))
- Addon-docs: Fix ArgsTable sorting when using of={Component} ([#14669](https://github.com/storybookjs/storybook/pull/14669))
- Server: Fix string escaping in CSF compiler ([#14615](https://github.com/storybookjs/storybook/pull/14615))

### Maintenance

- Examples: Move from placehold.it to place-hold.it for mock images ([#14637](https://github.com/storybookjs/storybook/pull/14637))

## 6.3.0-alpha.14 (April 23, 2021)

### Bug Fixes

- Core: Fix URL handling in Firefox ([#14556](https://github.com/storybookjs/storybook/pull/14556))
- Build: Create webpack stats target directory if needed and accept boolean flag ([#14690](https://github.com/storybookjs/storybook/pull/14690))

### Maintenance

- Docs: Remove `babel-loader` and `@babel/core` peer deps ([#14689](https://github.com/storybookjs/storybook/pull/14689))
- Use Storybook's built-in accessibility icon for VisionDeficiency tab. ([#14681](https://github.com/storybookjs/storybook/pull/14681))

## 6.3.0-alpha.13 (April 21, 2021)

### Bug Fixes

- Addon-docs: Fix ArgsTable sorting when using of={Component} ([#14669](https://github.com/storybookjs/storybook/pull/14669))

### Maintenance

- CLI: Rename preact template files to JSX ([#14670](https://github.com/storybookjs/storybook/pull/14670))

## 6.3.0-alpha.12 (April 20, 2021)

### Maintenance

- Angular: Refactor angular server ([#14358](https://github.com/storybookjs/storybook/pull/14358))
- CLI: Rename react template files to jsx ([#14650](https://github.com/storybookjs/storybook/pull/14650))

## 6.3.0-alpha.11 (April 19, 2021)

### Features

- CLI: Support community builders in `sb init` ([#14651](https://github.com/storybookjs/storybook/pull/14651))
- Angular: Support Ivy addon ([#14649](https://github.com/storybookjs/storybook/pull/14649))

### Maintenance

- Add `funding` to manifests ([#14647](https://github.com/storybookjs/storybook/pull/14647))

## 6.3.0-alpha.10 (April 18, 2021)

### Bug Fixes

- Modified Swatches keys to avoid duplicates ([#14636](https://github.com/storybookjs/storybook/pull/14636))

### Maintenance

- ESM tweaks for vite builder ([#14641](https://github.com/storybookjs/storybook/pull/14641))
- Examples: Move from placehold.it to place-hold.it for mock images ([#14637](https://github.com/storybookjs/storybook/pull/14637))

## 6.3.0-alpha.9 (April 17, 2021)

### Features

- Preact: Add react compat by default ([#14555](https://github.com/storybookjs/storybook/pull/14555))

### Bug Fixes

- Addon-docs: Fix MD code snippet format inside Description ([#14495](https://github.com/storybookjs/storybook/pull/14495))
- Server: Fix string escaping in CSF compiler ([#14615](https://github.com/storybookjs/storybook/pull/14615))

### Maintenance

- Maintenance: Improve issue templates ([#14543](https://github.com/storybookjs/storybook/pull/14543))

## 6.3.0-alpha.8 (April 15, 2021)

### Features

- Angular: Create actions for Outputs by default ([#14299](https://github.com/storybookjs/storybook/pull/14299))

### Bug Fixes

- Addon-a11y: Fix crypto in webpack5 ([#14592](https://github.com/storybookjs/storybook/pull/14592))
- Storyshots: Preserve authentication information in Storybook URL ([#14582](https://github.com/storybookjs/storybook/pull/14582))

### Maintenance

- Angular: Add template MDX example ([#14597](https://github.com/storybookjs/storybook/pull/14597))

### Dependency Upgrades

- Remove unused inquirer dependency ([#14590](https://github.com/storybookjs/storybook/pull/14590))

## 6.2.8 (April 14, 2021)

### Bug Fixes

- CLI: Properly detect vuetify3 ([#14552](https://github.com/storybookjs/storybook/pull/14552))
- Core: Fix build config inconsistency ([#14566](https://github.com/storybookjs/storybook/pull/14566))

## 6.3.0-alpha.7 (April 14, 2021)

### Features

- Angular: Improve story rendering mode ([#14226](https://github.com/storybookjs/storybook/pull/14226))

### Bug Fixes

- Angular: set the @ViewChild with a non-empty value in StorybookWrapperComponent ([#14586](https://github.com/storybookjs/storybook/pull/14586))

### Maintenance

- CI: Remove Travis, fix TeamCity, rework E2E on CircleCI ([#14522](https://github.com/storybookjs/storybook/pull/14522))
- Core: Resolve builders relatively to config file ([#14576](https://github.com/storybookjs/storybook/pull/14576))

## 6.3.0-alpha.6 (April 13, 2021)

### Bug Fixes

- Core: Fix build config inconsistency ([#14566](https://github.com/storybookjs/storybook/pull/14566))
- CLI: Fix vuetify3 detection ([#14552](https://github.com/storybookjs/storybook/pull/14552))

### Maintenance

- Build: Disable yarn immutable install by default during E2E tests ([#14568](https://github.com/storybookjs/storybook/pull/14568))
- Build: Fix `dev:babel` and `dev:tsc` NPM scripts ([#14560](https://github.com/storybookjs/storybook/pull/14560))

### Dependency Upgrades

- Bump vue-docgen-api to 4.38.0 ([#14567](https://github.com/storybookjs/storybook/pull/14567))
- Upgrade react-colorful to latest ([#14553](https://github.com/storybookjs/storybook/pull/14553))

## 6.3.0-alpha.5 (April 11, 2021)

### Features

- Core: Enable community builders ([#14545](https://github.com/storybookjs/storybook/pull/14545))

## 6.3.0-alpha.4 (April 10, 2021)

### Features

- Core: Expose Server instance through the pluggable Builder API ([#14468](https://github.com/storybookjs/storybook/pull/14468))

### Maintenance

- Core: Don't shadow the window global variable ([#14472](https://github.com/storybookjs/storybook/pull/14472))

## 6.3.0-alpha.3 (April 10, 2021)

### Features

- UI: Support `*` wildcard option in storySort order array ([#14531](https://github.com/storybookjs/storybook/pull/14531))

### Bug Fixes

- UI: Add show toolbar T in menu ([#14437](https://github.com/storybookjs/storybook/pull/14437))

### Maintenance

- Refactor: Replace `lodash/range` with `Array.from` ([#14323](https://github.com/storybookjs/storybook/pull/14323))
- Maintenance: Add TypeScript plugin for Yarn ([#14534](https://github.com/storybookjs/storybook/pull/14534))

## 6.2.7 (April 9, 2021)

### Bug Fixes

- CLI: Fix prerelease upgrade ([#14529](https://github.com/storybookjs/storybook/pull/14529))

## 6.3.0-alpha.2 (April 9, 2021)

### Features

- Web-components: Add full reload listening to server-side-events ([#14445](https://github.com/storybookjs/storybook/pull/14445))
- Core: Pass watchOptions from webpack config to webpackDevMiddleware ([#14461](https://github.com/storybookjs/storybook/pull/14461))

### Bug Fixes

- CLI: Fix prerelease upgrade ([#14529](https://github.com/storybookjs/storybook/pull/14529))

## 6.2.6 (April 9, 2021)

### Bug Fixes

- Core: Allow string in object arg and support fractional numbers in URL args ([#14511](https://github.com/storybookjs/storybook/pull/14511))
- UI: Skip duplicate storyId breaking sidebar ([#14502](https://github.com/storybookjs/storybook/pull/14502))

## 6.3.0-alpha.1 (April 9, 2021)

### Features

- Core: Enable gzip compression on the development server ([#14459](https://github.com/storybookjs/storybook/pull/14459))

### Bug Fixes

- Preact: Fix hooks when used in stories, preact-kitchen-sink ([#14473](https://github.com/storybookjs/storybook/pull/14473))
- Angular: Fix handling of line breaks with multiple selectors ([#14313](https://github.com/storybookjs/storybook/pull/14313))

## 6.3.0-alpha.0 (April 8, 2021)

### Maintenance

- Build: Move monorepo to Yarn 2 ([#13907](https://github.com/storybookjs/storybook/pull/13907))

## 6.2.5 (April 7, 2021)

### Bug Fixes

- Core: Don't include args param in docs mode URL ([#14494](https://github.com/storybookjs/storybook/pull/14494))
- Core: Restore previewHead/Body presets ([#14500](https://github.com/storybookjs/storybook/pull/14500))
- Controls: Reset ArgsTable state when switching stories ([#14493](https://github.com/storybookjs/storybook/pull/14493))

### Dependency Upgrades

- Revert "Upgrade `dotenv-webpack` to v6" ([#14501](https://github.com/storybookjs/storybook/pull/14501))

## 6.2.4 (April 7, 2021)

### Dependency Upgrades

- Upgrade `dotenv-webpack` to v6 ([#14492](https://github.com/storybookjs/storybook/pull/14492))

## 6.2.3 (April 5, 2021)

### Bug Fixes

- Core: Fix file-loader options for ESM compat ([#14480](https://github.com/storybookjs/storybook/pull/14480))
- Core: Fix config.js-based configuration ([#14479](https://github.com/storybookjs/storybook/pull/14479))

### Maintenance

- Core: Disable postcss warning, add main.js `features` setting ([#14478](https://github.com/storybookjs/storybook/pull/14478))

## 6.2.2 (April 2, 2021)

### Bug Fixes

- Core: Fix symlinks in static dir when building static Storybook ([#14448](https://github.com/storybookjs/storybook/pull/14448))
- Addon-docs/ArgsTable: Use storySort parameter ([#14422](https://github.com/storybookjs/storybook/pull/14422))
- Revert "Svelte - Fix async loaders and docs" Fix #14443 ([#14444](https://github.com/storybookjs/storybook/pull/14444))
- Addon-docs/Angular: Keep inlineStories to false by default ([#14447](https://github.com/storybookjs/storybook/pull/14447))

### Maintenance

- CLI: Fix link to `sb init` docs ([#14421](https://github.com/storybookjs/storybook/pull/14421))

## 6.2.1 (March 30, 2021)

Fix bad version update message from [#12183](https://github.com/storybookjs/storybook/issues/12183)

## 6.2.0 (March 30, 2021)

**[Storybook 6.2](https://github.com/storybookjs/storybook/issues/13160) future-proof component development**

Storybook 6.2 includes major improvements for new frameworks, package managers, and bundlers.

🚀 Frameworks: Vue 3, Svelte Native CSF
📦 Packaging: NPM 7, Yarn 2, ESM
🛠 Bundlers: Webpack 5 (experimental), pluggable bundlers to enable Vite, ESBuild, Snowpack, & more.

It also includes an overhaul of Storybook’s auto-generated controls and hundreds more fixes, features, and tweaks.

Browse the [changelogs](https://github.com/storybookjs/storybook/blob/next/CHANGELOG.md) matching `6.2.0-alpha.*`, `6.2.0-beta.*`, and `6.2.0-rc.*` for the full list of changes. See [Storybook 6 migration guide](https://storybook.js.org/blog/storybook-6-migration-guide/) to upgrade from `5.x` or [MIGRATION.md](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) for detailed migration instructions.

## 6.2.0-rc.13 (March 30, 2021)

### Bug Fixes

- Controls: QA fixes for Object and Color controls ([#14392](https://github.com/storybookjs/storybook/pull/14392))

## 6.2.0-rc.12 (March 30, 2021)

### Bug Fixes

- Controls: Fix defaultValue without PropType ([#14387](https://github.com/storybookjs/storybook/pull/14387))
- CLI: Compatibility with sveltekit ([#14384](https://github.com/storybookjs/storybook/pull/14384))
- Controls: Color picker QA fixes ([#14382](https://github.com/storybookjs/storybook/pull/14382))
- Svelte: Fix Cannot read property '\_\_docgen' of undefined ([#14383](https://github.com/storybookjs/storybook/pull/14383))

### Maintenance

- Core: Make Storybook esbuild-compatible ([#14380](https://github.com/storybookjs/storybook/pull/14380))

## 6.2.0-rc.11 (March 29, 2021)

### Features

- CLI: Use Svelte-native CSF during initialization ([#14363](https://github.com/storybookjs/storybook/pull/14363))

### Bug Fixes

- Addon-actions: Fix addArgs warnings by refactor ([#14372](https://github.com/storybookjs/storybook/pull/14372))
- Webpack: Fix HMR by removing concatenateModules optimization ([#14373](https://github.com/storybookjs/storybook/pull/14373))
- Fix issue with string unions/enums ([#14370](https://github.com/storybookjs/storybook/pull/14370))
- Components: Deprecate html components entry point ([#14369](https://github.com/storybookjs/storybook/pull/14369))

## 6.2.0-rc.10 (March 26, 2021)

**NOTE:** For Angular users using inline story rendering in addon-docs, this is a breaking prerelease change. See below and apologies for the back and forth. Last time we hope!

### Bug Fixes

- Addon-docs: Fix un-prefixed path links ([#14334](https://github.com/storybookjs/storybook/pull/14334))
- UI: Add aria-labels to buttons without discernible text ([#14338](https://github.com/storybookjs/storybook/pull/14338))

### Maintenance

- Angular: Improve docs inline rendering setup ([#14333](https://github.com/storybookjs/storybook/pull/14333))

## 6.2.0-rc.9 (March 25, 2021)

### Features

- Core: Support some special values in URL args ([#14293](https://github.com/storybookjs/storybook/pull/14293))

### Bug Fixes

- Core: Fix `enum` args parsing from URL ([#14314](https://github.com/storybookjs/storybook/pull/14314))
- Controls: Tweaks and fixes for color control ([#14316](https://github.com/storybookjs/storybook/pull/14316))
- Components: Handle `null` when parsing input in color picker ([#14305](https://github.com/storybookjs/storybook/pull/14305))

## 6.2.0-rc.8 (March 23, 2021)

**NOTE:** For Angular users using inline story rendering in addon-docs, this is a breaking prerelease change. See below and apologies for the back and forth.

### Bug Fixes

- Revert "Addon-docs/Angular: Fix inline rendering setup" ([#14310](https://github.com/storybookjs/storybook/pull/14310))
- Core: Import `isPlainObject` directly from lodash ([#14307](https://github.com/storybookjs/storybook/pull/14307))
- Addon-Links: Fix react.d.ts paths ([#14306](https://github.com/storybookjs/storybook/pull/14306))

## 6.2.0-rc.7 (March 23, 2021)

### Bug Fixes

- Core: Restore webpack4 watchOptions ([#14302](https://github.com/storybookjs/storybook/pull/14302))
- Webpack: Hash files only in dev mode ([#14284](https://github.com/storybookjs/storybook/pull/14284))
- UI: Element em should not make text content bold ([#14290](https://github.com/storybookjs/storybook/pull/14290))

### Dependency Upgrades

- Webpack5: Remove deprecated webpack-filter-warnings-plugin ([#14303](https://github.com/storybookjs/storybook/pull/14303))

## 6.2.0-rc.6 (March 21, 2021)

### Bug Fixes

- Revert "Webpack: Hash files only in production mode" ([#14283](https://github.com/storybookjs/storybook/pull/14283))

## 6.2.0-rc.5 (March 20, 2021)

### Bug Fixes

- Webpack: Hash files only in production mode ([#14264](https://github.com/storybookjs/storybook/pull/14264))
- Angular: Allow usage of all component valid selectors ([#14230](https://github.com/storybookjs/storybook/pull/14230))

### Maintenance

- Addon-controls: Improve color picker UI and migrate to react-colorful ([#14249](https://github.com/storybookjs/storybook/pull/14249))

## 6.2.0-rc.4 (March 19, 2021)

### Bug Fixes

- Webpack: Fix missing `module` mainField ([#14271](https://github.com/storybookjs/storybook/pull/14271))

## 6.2.0-rc.3 (March 18, 2021)

**NOTE:** For Angular users using inline story rendering in addon-docs, this is a breaking prerelease change. See below.

### Bug Fixes

- Addon-docs/Angular: Fix inline rendering setup ([#14270](https://github.com/storybookjs/storybook/pull/14270))
- Addon-docs: Fix table dark mode ([#14251](https://github.com/storybookjs/storybook/pull/14251))
- Webpack5: Replace fullhash with contenthash ([#14261](https://github.com/storybookjs/storybook/pull/14261))

### Maintenance

- CLI: Don't allow root directory as static dir ([#14068](https://github.com/storybookjs/storybook/pull/14068))
- WebComponents: Fix types and improve CLI detection ([#14258](https://github.com/storybookjs/storybook/pull/14258))

## 6.2.0-rc.2 (March 17, 2021)

### Bug Fixes

- Addon-docs/Vue,Vue3: Fix preset options for vue-docgen-api ([#14227](https://github.com/storybookjs/storybook/pull/14227))
- Webpack5: Fix hash => fullhash ([#14255](https://github.com/storybookjs/storybook/pull/14255))

### Maintenance

- Core: Check webpack version ([#14256](https://github.com/storybookjs/storybook/pull/14256))

## 6.2.0-rc.1 (March 16, 2021)

### Features

- CLI: Improve init for svelte ([#14161](https://github.com/storybookjs/storybook/pull/14161))

## 6.2.0-rc.0 (March 15, 2021)

### Features

- Svelte: Improve default webpack config ([#14235](https://github.com/storybookjs/storybook/pull/14235))

## 6.2.0-beta.15 (March 15, 2021)

### Features

- Controls: Add ArgsTable sorting ([#13125](https://github.com/storybookjs/storybook/pull/13125))

### Bug Fixes

- Addon-docs: Fix source block error on dynamically-generated stories ([#14217](https://github.com/storybookjs/storybook/pull/14217))

### Dependency Upgrades

- [Security] Bump react-dev-utils from 11.0.3 to 11.0.4 ([#14210](https://github.com/storybookjs/storybook/pull/14210))

## 6.2.0-beta.14 (March 11, 2021)

### Bug Fixes

- Addon-docs/Vue: Fix string docgen ([#14200](https://github.com/storybookjs/storybook/pull/14200))
- Controls: Fix width of Select control ([#14154](https://github.com/storybookjs/storybook/pull/14154))
- Source-loader: Revert sourcemaps ([#14199](https://github.com/storybookjs/storybook/pull/14199))
- Core: Fix webpack stats ([#14198](https://github.com/storybookjs/storybook/pull/14198))

## 6.2.0-beta.13 (March 11, 2021)

### Features

- CLI: Add a `--webpack-stats-json` flag ([#14186](https://github.com/storybookjs/storybook/pull/14186))

### Bug Fixes

- Core: Fix standalone and add tests ([#14196](https://github.com/storybookjs/storybook/pull/14196))
- Core: Fix dotenv file loading and add `env` to main.js ([#14191](https://github.com/storybookjs/storybook/pull/14191))
- Core: Fix main.ts/preview.ts ([#14184](https://github.com/storybookjs/storybook/pull/14184))

## 6.2.0-beta.12 (March 10, 2021)

### Features

- Core: Hoist 'control.options', validate them in core and introduce 'control.labels' ([#14169](https://github.com/storybookjs/storybook/pull/14169))

### Bug Fixes

- UI: Fix React unique key warning when using renderLabel ([#14172](https://github.com/storybookjs/storybook/pull/14172))

### Maintenance

- Controls: Remove auto inference and add to CLI template ([#14182](https://github.com/storybookjs/storybook/pull/14182))

## 6.2.0-beta.11 (March 9, 2021)

### Bug Fixes

- React: Fix fast refresh socket connection error ([#14165](https://github.com/storybookjs/storybook/pull/14165))

### Dependency Upgrades

- Update sveltedoc-parser to 4.1.0 ([#14164](https://github.com/storybookjs/storybook/pull/14164))

## 6.2.0-beta.10 (March 5, 2021)

### Bug Fixes

- Angular: Keep story templates with an empty value ([#14113](https://github.com/storybookjs/storybook/pull/14113))
- Core: Fix standalone API ... again ([#14140](https://github.com/storybookjs/storybook/pull/14140))

## 6.2.0-beta.9 (March 4, 2021)

### Bug Fixes

- Core: Fix standalone API ([#14122](https://github.com/storybookjs/storybook/pull/14122))
- Core: Fix main.ts/preview.ts handling ([#14123](https://github.com/storybookjs/storybook/pull/14123))

## 6.2.0-beta.8 (March 4, 2021)

### Features

- Core: Add 'mapping' to support complex arg values ([#14100](https://github.com/storybookjs/storybook/pull/14100))

## 6.2.0-beta.7 (March 4, 2021)

Failed publish

## 6.1.21 (March 3, 2021)

### Bug Fixes

- IE11: Transpile prettier down to ES5 ([#14047](https://github.com/storybookjs/storybook/pull/14047))
- CLI: Add `--legacy-peer-deps` for NPM7 install ([#14106](https://github.com/storybookjs/storybook/pull/14106))
- SyntaxHighlighter: Safely access clipboard on global.navigator ([#14035](https://github.com/storybookjs/storybook/pull/14035))

## 6.2.0-beta.6 (March 3, 2021)

### Features

- Svelte: Fix async loaders in docs panel ([#14080](https://github.com/storybookjs/storybook/pull/14080))

### Bug Fixes

- CLI: Add `--legacy-peer-deps` for NPM7 install ([#14106](https://github.com/storybookjs/storybook/pull/14106))

### Dependency Upgrades

- [Security] Bump pug from 3.0.0 to 3.0.1 ([#14104](https://github.com/storybookjs/storybook/pull/14104))
- [Security] Bump pug-code-gen from 3.0.1 to 3.0.2 ([#14105](https://github.com/storybookjs/storybook/pull/14105))

## 6.2.0-beta.5 (March 1, 2021)

### Features

- Core: Add `renderLabel` to customize sidebar tree labels ([#13121](https://github.com/storybookjs/storybook/pull/13121))

### Maintenance

- Core: Namespace sidebar config options ([#14067](https://github.com/storybookjs/storybook/pull/14067))

### Dependency Upgrades

- Move back to the original react-sizeme package ([#14069](https://github.com/storybookjs/storybook/pull/14069))

## 6.2.0-beta.4 (February 26, 2021)

### Features

- UI: Enable search for stories and fix `/` event listener ([#14062](https://github.com/storybookjs/storybook/pull/14062))
- UI: Add collapse roots to sidebar navigation ([#13685](https://github.com/storybookjs/storybook/pull/13685))

### Bug Fixes

- Core: Support null and undefined in URL args ([#14049](https://github.com/storybookjs/storybook/pull/14049))
- IE11: Transpile prettier down to ES5 ([#14047](https://github.com/storybookjs/storybook/pull/14047))
- UI: Fix shortcut button focus border to support high contrast ([#13699](https://github.com/storybookjs/storybook/pull/13699))

### Maintenance

- Fix flaky color rendering ([#14054](https://github.com/storybookjs/storybook/pull/14054))

## 6.2.0-beta.3 (February 25, 2021)

### Features

- CLI: Add builder option ([#14041](https://github.com/storybookjs/storybook/pull/14041))
- CLI/Vue 2: install vue-loader upon init of vue 2 storybook ([#14018](https://github.com/storybookjs/storybook/pull/14018))

### Bug Fixes

- SyntaxHighlighter: Safely access clipboard on global.navigator ([#14035](https://github.com/storybookjs/storybook/pull/14035))

## 6.2.0-beta.2 (February 24, 2021)

### Features

- Addon-controls: Add JSON tree editor for Object/Array Type args ([#12824](https://github.com/storybookjs/storybook/pull/12824))

### Bug Fixes

- CLI: Fix opening localhost in browser by default ([#14032](https://github.com/storybookjs/storybook/pull/14032))
- Addon-Docs: Do not create extra Vue instance for Dynamic source rendering ([#14002](https://github.com/storybookjs/storybook/pull/14002))

## 6.1.20 (February 24, 2021)

- Deps: upgrade react-dev-utils to get newer immer ([#14015](https://github.com/storybookjs/storybook/pull/14015))

## 6.2.0-beta.1 (February 23, 2021)

### Bug Fixes

- Core: Refactor ProgressPlugin handling ([#14016](https://github.com/storybookjs/storybook/pull/14016))

### Dependency Upgrades

- Deps: upgrade react-dev-utils to get newer immer ([#14015](https://github.com/storybookjs/storybook/pull/14015))

## 6.1.19 (February 23, 2021)

### Bug Fixes

- Components: Add missing `regenerator-runtime` dependency ([#13991](https://github.com/storybookjs/storybook/pull/13991))

## 6.2.0-beta.0 (February 22, 2021)

Storybook 6.2 is in beta. 🎉🎉🎉

Hundreds of improvements and fixes, including:

- **Vue 3** - Official support for the latest version of Vue.
- **Webpack 5** - Experimental support for the latest version of Webpack.
- **Controls** - Controls improvements including URL sync, filtering, sorting, and more.
- **Angular** - Overhauled Angular support.
- **Svelte** - Overhauled Svelte support.

Track the release in the Github: [Storybook 6.2 Release ⚡️](https://github.com/storybookjs/storybook/issues/13160)

## 6.2.0-alpha.35 (February 22, 2021)

### Bug Fixes

- Webpack5: Fix progress plugin version conflict ([#14007](https://github.com/storybookjs/storybook/pull/14007))

## 6.2.0-alpha.34 (February 22, 2021)

### Maintenance

- Core: Use webpack4 to build Manager UI instead of webpack5 ([#14001](https://github.com/storybookjs/storybook/pull/14001))
- Yarn PnP: Add missing dependencies for Webpack 4/5 work ([#13992](https://github.com/storybookjs/storybook/pull/13992))

### Dependency Upgrades

- Core: Fix core/builder dependencies ([#13999](https://github.com/storybookjs/storybook/pull/13999))

## 6.2.0-alpha.33 (February 22, 2021)

### Features

- Addon-docs: Support story.mdx, stories.mdx ([#13996](https://github.com/storybookjs/storybook/pull/13996))

### Bug Fixes

- Webpack5: Remove outdated html-webpack-plugin types ([#13986](https://github.com/storybookjs/storybook/pull/13986))

### Dependency Upgrades

- Move to a fork of react-sizeme with updated React peer dependency ([#13733](https://github.com/storybookjs/storybook/pull/13733))
- Webpack4: Upgrade html-webpack-plugin and remove external types ([#13993](https://github.com/storybookjs/storybook/pull/13993))

## 6.2.0-alpha.32 (February 21, 2021)

### Breaking prerelease

**NOTE:** this is a breaking change for users of `@storybook/vue3` which is currently in alpha prerelease:

- Vue 3: Map args with setup hook & remove automatic props mapping ([#13981](https://github.com/storybookjs/storybook/pull/13981))

### Bug Fixes

- Webpack5: Fix compilation error display ([#13983](https://github.com/storybookjs/storybook/pull/13983))
- Webpack5: Add semver to builder-webpack5 dependencies ([#13982](https://github.com/storybookjs/storybook/pull/13982))
- CLI: Don't allow empty string as outputDir option ([#13969](https://github.com/storybookjs/storybook/pull/13969))

## 6.2.0-alpha.31 (February 20, 2021)

### Features

- Angular: Support angular components without selector ([#13939](https://github.com/storybookjs/storybook/pull/13939))
- Preact: Add CSF types ([#13963](https://github.com/storybookjs/storybook/pull/13963))

### Bug Fixes

- Addon-docs: Fix ArgsTable tab renamed to `Story` when using args ([#13845](https://github.com/storybookjs/storybook/pull/13845))
- Angular: Correctly destroy angular application between each render ([#13956](https://github.com/storybookjs/storybook/pull/13956))
- Webpack5: Fix warnings display in build-storybook ([#13975](https://github.com/storybookjs/storybook/pull/13975))

## 6.2.0-alpha.30 (February 20, 2021)

### Features

- Core: Support webpack5 and webpack4 side by side ([#13808](https://github.com/storybookjs/storybook/pull/13808))

### Bug Fixes

- Args: Fix issues with string default values ([#13919](https://github.com/storybookjs/storybook/pull/13919))
- Args: Prefer react runtime default values ([#13937](https://github.com/storybookjs/storybook/pull/13937))

### Maintenance

- Core: Improve preset handling test coverage ([#13951](https://github.com/storybookjs/storybook/pull/13951))

## 6.2.0-alpha.29 (February 18, 2021)

### Features

- Core: Sync args state to URL ([#13803](https://github.com/storybookjs/storybook/pull/13803))
- UI: Select search input value on / ([#13884](https://github.com/storybookjs/storybook/pull/13884))

### Bug Fixes

- Components: Add missing `regenerator-runtime` dependency ([#13916](https://github.com/storybookjs/storybook/pull/13916))

### Maintenance

- Core: Load middleware.cjs if it exists ([#13592](https://github.com/storybookjs/storybook/pull/13592))
- Build: Ensure consistency of Chromatic snapshots of Zoom stories ([#13932](https://github.com/storybookjs/storybook/pull/13932))
- Angular: Clean and improve angular-cli examples ([#13886](https://github.com/storybookjs/storybook/pull/13886))

## 6.2.0-alpha.28 (February 15, 2021)

### Bug Fixes

- Addon-actions: Change to override default values ([#13912](https://github.com/storybookjs/storybook/pull/13912))
- CLI: Add safe check for eslint overrides ([#13717](https://github.com/storybookjs/storybook/pull/13717))

### Maintenance

- CLI: Don't try to add packages that are already installed ([#13876](https://github.com/storybookjs/storybook/pull/13876))

## 6.2.0-alpha.27 (February 15, 2021)

### Features

- Addon-controls: Infer color and date controls ([#13675](https://github.com/storybookjs/storybook/pull/13675))
- Svelte: Support TypeScript and preprocessors ([#13900](https://github.com/storybookjs/storybook/pull/13900))
- Addon-controls: Add include/exclude configuration options ([#13898](https://github.com/storybookjs/storybook/pull/13898))

### Maintenance

- Add catalog metadata to the addons ([#13666](https://github.com/storybookjs/storybook/pull/13666))
- Misc: Clean TS config and bump `@storybook/preset-create-react-app` ([#13878](https://github.com/storybookjs/storybook/pull/13878))

## 6.1.18 (February 15, 2021)

### Bug Fixes

- UI: Fix theming for focused search bar ([#13895](https://github.com/storybookjs/storybook/pull/13895))
- Storyshots: Support main.js usage ([#13842](https://github.com/storybookjs/storybook/pull/13842))

## 6.2.0-alpha.26 (February 13, 2021)

### Features

- Addon-controls: Files control ([#13544](https://github.com/storybookjs/storybook/pull/13544))
- UI: Add a 'main' role to the Main component for a11y ([#13827](https://github.com/storybookjs/storybook/pull/13827))

### Bug Fixes

- Addon-docs/Vue3: Attach app context from preview to inline stories ([#13894](https://github.com/storybookjs/storybook/pull/13894))
- UI: Fix theming for focused search bar ([#13895](https://github.com/storybookjs/storybook/pull/13895))

### Maintenance

- Build: Move all the `yarn install` in the `build` CI job ([#13872](https://github.com/storybookjs/storybook/pull/13872))
- Build: Rework `test` NPM script ([#13871](https://github.com/storybookjs/storybook/pull/13871))

## 6.2.0-alpha.25 (February 11, 2021)

### Features

- Addon-docs: Configure syntax highlighter language by story parameter ([#13869](https://github.com/storybookjs/storybook/pull/13869))
- Svelte: Improved decorators ([#13785](https://github.com/storybookjs/storybook/pull/13785))
- Addon-docs/Angular: Add dynamic source snippets ([#13740](https://github.com/storybookjs/storybook/pull/13740))

### Bug Fixes

- Vue 3: Fix decorators and add more examples ([#13855](https://github.com/storybookjs/storybook/pull/13855))
- Storyshots: Support main.js usage ([#13842](https://github.com/storybookjs/storybook/pull/13842))

### Maintenance

- Core: Add tests for the preset behavior of core ([#13846](https://github.com/storybookjs/storybook/pull/13846))
- Upgrade to danger-js@main ([#13857](https://github.com/storybookjs/storybook/pull/13857))

## 6.2.0-alpha.24 (February 6, 2021)

### Features

- Addon-storyshots: Add support for Vue 3 ([#13828](https://github.com/storybookjs/storybook/pull/13828))

### Maintenance

- CLI: only kill other processes on fail ([#13822](https://github.com/storybookjs/storybook/pull/13822))

## 6.2.0-alpha.23 (February 5, 2021)

### Bug Fixes

- Addon-docs/Vue3: Resolve vue3 package for addon-docs preset ([#13819](https://github.com/storybookjs/storybook/pull/13819))

## 6.2.0-alpha.22 (February 5, 2021)

### Bug Fixes

- CLI: Fix opening localhost in browser by default ([#13812](https://github.com/storybookjs/storybook/pull/13812))

## 6.1.17 (February 4, 2021)

### Bug Fixes

- CLI: Fix opening localhost in browser by default ([#13812](https://github.com/storybookjs/storybook/pull/13812))

## 6.2.0-alpha.21 (February 4, 2021)

### Features

- Addon-docs: Add support for Vue 3 ([#13809](https://github.com/storybookjs/storybook/pull/13809))

### Maintenance

- Build: Exclude all test and story files from transpilation ([#13714](https://github.com/storybookjs/storybook/pull/13714))
- Build: Generate version file with preval macro ([#13715](https://github.com/storybookjs/storybook/pull/13715))

## 6.1.16 (February 2, 2021)

### Bug Fixes

- Addon-docs/Svelte: Fix component name in docgen-loader ([#13760](https://github.com/storybookjs/storybook/pull/13760))
- UI: Fix copy to clipboard for insecure deployments ([#13777](https://github.com/storybookjs/storybook/pull/13777))

## 6.2.0-alpha.20 (February 2, 2021)

### Features

- Vue: Add Vue 3 support ([#13775](https://github.com/storybookjs/storybook/pull/13775))
- CLI: Add try/catch on readFileAsJson to improve error message ([#13730](https://github.com/storybookjs/storybook/pull/13730))
- Core: Generate manager cache in smoke test, but don't use/clear any cache ([#13784](https://github.com/storybookjs/storybook/pull/13784))

### Bug Fixes

- Addon-docs/Svelte: Fix component name in docgen-loader ([#13760](https://github.com/storybookjs/storybook/pull/13760))
- Addon-docs/Svelte: Fix component description ([#13659](https://github.com/storybookjs/storybook/pull/13659))
- UI: Fix copy to clipboard for insecure deployments ([#13777](https://github.com/storybookjs/storybook/pull/13777))

### Maintenance

- CLI: Handle package versions in package strings for generators ([#13774](https://github.com/storybookjs/storybook/pull/13774))
- Build: Do not recompile packages in publish step of the CI ([#13786](https://github.com/storybookjs/storybook/pull/13786))
- CI: Remove generic cache key from Circle CI ([#13787](https://github.com/storybookjs/storybook/pull/13787))
- CI: Upgrade cache GH Action & remove fallback caches ([#13752](https://github.com/storybookjs/storybook/pull/13752))

## 6.2.0-alpha.19 (January 29, 2021)

### Features

- Addon-docs/Angular: Inline rendering support with angular-elements ([#13525](https://github.com/storybookjs/storybook/pull/13525))
- CLI: Add version matcher functions for framework detection ([#13738](https://github.com/storybookjs/storybook/pull/13738))

### Bug Fixes

- CLI: Fix handling of version ranges in dependency checks ([#13759](https://github.com/storybookjs/storybook/pull/13759))

### Maintenance

- Build: Enable deepscan in workspace ([#13716](https://github.com/storybookjs/storybook/pull/13716))
- Chore: Increase node version minimums to 10.13 ([#13725](https://github.com/storybookjs/storybook/pull/13725))
- Fixes smoke-test on svelte-kitchen-sink ([#13705](https://github.com/storybookjs/storybook/pull/13705))

## 6.1.15 (January 22, 2021)

### Bug Fixes

- Svelte: Fix duplicate story preview ([#13663](https://github.com/storybookjs/storybook/pull/13663))
- Angular: Properly handle empty tsconfig compilerOptions ([#13596](https://github.com/storybookjs/storybook/pull/13596))

### Maintenance

- Angular: Use Nx function to read non-angularCli configs ([#13558](https://github.com/storybookjs/storybook/pull/13558))

### Dependency Upgrades

- Bump @types/reach\_\_router version ([#13703](https://github.com/storybookjs/storybook/pull/13703))

## 6.2.0-alpha.18 (January 22, 2021)

### Bug Fixes

- Svelte: Fix duplicate story preview ([#13663](https://github.com/storybookjs/storybook/pull/13663))

### Maintenance

- Angular: Add Angular 11.1 support ([#13704](https://github.com/storybookjs/storybook/pull/13704))

### Dependency Upgrades

- Bump @types/reach\_\_router version ([#13703](https://github.com/storybookjs/storybook/pull/13703))

## 6.2.0-alpha.17 (January 22, 2021)

### Features

- Addon-docs/Svelte: Add dynamic snippet support ([#13653](https://github.com/storybookjs/storybook/pull/13653))
- Addon-docs/Svelte: Add Slots and Events to the generated ArgsTable ([#13660](https://github.com/storybookjs/storybook/pull/13660))

### Bug Fixes

- Angular: Force re-render if template change ([#13638](https://github.com/storybookjs/storybook/pull/13638))
- Angular: Properly handle empty tsconfig compilerOptions ([#13596](https://github.com/storybookjs/storybook/pull/13596))

### Maintenance

- Core: Deprecate default postcss config, recommend addon-postcss ([#13669](https://github.com/storybookjs/storybook/pull/13669))
- Core: Throw an error for invalid story format ([#13673](https://github.com/storybookjs/storybook/pull/13673))
- Build: Ensure consistency of Chromatic snapshots of Zoom stories ([#13676](https://github.com/storybookjs/storybook/pull/13676))

### Dependency Upgrades

- Dependencies: Swap back to upstream postcss-loader ([#13698](https://github.com/storybookjs/storybook/pull/13698))

## 6.2.0-alpha.16 (January 16, 2021)

### Dependency Upgrades

- Dependencies: Remove inquirer types ([#13651](https://github.com/storybookjs/storybook/pull/13651))
- Dependencies: Swap postcss-loader for fork version ([#13655](https://github.com/storybookjs/storybook/pull/13655))

## 6.2.0-alpha.15 (January 15, 2021)

### Features

- Addon-actions: Normalize args ([#13624](https://github.com/storybookjs/storybook/pull/13624))
- Addon-viewport: Add viewports of the latest iPhones ([#13176](https://github.com/storybookjs/storybook/pull/13176))

### Maintenance

- Maintenance: Configure Renovate ([#13641](https://github.com/storybookjs/storybook/pull/13641))

### Dependency Upgrades

- Dependencies: 6.2 non-breaking package upgrades ([#13631](https://github.com/storybookjs/storybook/pull/13631))
- Dependencies: Update postcss-loader to ^4.1.0 ([#13640](https://github.com/storybookjs/storybook/pull/13640))

## 6.2.0-alpha.14 (January 14, 2021)

### Bug Fixes

- CLI: Fix sb init prompt when framework type is undetected ([#13520](https://github.com/storybookjs/storybook/pull/13520))

### Maintenance

- Rax: Migrate to TS ([#13450](https://github.com/storybookjs/storybook/pull/13450))
- Riot: Migrate to TS ([#13447](https://github.com/storybookjs/storybook/pull/13447))
- Marionette: Migrate to TS ([#13448](https://github.com/storybookjs/storybook/pull/13448))
- Marko: Migrate to TS ([#13449](https://github.com/storybookjs/storybook/pull/13449))

## 6.2.0-alpha.13 (January 13, 2021)

### Features

- Angular: Improve decorators ([#13507](https://github.com/storybookjs/storybook/pull/13507))

### Maintenance

- Angular: Fix flaky tests based on timezone ([#13609](https://github.com/storybookjs/storybook/pull/13609))
- Angular: Use Nx function to read non-angularCli configs ([#13558](https://github.com/storybookjs/storybook/pull/13558))
- Build: Move Preact E2E tests on a Node 12 executor ([#13582](https://github.com/storybookjs/storybook/pull/13582))
- Addon-docs: Add missing types for Story doc block ([#13549](https://github.com/storybookjs/storybook/pull/13549))

## 6.1.14 (January 12, 2021)

### Bug Fixes

- Core: Use fs-extra emptyDir so build works on docker volume ([#13474](https://github.com/storybookjs/storybook/pull/13474))
- Addon-docs: Tighten preset webpack pattern for mdx stories ([#13476](https://github.com/storybookjs/storybook/pull/13476))
- Typescript: Fix qs import in @storybook/client-api ([#13518](https://github.com/storybookjs/storybook/pull/13518))
- CLI: Ensure --host option changes the network host ([#13521](https://github.com/storybookjs/storybook/pull/13521))
- Svelte: Statically load docgen info for svelte components ([#13466](https://github.com/storybookjs/storybook/pull/13466))

## 6.1.13 (January 12, 2021)

NPM publish failed

## 6.1.12 (January 12, 2021)

### Bug Fixes

- Addon-docs: Fix link not working cross origin ([#13022](https://github.com/storybookjs/storybook/pull/13022))
- Addon-docs: Resolve babel-loader from storybook/core ([#13607](https://github.com/storybookjs/storybook/pull/13607))

## 6.2.0-alpha.12 (January 12, 2021)

### Bug Fixes

- Addon-docs: Resolve babel-loader from storybook/core ([#13607](https://github.com/storybookjs/storybook/pull/13607))

## 6.2.0-alpha.11 (January 11, 2021)

### Features

- HTML: Add CSF types ([#13519](https://github.com/storybookjs/storybook/pull/13519))
- Addon-jest: Infer parameter from story filename if not provided ([#13535](https://github.com/storybookjs/storybook/pull/13535))
- Server: Forward globals in fetchStoryHtml ([#13158](https://github.com/storybookjs/storybook/pull/13158))

### Bug Fixes

- Addon-docs: Fix link not working cross origin ([#13022](https://github.com/storybookjs/storybook/pull/13022))
- Addon-docs: Use theme text color header anchors ([#13533](https://github.com/storybookjs/storybook/pull/13533))

### Maintenance

- Build: remove redundant checks for TS type declaration generation ([#13567](https://github.com/storybookjs/storybook/pull/13567))

## 6.2.0-alpha.10 (December 28, 2020)

### Bug Fixes

- Typescript: Fix qs import in @storybook/client-api ([#13518](https://github.com/storybookjs/storybook/pull/13518))
- CLI: Ensure --host option changes the network host ([#13521](https://github.com/storybookjs/storybook/pull/13521))

### Maintenance

- Perf: Reuse SVG icon paths by using symbols ([#13110](https://github.com/storybookjs/storybook/pull/13110))
- Core: Fix typing of dev CLI options ([#13501](https://github.com/storybookjs/storybook/pull/13501))
- Perf: Bundle only required syntax highlighter languages ([#13479](https://github.com/storybookjs/storybook/pull/13479))

## 6.2.0-alpha.9 (December 20, 2020)

### Features

- Web-components: Add typescript types and CLI template ([#12395](https://github.com/storybookjs/storybook/pull/12395))

### Bug Fixes

- Addon-docs: Fix angular without compodoc ([#13487](https://github.com/storybookjs/storybook/pull/13487))
- Core: Use fs-extra emptyDir so build works on docker volume ([#13474](https://github.com/storybookjs/storybook/pull/13474))
- Addon-docs: Tighten preset webpack pattern for mdx stories ([#13476](https://github.com/storybookjs/storybook/pull/13476))
- Svelte: Statically load docgen info for svelte components ([#13466](https://github.com/storybookjs/storybook/pull/13466))

### Dependency Upgrades

- Bump @ember/optional-features from 1.3.0 to 2.0.0 ([#12829](https://github.com/storybookjs/storybook/pull/12829))

## 6.2.0-alpha.8 (December 16, 2020)

### Bug Fixes

- Angular: Fix `configFile: undefined` in ts-loader options ([#13382](https://github.com/storybookjs/storybook/pull/13382))

### Maintenance

- Angular: Deprecate the story component attribute ([#13383](https://github.com/storybookjs/storybook/pull/13383))

## 6.2.0-alpha.7 (December 15, 2020)

### Bug Fixes

- CLI: Add overrides to CRA ESLint config ([#13452](https://github.com/storybookjs/storybook/pull/13452))

### Maintenance

- Perf: Lazy load OverlayScrollbars ([#13430](https://github.com/storybookjs/storybook/pull/13430))
- Addon-docs: Remove unused titleFunction export ([#13457](https://github.com/storybookjs/storybook/pull/13457))
- Perf: Distribute both ESM and CJS modules ([#13013](https://github.com/storybookjs/storybook/pull/13013))
- Perf: Replace react-hotkeys with useEffect keybinding ([#13424](https://github.com/storybookjs/storybook/pull/13424))

## 6.1.11 (December 12, 2020)

### Bug Fixes

- UI: Fix null ref in sidebar ([#13423](https://github.com/storybookjs/storybook/pull/13423))
- Addon-docs: Handle svelte docgen failures gracefully ([#13386](https://github.com/storybookjs/storybook/pull/13386))

### Dependency Upgrades

- Update react-popper-tooltip and @popperjs/core for react17 ([#13434](https://github.com/storybookjs/storybook/pull/13434))

## 6.2.0-alpha.6 (December 12, 2020)

### Features

- Main.js: Add previewHead, previewBody, managerHead presets ([#13432](https://github.com/storybookjs/storybook/pull/13432))

### Bug Fixes

- Core: Fix `modulesCount` cache storage and retrieval ([#13431](https://github.com/storybookjs/storybook/pull/13431))
- UI: Fix null ref in sidebar ([#13423](https://github.com/storybookjs/storybook/pull/13423))

### Maintenance

- Components: Cleanup circular dependencies ([#13439](https://github.com/storybookjs/storybook/pull/13439))
- Core: Generate bundle size report for prebuilt manager ([#13425](https://github.com/storybookjs/storybook/pull/13425))
- CI: Speed up CircleCI workflows ([#13320](https://github.com/storybookjs/storybook/pull/13320))

### Dependency Upgrades

- Update react-popper-tooltip and @popperjs/core for react17 ([#13434](https://github.com/storybookjs/storybook/pull/13434))

## 6.2.0-alpha.5 (December 8, 2020)

### Bug Fixes

- Core: Fix `--static-dir` with absolute path on Windows ([#13344](https://github.com/storybookjs/storybook/pull/13344))

## 6.2.0-alpha.4 (December 6, 2020)

### Bug Fixes

- Addon-docs: Handle svelte docgen failures gracefully ([#13386](https://github.com/storybookjs/storybook/pull/13386))

### Dependency Upgrades

- Bump @ember/test-helpers from 1.7.1 to 2.1.0 ([#13143](https://github.com/storybookjs/storybook/pull/13143))

## 6.2.0-alpha.3 (December 4, 2020)

### Bug Fixes

- CLI: Fix stories path in Introduction.stories.mdx ([#13368](https://github.com/storybookjs/storybook/pull/13368))
- UI: Fix display of custom brand image ([#13355](https://github.com/storybookjs/storybook/pull/13355))

### Maintenance

- CLI: Replace inquirer with prompts ([#13225](https://github.com/storybookjs/storybook/pull/13225))

## 6.1.10 (December 4, 2020)

### Bug Fixes

- CLI: Fix stories path in Introduction.stories.mdx ([#13368](https://github.com/storybookjs/storybook/pull/13368))
- UI: Fix display of custom brand image ([#13355](https://github.com/storybookjs/storybook/pull/13355))
- Storyshots: Fix missing `done` attribute on type definition ([#13341](https://github.com/storybookjs/storybook/pull/13341))
- Addon-docs: ArgTypes optional on Meta ([#13352](https://github.com/storybookjs/storybook/pull/13352))

### Dependency Upgrades

- Addon-storyshots: Add React as peer dependency ([#13343](https://github.com/storybookjs/storybook/pull/13343))

## 6.2.0-alpha.2 (December 3, 2020)

### Bug Fixes

- Storyshots: Fix missing `done` attribute on type definition ([#13341](https://github.com/storybookjs/storybook/pull/13341))
- Core: Fix IE11 compatibility by using XHR and plain ES5 ([#13348](https://github.com/storybookjs/storybook/pull/13348))

### Maintenance

- Angular: Overhaul preview renderer ([#13215](https://github.com/storybookjs/storybook/pull/13215))

## 6.2.0-alpha.1 (December 1, 2020)

### Bug Fixes

- Addon-docs: ArgTypes optional on Meta ([#13352](https://github.com/storybookjs/storybook/pull/13352))
- Composition: Filter out disabled refs in getAutoRefs ([#12863](https://github.com/storybookjs/storybook/pull/12863))
- UI: Add support for expand/collapse keyboard shortcuts ([#12980](https://github.com/storybookjs/storybook/pull/12980))

### Maintenance

- Dependencies: Rebuild yarn.lock ([#13289](https://github.com/storybookjs/storybook/pull/13289))
- Core: Add typescript as optional peer dependency ([#13330](https://github.com/storybookjs/storybook/pull/13330))

### Dependency Upgrades

- Bump wait-on from 4.0.2 to 5.2.0 ([#12835](https://github.com/storybookjs/storybook/pull/12835))
- Bump commander from 5.1.0 to 6.2.0 ([#13148](https://github.com/storybookjs/storybook/pull/13148))

## 6.2.0-alpha.0 (December 1, 2020)

### Bug Fixes

- Addon-docs: Fix type aliases and enum types from Angular Compodoc JSON ([#12665](https://github.com/storybookjs/storybook/pull/12665))
- Core: Ensure node `name` does not contain leading/trailing whitespace ([#13275](https://github.com/storybookjs/storybook/pull/13275))
- Angular: Run setProps in the NgZone ([#12382](https://github.com/storybookjs/storybook/pull/12382))

### Maintenance

- Core: Make @babel/core an optional peer dependency ([#13329](https://github.com/storybookjs/storybook/pull/13329))
- Core: Replace preset-env polyfills with babel-polyfills ([#13055](https://github.com/storybookjs/storybook/pull/13055))
- CLI: use Jest to test CLI commands and remove outdated fixtures ([#12936](https://github.com/storybookjs/storybook/pull/12936))

## 6.1.9 (November 29, 2020)

### Bug Fixes

- Addon-backgrounds: Fix grid offset always using default value ([#13260](https://github.com/storybookjs/storybook/pull/13260))
- UI: Fix keybindings on non-US keyboard layouts ([#13319](https://github.com/storybookjs/storybook/pull/13319))
- Addon-Docs: Handle class attributes in Dynamic Source Rendering for Vue.js ([#13327](https://github.com/storybookjs/storybook/pull/13327))

## 6.1.8 (November 27, 2020)

### Bug Fixes

- Core: Fix preview URL dropped hashes ([#13308](https://github.com/storybookjs/storybook/pull/13308))
- Core: Fix template script tag support ([#13271](https://github.com/storybookjs/storybook/pull/13271))
- Addon-docs: Fix Vue source snippets for function attributes ([#13288](https://github.com/storybookjs/storybook/pull/13288))
- Components: Fix Zoom for IE11 ([#13302](https://github.com/storybookjs/storybook/pull/13302))
- React: Don't add FastRefresh if already enabled ([#13303](https://github.com/storybookjs/storybook/pull/13303))
- CLI: Fix storybook-deployer upgrade warning ([#13306](https://github.com/storybookjs/storybook/pull/13306))

### Maintenance

- React: Expose StorybookConfig types ([#13309](https://github.com/storybookjs/storybook/pull/13309))
- React: Fix unit tests for react preset ([#13315](https://github.com/storybookjs/storybook/pull/13315))

## 6.1.7 (November 27, 2020)

### Bug Fixes

- CLI: Fix not printing managerTotalTime when using cached manager ([#13294](https://github.com/storybookjs/storybook/pull/13294))
- Core: Only apply `express.json()` middleware to /runtime-error route ([#13295](https://github.com/storybookjs/storybook/pull/13295))
- Core: Don't use prebuilt or cached manager when running smoke test ([#13266](https://github.com/storybookjs/storybook/pull/13266))
- Core: Detect arg inference for cyclic args and warn ([#13263](https://github.com/storybookjs/storybook/pull/13263))

### Dependency Upgrades

- Remove unused dependency @svgr/webpack ([#13281](https://github.com/storybookjs/storybook/pull/13281))

## 6.1.6 (November 25, 2020)

### Bug Fixes

- Addon-controls: Fix ensureDocsBeforeControls support for paths ([#13204](https://github.com/storybookjs/storybook/pull/13204))
- CLI: Add core-js to Preact generator ([#13138](https://github.com/storybookjs/storybook/pull/13138))
- Core: Improve handling of --static-dir option ([#13245](https://github.com/storybookjs/storybook/pull/13245))
- Core: Fix webpack5 compatibility check for ProgressPlugin ([#13239](https://github.com/storybookjs/storybook/pull/13239))

## 6.1.5 (November 24, 2020)

### Bug Fixes

- Core: Resolve react and react-dom from core ([#13195](https://github.com/storybookjs/storybook/pull/13195))

## 6.1.4 (November 24, 2020)

### Bug Fixes

- Core: Clear manager cache on runtime error ([#13230](https://github.com/storybookjs/storybook/pull/13230))

## 6.1.3 (November 23, 2020)

### Bug Fixes

- Core: Replace 'trash' with 'fs.remove' ([#13211](https://github.com/storybookjs/storybook/pull/13211))
- UI: Fix overflow scrolling on layout:centered ([#13217](https://github.com/storybookjs/storybook/pull/13217))
- CLI: Don't install babel-loader for CRA ([#13220](https://github.com/storybookjs/storybook/pull/13220))
- Addon-docs: Fix lineheight in typeset component ([#13205](https://github.com/storybookjs/storybook/pull/13205))

## 6.1.2 (November 21, 2020)

### Bug Fixes

- Storyshots: Fix `beforeScreenshot` and `afterScreenshot` return types ([#13198](https://github.com/storybookjs/storybook/pull/13198))
- UI: Target only IE10/IE11 for our CSS vertical centering hack ([#13192](https://github.com/storybookjs/storybook/pull/13192))

## 6.1.1 (November 20, 2020)

### Bug Fixes

- Addon-backgrounds: Fix grid disable ([#13175](https://github.com/storybookjs/storybook/pull/13175))

## 6.1.0 (November 19, 2020)

6.1 is the first in a series of performance-oriented Storybook releases. It includes:

- [Fast search and navigation](https://storybook.js.org/blog/new-component-finder-and-sidebar/)
- Manager caching for faster startup [#12707](https://github.com/storybookjs/storybook/pull/12707)
- Asynchronous loaders [#12699](https://github.com/storybookjs/storybook/pull/12699)
- React improvements

  - React 17 support [#12972](https://github.com/storybookjs/storybook/pull/12972) [#12975](https://github.com/storybookjs/storybook/pull/12975)
  - Fast refresh [#12470](https://github.com/storybookjs/storybook/pull/12470) [#12535](https://github.com/storybookjs/storybook/pull/12535)
  - Strict mode [#12781](https://github.com/storybookjs/storybook/pull/12781)

    6.1 contains hundreds more fixes, features, and tweaks. Browse the [changelogs](https://github.com/storybookjs/storybook/blob/next/CHANGELOG.md) matching `6.1.0-alpha.*`, `6.1.0-beta.*`, and `6.1.0-rc.*` for the full list of changes. See [Storybook 6 migration guide](https://medium.com/storybookjs/storybook-6-migration-guide-200346241bb5) to upgrade from `5.3` or earlier.

## 6.1.0-rc.6 (November 19, 2020)

### Bug Fixes

- Core: Fix using cached manager on the 2nd run ([#13165](https://github.com/storybookjs/storybook/pull/13165))
- Addon-docs: Fix Preview scaling with transform instead of zoom ([#12845](https://github.com/storybookjs/storybook/pull/12845))

## 6.1.0-rc.5 (November 19, 2020)

### Features

- UI: CSS escape hatches for sidebar styling ([#13155](https://github.com/storybookjs/storybook/pull/13155))

### Bug Fixes

- UI: Fix CSS for IE11 ([#13159](https://github.com/storybookjs/storybook/pull/13159))

### Maintenance

- Build: Update example and app to Angular 11 ([#13141](https://github.com/storybookjs/storybook/pull/13141))

## 6.1.0-rc.4 (November 17, 2020)

### Maintenance

- Build: Fix Yarn 2 E2E tests ([#13129](https://github.com/storybookjs/storybook/pull/13129))
- UI: Reduce rerenders when changing the selected story ([#13107](https://github.com/storybookjs/storybook/pull/13107))
- Build: Update example to Angular 10 ([#13048](https://github.com/storybookjs/storybook/pull/13048))

## 6.1.0-rc.3 (November 16, 2020)

### Maintenance

- Addon-docs: Export SourceContainer context ([#13118](https://github.com/storybookjs/storybook/pull/13118))
- UI: Fix loading UI when EventSource isn't defined ([#13123](https://github.com/storybookjs/storybook/pull/13123))
- Build: Remove some dependencies and improve E2E workflow ([#13115](https://github.com/storybookjs/storybook/pull/13115))

## 6.1.0-rc.2 (November 13, 2020)

### Bug Fixes

- Addon-docs: Fix Meta prop types ([#13101](https://github.com/storybookjs/storybook/pull/13101))
- UI: preventDefault for certain keyboard shortcuts ([#13097](https://github.com/storybookjs/storybook/pull/13097))

### Dependency Upgrades

- Bump `@emotion/core` to 10.1.1 ([#13102](https://github.com/storybookjs/storybook/pull/13102))

## 6.1.0-rc.1 (November 13, 2020)

### Maintenance

- Angular: Support Angular 11 ([#13096](https://github.com/storybookjs/storybook/pull/13096))
- UI: Tree highlight performance ([#13095](https://github.com/storybookjs/storybook/pull/13095))

## 6.1.0-rc.0 (November 12, 2020)

### Bug Fixes

- UI: Fix kebab-case CSS property error ([#13090](https://github.com/storybookjs/storybook/pull/13090))
- UI: Fix single story hoisting at the root ([#13089](https://github.com/storybookjs/storybook/pull/13089))

### Maintenance

- UI: Disable instant-on manager for now ([#13084](https://github.com/storybookjs/storybook/pull/13084))

## 6.1.0-beta.7 (November 11, 2020)

### Bug Fixes

- React: Don't create a new story function on every render ([#13069](https://github.com/storybookjs/storybook/pull/13069))
- UI: Fix search field styling in Safari 13 ([#13070](https://github.com/storybookjs/storybook/pull/13070))
- Addon-docs: Fix spurious warnings ([#13075](https://github.com/storybookjs/storybook/pull/13075))
- UI: Fix Escape key handling perf ([#13073](https://github.com/storybookjs/storybook/pull/13073))
- Storyshots: Fix compatibility for jest-preset-angular 8.3+ ([#13060](https://github.com/storybookjs/storybook/pull/13060))

## 6.1.0-beta.6 (November 9, 2020)

### Bug Fixes

- Angular: Fix storyData handling on module update ([#13037](https://github.com/storybookjs/storybook/pull/13037))
- Args: Default to type 'object' when there is a null arg ([#13051](https://github.com/storybookjs/storybook/pull/13051))
- Core: Fix duplicate argTypeEnhancers on HMR ([#13050](https://github.com/storybookjs/storybook/pull/13050))

### Dependency Upgrades

- Bump react-dogen-typescript-plugin to 0.6.2 ([#13052](https://github.com/storybookjs/storybook/pull/13052))

## 6.1.0-beta.5 (November 8, 2020)

### Features

- UI: Single story hoisting in sidebar ([#13039](https://github.com/storybookjs/storybook/pull/13039))

## 6.1.0-beta.4 (November 6, 2020)

### Bug Fixes

- UI: Fixes for Sidebar and Search ([#13027](https://github.com/storybookjs/storybook/pull/13027))
- Core: Make sure cache is available before trying to use it ([#13012](https://github.com/storybookjs/storybook/pull/13012))
- Core: Fix possible "write after end" exception for response stream ([#13007](https://github.com/storybookjs/storybook/pull/13007))

## 6.1.0-beta.3 (November 6, 2020)

### Features

- Core: Add STORYBOOK environment variable ([#12997](https://github.com/storybookjs/storybook/pull/12997))

### Bug Fixes

- Args: Fix args inference for null values ([#13029](https://github.com/storybookjs/storybook/pull/13029))
- Core: Dedupe default ArgTypes enhancers ([#13030](https://github.com/storybookjs/storybook/pull/13030))
- Core: Add catch to end process ([#13018](https://github.com/storybookjs/storybook/pull/13018))
- UI: Fix icon for addon panel orientation button ([#13026](https://github.com/storybookjs/storybook/pull/13026))
- Addon-docs: Fix test for Angular type inference ([#13009](https://github.com/storybookjs/storybook/pull/13009))
- CLI: Fix deprecation check ([#12981](https://github.com/storybookjs/storybook/pull/12981))
- UI: Restrict layout styles to only apply to a rendered preview area ([#13014](https://github.com/storybookjs/storybook/pull/13014))

### Maintenance

- Build: Add chokidar2 for yarn dev ([#13028](https://github.com/storybookjs/storybook/pull/13028))
- Build: Remove more enzyme ([#13005](https://github.com/storybookjs/storybook/pull/13005))

### Dependency Upgrades

- Bump webpack to 4.41.24 ([#13019](https://github.com/storybookjs/storybook/pull/13019))

## 6.1.0-beta.2 (November 4, 2020)

### Bug Fixes

- Addon-docs: Hide React default props in source block ([#13003](https://github.com/storybookjs/storybook/pull/13003))
- Addon-docs: Angular empty string now infers to "string" instead of "void" ([#12994](https://github.com/storybookjs/storybook/pull/12994))

### Maintenance

- Components: Add outline icon ([#13002](https://github.com/storybookjs/storybook/pull/13002))
- Core: Migrate core to TypeScript ([#12839](https://github.com/storybookjs/storybook/pull/12839))
- Addon-docs: Exclude testfixtures from package ([#12998](https://github.com/storybookjs/storybook/pull/12998))

## 6.1.0-beta.1 (November 3, 2020)

### Bug Fixes

- Components: react-syntaxt-highlighter optimization ([#12948](https://github.com/storybookjs/storybook/pull/12948))

### Maintenance

- Build: Replace enzyme with react-test-library ([#12990](https://github.com/storybookjs/storybook/pull/12990))
- Core: Move `react` and `react-dom` to peer deps ([#12972](https://github.com/storybookjs/storybook/pull/12972))

## 6.1.0-beta.0 (November 3, 2020)

### Maintenance

- Build: Relax react deps for preview-wrapper-react ([#12988](https://github.com/storybookjs/storybook/pull/12988))
- Build: Run storybook in react@17 ([#12978](https://github.com/storybookjs/storybook/pull/12978))

## 6.1.0-alpha.35 (November 2, 2020)

### Maintenance

- Build: Fix bootstrap reset command ([#12976](https://github.com/storybookjs/storybook/pull/12976))
- Core: Remove webpack DLLs ([#12975](https://github.com/storybookjs/storybook/pull/12975))

## 6.1.0-alpha.34 (November 1, 2020)

### Features

- Composition: Append index to ref indicator links ([#12932](https://github.com/storybookjs/storybook/pull/12932))

### Bug Fixes

- UI: Don't listen for progress updates in static builds ([#12966](https://github.com/storybookjs/storybook/pull/12966))

## 6.1.0-alpha.33 (October 30, 2020)

### Features

- UI: Instant-on manager ([#12707](https://github.com/storybookjs/storybook/pull/12707))

### Bug Fixes

- Core: Disable UI dll by default ([#12926](https://github.com/storybookjs/storybook/pull/12926))
- Combine args with basic object spread semantics ([#12958](https://github.com/storybookjs/storybook/pull/12958))

### Dependency Upgrades

- Core: Allow React-DOM 17.x ([#12937](https://github.com/storybookjs/storybook/pull/12937))

## 6.1.0-alpha.32 (October 30, 2020)

### Bug Fixes

- CLI: Disable DLL by default in template ([#12954](https://github.com/storybookjs/storybook/pull/12954))
- Preact: Fix peerDeps version specifier ([#12883](https://github.com/storybookjs/storybook/pull/12883))

## 6.1.0-alpha.31 (October 27, 2020)

### Features

- Search UX improvements ([#12765](https://github.com/storybookjs/storybook/pull/12765))
- Core: Add new layout style `none` and fix layout styles ([#12727](https://github.com/storybookjs/storybook/pull/12727))

### Dependency Upgrades

- Deps: Upgrade regenerator-runtime to 0.13.7 ([#12902](https://github.com/storybookjs/storybook/pull/12902))
- Deps: Upgrade ts-dedent to 2.0 ([#12901](https://github.com/storybookjs/storybook/pull/12901))

## 6.1.0-alpha.30 (October 26, 2020)

### Features

- Addon-docs: Lazy load iframes ([#12888](https://github.com/storybookjs/storybook/pull/12888))

### Bug Fixes

- React: Allow Storybook packages to use React 17.x ([#12908](https://github.com/storybookjs/storybook/pull/12908))
- React: Support JSX react transform introduced in 16.14.0 ([#12899](https://github.com/storybookjs/storybook/pull/12899))
- Addon-viewport: Fill entire iframe width with drop shadow ([#12870](https://github.com/storybookjs/storybook/pull/12870))

### Maintenance

- CLI: Deprecate '--story-format=mdx' option ([#12905](https://github.com/storybookjs/storybook/pull/12905))

### Dependency Upgrades

- Deps: upgrade babel to 7.12 ([#12903](https://github.com/storybookjs/storybook/pull/12903))
- Addon-docs: Remove react-is dependency ([#12910](https://github.com/storybookjs/storybook/pull/12910))

## 6.1.0-alpha.29 (October 23, 2020)

### Bug Fixes

- CLI: Fix intro MDX for React17 ([#12878](https://github.com/storybookjs/storybook/pull/12878))

## 6.0.27 (October 23, 2020)

### Bug Fixes

- CLI: Fix intro MDX for React17 ([#12878](https://github.com/storybookjs/storybook/pull/12878))
- Core: Disable Docs DLL by default ([#12874](https://github.com/storybookjs/storybook/pull/12874))
- Essentials: Fix absolute config dir ([#12873](https://github.com/storybookjs/storybook/pull/12873))
- Addon-controls: Fix "docs before controls" check ([#12738](https://github.com/storybookjs/storybook/pull/12738))
- Addon-knobs: Fix uncontrolled to controlled warning for booleans ([#12719](https://github.com/storybookjs/storybook/pull/12719))

### Dependency Upgrades

- Upgrade babel-plugin-react-docgen ([#12748](https://github.com/storybookjs/storybook/pull/12748))

## 6.1.0-alpha.28 (October 23, 2020)

### Bug Fixes

- Core: Disable Docs DLL by default ([#12874](https://github.com/storybookjs/storybook/pull/12874))
- Essentials: Fix absolute config dir ([#12873](https://github.com/storybookjs/storybook/pull/12873))
- UI: Add close button to version update notification ([#12320](https://github.com/storybookjs/storybook/pull/12320))

### Maintenance

- UI: Add fullscreen mode to docs ([#12861](https://github.com/storybookjs/storybook/pull/12861))

### Dependency Upgrades

- Angular: Update TypeScript peerDep version to support Angular 11 ([#12866](https://github.com/storybookjs/storybook/pull/12866))

## 6.1.0-alpha.27 (October 19, 2020)

### Features

- Addon-docs: Dynamic source rendering for Vue ([#12812](https://github.com/storybookjs/storybook/pull/12812))

### Bug Fixes

- Core: Pass framework options as global ([#12810](https://github.com/storybookjs/storybook/pull/12810))

### Maintenance

- CLI: Clean up handling of unknown subcommands ([#12799](https://github.com/storybookjs/storybook/pull/12799))

## 6.1.0-alpha.26 (October 18, 2020)

### Maintenance

- Components: Minor update checking color in Button ([#12800](https://github.com/storybookjs/storybook/pull/12800))

### Dependency Upgrades

- Bump vue-docgen-api to 4.33.1 ([#12808](https://github.com/storybookjs/storybook/pull/12808))
- Storyshots: Add missing vue peer dependencies ([#12790](https://github.com/storybookjs/storybook/pull/12790))
- Core/CLI: Update ShellJS dep version ([#12794](https://github.com/storybookjs/storybook/pull/12794))

## 6.1.0-alpha.25 (October 16, 2020)

### Features

- React: Add strictMode option ([#12781](https://github.com/storybookjs/storybook/pull/12781))

### Dependency Upgrades

- Bump lodash from 4.17.19 to 4.17.20 ([#12235](https://github.com/storybookjs/storybook/pull/12235))

## 6.1.0-alpha.24 (October 15, 2020)

### Bug Fixes

- Addon-viewports: Fix initial load state ([#11627](https://github.com/storybookjs/storybook/pull/11627))
- UI: Fullscreen toggle does not work when all panels are collapsed ([#11810](https://github.com/storybookjs/storybook/pull/11810))
- Addon-controls: Fix "docs before controls" check ([#12738](https://github.com/storybookjs/storybook/pull/12738))

### Maintenance

- Build: fix E2E tests and rework related CircleCI jobs ([#12746](https://github.com/storybookjs/storybook/pull/12746))

### Dependency Upgrades

- Upgrade babel-plugin-react-docgen ([#12748](https://github.com/storybookjs/storybook/pull/12748))

## 6.1.0-alpha.23 (October 12, 2020)

### Features

- Core: Add async loaders ([#12699](https://github.com/storybookjs/storybook/pull/12699))
- Addon-a11y: Add blurred vision effect ([#12731](https://github.com/storybookjs/storybook/pull/12731))

### Maintenance

- Build: Improve angular e2e tests ([#12723](https://github.com/storybookjs/storybook/pull/12723))

## 6.1.0-alpha.22 (October 10, 2020)

### Features

- Angular: Choose project used by Storybook ([#12565](https://github.com/storybookjs/storybook/pull/12565))

### Bug Fixes

- Composition: Fix incorrect ref type ([#12709](https://github.com/storybookjs/storybook/pull/12709))
- Addon-knobs: Fix uncontrolled to controlled warning for booleans ([#12719](https://github.com/storybookjs/storybook/pull/12719))

## 6.1.0-alpha.21 (October 8, 2020)

### Features

- Sidebar: Better search, keyboard shortcuts, "recently viewed" ([#12601](https://github.com/storybookjs/storybook/pull/12601))
- Source-loader: Generate sourcemaps ([#12277](https://github.com/storybookjs/storybook/pull/12277))
- Core: Add APNG support ([#12639](https://github.com/storybookjs/storybook/pull/12639))

### Bug Fixes

- Addon-docs: Fix Memo React components in ArgsTable ([#12686](https://github.com/storybookjs/storybook/pull/12686))
- Core: Fix babel-loader path resolution ([#12536](https://github.com/storybookjs/storybook/pull/12536))

### Maintenance

- Core: Log which CSF file is failing to load ([#12690](https://github.com/storybookjs/storybook/pull/12690))
- Build: Speed up CI checks ([#12315](https://github.com/storybookjs/storybook/pull/12315))

## 6.0.26 (October 5, 2020)

### Bug Fixes

- Addon-docs: Fix exotic React components in Source block ([#12638](https://github.com/storybookjs/storybook/pull/12638))

## 6.1.0-alpha.20 (October 5, 2020)

### Bug Fixes

- Addon-docs: Fix exotic React components in Source block ([#12638](https://github.com/storybookjs/storybook/pull/12638))
- Storyshots: Fix typings of "test"-method ([#12389](https://github.com/storybookjs/storybook/pull/12389))
- Storyshots: Fix support for test failures in async tests ([#11962](https://github.com/storybookjs/storybook/pull/11962))

### Maintenance

- Storyshots Puppeteer: Fix support for over 1 assertions in async tests ([#12657](https://github.com/storybookjs/storybook/pull/12657))

### Dependency Upgrades

- Marko: Update @marko/webpack and allow Marko 5 peerDepenency ([#12035](https://github.com/storybookjs/storybook/pull/12035))

## 6.0.25 (October 4, 2020)

### Bug Fixes

- CLI: Workaround for react native `sb init` ([#12405](https://github.com/storybookjs/storybook/pull/12405))

## 6.0.24 (October 4, 2020)

Failed NPM publish

## 6.0.23 (October 4, 2020)

Failed NPM publish

## 6.1.0-alpha.19 (October 3, 2020)

### Maintenance

- ArgsTable: Remove the "simple" detection for enum types ([#12587](https://github.com/storybookjs/storybook/pull/12587))
- Addon-docs: Move summary & detail equality check to createSummaryValue ([#12588](https://github.com/storybookjs/storybook/pull/12588))
- Essentials: Make controls tab show first ([#12652](https://github.com/storybookjs/storybook/pull/12652))
- Misc: Clean usage and place in the monorepo of some dependencies ([#12653](https://github.com/storybookjs/storybook/pull/12653))

## 6.1.0-alpha.18 (September 30, 2020)

### Bug Fixes

- Composition: Rename `disabled` parameter => `disable` ([#12603](https://github.com/storybookjs/storybook/pull/12603))
- UI: Fix page title for non-alpha chars ([#12583](https://github.com/storybookjs/storybook/pull/12583))

### Maintenance

- Fix spelling errors ([#12590](https://github.com/storybookjs/storybook/pull/12590))

## 6.1.0-alpha.17 (September 26, 2020)

### Features

- Addon-docs: Add CSS Shadow Parts to web-component props table ([#10442](https://github.com/storybookjs/storybook/pull/10442))

### Dependency Upgrades

- [Security] Bump bl from 1.2.2 to 1.2.3 ([#12480](https://github.com/storybookjs/storybook/pull/12480))
- [Security] Bump node-fetch from 2.6.0 to 2.6.1 ([#12448](https://github.com/storybookjs/storybook/pull/12448))

## 6.0.22 (September 26, 2020)

### Bug Fixes

- Addon-docs: Change 2nd argument of transformSource to the storyContext ([#12265](https://github.com/storybookjs/storybook/pull/12265))
- Angular: Unsubscribe prop subscriptions ([#12514](https://github.com/storybookjs/storybook/pull/12514))
- React: Fix reactDocgen option when false ([#12492](https://github.com/storybookjs/storybook/pull/12492))
- CLI: Fix storiesof-to-csf codemod for TypeScript ([#12453](https://github.com/storybookjs/storybook/pull/12453))
- Addon-docs: Fix missing line-height on TypeSet block ([#12134](https://github.com/storybookjs/storybook/pull/12134))
- Core: Use the denormed params on the first story for initial options ([#11938](https://github.com/storybookjs/storybook/pull/11938))

### Maintenance

- Build: Disable problematic story in Chromatic ([#12457](https://github.com/storybookjs/storybook/pull/12457))

### Dependency Upgrades

- [Security] Bump node-fetch from 2.6.0 to 2.6.1 ([#12448](https://github.com/storybookjs/storybook/pull/12448))

## 6.1.0-alpha.16 (September 25, 2020)

### Bug Fixes

- Addon-backgrounds: Add docs support and extend grid configuration ([#12368](https://github.com/storybookjs/storybook/pull/12368))
- Addon-docs: Fix story description to only show when expanded ([#12563](https://github.com/storybookjs/storybook/pull/12563))

### Dependency Upgrades

- Upgrade react-docgen-typescript-plugin to 0.6.0 ([#12577](https://github.com/storybookjs/storybook/pull/12577))

## 6.1.0-alpha.15 (September 24, 2020)

### Features

- Core: Add viewMode to StoryContext ([#12566](https://github.com/storybookjs/storybook/pull/12566))
- Addon-docs: Add converters between Flow types and storybook types ([#12550](https://github.com/storybookjs/storybook/pull/12550))

### Bug Fixes

- Addon-actions: Fix log flushing when story re-renders ([#12500](https://github.com/storybookjs/storybook/pull/12500))
- Angular: Unsubscribe prop subscriptions ([#12514](https://github.com/storybookjs/storybook/pull/12514))
- Addon-docs: Remove leading pipe if using raw value for Flow union ([#12549](https://github.com/storybookjs/storybook/pull/12549))

## 6.1.0-alpha.14 (September 22, 2020)

### Features

- Web Components: Add script tag support ([#12509](https://github.com/storybookjs/storybook/pull/12509))

### Bug Fixes

- React: Fix fast refresh ([#12535](https://github.com/storybookjs/storybook/pull/12535))

### Maintenance

- CLI: Change suggested upgrade command to sb@latest ([#12533](https://github.com/storybookjs/storybook/pull/12533))

## 6.1.0-alpha.13 (September 22, 2020)

Failed NPM publish

## 6.1.0-alpha.12 (September 21, 2020)

### Features

- React: Add react-refresh ([#12470](https://github.com/storybookjs/storybook/pull/12470))
- Server: Add support for script tags ([#12522](https://github.com/storybookjs/storybook/pull/12522))

### Dependency Upgrades

- Core: Upgrade babel ([#12499](https://github.com/storybookjs/storybook/pull/12499))

## 6.1.0-alpha.11 (September 19, 2020)

### Bug Fixes

- Preact: Keep the story state between rerenders ([#12221](https://github.com/storybookjs/storybook/pull/12221))

### Maintenance

- Addon-controls: Update style of Boolean control ([#12515](https://github.com/storybookjs/storybook/pull/12515))

## 6.1.0-alpha.10 (September 16, 2020)

### Features

- Ember: Add `emberOptions` to `main.js` config ✨ ([#12440](https://github.com/storybookjs/storybook/pull/12440))

### Bug Fixes

- React: Fix reactDocgen option when false ([#12492](https://github.com/storybookjs/storybook/pull/12492))

## 6.1.0-alpha.9 (September 13, 2020)

### Features

- Storyshots: Allow taking a screenshot of just a specific element ([#12460](https://github.com/storybookjs/storybook/pull/12460))

### Bug Fixes

- CLI: Fix storiesof-to-csf codemod for TypeScript ([#12453](https://github.com/storybookjs/storybook/pull/12453))

### Maintenance

- Addon-docs: Resolve vue-docgen-loader from @storybook/vue ([#12461](https://github.com/storybookjs/storybook/pull/12461))
- Build: Disable problematic story in Chromatic ([#12457](https://github.com/storybookjs/storybook/pull/12457))

## 6.1.0-alpha.8 (September 12, 2020)

### Features

- HTML: Add script tag support ([#12089](https://github.com/storybookjs/storybook/pull/12089))
- Addon-docs: Fix fixed-position inline stories ([#11350](https://github.com/storybookjs/storybook/pull/11350))

### Bug Fixes

- Core: require.resolve loaders and add missing dependencies ([#12383](https://github.com/storybookjs/storybook/pull/12383))
- Addon-docs: Fix DocsPage scroll behavior ([#12047](https://github.com/storybookjs/storybook/pull/12047))

### Maintenance

- Core: Fix monorepo compatibility ([#11753](https://github.com/storybookjs/storybook/pull/11753))

## 6.1.0-alpha.7 (September 10, 2020)

### Features

- Components: Add graphql support to SyntaxHighlighter ([#12385](https://github.com/storybookjs/storybook/pull/12385))

### Bug Fixes

- UI: Fix the p > div nesting issue ([#12298](https://github.com/storybookjs/storybook/pull/12298))
- Addon-docs: Apply transformSource to any SourceType ([#12375](https://github.com/storybookjs/storybook/pull/12375))
- CLI: Workaround for react native `sb init` ([#12405](https://github.com/storybookjs/storybook/pull/12405))

### Dependency Upgrades

- Core: Change react deps to normal deps ([#11628](https://github.com/storybookjs/storybook/pull/11628))

## 6.1.0-alpha.6 (September 10, 2020)

### Features

- Core: Add static dir path mappings ([#12222](https://github.com/storybookjs/storybook/pull/12222))
- Addon-controls: Default to radio control for small enums ([#12436](https://github.com/storybookjs/storybook/pull/12436))

### Bug Fixes

- Source-loader: Export extract-source in its own entry point ([#12429](https://github.com/storybookjs/storybook/pull/12429))
- Addon-docs: Prefer flow's union elements over raw values ([#12376](https://github.com/storybookjs/storybook/pull/12376))

## 6.1.0-alpha.5 (September 10, 2020)

Failed npm publish

## 6.1.0-alpha.4 (September 8, 2020)

### Features

- Addon-docs: Add Methods to web components ArgsTable ([#12413](https://github.com/storybookjs/storybook/pull/12413))

### Bug Fixes

- Addon-docs: Introduce undefined filtering to jsxDecorator ([#12365](https://github.com/storybookjs/storybook/pull/12365))
- Addon-docs: Fix missing line-height on TypeSet block ([#12134](https://github.com/storybookjs/storybook/pull/12134))

### Maintenance

- Addon-docs: Reuse extractSource from source-loader ([#12225](https://github.com/storybookjs/storybook/pull/12225))

## 6.1.0-alpha.3 (September 3, 2020)

### Features

- Addon-docs: Add Controls argument autodetection for svelte ([#12347](https://github.com/storybookjs/storybook/pull/12347))

### Bug Fixes

- Core: Use denormed params of the first story for initial options ([#11938](https://github.com/storybookjs/storybook/pull/11938))

### Maintenance

- Addon-docs: Light refactor of Source block ([#12268](https://github.com/storybookjs/storybook/pull/12268))
- Addon-docs: Change 2nd argument of transformSource to the storyContext ([#12265](https://github.com/storybookjs/storybook/pull/12265))

### Dependency Upgrades

- Bump css from 2.2.4 to 3.0.0 ([#12338](https://github.com/storybookjs/storybook/pull/12338))

## 6.1.0-alpha.2 (September 3, 2020)

Failed NPM publish

## 6.1.0-alpha.1 (August 31, 2020)

### Features

- Components: Add additionalActions prop to Preview block ([#12274](https://github.com/storybookjs/storybook/pull/12274))

### Maintenance

- Addon-docs: Add transformSource for jsxDecorator, deprecated onBeforeRender ([#12178](https://github.com/storybookjs/storybook/pull/12178))

### Dependency Upgrades

- Update the axe version in addon-a11y to 4.0 ([#12150](https://github.com/storybookjs/storybook/pull/12150))
- Upgrade react-popper-tooltip to 3.1.0 ([#11827](https://github.com/storybookjs/storybook/pull/11827))

## 6.1.0-alpha.0 (August 31, 2020)

### Features

- SyntaxHighlighter: Put formatted code to clipboard ([#11276](https://github.com/storybookjs/storybook/pull/11276))
- Addon-docs: Add inline rendering for svelte ([#12313](https://github.com/storybookjs/storybook/pull/12313))

### Bug Fixes

- UI: Remove scrolling attribute from iFrame ([#12223](https://github.com/storybookjs/storybook/pull/12223))

### Maintenance

- CLI: Add HTML components and stories ([#12286](https://github.com/storybookjs/storybook/pull/12286))
- Vue: Add basic CSF types ([#12037](https://github.com/storybookjs/storybook/pull/12037))
- CLI: Add Aurelia detection ([#12181](https://github.com/storybookjs/storybook/pull/12181))
- Storyshots: Remove needless iteration testStorySnapshots ([#12321](https://github.com/storybookjs/storybook/pull/12321))

### Dependency Upgrades

- Bump react-syntax-highlighter to 13.2.1 ([#11838](https://github.com/storybookjs/storybook/pull/11838))

## 6.0.21 (August 31, 2020)

### Bug Fixes

- Addon-controls: Fix uncontrolled to controlled warning for booleans ([#12322](https://github.com/storybookjs/storybook/pull/12322))

### Maintenance

- Build: Add CRA benchmark ([#12209](https://github.com/storybookjs/storybook/pull/12209))

## 6.0.20 (August 28, 2020)

### Bug Fixes

- ArgsTable: Fix union type splitting ([#11868](https://github.com/storybookjs/storybook/pull/11868))
- CLI: Fix import of Button in react mdx template ([#12252](https://github.com/storybookjs/storybook/pull/12252))

## 5.3.21 (August 28, 2020)

### Bug Fixes

- Core: Add skip dispose option to ClientApi ([#9868](https://github.com/storybookjs/storybook/pull/9868))

## 6.0.19 (August 27, 2020)

### Bug Fixes

- UI: Fix eject and copy URLs for composition ([#12233](https://github.com/storybookjs/storybook/pull/12233))

## 5.3.20 (August 27, 2020)

### Bug Fixes

- React-native server: Fix addon tabs ([#10468](https://github.com/storybookjs/storybook/pull/10468))
- Addon-docs: Fix babel JSX handling in MDX ([#11448](https://github.com/storybookjs/storybook/pull/11448))
- Revert "Fix: Search stories" ([#10916](https://github.com/storybookjs/storybook/pull/10916))

## 6.0.18 (August 26, 2020)

### Bug Fixes

- UI: Fix `disable` parameter to hide addon panel ([#12171](https://github.com/storybookjs/storybook/pull/12171))
- Addon-controls: Fix controls from args ([#12230](https://github.com/storybookjs/storybook/pull/12230))

### Dependency Upgrades

- Mithril: Add Mithril v2.0.0 to peer dependencies ([#12229](https://github.com/storybookjs/storybook/pull/12229))

## 6.0.17 (August 25, 2020)

### Bug Fixes

- Addon-essentials: Log info on config override ([#12211](https://github.com/storybookjs/storybook/pull/12211))

### Maintenance

- Build: Remove outdated CLI tests ([#12207](https://github.com/storybookjs/storybook/pull/12207))

### Dependency Upgrades

- Source-loader: Pin prettier to 2.0.x version ([#12226](https://github.com/storybookjs/storybook/pull/12226))

## 6.0.16 (August 20, 2020)

### Bug Fixes

- Addon-docs: Fix Vue ArgsTable sanitizing of item.type.elements to item.type.value ([#12165](https://github.com/storybookjs/storybook/pull/12165))

## 6.0.15 (August 20, 2020)

### Bug Fixes

- Addon-docs: Fix ArgsTable union type handling in Vue/TS ([#12158](https://github.com/storybookjs/storybook/pull/12158))
- Addon-docs: Fix inline rendering for DOM nodes in HTML ([#12164](https://github.com/storybookjs/storybook/pull/12164))

### Maintenance

- React: Simplify component type for CSF typing ([#12110](https://github.com/storybookjs/storybook/pull/12110))

## 6.0.14 (August 20, 2020)

### Bug Fixes

- Addon-docs: Fix MDX IDs from CSF imports ([#12154](https://github.com/storybookjs/storybook/pull/12154))
- Addon-viewport: Add preset to fix windows import ([#12148](https://github.com/storybookjs/storybook/pull/12148))
- Composition: Verify refs in node ([#12085](https://github.com/storybookjs/storybook/pull/12085))

### Maintenance

- Build: Update and optimize circleCI Config ([#12118](https://github.com/storybookjs/storybook/pull/12118))

## 6.0.13 (August 19, 2020)

### Bug Fixes

- Source-loader: Fix default exports of type TSAsExpression ([#12099](https://github.com/storybookjs/storybook/pull/12099))
- Addon-docs: Fix source code for Template.bind({}) in MDX ([#12107](https://github.com/storybookjs/storybook/pull/12107))
- Addon-A11y: Fix manual run & timeline ([#12003](https://github.com/storybookjs/storybook/pull/12003))
- Core: Add frameworkPath to options to support custom frameworks ([#12087](https://github.com/storybookjs/storybook/pull/12087))

## 6.0.12 (August 17, 2020)

### Bug Fixes

- Angular: Make CLI templates compatible with TS strict mode ([#12081](https://github.com/storybookjs/storybook/pull/12081))
- React: Fix CSF component typing ([#12072](https://github.com/storybookjs/storybook/pull/12072))
- ArgsTable: Fix styles to allow long text to wrap ([#11818](https://github.com/storybookjs/storybook/pull/11818))
- Addon-docs: Fix main check for absolute config dirs ([#12057](https://github.com/storybookjs/storybook/pull/12057))

## 6.0.11 (August 17, 2020)

NPM publish failed

## 6.0.10 (August 15, 2020)

### Bug Fixes

- Addon-controls: Fix argType inference priority ([#12048](https://github.com/storybookjs/storybook/pull/12048))

## 6.0.9 (August 15, 2020)

### Bug Fixes

- Addon-docs: Fix CSF names importing in MDX ([#12044](https://github.com/storybookjs/storybook/pull/12044))

### Maintenance

- ArgsTable: Error when subcomponents is an array ([#12033](https://github.com/storybookjs/storybook/pull/12033))

## 6.0.8 (August 15, 2020)

Unpublished

## 6.0.7 (August 14, 2020)

### Bug Fixes

- Addon-docs: Fix extractArgTypes for unknown component ([#12012](https://github.com/storybookjs/storybook/pull/12012))

### Maintenance

- UI: Update upgrade command in about section ([#11934](https://github.com/storybookjs/storybook/pull/11934))
- Build: Remove documentation scripts and fix README ([#12015](https://github.com/storybookjs/storybook/pull/12015))

### Dependency Upgrades

- Bump jest-specific-snapshot to v4 ([#11939](https://github.com/storybookjs/storybook/pull/11939))

## 6.0.6 (August 14, 2020)

### Bug Fixes

- CLI: Fix upgrade to warn when no packages found ([#11993](https://github.com/storybookjs/storybook/pull/11993))
- Addon-docs: Fix blocks type export ([#11987](https://github.com/storybookjs/storybook/pull/11987))
- CLI: Fix RN link ([#11973](https://github.com/storybookjs/storybook/pull/11973))

## 6.0.5 (August 13, 2020)

### Bug Fixes

- CLI: Fix welcome links on Introduction MDX ([#11949](https://github.com/storybookjs/storybook/pull/11949))

## 6.0.4 (August 12, 2020)

### Bug Fixes

- Source-loader: Fix `.add` detection ([#11920](https://github.com/storybookjs/storybook/pull/11920))

## 6.0.3 (August 12, 2020)

### Bug Fixes

- Essentials: Fix missing toolbars addon ([#11910](https://github.com/storybookjs/storybook/pull/11910))

## 6.0.2 (August 11, 2020)

### Bug Fixes

- CLI: Fix csf-hoist-story-annotations codemod for variable default exports ([#11895](https://github.com/storybookjs/storybook/pull/11895))

## 6.0.1 (August 11, 2020)

### Bug Fixes

- Core: Fix support for main.ts/preview.ts files ([#11885](https://github.com/storybookjs/storybook/pull/11885))
- Addon-docs: Fix ArgsTable regression ([#11889](https://github.com/storybookjs/storybook/pull/11889))

## 6.0.0 (August 10, 2020)

Storybook 6.0 is here!

- 💎 [Essentials: Zero-configuration setup](https://medium.com/storybookjs/zero-config-storybook-66e7c4798e5d)
- 🧬 [Args: Next-generation, dynamic story format](https://medium.com/storybookjs/introducing-storybook-args-2dadcdb777cc)
- 🎛 [Controls: Live edit component examples](https://medium.com/storybookjs/storybook-controls-ce82af93e430)
- 🌐 [Composition: Combine multiple Storybooks](https://medium.com/storybookjs/storybook-composition-af0da9084fba)
- 📚 [Documentation: Complete project overhaul](https://storybook.js.org/docs/react/get-started)

  6.0 contains hundreds more fixes, features, and tweaks. Browse the changelogs matching `6.0.0-alpha.*`, `6.0.0-beta.*`, and `6.0.0-rc.*` for the full list of changes. See [MIGRATION.md](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) to upgrade from `5.3` or earlier.

## 6.0.0-rc.30 (August 10, 2020)

### Bug Fixes

- Storyshots: Don't ship typescript files in dist ([#11792](https://github.com/storybookjs/storybook/pull/11792))

### Maintenance

- 6.0 documentation overhaul ([#11861](https://github.com/storybookjs/storybook/pull/11861))

## 6.0.0-rc.29 (August 7, 2020)

### Features

- CLI: Add CSF types for Angular ([#11825](https://github.com/storybookjs/storybook/pull/11825))

### Bug Fixes

- Core: Fix serialization of `undefined` ([#11829](https://github.com/storybookjs/storybook/pull/11829))

## 6.0.0-rc.28 (August 6, 2020)

### Bug Fixes

- CLI: Add CSF typings for react stories ([#11811](https://github.com/storybookjs/storybook/pull/11811))

### Dependency Upgrades

- Upgrade telejson to 5.0.1 ([#11824](https://github.com/storybookjs/storybook/pull/11824))

## 6.0.0-rc.27 (August 6, 2020)

### Features

- Addon-docs: Prettier, collapsible values in ArgsTable ([#11768](https://github.com/storybookjs/storybook/pull/11768))
- Addon-docs: Add inline rendering support for HTML ([#11814](https://github.com/storybookjs/storybook/pull/11814))

### Bug Fixes

- Addon-controls: Fix ArgsTable bugs and styling ([#11805](https://github.com/storybookjs/storybook/pull/11805))
- Addon-docs: Don't zoom docs content ([#11795](https://github.com/storybookjs/storybook/pull/11795))

## 6.0.0-rc.26 (August 5, 2020)

### Dependency Upgrades

- Perf: Upgrade telejson ([#11797](https://github.com/storybookjs/storybook/pull/11797))

## 6.0.0-rc.25 (August 4, 2020)

### Bug Fixes

- CSF: Fix mixed `.x` and deprecated `.story.x` parameters ([#11781](https://github.com/storybookjs/storybook/pull/11781))

## 6.0.0-rc.24 (August 3, 2020)

### Bug Fixes

- Addon-docs: Fix link font size to inherit ([#11770](https://github.com/storybookjs/storybook/pull/11770))
- Addon-knobs: Fix search params with URI encoding ([#11642](https://github.com/storybookjs/storybook/pull/11642))
- Core: Add `STORY_SPECIFIED` event for initial selection/URL ([#11766](https://github.com/storybookjs/storybook/pull/11766))
- Core: Fix handling of initial hashes ([#11767](https://github.com/storybookjs/storybook/pull/11767))

### Documentation

- Core: Fix link to deprecated configure ([#11771](https://github.com/storybookjs/storybook/pull/11771))

## 6.0.0-rc.23 (August 3, 2020)

### Bug Fixes

- Source-loader: Fix storiesOf missing `__STORY__` variable ([#11765](https://github.com/storybookjs/storybook/pull/11765))

## 6.0.0-rc.22 (August 2, 2020)

### Features

- Addon-docs: Add `docs.description` parameter ([#11761](https://github.com/storybookjs/storybook/pull/11761))

### Bug Fixes

- Composition: Fix missing version property in autoref ([#11745](https://github.com/storybookjs/storybook/pull/11745))
- Addon-a11y: Fix inherited parameters ([#11730](https://github.com/storybookjs/storybook/pull/11730))
- Addon-docs: Fix Ember args ([#11760](https://github.com/storybookjs/storybook/pull/11760))
- Addon-Docs: Fix Ember extractArgTypes default value ([#10512](https://github.com/storybookjs/storybook/pull/10512))
- Addon-Docs: Fix Ember extractArgTypes ([#10525](https://github.com/storybookjs/storybook/pull/10525))

### Dependency Upgrades

- Addon-docs: Make vue-docgen optional peer deps ([#11759](https://github.com/storybookjs/storybook/pull/11759))

## 6.0.0-rc.21 (August 1, 2020)

### Features

- Addon-docs: Add Story.story for CSF stories with MDX docs ([#11752](https://github.com/storybookjs/storybook/pull/11752))

### Maintenance

- Addon-docs: Rename Preview/Props to Canvas/ArgsTable ([#11744](https://github.com/storybookjs/storybook/pull/11744))

## 6.0.0-rc.20 (July 31, 2020)

### Breaking Changes

- Core: Pass normalized parameters to the story sort function ([#11743](https://github.com/storybookjs/storybook/pull/11743))

### Bug Fixes

- Core: Dedupe argTypes serialization ([#11740](https://github.com/storybookjs/storybook/pull/11740))

## 6.0.0-rc.19 (July 31, 2020)

### Bug Fixes

- Core: Speed up combineParameters ([#11736](https://github.com/storybookjs/storybook/pull/11736))
- Addon-docs: Support absolute anchors when deployed at non-root ([#11403](https://github.com/storybookjs/storybook/pull/11403))

### Maintenance

- Args: Add optional scalar test cases for typescript ([#11149](https://github.com/storybookjs/storybook/pull/11149))

## 6.0.0-rc.18 (July 30, 2020)

### Bug Fixes

- Addon-controls: Fix update logic for argTypes with custom names ([#11704](https://github.com/storybookjs/storybook/pull/11704))
- Core: Fix HMR ([#11709](https://github.com/storybookjs/storybook/pull/11709))
- Server: Serialize Object controls as JSON over the wire ([#11703](https://github.com/storybookjs/storybook/pull/11703))
- Revert #11502: Remove z-index on ActionBar ([#11708](https://github.com/storybookjs/storybook/pull/11708))
- Revert #11066: Add skip to content on panel and story iframe ([#11718](https://github.com/storybookjs/storybook/pull/11718))
- UI: Improve treestate performance ([#11725](https://github.com/storybookjs/storybook/pull/11725))

## 6.0.0-rc.17 (July 30, 2020)

Failed NPM publish

## 6.0.0-rc.16 (July 28, 2020)

### Features

- Source-loader: Inject source snippets as story parameters ([#11707](https://github.com/storybookjs/storybook/pull/11707))
- Source-loader: Handle bind expression stories ([#11710](https://github.com/storybookjs/storybook/pull/11710))
- UI: Add skip to content on panel and story iframe ([#11066](https://github.com/storybookjs/storybook/pull/11066))
- Addon-storyshots: Add web-component support ([#11064](https://github.com/storybookjs/storybook/pull/11064))

### Bug Fixes

- Addon-docs: Fix docs render layout to always be 'fullscreen' ([#11699](https://github.com/storybookjs/storybook/pull/11699))
- UI: Fix release notes on production builds ([#11700](https://github.com/storybookjs/storybook/pull/11700))
- Addon-docs: Apply list styles over reset ([#11281](https://github.com/storybookjs/storybook/pull/11281))

### Maintenance

- CLI: Update rax/mithril/web-components templates, rework Yarn2 E2E ([#11354](https://github.com/storybookjs/storybook/pull/11354))

## 6.0.0-rc.15 (July 27, 2020)

### Features

- Server: Update to 6.0 APIs and support Controls ([#11680](https://github.com/storybookjs/storybook/pull/11680))

### Bug Fixes

- Addon-Storysource: Fix broken source when there's no story ([#11679](https://github.com/storybookjs/storybook/pull/11679))
- Angular: Use system path when checking if asset is a directory ([#11472](https://github.com/storybookjs/storybook/pull/11472))
- Composition: Fix composition of older storybooks ([#11673](https://github.com/storybookjs/storybook/pull/11673))
- Core: Fix existing behavior with story prefixes ([#11660](https://github.com/storybookjs/storybook/pull/11660))
- Core: Fix webpack recursion in mainjs glob processing logic ([#11647](https://github.com/storybookjs/storybook/pull/11647))

### Maintenance

- Addon-knobs: Move `@types/react-color` to devDeps ([#11690](https://github.com/storybookjs/storybook/pull/11690))

### Dependency Upgrades

- Bump react-docgen-typescript-plugin to 0.5.2 ([#11658](https://github.com/storybookjs/storybook/pull/11658))

## 6.0.0-rc.14 (July 22, 2020)

### Bug Fixes

- Addon-docs: Re-enable source-loader by default ([#11650](https://github.com/storybookjs/storybook/pull/11650))
- Core: Remove duplicate decorators and warn ([#11643](https://github.com/storybookjs/storybook/pull/11643))
- Storyshots: Fix metadata (parameters/decorators) handling ([#11518](https://github.com/storybookjs/storybook/pull/11518))
- Addon-docs: Skip dynamic source rendering when not needed ([#11640](https://github.com/storybookjs/storybook/pull/11640))
- Core: Fix prefix redirect ([#11637](https://github.com/storybookjs/storybook/pull/11637))

### Maintenance

- Core: Log message length on channel message ([#11646](https://github.com/storybookjs/storybook/pull/11646))

## 6.0.0-rc.13 (July 21, 2020)

### Bug Fixes

- Core: Improve translation of globs for main.js stories ([#11531](https://github.com/storybookjs/storybook/pull/11531))
- Core: Optimize `storiesHash` by removing unused parameters ([#11624](https://github.com/storybookjs/storybook/pull/11624))
- Composition: Fix docs-only stories in composed refs ([#11584](https://github.com/storybookjs/storybook/pull/11584))
- CLI: Generate `docs:json` command dynamically for Angular project ([#11622](https://github.com/storybookjs/storybook/pull/11622))

## 6.0.0-rc.12 (July 20, 2020)

### Bug Fixes

- Addon-controls: Fix undefined args handling ([#11619](https://github.com/storybookjs/storybook/pull/11619))
- UI: Fix the color of the menu separator ([#11564](https://github.com/storybookjs/storybook/pull/11564))
- Storyshots: Don't show `configure` deprecation warning ([#11611](https://github.com/storybookjs/storybook/pull/11611))
- Addon-docs: Fix Props `components` input ([#11612](https://github.com/storybookjs/storybook/pull/11612))

### Maintenance

- Examples: Remove deprecated hierarchy separators ([#11615](https://github.com/storybookjs/storybook/pull/11615))
- Hoist CSF `.story` annotations ([#11617](https://github.com/storybookjs/storybook/pull/11617))

## 6.0.0-rc.11 (July 19, 2020)

### Features

- Addon-controls: Expose `presetColors` for the color control ([#11606](https://github.com/storybookjs/storybook/pull/11606))

### Bug Fixes

- Addon-docs: Fix Vue defaultValue in props table ([#11603](https://github.com/storybookjs/storybook/pull/11603))

## 6.0.0-rc.10 (July 18, 2020)

### Features

- Addon-docs: Automatic source selection based on story type ([#11601](https://github.com/storybookjs/storybook/pull/11601))

## 6.0.0-rc.9 (July 17, 2020)

### Bug Fixes

- Addon-controls: Fix no-args warning if argTypes are used ([#11598](https://github.com/storybookjs/storybook/pull/11598))
- Core: Pass denormalized stories to the sort function ([#11572](https://github.com/storybookjs/storybook/pull/11572))
- Addon-docs: Fix Vue inline rendering with Args and decorators ([#11594](https://github.com/storybookjs/storybook/pull/11594))
- Composition: Fix missing refId on getData calls ([#11541](https://github.com/storybookjs/storybook/pull/11541))
- UI: Fix scrollbars in flexbar ([#11579](https://github.com/storybookjs/storybook/pull/11579))

## 6.0.0-rc.8 (July 16, 2020)

### Features

- CLI: Component-driven React / Vue / Angular / Preact / Svelte templates ([#11505](https://github.com/storybookjs/storybook/pull/11505))
- Addon-controls: Add reset UI to ArgsTable ([#11550](https://github.com/storybookjs/storybook/pull/11550))

### Bug Fixes

- Addon-docs: Fix Vue argTypes default values ([#11534](https://github.com/storybookjs/storybook/pull/11534))

### Maintenance

- Core: Move basic argType inference out of addon-docs and into core ([#11561](https://github.com/storybookjs/storybook/pull/11561))

## 6.0.0-rc.7 (July 16, 2020)

NPM publish failed

## 6.0.0-rc.6 (July 16, 2020)

NPM publish failed

## 6.0.0-rc.5 (July 15, 2020)

### Features

- Core: Add args reset API ([#11519](https://github.com/storybookjs/storybook/pull/11519))

### Bug Fixes

- Addon-docs: Make Meta block subcomponents optional ([#11556](https://github.com/storybookjs/storybook/pull/11556))
- UI: Remove z-index on ActionBar ([#11502](https://github.com/storybookjs/storybook/pull/11502))
- Composition: Fix docs-only story handling for composed storybooks ([#11537](https://github.com/storybookjs/storybook/pull/11537))
- Addon-Docs: Fix ArgsTable controls on Docs tab ([#11552](https://github.com/storybookjs/storybook/pull/11552))

### Maintenance

- Core: Add `argTypes` to `StoryContext` ([#11558](https://github.com/storybookjs/storybook/pull/11558))
- CLI: Improve Storybook packages version management ([#11342](https://github.com/storybookjs/storybook/pull/11342))

## 6.0.0-rc.4 (July 15, 2020)

NPM publish failed

## 6.0.0-rc.3 (July 11, 2020)

### Bug Fixes

- Composition: Don't show versions dropdown if there are no versions ([#11497](https://github.com/storybookjs/storybook/pull/11497))
- Addon-docs: Remove undefined for optional values in Typescript Props ([#11503](https://github.com/storybookjs/storybook/pull/11503))

## 6.0.0-rc.2 (July 10, 2020)

### Bug Fixes

- UI: Fix menu alignment regression ([#11469](https://github.com/storybookjs/storybook/pull/11469))
- Composition: Fix syntax on `no-cors` ([#11491](https://github.com/storybookjs/storybook/pull/11491))
- Addon-docs: Fix MDX handling to ignore babel.config.js ([#11495](https://github.com/storybookjs/storybook/pull/11495))
- UI: Increase max-height of menu tooltip so scrollbars don't appear ([#11471](https://github.com/storybookjs/storybook/pull/11471))

### Maintenance

- CLI: Add common welcome MDX and cleanup ([#11422](https://github.com/storybookjs/storybook/pull/11422))
- CSF: Deprecate duplicate titles rather than forbid them ([#11476](https://github.com/storybookjs/storybook/pull/11476))

## 6.0.0-rc.1 (July 9, 2020)

### Bug Fixes

- Addon-toolbars: Show name if there is no icon ([#11475](https://github.com/storybookjs/storybook/pull/11475))

### Maintenance

- CI: Fix iframe test flake ([#11473](https://github.com/storybookjs/storybook/pull/11473))
- CI: Deploy the `next` branch of frontpage too ([#11462](https://github.com/storybookjs/storybook/pull/11462))

### Dependency Upgrades

- Bump vue-property-decorator from 8.4.2 to 9.0.0 ([#11241](https://github.com/storybookjs/storybook/pull/11241))
- Bump @types/react-dom from 16.9.7 to 16.9.8 ([#11191](https://github.com/storybookjs/storybook/pull/11191))
- Bump jest-image-snapshot from 3.1.0 to 4.0.2 ([#11267](https://github.com/storybookjs/storybook/pull/11267))
- Bump autoprefixer from 9.8.0 to 9.8.4 ([#11288](https://github.com/storybookjs/storybook/pull/11288))
- [Security] Bump npm-registry-fetch from 4.0.4 to 4.0.5 ([#11453](https://github.com/storybookjs/storybook/pull/11453))

## 6.0.0-rc.0 (July 8, 2020)

[Storybook 6.0](https://github.com/storybookjs/storybook/issues/9311) is stabilizing! It brings loads of component dev and documentation improvements to your favorite workshop:

- [Args](https://docs.google.com/document/d/1Mhp1UFRCKCsN8pjlfPdz8ZdisgjNXeMXpXvGoALjxYM/edit#heading=h.6mdg0tp8crgj) - next-gen dynamic component examples
  - ([controls](https://github.com/storybookjs/storybook/pull/10834) / [runtime](https://github.com/storybookjs/storybook/pull/10014) / [actions](https://github.com/storybookjs/storybook/pull/10029) / [toolbars](https://github.com/storybookjs/storybook/pull/10028) / [docs controls](https://github.com/storybookjs/storybook/pull/10354))
- [Composition](https://github.com/storybookjs/storybook/pull/9210) - compose multiple storybooks into one
- [Zero-config Typescript](https://github.com/storybookjs/storybook/pull/10813) - pre-configured for all frameworks, easy customization
- [Yarn 2 support](https://github.com/storybookjs/storybook/issues/9527) - next generation package management

## 6.0.0-beta.46 (July 8, 2020)

### Breaking Changes

- Addon-backgrounds: Zero config defaults ([#11460](https://github.com/storybookjs/storybook/pull/11460))

### Features

- Composition: Add version query to composed ref ([#11447](https://github.com/storybookjs/storybook/pull/11447))
- UI: Add version release notes ([#11360](https://github.com/storybookjs/storybook/pull/11360))

### Maintenance

- Addon-controls: Add addon-docs check on startup ([#11458](https://github.com/storybookjs/storybook/pull/11458))
- Addon-docs: Remove deprecated addParameters calls ([#11455](https://github.com/storybookjs/storybook/pull/11455))
- Composition: Change event source to ref ([#11392](https://github.com/storybookjs/storybook/pull/11392))
- Fix Yarn 2 compatibility in CLI and Essentials ([#11444](https://github.com/storybookjs/storybook/pull/11444))

## 6.0.0-beta.45 (July 7, 2020)

### Bug Fixes

- Addon-docs: Fix babel JSX handling in MDX ([#11448](https://github.com/storybookjs/storybook/pull/11448))

## 6.0.0-beta.44 (July 6, 2020)

### Breaking Changes

- Core: Consistent file paths for locally-defined addons ([#11368](https://github.com/storybookjs/storybook/pull/11368))

### Features

- Composition: Ensure args get sent to the right ref ([#11401](https://github.com/storybookjs/storybook/pull/11401))
- Core: Deprecate configure and clearDecorators ([#11431](https://github.com/storybookjs/storybook/pull/11431))

### Bug Fixes

- Controls: Fix object control for story switching ([#11432](https://github.com/storybookjs/storybook/pull/11432))
- Controls: Fix interaction lag & CJK input ([#11430](https://github.com/storybookjs/storybook/pull/11430))

## 6.0.0-beta.43 (July 5, 2020)

### Features

- Composition: Ignore globals from non-local refs ([#11407](https://github.com/storybookjs/storybook/pull/11407))

### Maintenance

- Core: Remove manager redirects on boot ([#11390](https://github.com/storybookjs/storybook/pull/11390))

## 6.0.0-beta.42 (July 5, 2020)

### Bug Fixes

- Addon-docs: Fix Props subcomponents regression ([#11420](https://github.com/storybookjs/storybook/pull/11420))

### Maintenance

- Core: Deprecate `addParameters` and `addDecorator` ([#11417](https://github.com/storybookjs/storybook/pull/11417))

## 6.0.0-beta.41 (July 4, 2020)

### Bug Fixes

- Addon-docs: Fix subcomponents display logic ([#11415](https://github.com/storybookjs/storybook/pull/11415))
- Addon-docs: Fix Source rendering corner case ([#11414](https://github.com/storybookjs/storybook/pull/11414))

## 6.0.0-beta.40 (July 4, 2020)

### Features

- CLI: Add upgrade utility with version consistency check ([#11396](https://github.com/storybookjs/storybook/pull/11396))

### Maintenance

- Build: Fix CI breaks ([#11410](https://github.com/storybookjs/storybook/pull/11410))
- Core: Deprecate immutable options as parameters ([#11387](https://github.com/storybookjs/storybook/pull/11387))

## 6.0.0-beta.39 (July 2, 2020)

### Breaking Changes

- CSF: Forbid duplicate kinds ([#11369](https://github.com/storybookjs/storybook/pull/11369))
- Args: Rename `globalArgs` to `globals` ([#11385](https://github.com/storybookjs/storybook/pull/11385))

### Features

- Args: Disable rows and controls in argTypes ([#11388](https://github.com/storybookjs/storybook/pull/11388))
- Composition: Add auto disable ([#11364](https://github.com/storybookjs/storybook/pull/11364))
- CLI: use addon-essentials & args ([#11282](https://github.com/storybookjs/storybook/pull/11282))

### Maintenance

- Build: Add artifacts for e2e CI task ([#11365](https://github.com/storybookjs/storybook/pull/11365))
- Build: Remove cli fixtures in favor of e2e ([#11357](https://github.com/storybookjs/storybook/pull/11357))

## 6.0.0-beta.38 (June 30, 2020)

### Breaking Changes

- Configuration: Remove hierarchy separators ([#11344](https://github.com/storybookjs/storybook/pull/11344))

### Features

- Addon-docs: Dynamic Source rendering for React ([#11332](https://github.com/storybookjs/storybook/pull/11332))
- Args: Store global args in session storage ([#11345](https://github.com/storybookjs/storybook/pull/11345))
- Addon-docs: Add opt-in Markdown transclusion in MDX ([#11334](https://github.com/storybookjs/storybook/pull/11334))

### Bug Fixes

- Core: Fix preset options handling ([#11333](https://github.com/storybookjs/storybook/pull/11333))
- UI: Revert theming greys flip ([#11297](https://github.com/storybookjs/storybook/pull/11297))
- Core: Composition QA ([#11224](https://github.com/storybookjs/storybook/pull/11224))

### Maintenance

- Examples: Dual theme rendering ([#11295](https://github.com/storybookjs/storybook/pull/11295))
- Examples: Recreate stories for sidebaritem ([#11298](https://github.com/storybookjs/storybook/pull/11298))

## 6.0.0-beta.37 (June 26, 2020)

### Breaking Changes

- Core: Deprecate `setAddon` from `storiesOf` API ([#11322](https://github.com/storybookjs/storybook/pull/11322))

### Bug Fixes

- Revert "Core: Fix source-map strategy for production" ([#11320](https://github.com/storybookjs/storybook/pull/11320))
- Core: Set viewMode to story when navating from non story pages ([#11317](https://github.com/storybookjs/storybook/pull/11317))

### Dependency Upgrades

- Bump react-textarea-autosize to 8.1.1 ([#11319](https://github.com/storybookjs/storybook/pull/11319))

## 6.0.0-beta.36 (June 25, 2020)

### Features

- Composition: Allow refs versions in config ([#11294](https://github.com/storybookjs/storybook/pull/11294))

### Bug Fixes

- CLI: Fix docs & essentials version on `sb@next init` ([#11303](https://github.com/storybookjs/storybook/pull/11303))
- Composition: Fix list of versions missing current version ([#11259](https://github.com/storybookjs/storybook/pull/11259))
- Composition: Fix undefined/undefined in url on init ([#11293](https://github.com/storybookjs/storybook/pull/11293))

### Maintenance

- Essentials example: Fix typescript error ([#11305](https://github.com/storybookjs/storybook/pull/11305))

## 6.0.0-beta.35 (June 24, 2020)

### Features

- Essentials: Add addon-controls ([#11285](https://github.com/storybookjs/storybook/pull/11285))

### Bug Fixes

- Addon-docs markdown tables right align support ([#11280](https://github.com/storybookjs/storybook/pull/11280))

### Maintenance

- Addon-docs: Simplify argType inference ([#11284](https://github.com/storybookjs/storybook/pull/11284))

## 6.0.0-beta.34 (June 23, 2020)

### Features

- Addon-backgrounds: Allow gradients in story preview ([#11265](https://github.com/storybookjs/storybook/pull/11265))

### Bug Fixes

- Core: Fix invalid glob warning for absolute paths ([#11247](https://github.com/storybookjs/storybook/pull/11247))

### Maintenance

- UI: Replace document.execCommand with navigator.clipboard ([#11251](https://github.com/storybookjs/storybook/pull/11251))
- ArgsTable: Updated Boolean control ([#11263](https://github.com/storybookjs/storybook/pull/11263))
- Core; Preserve watch output when running dev mode ([#11150](https://github.com/storybookjs/storybook/pull/11150))

### Dependency Upgrades

- Bump lint-staged from 10.2.6 to 10.2.10 ([#11187](https://github.com/storybookjs/storybook/pull/11187))

## 6.0.0-beta.33 (June 22, 2020)

### Features

- ArgsTable: Add subsections and design cleanup ([#11216](https://github.com/storybookjs/storybook/pull/11216))
- Core: Improve startup events ([#11080](https://github.com/storybookjs/storybook/pull/11080))

### Bug Fixes

- Preact: Fix Preact 8 compatibility ([#11225](https://github.com/storybookjs/storybook/pull/11225))

### Maintenance

- Core :Add deprecation message for selectedName/Kind urls ([#11111](https://github.com/storybookjs/storybook/pull/11111))

## 6.0.0-beta.32 (June 19, 2020)

### Bug Fixes

- Addon-knobs: Update select types for undefined, null and boolean ([#11202](https://github.com/storybookjs/storybook/pull/11202))

### Maintenance

- Composition: rename auth url & add tests for modules/refs ([#11215](https://github.com/storybookjs/storybook/pull/11215))
- Examples: Add design-system to official example ([#11081](https://github.com/storybookjs/storybook/pull/11081))

## 6.0.0-beta.31 (June 17, 2020)

### Bug Fixes

- React: Fix react-docgen for JS files ([#11217](https://github.com/storybookjs/storybook/pull/11217))
- React: Load root tsconfig.json into docgen-typescript if none provided ([#11184](https://github.com/storybookjs/storybook/pull/11184))
- Composition: Remove manual redirects ([#11196](https://github.com/storybookjs/storybook/pull/11196))

### Dependency Upgrades

- Bump react-draggable from 4.4.2 to 4.4.3 ([#11192](https://github.com/storybookjs/storybook/pull/11192))

## 6.0.0-beta.30 (June 16, 2020)

### Features

- MDX: Support function.bind({}) syntax ([#11198](https://github.com/storybookjs/storybook/pull/11198))

### Bug Fixes

- Addon-docs: Remove render preprocessing for react components w/o docgen ([#11195](https://github.com/storybookjs/storybook/pull/11195))
- Core: Fix addon load order ([#11178](https://github.com/storybookjs/storybook/pull/11178))
- Core: Add global box-sizing setting. Fixes #10207 ([#11055](https://github.com/storybookjs/storybook/pull/11055))

### Maintenance

- Addon-controls: Add examples to angular, ember, html, svelte, vue, web-components ([#11197](https://github.com/storybookjs/storybook/pull/11197))

## 6.0.0-beta.29 (June 16, 2020)

### Features

- Addon-docs: Add syntax highlighting to Code and Description blocks ([#11183](https://github.com/storybookjs/storybook/pull/11183))

### Bug Fixes

- MDX: Don't use root babelrc by default ([#11185](https://github.com/storybookjs/storybook/pull/11185))
- Addon-docs: Fix 'show source' for stories with dynamic title ([#10959](https://github.com/storybookjs/storybook/pull/10959))

## 6.0.0-beta.28 (June 15, 2020)

### Features

- Addon-docs: Add argTypes type/control shorthand ([#11174](https://github.com/storybookjs/storybook/pull/11174))

### Bug Fixes

- Core: Remove boxSizing to fix weird CSS layouts ([#11175](https://github.com/storybookjs/storybook/pull/11175))
- Addon-docs: Fix forwardRef & invalid hook call ([#11154](https://github.com/storybookjs/storybook/pull/11154))
- Client-API: Add @types/qs typings ([#11162](https://github.com/storybookjs/storybook/pull/11162))

### Maintenance

- CLI: Colocate stories and components, centralize main.js ([#11136](https://github.com/storybookjs/storybook/pull/11136))
- Build: Exclude stories from collecting coverage ([#11164](https://github.com/storybookjs/storybook/pull/11164))
- Core: Extend router/utils test set ([#11156](https://github.com/storybookjs/storybook/pull/11156))

## 6.0.0-beta.27 (June 14, 2020)

### Maintenance

- UI: Remove unused modules ([#11159](https://github.com/storybookjs/storybook/pull/11159))
- UI: Remove unused & duplicated code ([#11155](https://github.com/storybookjs/storybook/pull/11155))
- REMOVE unused dependencies && FIX versions ([#11143](https://github.com/storybookjs/storybook/pull/11143))

## 6.0.0-beta.26 (June 12, 2020)

### Bug Fixes

- Addon-docs: Fix Vue args rendering in Docs mode ([#11138](https://github.com/storybookjs/storybook/pull/11138))
- Typescript: Fix mandatory typescript dependency ([#11140](https://github.com/storybookjs/storybook/pull/11140))

## 6.0.0-beta.25 (June 11, 2020)

### Bug Fixes

- Composition: Fix auto refs when there are no specified refs ([#11057](https://github.com/storybookjs/storybook/pull/11057))

## 6.0.0-beta.24 (June 11, 2020)

### Breaking Changes

- Components: Remove PropsTable, clean ArgsTable stories ([#11105](https://github.com/storybookjs/storybook/pull/11105))

### Features

- React: Switch react-docgen-typescript-loader to react-docgen-typescript-plugin ([#11106](https://github.com/storybookjs/storybook/pull/11106))
- Vue: Add first-class args support ([#11115](https://github.com/storybookjs/storybook/pull/11115))
- Core: Add babel plugin for typescript decorators ([#11063](https://github.com/storybookjs/storybook/pull/11063))
- CLI: Pass --quiet to disable HMR logging in browser console ([#11087](https://github.com/storybookjs/storybook/pull/11087))
- Addon-knobs: Add number of knobs to tab title ([#11075](https://github.com/storybookjs/storybook/pull/11075))

### Bug Fixes

- Core: Fix package duplication issues by aliasing all storybook packages ([#11092](https://github.com/storybookjs/storybook/pull/11092))
- hidden) canvas ([#10599](https://github.com/storybookjs/storybook/pull/10599))
- Core: Fix loglevel filtering ([#11096](https://github.com/storybookjs/storybook/pull/11096))
- Core: Remove @babel/plugin-transform-react-constant-elements ([#11086](https://github.com/storybookjs/storybook/pull/11086))
- UI: Fix search in production mode ([#10917](https://github.com/storybookjs/storybook/pull/10917))

### Maintenance

- CLI: Refactor to simplify works with multiple package managers ([#11074](https://github.com/storybookjs/storybook/pull/11074))

### Dependency Upgrades

- chore(deps-dev): bump protractor from 5.4.4 to 7.0.0 ([#10832](https://github.com/storybookjs/storybook/pull/10832))
- build(deps): [security] bump websocket-extensions from 0.1.3 to 0.1.4 ([#11056](https://github.com/storybookjs/storybook/pull/11056))
- build(deps): bump @babel/plugin-transform-shorthand-properties from 7.8.3 to 7.10.1 ([#11088](https://github.com/storybookjs/storybook/pull/11088))
- build(deps-dev): bump tslib from 1.13.0 to 2.0.0 ([#11089](https://github.com/storybookjs/storybook/pull/11089))
- build(deps-dev): bump @packtracker/webpack-plugin from 2.2.0 to 2.3.0 ([#11091](https://github.com/storybookjs/storybook/pull/11091))

## 6.0.0-beta.23 (June 8, 2020)

### Features

- Addon-docs: Add `docs.forceExtractedArgTypes` parameter ([#11069](https://github.com/storybookjs/storybook/pull/11069))

### Bug Fixes

- Vue: Fix force rendering ([#11076](https://github.com/storybookjs/storybook/pull/11076))
- Controls: Fix enum extraction for react-docgen-typescript ([#11070](https://github.com/storybookjs/storybook/pull/11070))

### Maintenance

- Core: Zero-config Typescript e2e test ([#10843](https://github.com/storybookjs/storybook/pull/10843))

## 6.0.0-beta.22 (June 6, 2020)

### Features

- Addon-controls: Add hideNoControlsWarning parameter ([#11035](https://github.com/storybookjs/storybook/pull/11035))

### Bug Fixes

- Controls: Fix null entry in options array handling ([#11048](https://github.com/storybookjs/storybook/pull/11048))
- Ember: Return early when there's no JSDoc for a component ([#10490](https://github.com/storybookjs/storybook/pull/10490))
- Ember: Fix double render ([#10971](https://github.com/storybookjs/storybook/pull/10971))
- UI: Fix focus not showing up on buttons ([#10944](https://github.com/storybookjs/storybook/pull/10944))
- Composition: Fix bad package.json resolve ([#11023](https://github.com/storybookjs/storybook/pull/11023))
- Core: Fix Yarn 2 compatibility & E2E test ([#11008](https://github.com/storybookjs/storybook/pull/11008))

### Maintenance

- Aurelia: Fix issue with auto generated knobs for elements ([#10853](https://github.com/storybookjs/storybook/pull/10853))
- Build: Upgrade cypress && FIX lodash dependency ([#10925](https://github.com/storybookjs/storybook/pull/10925))

### Dependency Upgrades

- build(deps-dev): bump ember-source from 3.17.3 to 3.19.0 ([#11043](https://github.com/storybookjs/storybook/pull/11043))
- Bump rimraf from 2.7.1 to 3.0.2 ([#10923](https://github.com/storybookjs/storybook/pull/10923))
- build(deps-dev): bump ts-jest from 25.5.1 to 26.1.0 ([#11042](https://github.com/storybookjs/storybook/pull/11042))
- Update react-textarea-autosize & Remove @types/react-textarea-autosize ([#11040](https://github.com/storybookjs/storybook/pull/11040))
- Bump pug from 2.0.4 to 3.0.0 ([#10920](https://github.com/storybookjs/storybook/pull/10920))
- build(deps): bump @types/node from 13.13.9 to 14.0.10 ([#11039](https://github.com/storybookjs/storybook/pull/11039))
- Bump vue-docgen-api from 4.23.1 to 4.24.0 ([#11017](https://github.com/storybookjs/storybook/pull/11017))
- Bump @babel/preset-flow from 7.9.0 to 7.10.1 ([#11018](https://github.com/storybookjs/storybook/pull/11018))

## 6.0.0-beta.21 (June 4, 2020)

### Breaking Changes

- Preact: Update Preact version ([#10978](https://github.com/storybookjs/storybook/pull/10978))

### Features

- Addon-docs: Angular ArgTypes for pipes, injectables, classes ([#11016](https://github.com/storybookjs/storybook/pull/11016))
- TypeScript: Add warning for setup issues and fix Babel config ([#10998](https://github.com/storybookjs/storybook/pull/10998))
- Core: Add logLevel preset property to filter logging ([#10370](https://github.com/storybookjs/storybook/pull/10370))

### Bug Fixes

- Addon-controls: Fix initialization logic; remove react-select ([#11024](https://github.com/storybookjs/storybook/pull/11024))
- CLI: Fix `sb init` in Yarn workspace environment ([#10985](https://github.com/storybookjs/storybook/pull/10985))

### Maintenance

- React: Remove argsStory helper function ([#11036](https://github.com/storybookjs/storybook/pull/11036))
- Addon-controls: Remove residual options-type controls ([#11015](https://github.com/storybookjs/storybook/pull/11015))

## 6.0.0-beta.20 (June 1, 2020)

### Bug Fixes

- Addon-controls: Fix `options` control types ([#11003](https://github.com/storybookjs/storybook/pull/11003))
- Addon-controls: Fix no-control handling ([#11001](https://github.com/storybookjs/storybook/pull/11001))
- Addon-docs: Fix function argType inference in react-docgen-typescript ([#10997](https://github.com/storybookjs/storybook/pull/10997))

### Maintenance

- Addon-controls/a11y: Fix PARAM_KEY export for consistency ([#10988](https://github.com/storybookjs/storybook/pull/10988))

## 6.0.0-beta.19 (May 30, 2020)

### Features

- Addon-controls: Add warning to controls tab on no-args story ([#10986](https://github.com/storybookjs/storybook/pull/10986))

### Bug Fixes

- Addon-docs: Handle JSON.parse exception for Angular union types ([#10984](https://github.com/storybookjs/storybook/pull/10984))

## 6.0.0-beta.18 (May 29, 2020)

### Bug Fixes

- Core: Fix HMR for navigation sidebar in UI ([#10981](https://github.com/storybookjs/storybook/pull/10981))
- Core: Fix `register.tsx` as manager code in preset heuristic ([#10980](https://github.com/storybookjs/storybook/pull/10980))
- Core: Send global args with set stories ([#10910](https://github.com/storybookjs/storybook/pull/10910))
- Core: Log swallowed errors when requiring stories ([#10974](https://github.com/storybookjs/storybook/pull/10974))
- Core: Support valid globs ([#10926](https://github.com/storybookjs/storybook/pull/10926))

## 6.0.0-beta.17 (May 28, 2020)

### Features

- Addon-controls: Angular support ([#10946](https://github.com/storybookjs/storybook/pull/10946))
- Addon-controls: Web-components support ([#10953](https://github.com/storybookjs/storybook/pull/10953))

## 6.0.0-beta.16 (May 28, 2020)

### Bug Fixes

- Core: Add missing babel plugin ([#10941](https://github.com/storybookjs/storybook/pull/10941))

### Maintenance

- CI: Stabilize E2E tests ([#10888](https://github.com/storybookjs/storybook/pull/10888))

## 6.0.0-beta.15 (May 27, 2020)

### Features

- Addon-Controls: Next-generation knobs ([#10834](https://github.com/storybookjs/storybook/pull/10834))

### Bug Fixes

- Core: Avoid re-render on HMR of other stories ([#10908](https://github.com/storybookjs/storybook/pull/10908))
- Core: Fix auth for refs ([#10845](https://github.com/storybookjs/storybook/pull/10845))

### Dependency Upgrades

- Bump react-syntax-highlighter from 11.0.2 to 12.2.1 ([#10919](https://github.com/storybookjs/storybook/pull/10919))

## 6.0.0-beta.14 (May 25, 2020)

### Breaking Changes

- CSF: Hoist story annotation object ([#10907](https://github.com/storybookjs/storybook/pull/10907))
- Vue: Remove babel-preset-vue ([#10909](https://github.com/storybookjs/storybook/pull/10909))

### Features

- Angular: Support `workspace.json` in nx workspace ([#10881](https://github.com/storybookjs/storybook/pull/10881))

### Bug Fixes

- Addon-docs: Fix single item width in Preview block ([#10877](https://github.com/storybookjs/storybook/pull/10877))
- UI: Center toolbar icon buttons ([#10897](https://github.com/storybookjs/storybook/pull/10897))
- Core: Fix double rendering on startup ([#10892](https://github.com/storybookjs/storybook/pull/10892))

### Maintenance

- Core: Use dedicated loader for es6 modules ([#10783](https://github.com/storybookjs/storybook/pull/10783))
- Core: Fix yarn test command on windows ([#10904](https://github.com/storybookjs/storybook/pull/10904))

## 5.3.19 (May 24, 2020)

### Bug Fixes

- UI: Fix search stories ([#10539](https://github.com/storybookjs/storybook/pull/10539))

### Security

- Upgrade markdown-to-jsx to 6.11.4 ([#10873](https://github.com/storybookjs/storybook/pull/10873))

## 6.0.0-beta.13 (May 23, 2020)

### Bug Fixes

- Core: Fix ts/tsx resolution in the manager ([#10886](https://github.com/storybookjs/storybook/pull/10886))
- Core: Fix typo in projectRoot node_modules detection ([#10848](https://github.com/storybookjs/storybook/pull/10848))
- Addon-docs: Fix story inline rendering ([#10875](https://github.com/storybookjs/storybook/pull/10875))
- Core: Fix CRA filter for built-in webpack settings ([#10861](https://github.com/storybookjs/storybook/pull/10861))
- Addon-docs: Fix react forwardRefs with destructured props ([#10864](https://github.com/storybookjs/storybook/pull/10864))

### Maintenance

- React: Upgrade preset-create-react-app in examples ([#10867](https://github.com/storybookjs/storybook/pull/10867))
- Core: Close server when e2e test failed ([#10868](https://github.com/storybookjs/storybook/pull/10868))

### Dependency Upgrades

- Upgrade markdown-to-jsx to 6.11.4 ([#10873](https://github.com/storybookjs/storybook/pull/10873))

## 6.0.0-beta.12 (May 21, 2020)

### Breaking Changes

- Core: Zero-config TypeScript loading ([#10813](https://github.com/storybookjs/storybook/pull/10813))

## 6.0.0-beta.11 (May 21, 2020)

Failed publish

## 6.0.0-beta.10 (May 21, 2020)

Failed publish

## 6.0.0-beta.9 (May 21, 2020)

### Bug Fixes

- UI: Avoid full refresh when on some tab changes ([#10838](https://github.com/storybookjs/storybook/pull/10838))
- Composition: Fix refs not authenticating ([#10819](https://github.com/storybookjs/storybook/pull/10819))
- Core: Fix global args initial state for addon-toolbars ([#10833](https://github.com/storybookjs/storybook/pull/10833))
- Addon-a11y: Add deprecated withA11y ([#10814](https://github.com/storybookjs/storybook/pull/10814))
- Core: Transpile minimum node_modules ([#10725](https://github.com/storybookjs/storybook/pull/10725))
- UI: Change default view to Canvas on mobile ([#10818](https://github.com/storybookjs/storybook/pull/10818))
- Docs: Improve Preview zoom handling ([#10801](https://github.com/storybookjs/storybook/pull/10801))

### Maintenance

- CI: example overhaul clean ([#10702](https://github.com/storybookjs/storybook/pull/10702))
- CLI: Migrate CLI to TypeScript ([#10802](https://github.com/storybookjs/storybook/pull/10802))

### Dependency Upgrades

- Upgrade and add some missing dependencies in core, router, api ([#10825](https://github.com/storybookjs/storybook/pull/10825))

## 6.0.0-beta.8 (May 17, 2020)

### Features

- Addon-toolbars: Show tool icons for all viewModes ([#10810](https://github.com/storybookjs/storybook/pull/10810))

### Bug Fixes

- Addon-docs: Eval argTypes default value ([#10812](https://github.com/storybookjs/storybook/pull/10812))

### Maintenance

- Scripts: parallel execution on build package scripts ([#10808](https://github.com/storybookjs/storybook/pull/10808))

## 6.0.0-beta.7 (May 15, 2020)

### Breaking changes

- Cleanup: Remove support for babel-loader < 8 ([#10781](https://github.com/storybookjs/storybook/pull/10781))

### Features

- Composition: Zero-config composition from dependencies ([#10753](https://github.com/storybookjs/storybook/pull/10753))

### Bug Fixes

- Core: Detect local addons for windows machine ([#10786](https://github.com/storybookjs/storybook/pull/10786))
- Composition: Rename `mapper` to `storyMapper` and fix loading bugs ([#10780](https://github.com/storybookjs/storybook/pull/10780))

### Maintenance

- CLI: HTML stories homogenization ([#10705](https://github.com/storybookjs/storybook/pull/10705))
- CLI: web-components stories homogenization ([#10703](https://github.com/storybookjs/storybook/pull/10703))

### Dependency Upgrades

- Update jest-preset-angular to 8.2.0 ([#10778](https://github.com/storybookjs/storybook/pull/10778))

## 6.0.0-beta.6 (May 12, 2020)

### Breaking Changes

- Essentials: Update configuration heuristics for main.js ([#10737](https://github.com/storybookjs/storybook/pull/10737))

### Features

- Essentials: Add addon-actions ([#10748](https://github.com/storybookjs/storybook/pull/10748))
- Essentials: Add addon-docs ([#10729](https://github.com/storybookjs/storybook/pull/10729))

### Bug Fixes

- UI: Reset layout properties when switching stories ([#10643](https://github.com/storybookjs/storybook/pull/10643))

### Maintenance

- CLI: react stories homogenization ([#10711](https://github.com/storybookjs/storybook/pull/10711))
- CLI: vue stories homogenization ([#10708](https://github.com/storybookjs/storybook/pull/10708))
- CLI: webpack react stories homogenization ([#10709](https://github.com/storybookjs/storybook/pull/10709))
- CLI: svelte stories homogenization ([#10704](https://github.com/storybookjs/storybook/pull/10704))
- CLI: react-scripts stories homogenization ([#10710](https://github.com/storybookjs/storybook/pull/10710))
- CLI: mithril stories homogenization ([#10707](https://github.com/storybookjs/storybook/pull/10707))
- CLI: rax stories homogenization ([#10706](https://github.com/storybookjs/storybook/pull/10706))
- CLI: riot stories homogenization ([#10715](https://github.com/storybookjs/storybook/pull/10715))
- CLI: ember stories homogenization ([#10713](https://github.com/storybookjs/storybook/pull/10713))
- CLI: preact stories homogenization ([#10712](https://github.com/storybookjs/storybook/pull/10712))
- CLI: sfc_vue stories homogenization ([#10714](https://github.com/storybookjs/storybook/pull/10714))

### Dependency Upgrades

- Revert "Change reference for jest-preset-angular/build/setupJest as per migration guide" ([#10727](https://github.com/storybookjs/storybook/pull/10727))

## 6.0.0-beta.5 (May 11, 2020)

### Bug Fixes

- Core: Fix error handling on load ([#10659](https://github.com/storybookjs/storybook/pull/10659))

### Maintenance

- Storyshots: Change reference for jest-preset-angular/build/setupJest ([#10699](https://github.com/storybookjs/storybook/pull/10699))
- CLI: Remove CRA fixtures from Yarn 2 tests run ([#10720](https://github.com/storybookjs/storybook/pull/10720))
- Fix: Set private package on Aurelia example ([#10688](https://github.com/storybookjs/storybook/pull/10688))

## 6.0.0-beta.4 (May 8, 2020)

### Features

- React: Add `argsStory` convenience function ([#10685](https://github.com/storybookjs/storybook/pull/10685))

### Dependency Upgrades

- Build: Upgrade jest to 26 ([#10669](https://github.com/storybookjs/storybook/pull/10669))

## 6.0.0-beta.3 (May 7, 2020)

### Breaking Changes

- Addon-backgrounds: Simplified parameters API ([#10634](https://github.com/storybookjs/storybook/pull/10634))

### Bug Fixes

- Core: Fix `globalArgs` initialization from global parameters ([#10566](https://github.com/storybookjs/storybook/pull/10566))
- Core: Fix DLL context for IE11 ([#106444]https://github.com/storybookjs/storybook/pull/10644))

### Dependency Upgrades

- Addon-storyshots: Upgrade to jest 26 ([#10642](https://github.com/storybookjs/storybook/pull/10642))
- Bump terser-webpack-plugin from 2.3.6 to 3.0.0 ([#10650](https://github.com/storybookjs/storybook/pull/10650))

## 6.0.0-beta.2 (May 4, 2020)

### Bug Fixes

- Addon-docs: Fix broken props logic for no-args stories ([#10633](https://github.com/storybookjs/storybook/pull/10633))
- Addon-docs: Fix custom source manual override ([#10632](https://github.com/storybookjs/storybook/pull/10632))
- Addon-docs: Fix MDX stories with multiple children ([#9531](https://github.com/storybookjs/storybook/pull/9531))
- Addon-docs: Fix object array in Props ([#10621](https://github.com/storybookjs/storybook/pull/10621))
- Actions: Fix import of `uuid` ([#10625](https://github.com/storybookjs/storybook/pull/10625))

### Maintenance

- Core: Fix Args test to not use different code path ([#10607](https://github.com/storybookjs/storybook/pull/10607))

## 6.0.0-beta.1 (May 2, 2020)

### Features

- CLI: Add automatic detection for svelte ([#10623](https://github.com/storybookjs/storybook/pull/10623))

### Bug Fixes

- Addon-docs: Fix no-props logic in Source block ([#10619](https://github.com/storybookjs/storybook/pull/10619))
- Props: Fix subcomponents ([#10608](https://github.com/storybookjs/storybook/pull/10608))

### Maintenance

- Yarn 2: Fix dependencies issues for compatibility ([#10613](https://github.com/storybookjs/storybook/pull/10613))
- CLI: Fix cli when working with Yarn 2 and Node 10 ([#10550](https://github.com/storybookjs/storybook/pull/10550))

## 6.0.0-beta.0 (April 29, 2020)

Storybook 6.0 is in beta. 🎉🎉🎉

Hundreds of improvements and fixes, including:

- **Args** - Dynamic story data with automatic prop controls and actions.
- **Composition** - Compose storybooks for better documentation, performance, and multi-framework support.
- **Server** - Enabling Storybook for Rails and other server-side components.
- **Yarn 2** - Supporting next generation package management.

Track the release in the Github: [Storybook 6.0 Release 🏆](https://github.com/storybookjs/storybook/issues/9311)

## 6.0.0-alpha.46 (April 29, 2020)

### Breaking Changes

- Core: Normalize parameters in store/channel ([#10373](https://github.com/storybookjs/storybook/pull/10373))
- React: Remove deprecated CRA preset ([#10571](https://github.com/storybookjs/storybook/pull/10571))

### Features

- Addon-docs: Props controls for Vue ([#10559](https://github.com/storybookjs/storybook/pull/10559))

### Bug Fixes

- Addon-docs: Add subcomponents prop to Meta block ([#10573](https://github.com/storybookjs/storybook/pull/10573))

## 6.0.0-alpha.45 (April 28, 2020)

## Breaking changes

- Core: Pass args first to stories by default ([#10452](https://github.com/storybookjs/storybook/pull/10452))

## 6.0.0-alpha.44 (April 27, 2020)

### Features

- CLI: Automatically detect typescript in `sb init` ([#10547](https://github.com/storybookjs/storybook/pull/10547))

### Bug Fixes

- UI: Fix `viewMode` parameter handling ([#10292](https://github.com/storybookjs/storybook/pull/10292))

## 6.0.0-alpha.43 (April 24, 2020)

### Features

- Addon-a11y: Use channel to highlight elements in preview ([#10456](https://github.com/storybookjs/storybook/pull/10456))
- Storyshots: Support react hooks ([#10529](https://github.com/storybookjs/storybook/pull/10529))

### Bug Fixes

- Core: Transform for/of in dlls for IE11 compatibility ([#10471](https://github.com/storybookjs/storybook/pull/10471))

### Maintenance

- Addon-contexts: Move to deprecated-addons repo ([#10479](https://github.com/storybookjs/storybook/pull/10479))

## 6.0.0-alpha.42 (April 23, 2020)

### Bug Fixes

- Build: Fix misc warnings that trip up Chromatic ([#10521](https://github.com/storybookjs/storybook/pull/10521))
- Composition: Update UI for refs ([#10504](https://github.com/storybookjs/storybook/pull/10504))

### Maintenance

- Addon-docs: Rename `formatSource` to `transformSource` ([#10503](https://github.com/storybookjs/storybook/pull/10503))

## 6.0.0-alpha.41 (April 21, 2020)

### Features

- Addon-docs: Reset styles in Preview component ([#10274](https://github.com/storybookjs/storybook/pull/10274))

### Bug Fixes

- Addon-docs: Port Vue to ArgsTable ([#10482](https://github.com/storybookjs/storybook/pull/10482))
- Addon-docs: Fix Props controls to point to primary story ([#10480](https://github.com/storybookjs/storybook/pull/10480))
- Core: Fix addon tab in react-native-server ([#10468](https://github.com/storybookjs/storybook/pull/10468))

### Dependency Upgrades

- Misc upgrades ([#10460](https://github.com/storybookjs/storybook/pull/10460))

## 6.0.0-alpha.40 (April 20, 2020)

### Bug Fixes

- Addon-docs: Fix controls column display logic ([#10473](https://github.com/storybookjs/storybook/pull/10473))

## 6.0.0-alpha.39 (April 18, 2020)

### Breaking Changes

- Addon-docs: Inline stories in Vue by default ([#10463](https://github.com/storybookjs/storybook/pull/10463))

### Features

- Addon-docs: Provide better props include/exclude features ([#10464](https://github.com/storybookjs/storybook/pull/10464))
- UI: Improve loading state ([#10444](https://github.com/storybookjs/storybook/pull/10444))

### Bug Fixes

- UI: Fix bad shortcutpage layout ([#10445](https://github.com/storybookjs/storybook/pull/10445))

## 6.0.0-alpha.38 (April 18, 2020)

Failed publish

## 6.0.0-alpha.37 (April 17, 2020)

### Features

- Addon-actions: Make arg auto-generation more aggressive ([#10451](https://github.com/storybookjs/storybook/pull/10451))

### Maintenance

- Examples: Format stringified parameters ([#10435](https://github.com/storybookjs/storybook/pull/10435))

### Dependency Upgrades

- Bump recast from 0.16.2 to 0.19.0 ([#10415](https://github.com/storybookjs/storybook/pull/10415))

## 6.0.0-alpha.36 (April 16, 2020)

### Bug Fixes

- Server: Fix serialization of knobs params back to server ([#10391](https://github.com/storybookjs/storybook/pull/10391))
- Core: Serve correctly hashed static files with the Cache-Control header ([#10390](https://github.com/storybookjs/storybook/pull/10390))
- Addon-a11y: Fix default a11y parameters ([#10439](https://github.com/storybookjs/storybook/pull/10439))
- Core: Fix event source handling ([#10416](https://github.com/storybookjs/storybook/pull/10416))

### Maintenance

- Addon-docs: Add blocks typings ([#10441](https://github.com/storybookjs/storybook/pull/10441))

## 6.0.0-alpha.35 (April 16, 2020)

### Bug Fixes

- Core: Fix static build with DLL ([#10377](https://github.com/storybookjs/storybook/pull/10377))
- Addon-Docs: Fix Args table generation for story with no component ([#10436](https://github.com/storybookjs/storybook/pull/10436))

### Maintenance

- Yarn 2: Fix compatibility with `.storybook/preview.js` file ([#10342](https://github.com/storybookjs/storybook/pull/10342))
- Official-storybook: Fix passArgsFirst problems ([#10432](https://github.com/storybookjs/storybook/pull/10432))

## 6.0.0-alpha.34 (April 15, 2020)

### Breaking Changes

- Addon-A11y: Remove decorator in favor of parameter configuration ([#10381](https://github.com/storybookjs/storybook/pull/10381))

### Features

- Addon-docs: Add controls to ArgsTable ([#10354](https://github.com/storybookjs/storybook/pull/10354))
- CLI: Reuse existing chromium tab if possible ([#10329](https://github.com/storybookjs/storybook/pull/10329))

### Bug Fixes

- Core: Fix main.js `stories` regex to glob conversion ([#10400](https://github.com/storybookjs/storybook/pull/10400))
- Composition: Fix ref getSourceType for URL paths with index.html ([#10421](https://github.com/storybookjs/storybook/pull/10421))
- Core: Add .cjs files for main.js config ([#10358](https://github.com/storybookjs/storybook/pull/10358))

### Dependency Upgrades

- Bump @types/react-select from 2.0.19 to 3.0.11 ([#10262](https://github.com/storybookjs/storybook/pull/10262))
- Bump strip-json-comments from 3.0.1 to 3.1.0 ([#10334](https://github.com/storybookjs/storybook/pull/10334))
- Bump axe version to 3.5.3 ([#10375](https://github.com/storybookjs/storybook/pull/10375))
- Bump markdown-to-jsx from 6.11.0 to 6.11.1 ([#10331](https://github.com/storybookjs/storybook/pull/10331))
- Bump semver from 7.1.3 to 7.2.2 ([#10385](https://github.com/storybookjs/storybook/pull/10385))

## 6.0.0-alpha.33 (April 14, 2020)

### Breaking prerelease

- Core: Rename ParameterEnhancer to ArgsEnhancer ([#10398](https://github.com/storybookjs/storybook/pull/10398))

### Bug Fixes

- Core: Fix `webpackFinal` being called twice ([#10402](https://github.com/storybookjs/storybook/pull/10402))
- Core: Fix legacy redirect ([#10404](https://github.com/storybookjs/storybook/pull/10404))

### Maintenance

- CLI: Update fixtures used for CLI tests ([#10396](https://github.com/storybookjs/storybook/pull/10396))
- Build: Update bootstrap to install optional deps on CI ([#10408](https://github.com/storybookjs/storybook/pull/10408))
- Addon-docs: Format source at render time ([#10383](https://github.com/storybookjs/storybook/pull/10383))

## 6.0.0-alpha.32 (April 11, 2020)

### Features

- CSF: Warn when there are no exported stories ([#10357](https://github.com/storybookjs/storybook/pull/10357))

### Bug Fixes

- Marko: Always destroy old component when switching stories ([#10345](https://github.com/storybookjs/storybook/pull/10345))

### Maintenance

- Dev: Build script for package development ([#10343](https://github.com/storybookjs/storybook/pull/10343))

## 6.0.0-alpha.31 (April 7, 2020)

### Bug Fixes

- Core: Fix ie11 compatibility ([#10281](https://github.com/storybookjs/storybook/pull/10281))
- Core: Add .cjs & .mjs to interpret-files ([#10288](https://github.com/storybookjs/storybook/pull/10288))
- Core: Fix source-map strategy for production ([#10290](https://github.com/storybookjs/storybook/pull/10290))
- Addon-knobs: Allow `text` and `number` to take undefined values ([#10101](https://github.com/storybookjs/storybook/pull/10101))

### Maintenance

- Core: Warn about deprecated config files ([#10097](https://github.com/storybookjs/storybook/pull/10097))
- Yarn 2: rework imports in webpack preview virtual module to fix compatibility ([#10305](https://github.com/storybookjs/storybook/pull/10305))
- Addon-centered: Move to deprecated-addons ([#10300](https://github.com/storybookjs/storybook/pull/10300))

## 5.3.18 (March 31, 2020)

### Bug Fixes

- Core: Fix manager assets to be routed in express ([#9646](https://github.com/storybookjs/storybook/pull/9646))
- Storyshots: Fix MDX transform ([#10223](https://github.com/storybookjs/storybook/pull/10223))
- Addon-docs: Restore IE11 compat on Windows by transpiling acorn-jsx ([#9790](https://github.com/storybookjs/storybook/pull/9790))
- Addon-docs: Ensure visibility of links within prop descriptions ([#10210](https://github.com/storybookjs/storybook/pull/10210))

## 6.0.0-alpha.30 (March 31, 2020)

### Breaking Changes

- Misc: remove deprecations for 6.0.0 ([#10216](https://github.com/storybookjs/storybook/pull/10216))
- DocsPage: Remove slots for 6.0 ([#10259](https://github.com/storybookjs/storybook/pull/10259))
- Addon-actions: Add preset and configure with parameters ([#9933](https://github.com/storybookjs/storybook/pull/9933))

### Features

- MDX: Add args/argTypes/component/subcomponents support ([#10258](https://github.com/storybookjs/storybook/pull/10258))
- Addon-docs: Add linear gradient support to ColorPalette block ([#10237](https://github.com/storybookjs/storybook/pull/10237))

### Bug Fixes

- Addon-a11y: Performance fix ([#10219](https://github.com/storybookjs/storybook/pull/10219))
- API: Fix local addon handling ([#10254](https://github.com/storybookjs/storybook/pull/10254))
- Core: Fix URL load failure due to missing base ([#10228](https://github.com/storybookjs/storybook/pull/10228))
- Storyshots: Fix MDX transform ([#10223](https://github.com/storybookjs/storybook/pull/10223))

### Maintenance

- Build: Add puppeteer libs so teamcity can build examples ([#10235](https://github.com/storybookjs/storybook/pull/10235))

### Dependency Upgrades

- Misc upgrades ([#10236](https://github.com/storybookjs/storybook/pull/10236))

## 6.0.0-alpha.29 (March 26, 2020)

### Features

- Core: Composition - load remote storybooks ([#9210](https://github.com/storybookjs/storybook/pull/9210))
- CLI: extract-storybook bin ([#10146](https://github.com/storybookjs/storybook/pull/10146))

### Bug Fixes

- Addon-docs: Ensure visibility of links within prop descriptions ([#10210](https://github.com/storybookjs/storybook/pull/10210))

### Maintenance

- Core: Remove useStoryState ([#10187](https://github.com/storybookjs/storybook/pull/10187))
- Addon-jest: Title case panel name ([#10161](https://github.com/storybookjs/storybook/pull/10161))

### Dependency Upgrades

- Bump semver from 6.3.0 to 7.1.3 ([#9864](https://github.com/storybookjs/storybook/pull/9864))
- Bump @types/jest from 25.1.3 to 25.1.4 ([#10133](https://github.com/storybookjs/storybook/pull/10133))

## 6.0.0-alpha.28 (March 23, 2020)

### Features

- UI: Form/textarea maxHeight : 400 ([#9860](https://github.com/storybookjs/storybook/pull/9860))

### Bug Fixes

- Addon-docs: Make source resilient to bad story ID's ([#10184](https://github.com/storybookjs/storybook/pull/10184))
- Core: Don't persist theme to localStorage ([#9076](https://github.com/storybookjs/storybook/pull/9076))
- Core: Fix to load Storybook in IE11 ([#9942](https://github.com/storybookjs/storybook/pull/9942))

### Maintenance

- Server: Simplify server addons ([#9931](https://github.com/storybookjs/storybook/pull/9931))
- Core: FIX error of load order when using configure in preview|config.js ([#10159](https://github.com/storybookjs/storybook/pull/10159))
- Build: Experiment to make CircleCI tests a faster and more stable ([#9969](https://github.com/storybookjs/storybook/pull/9969))
- Vue: Fix webpack config when execute 'yarn workspace vue-example dev' ([#9704](https://github.com/storybookjs/storybook/pull/9704))
- Core: Re-enable failing args tests ([#10126](https://github.com/storybookjs/storybook/pull/10126))
- Build: Add script & parallelization for running chromatic on examples ([#10125](https://github.com/storybookjs/storybook/pull/10125))

### Dependency Upgrades

- Addon-a11y: Move react to peer dependency ([#9957](https://github.com/storybookjs/storybook/pull/9957))

## 5.3.17 (March 14, 2020)

### Bug Fixes

- Components: Change react-syntax-highlighter from esm to cjs ([#9780](https://github.com/storybookjs/storybook/pull/9780))

## 5.3.16 (March 14, 2020)

Failed NPM publish

## 5.3.15 (March 14, 2020)

### Bug Fixes

- Core: Disables html-webpack-plugin's option to remove script tag types ([#10042](https://github.com/storybookjs/storybook/pull/10042))
- Addon-actions: Style ActionLogger to preserve whitespace ([#10046](https://github.com/storybookjs/storybook/pull/10046))

### Maintenance

- CI: Fix GitHub unit test workflow ([#9971](https://github.com/storybookjs/storybook/pull/9971))

### Dependency Upgrades

- Security: Remove usage of a vulnerable version of serialize-javascript ([#10071](https://github.com/storybookjs/storybook/pull/10071))

## 6.0.0-alpha.27 (March 13, 2020)

### Features

- Addon-toolbars: Global args support in the toolbar ([#10028](https://github.com/storybookjs/storybook/pull/10028))
- Addon-actions: Add Storybook Args support ([#10029](https://github.com/storybookjs/storybook/pull/10029))
- Core: Add globalArgs/globalArgTypes `preview.js` exports ([#10123](https://github.com/storybookjs/storybook/pull/10123))

## 6.0.0-alpha.26 (March 12, 2020)

### Breaking Changes

- Remove deprecated decorators and loaders ([#9951](https://github.com/storybookjs/storybook/pull/9951))

### Features

- Core: Improve support for main.ts/preview.ts files ([#10099](https://github.com/storybookjs/storybook/pull/10099))
- Addon-docs: Theme with `docs.theme` parameter ([#10114](https://github.com/storybookjs/storybook/pull/10114))
- Addon-docs: Svelte example ([#7673](https://github.com/storybookjs/storybook/pull/7673))

### Maintenance

- CSF: Promote args/argTypes to first-class metadata ([#10117](https://github.com/storybookjs/storybook/pull/10117))

## 6.0.0-alpha.25 (March 11, 2020)

NOTE: `6.0.0-alpha.24` broken due to bad merge. Sorry!

### Bug Fixes

- Core: Fix initialization of global args ([#10106](https://github.com/storybookjs/storybook/pull/10106))

## 6.0.0-alpha.24 (March 11, 2020)

### Features

- Addon-docs: formatSource snippet customization function ([#10089](https://github.com/storybookjs/storybook/pull/10089))
- Core: Add global args feature ([#10015](https://github.com/storybookjs/storybook/pull/10015))
- UI: Migrate from simplebar to overlaybars ([#9375](https://github.com/storybookjs/storybook/pull/9375))

### Bug Fixes

- Core: Fix StoryInput parameters typings ([#10013](https://github.com/storybookjs/storybook/pull/10013))
- Changed import of react-syntax-highlighter from esm to cjs ([#9292](https://github.com/storybookjs/storybook/pull/9292))

### Maintenance

- Build: Setup TeamCity Cloud ([#9875](https://github.com/storybookjs/storybook/pull/9875))
- Tech/improvements ([#10096](https://github.com/storybookjs/storybook/pull/10096))
- Core: Move event handlers into module init ([#10085](https://github.com/storybookjs/storybook/pull/10085))

### Dependency Upgrades

- Bump axe-core from 3.5.1 to 3.5.2 ([#10090](https://github.com/storybookjs/storybook/pull/10090))

## 6.0.0-alpha.23 (March 11, 2020)

Failed publish

## 6.0.0-alpha.22 (March 10, 2020)

### Breaking Changes

- MDX: Compile to improved source-loader format ([#10084](https://github.com/storybookjs/storybook/pull/10084))

### Features

- Core: Add args feature ([#10014](https://github.com/storybookjs/storybook/pull/10014))

### Maintenance

- Tech/improvements ([#10083](https://github.com/storybookjs/storybook/pull/10083))
- Few minor improvements extracted from the inception feature PR ([#10072](https://github.com/storybookjs/storybook/pull/10072))
- Tech/improvements ([#10070](https://github.com/storybookjs/storybook/pull/10070))

### Dependency Upgrades

- Yarn 2: Add missing dependencies ([#10012](https://github.com/storybookjs/storybook/pull/10012))
- Security: Remove usage of a vulnerable version of serialize-javascript ([#10071](https://github.com/storybookjs/storybook/pull/10071))

## 6.0.0-alpha.21 (March 5, 2020)

### Breaking Changes

- Core: Overhaul start.js and event emitting/listening ([#9914](https://github.com/storybookjs/storybook/pull/9914))

### Features

- CLI: Support js / jsx / ts / tsx stories in React CSF template ([#10003](https://github.com/storybookjs/storybook/pull/10003))
- Cra-kitchen-sink : Add Named Color Palette Example(MDX) ([#9709](https://github.com/storybookjs/storybook/pull/9709))
- Addon-Queryparams: Add addon preset ([#9949](https://github.com/storybookjs/storybook/pull/9949))

### Bug Fixes

- Addon-actions: Style ActionLogger to preserve whitespace ([#10046](https://github.com/storybookjs/storybook/pull/10046))
- Core: Disables html-webpack-plugin's option to remove script tag types ([#10042](https://github.com/storybookjs/storybook/pull/10042))

### Maintenance

- Tech: Misc improvements ([#10052](https://github.com/storybookjs/storybook/pull/10052))
- Tech: Misc improvements extracted from composition ([#10040](https://github.com/storybookjs/storybook/pull/10040))
- CI: change parallelism ([#10041](https://github.com/storybookjs/storybook/pull/10041))
- Storybook-official: try moving options to `manager.js` ([#9323](https://github.com/storybookjs/storybook/pull/9323))
- Misc: Add missing dependencies ([#9965](https://github.com/storybookjs/storybook/pull/9965))
- CI: Fix GitHub unit test workflow ([#9971](https://github.com/storybookjs/storybook/pull/9971))

### Dependency Upgrades

- Upgrade reach router ([#10016](https://github.com/storybookjs/storybook/pull/10016))

## 6.0.0-alpha.20 (February 27, 2020)

### Bug Fixes

- Core: Fix `configFilename` containing backticks ([#9960](https://github.com/storybookjs/storybook/pull/9960))

### Maintenance

- Core: Add stories to demonstrate `layout` ([#9940](https://github.com/storybookjs/storybook/pull/9940))

## 5.3.14 (February 25, 2020)

### Bug Fixes

- Centered: remove `typesVersions` attribute ([#9907](https://github.com/storybookjs/storybook/pull/9907))
- Props: Fix typescript unspecified default value ([#9873](https://github.com/storybookjs/storybook/pull/9873))
- Core: Use telejson for websockets channel ([#9867](https://github.com/storybookjs/storybook/pull/9867))
- Storyshots: Fix support for jsx/tsx config files ([#9834](https://github.com/storybookjs/storybook/pull/9834))
- MDX: Fix custom classes getting stripped ([#8897](https://github.com/storybookjs/storybook/pull/8897))
- Typescript: Add downlevel dts for 3.5 ([#9847](https://github.com/storybookjs/storybook/pull/9847))

## 6.0.0-alpha.19 (February 24, 2020)

### Features

- Addon-links: Add preset ([#9932](https://github.com/storybookjs/storybook/pull/9932))

### Bug Fixes

- Addon-docs: Restore IE11 compat on Windows by transpiling acorn-jsx ([#9790](https://github.com/storybookjs/storybook/pull/9790))

## 6.0.0-alpha.18 (February 22, 2020)

### Features

- Addon-knobs: Add `disableForceUpdate` option ([#9447](https://github.com/storybookjs/storybook/pull/9447))

## 6.0.0-alpha.17 (February 21, 2020)

### Bug Fixes

- Props: Fix typescript unspecified default value ([#9873](https://github.com/storybookjs/storybook/pull/9873))
- Centered: remove `typesVersions` attribute ([#9907](https://github.com/storybookjs/storybook/pull/9907))

### Maintenance

- Misc: Add missing dependencies or peerDependencies ([#9916](https://github.com/storybookjs/storybook/pull/9916))

## 6.0.0-alpha.16 (February 21, 2020)

Failed NPM publish

## 6.0.0-alpha.15 (February 20, 2020)

### Breaking Changes

- Refactor Client API: pull metadata handling code into the store. ([#9877](https://github.com/storybookjs/storybook/pull/9877))

### Features

- Core: Add skip dispose option to ClientApi ([#9868](https://github.com/storybookjs/storybook/pull/9868))

## 6.0.0-alpha.14 (February 19, 2020)

### Features

- CLI: Add Yarn 2 compatibility ([#9866](https://github.com/storybookjs/storybook/pull/9866))

### Bug Fixes

- Typescript: Add downlevel dts for TS3.5 support ([#9902](https://github.com/storybookjs/storybook/pull/9902))
- CLI: capture unknown arguments the native way ([#9888](https://github.com/storybookjs/storybook/pull/9888))
- Core: Use telejson for websockets channel ([#9867](https://github.com/storybookjs/storybook/pull/9867))

### Maintenance

- Build: Upgrade to latest version of eslint config ([#9882](https://github.com/storybookjs/storybook/pull/9882))
- Typescript: Misc improvements ([#9879](https://github.com/storybookjs/storybook/pull/9879))
- Misc: Project root cleanup ([#9880](https://github.com/storybookjs/storybook/pull/9880))

### Dependency Upgrades

- Bump webpack-cli from 3.3.10 to 3.3.11 ([#9895](https://github.com/storybookjs/storybook/pull/9895))
- Migrate to leven ([#9881](https://github.com/storybookjs/storybook/pull/9881))

## 6.0.0-alpha.13 (February 15, 2020)

### Bug Fixes

- CLI: fix React Scripts csf-ts story templates ([#9863](https://github.com/storybookjs/storybook/pull/9863))
- Addon-viewports: Fix Galaxy S9's viewport size ([#9797](https://github.com/storybookjs/storybook/pull/9797))
- Storyshots: Fix support for jsx/tsx config files ([#9834](https://github.com/storybookjs/storybook/pull/9834))

### Maintenance

- Addon-docs: Snapshot testing and bug reporting for props tables ([#9838](https://github.com/storybookjs/storybook/pull/9838))
- Typescript: Remove prop types in lib/components ([#9747](https://github.com/storybookjs/storybook/pull/9747))
- Typescript: Better api consumer ([#9861](https://github.com/storybookjs/storybook/pull/9861))

### Dependency Upgrades

- Bump marko from 4.18.42 to 4.18.45 ([#9839](https://github.com/storybookjs/storybook/pull/9839))

## 6.0.0-alpha.12 (February 14, 2020)

### Maintenance

- Typescript: Improve @storybook/ui types ([#9820](https://github.com/storybookjs/storybook/pull/9820))
- Misc: Fix deepscan issues ([#9843](https://github.com/storybookjs/storybook/pull/9843)) ([#9842](https://github.com/storybookjs/storybook/pull/9842))

## 6.0.0-alpha.11 (February 13, 2020)

### Breaking Changes

- Core: Remove legacy data from Story Store ([#9810](https://github.com/storybookjs/storybook/pull/9810))

### Bug Fixes

- Addon-docs: Preserve HTML element classes in MDX ([#8897](https://github.com/storybookjs/storybook/pull/8897))

### Maintenance

- CLI: transpile `@storybook/cli` to CJS ([#9807](https://github.com/storybookjs/storybook/pull/9807))

## 5.3.13 (February 12, 2020)

### Bug Fixes

- React: Remove `MiniCssExtractPlugin` for CRA ([#9759](https://github.com/storybookjs/storybook/pull/9759))

### Maintenance

- Build: Fix DLL generation race condition ([#9770](https://github.com/storybookjs/storybook/pull/9770))

## 6.0.0-alpha.10 (February 11, 2020)

### Maintenance

- Typescript: Migrate @storybook/ui ([#9791](https://github.com/storybookjs/storybook/pull/9791))

## 6.0.0-alpha.9 (February 9, 2020)

### Features

- Addon-docs: Add preset options for vue-docgen-api ([#9699](https://github.com/storybookjs/storybook/pull/9699))
- UI: Add initialActive option parameter ([#9141](https://github.com/storybookjs/storybook/pull/9141))

### Bug Fixes

- Components: Import react-syntax-highlighter/create-element from cjs ([#9795](https://github.com/storybookjs/storybook/pull/9795))

### Maintenance

- Examples: Change main.js to main.ts to show it's possible ([#9775](https://github.com/storybookjs/storybook/pull/9775))

## 6.0.0-alpha.8 (February 8, 2020)

### Maintenance

- Replace lodash named imports with specific imports ([#9787](https://github.com/storybookjs/storybook/pull/9787))

## 6.0.0-alpha.7 (February 7, 2020)

### Bug Fixes

- Core: Support custom addons using JSX ([#9648](https://github.com/storybookjs/storybook/pull/9648))
- Components: Change react-syntax-highlighter from esm to cjs ([#9780](https://github.com/storybookjs/storybook/pull/9780))
- Core: Fix manager assets to be routed in express ([#9646](https://github.com/storybookjs/storybook/pull/9646))

### Maintenance

- Examples: Remove addon-notes remnants ([#9782](https://github.com/storybookjs/storybook/pull/9782))
- Build: Fix DLL generation race condition ([#9770](https://github.com/storybookjs/storybook/pull/9770))

## 6.0.0-alpha.6 (February 5, 2020)

### Bug Fixes

- Core: Fix dev server error - back out bad change ([#9753](https://github.com/storybookjs/storybook/pull/9753))
- CLI: Fix file path for the Button story ([#9325](https://github.com/storybookjs/storybook/pull/9325))

## 5.3.12 (February 5, 2020)

### Bug Fixes

- Core: Fix dev server error - back out bad change ([#9753](https://github.com/storybookjs/storybook/pull/9753))

## 5.3.11 (February 4, 2020)

### Bug Fixes

- Svelte: Fix Svelte 3 slots for decorators ([#9724](https://github.com/storybookjs/storybook/pull/9724))
- CLI: Fix file path for Button story ([#9325](https://github.com/storybookjs/storybook/pull/9325))
- Angular: Emit decorator metadata by default ([#9701](https://github.com/storybookjs/storybook/pull/9701))
- Storyshots: Fix config via main.ts ([#9577](https://github.com/storybookjs/storybook/pull/9577))

## 6.0.0-alpha.5 (February 4, 2020)

### Features

- Core: Add Yarn 2 compatibility ([#9667](https://github.com/storybookjs/storybook/pull/9667))
- Addon-a11y: Add preset ([#9697](https://github.com/storybookjs/storybook/pull/9697))
- Server: Initial support for @storybook/server ([#9722](https://github.com/storybookjs/storybook/pull/9722))

### Bug Fixes

- Svelte: Fix Svelte 3 slots for decorators ([#9724](https://github.com/storybookjs/storybook/pull/9724))

### Maintenance

- Cra-ts-kitchen-sink: Fix stories glob pattern ([#9706](https://github.com/storybookjs/storybook/pull/9706))

## 6.0.0-alpha.4 (February 3, 2020)

### Bug Fixes

- Angular: Emit decorator metadata by default ([#9701](https://github.com/storybookjs/storybook/pull/9701))
- Addon-centered: Fix clash with addon-docs for react ([#8388](https://github.com/storybookjs/storybook/pull/8388))

### Maintenance

- Add angular 8 and 9 cli fixtures ([#8769](https://github.com/storybookjs/storybook/pull/8769))

### Dependency Upgrades

- Misc upgrades ([#9688](https://github.com/storybookjs/storybook/pull/9688))

## 5.3.10 (February 2, 2020)

### Bug Fixes

- Core: Upgrade `min-css-extract-plugin` to fix SASS loading ([#9652](https://github.com/storybookjs/storybook/pull/9652))
- CRA: Fix jsconfig support ([#9324](https://github.com/storybookjs/storybook/pull/9324))
- Web-components: Fix default value for docs prop table ([#9655](https://github.com/storybookjs/storybook/pull/9655))
- Web-components: Fix types to play nicely with lit-element ([#9557](https://github.com/storybookjs/storybook/pull/9557))
- UI: Add support for className prop on Form.Field ([#9665](https://github.com/storybookjs/storybook/pull/9665))
- Addon-storyshots: Remove excess slashes from jest transform warning ([#9616](https://github.com/storybookjs/storybook/pull/9616))

### Maintenance

- Ember: Migrate to new "import { hbs } from 'ember-cli-htmlbars'" ([#9633](https://github.com/storybookjs/storybook/pull/9633))
- Build: Netlify for examples again ([#9585](https://github.com/storybookjs/storybook/pull/9585))
- Publish: Remove docs to reduce package size ([#9612](https://github.com/storybookjs/storybook/pull/9612))

## 6.0.0-alpha.3 (February 2, 2020)

### Bug Fixes

- CRA: Fix jsconfig support ([#9324](https://github.com/storybookjs/storybook/pull/9324))
- UI: Check if docsOnly is set to hide the addon panels ([#9687](https://github.com/storybookjs/storybook/pull/9687))

### Maintenance

- Addon-notes, addon-info: Move to deprecated-addons repo ([#9673](https://github.com/storybookjs/storybook/pull/9673))

## 6.0.0-alpha.2 (January 30, 2020)

### Features

- UI: Configure tabs title, visibility, order and disable ([#9095](https://github.com/storybookjs/storybook/pull/9095))
- Addon-cssresources: Add hideCode option ([#9627](https://github.com/storybookjs/storybook/pull/9627))
- UI: Add `viewMode` parameter to control story nav UI ([#9090](https://github.com/storybookjs/storybook/pull/9090))

### Bug Fixes

- Web-components: Fix default value for prop table docs ([#9655](https://github.com/storybookjs/storybook/pull/9655))
- Web-components: Make TypeScript types play nicely with lit-element ([#9557](https://github.com/storybookjs/storybook/pull/9557))
- UI: Fix tabs to scroll horizontally ([#9383](https://github.com/storybookjs/storybook/pull/9383))
- UI: Add support for className prop on Form.Field ([#9665](https://github.com/storybookjs/storybook/pull/9665))
- Core: Upgrade `min-css-extract-plugin` to fix SASS loading ([#9652](https://github.com/storybookjs/storybook/pull/9652))
- Adon-docs: Fix ColorPalette styling ([#9643](https://github.com/storybookjs/storybook/pull/9643))
- Addon-storyshots: Remove excess slashes from jest transform warning ([#9616](https://github.com/storybookjs/storybook/pull/9616))

### Maintenance

- Source-loader: Overhaul to remove decorators, support user-configurable source ([#9547](https://github.com/storybookjs/storybook/pull/9547))
- Build: Use Netlify for examples again ([#9585](https://github.com/storybookjs/storybook/pull/9585))
- Ember: Migrate to new "import { hbs } from 'ember-cli-htmlbars'" ([#9633](https://github.com/storybookjs/storybook/pull/9633))
- Publish: Remove docs to reduce package size ([#9612](https://github.com/storybookjs/storybook/pull/9612))

## 5.3.9 (January 24, 2020)

### Bug Fixes

- Addon-docs: Revert breaking source indentation fix ([#9609](https://github.com/storybookjs/storybook/pull/9609))

## 6.0.0-alpha.1 (January 23, 2020)

### Features

- Core: Enable HMR logging in browser console ([#9535](https://github.com/storybookjs/storybook/pull/9535))

### Bug Fixes

- Addon-knobs: Fix broken link to repo in empty panel ([#9530](https://github.com/storybookjs/storybook/pull/9530))
- Typescript: Export IStory in `@storybook/angular` ([#9097](https://github.com/storybookjs/storybook/pull/9097))

### Maintenance

- React-native: Extract to its own repo ([#9599](https://github.com/storybookjs/storybook/pull/9599))
- Polymer: Extract to its own repo ([#9596](https://github.com/storybookjs/storybook/pull/9596))
- Build: Fix some dependencies & ts problems ([#9603](https://github.com/storybookjs/storybook/pull/9603))

## 5.3.8 (January 22, 2020)

### Bug Fixes

- Addon-docs: Fix TS false default value in prop table ([#9560](https://github.com/storybookjs/storybook/pull/9560))
- Addon-knobs: Fix broken repo link in empty panel ([#9530](https://github.com/storybookjs/storybook/pull/9530))
- Typescript: Export IStory in `@storybook/angular` ([#9097](https://github.com/storybookjs/storybook/pull/9097))
- Fixed Angular button example story ([#9540](https://github.com/storybookjs/storybook/pull/9540))
- Clean usage of `@types/webpack-env` dep in all packages ([#9536](https://github.com/storybookjs/storybook/pull/9536))

## 6.0.0-alpha.0 (January 21, 2020)

### Features

- API: Add useSharedState, useStoryState ([#9566](https://github.com/storybookjs/storybook/pull/9566))
- Addon-docs: Named colors with ColorPalette ([#9453](https://github.com/storybookjs/storybook/pull/9453))
- Core: Add preview layouts ([#9229](https://github.com/storybookjs/storybook/pull/9229))
- Marionette: Add marionette support ([#7981](https://github.com/storybookjs/storybook/pull/7981))
- Addon-a11y: Support manual run ([#8883](https://github.com/storybookjs/storybook/pull/8883))
- Addon-cssresources: Disable SyntaxHighlighter for long code ([#9360](https://github.com/storybookjs/storybook/pull/9360))
- Core: Improve monorepo support ([#8822](https://github.com/storybookjs/storybook/pull/8822))

### Bug Fixes

- Addon-docs: Fix TS false default value in prop table ([#9560](https://github.com/storybookjs/storybook/pull/9560))
- Addon-docs: Remove hard-coded lineHeight in Typeset block ([#9567](https://github.com/storybookjs/storybook/pull/9567))
- Fixed Angular button example story ([#9540](https://github.com/storybookjs/storybook/pull/9540))
- Core: Fix generated entry to import at top of file ([#9398](https://github.com/storybookjs/storybook/pull/9398))
- Preact: Fix story function typescript type ([#9123](https://github.com/storybookjs/storybook/pull/9123))
- UI: Make canvas link a link ([#9257](https://github.com/storybookjs/storybook/pull/9257))

### Maintenance

- Build: the build-storybooks script ([#9569](https://github.com/storybookjs/storybook/pull/9569))
- CLI: Improve Rax template ([#9574](https://github.com/storybookjs/storybook/pull/9574))
- Typescript: Migrate polymer ([#9565](https://github.com/storybookjs/storybook/pull/9565))
- Typescript: Migrate ember ([#9020](https://github.com/storybookjs/storybook/pull/9020))
- Next 6.0.0 ([#9212](https://github.com/storybookjs/storybook/pull/9212))
- REMOVE subscription_store ([#9228](https://github.com/storybookjs/storybook/pull/9228))

### Dependency Upgrades

- Update husky to v4 ([#9509](https://github.com/storybookjs/storybook/pull/9509))
- Bumped react-dev-utils dependency to v10. ([#9579](https://github.com/storybookjs/storybook/pull/9579))
- Bump babel-plugin-macros from 2.7.1 to 2.8.0 ([#9236](https://github.com/storybookjs/storybook/pull/9236))
- Bump babel-plugin-emotion from 10.0.23 to 10.0.27 ([#9239](https://github.com/storybookjs/storybook/pull/9239))
- Bump @babel/runtime from 7.7.4 to 7.7.7 ([#9277](https://github.com/storybookjs/storybook/pull/9277))
- Bump corejs-upgrade-webpack-plugin from 2.2.0 to 3.0.1 ([#9427](https://github.com/storybookjs/storybook/pull/9427))
- Bump terser-webpack-plugin from 2.2.1 to 2.3.2 ([#9386](https://github.com/storybookjs/storybook/pull/9386))
