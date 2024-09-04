## 5.3.7 (January 20, 2020)

### Bug Fixes

- Node-logger: Move `@types/npmlog` to dependencies ([#9538](https://github.com/storybookjs/storybook/pull/9538))
- Core: Fix legacy story URLs ([#9545](https://github.com/storybookjs/storybook/pull/9545))
- Addon-docs: Convert default prop value to string ([#9525](https://github.com/storybookjs/storybook/pull/9525))
- Addon-docs: Preserve Source indentation by default ([#9513](https://github.com/storybookjs/storybook/pull/9513))

## 5.3.6 (January 17, 2020)

### Bug Fixes

- Source-loader: Bypass if file has no exports ([#9505](https://github.com/storybookjs/storybook/pull/9505))
- Core: Fix default sorting of docs-only stories ([#9504](https://github.com/storybookjs/storybook/pull/9504))

## 5.3.5 (January 17, 2020)

### Bug Fixes

- Core: Fix typo for loading addon-notes/register-panel ([#9497](https://github.com/storybookjs/storybook/pull/9497))
- Source-loader: Add imports to top of file ([#9492](https://github.com/storybookjs/storybook/pull/9492))

## 5.3.4 (January 16, 2020)

### Bug Fixes

- Core: Fix presets register panel ([#9486](https://github.com/storybookjs/storybook/pull/9486))
- Core: Fix addon/preset detection for local addons ([#9485](https://github.com/storybookjs/storybook/pull/9485))
- Core: Fix default story sort ([#9482](https://github.com/storybookjs/storybook/pull/9482))

## 5.3.3 (January 14, 2020)

### Bug Fixes

- UI: Fix edge case where only one legacy separator is defined ([#9425](https://github.com/storybookjs/storybook/pull/9425))
- Core: Preserve kind load order on HMR when no sortFn is provided ([#9424](https://github.com/storybookjs/storybook/pull/9424))
- Angular: Fix missing architect properties ([#9390](https://github.com/storybookjs/storybook/pull/9390))
- Addon-knobs: Fix null knob values in select ([#9416](https://github.com/storybookjs/storybook/pull/9416))
- Source-loader: Disable linting altogether ([#9417](https://github.com/storybookjs/storybook/pull/9417))

## 5.3.2 (January 13, 2020)

### Bug Fixes

- Source-loader: Disable eslint entirely for generated code ([#9410](https://github.com/storybookjs/storybook/pull/9410))

## 5.3.1 (January 12, 2020)

### Bug Fixes

- Core: Fix generated entry to import at top of file ([#9398](https://github.com/storybookjs/storybook/pull/9398))

## 5.3.0 (January 11, 2020)

Storybook 5.3 is here!

- 📝 [Custom documentation in MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc)
- 🎨 [Multi-framework SB Docs (React, Vue, Angular, WC, Ember)](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- 📦 [Web-components framework support](https://dev.to/open-wc/storybook-for-web-components-on-steroids-4h29)
- 🔼 [Main.js declarative configuration](https://medium.com/storybookjs/declarative-storybook-configuration-49912f77b78)

  5.3 contains hundreds more fixes, features, and tweaks. Browse the changelogs matching `5.3.0-alpha.*`, `5.3.0-beta.*`, and `5.3.0-rc.*` for the full list of changes. See [MIGRATION.md](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) to upgrade from `5.0` or earlier.

## 5.3.0-rc.14 (January 11, 2020)

- Merge `master` into `next` for 5.3.0 release ([#9388](https://github.com/storybookjs/storybook/pull/9388))

## 5.3.0-rc.13 (January 11, 2020)

### Bug Fixes

- Addon-docs: Fix link CORS errors using channel navigate event ([#9381](https://github.com/storybookjs/storybook/pull/9381))
- CLI: Fix `sb init` to use spawn.sync if creating package.json ([#9359](https://github.com/storybookjs/storybook/pull/9359))

### Maintenance

- Official-storybook: Prop table example for multiple named exports ([#9364](https://github.com/storybookjs/storybook/pull/9364))
- Addon-docs / web-components: Rename 'props' to 'properties' in props table ([#9362](https://github.com/storybookjs/storybook/pull/9362))

### Dependency Upgrades

- Upgrade @types/webpack-env and @types/node to fix conflicting types ([#9365](https://github.com/storybookjs/storybook/pull/9365))

## 5.3.0-rc.12 (January 8, 2020)

### Bug Fixes

- Nav UI: Nodes are components only if they contain ALL leaf nodes ([#9356](https://github.com/storybookjs/storybook/pull/9356))
- Core: Fix HMR for global decorators in main.js config ([#9354](https://github.com/storybookjs/storybook/pull/9354))
- Presets: Fix register.js addons entry ([#9347](https://github.com/storybookjs/storybook/pull/9347))
- React: Check CRA is installed before showing warning ([#9346](https://github.com/storybookjs/storybook/pull/9346))

## 5.3.0-rc.11 (January 7, 2020)

### Bug Fixes

- Addon-Docs: Handle leaf/non-leaf mixture in docs-mode navigation ([#9321](https://github.com/storybookjs/storybook/pull/9321))

### Dependency Upgrades

- Axe storyshots: move to original @wordpress/jest-puppeteer-axe package ([#9337](https://github.com/storybookjs/storybook/pull/9337))

## 5.3.0-rc.10 (January 6, 2020)

### Bug Fixes

- Revert "Source-loader: Disable no-implicit-any linting" ([#9333](https://github.com/storybookjs/storybook/pull/9333))
- Addon-docs: Fix scroll behavior on page navigation ([#9331](https://github.com/storybookjs/storybook/pull/9331))

## 5.3.0-rc.9 (January 4, 2020)

### Features

- CSF: Use `__namedExportsOrder` array in loader if provided ([#9315](https://github.com/storybookjs/storybook/pull/9315))

### Bug Fixes

- Router: Add storyNameFromExport to avoid breaking changes ([#9320](https://github.com/storybookjs/storybook/pull/9320))

## 5.3.0-rc.8 (January 3, 2020)

### Bug Fixes

- Addon-docs: Tweak props table paragraph spacing ([#9307](https://github.com/storybookjs/storybook/pull/9307))

### Maintenance

- Add minimal typescript component to official-storybook ([#9308](https://github.com/storybookjs/storybook/pull/9308))

### Dependency Upgrades

- React: Upgrade babel-plugin-react-docgen to 4.0.0 ([#9303](https://github.com/storybookjs/storybook/pull/9303))

## 5.3.0-rc.7 (January 2, 2020)

### Bug Fixes

- Core: Fix babel.js to disable simplify ([#9280](https://github.com/storybookjs/storybook/pull/9280))
- Storyshots-Puppeteer: Don't infer story ID from its name ([#9291](https://github.com/storybookjs/storybook/pull/9291))

## 5.3.0-rc.6 (December 31, 2019)

This is significant change to `main.js` aka tri-config, dramatically simplifying how addons and presets are registered. See the maintenance PR for details.

### Maintenance

- Main.js: Combine presets/registers in `addons` field ([#9246](https://github.com/storybookjs/storybook/pull/9246))

## 5.3.0-rc.5 (December 31, 2019)

### Bug Fixes

- Addon-docs: Hide stories block when there are no stories ([#9271](https://github.com/storybookjs/storybook/pull/9271))
- Source-loader: Disable no-implicit-any linting ([#9272](https://github.com/storybookjs/storybook/pull/9272))

## 5.3.0-rc.4 (December 28, 2019)

### Bug Fixes

- Addon-docs: Fix MDX story rendering with dynamic component titles ([#9248](https://github.com/storybookjs/storybook/pull/9248))

### Maintenance

- Ignore testfixtures directory in storybook publish ([#9244](https://github.com/storybookjs/storybook/pull/9244))

## 5.3.0-rc.3 (December 26, 2019)

### Bug Fixes

- Addon-docs: Include ember files in addon-docs publish ([#9230](https://github.com/storybookjs/storybook/pull/9230))

### Maintenance

- Standalone CSF example ([#9223](https://github.com/storybookjs/storybook/pull/9223))

### Dependency Upgrades

- Addon-info: Upgrade marksy for security ([#9234](https://github.com/storybookjs/storybook/pull/9234))

## 5.3.0-rc.2 (December 26, 2019)

Failed NPM publish

## 5.3.0-rc.1 (December 23, 2019)

### Bug Fixes

- Angular: Add default value to the budgets property ([#9207](https://github.com/storybookjs/storybook/pull/9207))
- DocsPage: Fix title with new path separator scheme ([#9204](https://github.com/storybookjs/storybook/pull/9204))

### Maintenance

- CLI: Make template `stories` glob more permissive ([#9224](https://github.com/storybookjs/storybook/pull/9224))

## 5.3.0-rc.0 (December 19, 2019)

### Features

- CSF: Use `__orderedExports` in loader if provided ([#9181](https://github.com/storybookjs/storybook/pull/9181))

### Bug Fixes

- Addon-a11y: Fix selected blindness color filter ([#9179](https://github.com/storybookjs/storybook/pull/9179))

### Maintenance

- Addon-essentials: Remove actions, links, knobs ([#9184](https://github.com/storybookjs/storybook/pull/9184))

## 5.3.0-beta.31 (December 16, 2019)

### Features

- React: Add support for CRA without overrides ([#9157](https://github.com/storybookjs/storybook/pull/9157))
- Addon-docs: Add fontFamily prop to Typeset component ([#9158](https://github.com/storybookjs/storybook/pull/9158))

### Bug Fixes

- Core: Emit store render event synchronously if we can ([#9087](https://github.com/storybookjs/storybook/pull/9087))

## 5.3.0-beta.30 (December 16, 2019)

Failed NPM publish

## 5.3.0-beta.29 (December 16, 2019)

Failed NPM publish

## 5.3.0-beta.28 (December 16, 2019)

Failed NPM publish

## 5.3.0-beta.27 (December 16, 2019)

Failed NPM publish

## 5.3.0-beta.26 (December 16, 2019)

Failed NPM publish

## 5.3.0-beta.25 (December 15, 2019)

### Bug Fixes

- Addon-docs: Hide addons on docs-only stories ([#9125](https://github.com/storybookjs/storybook/pull/9125))

### Dependency Upgrades

- Upgrade vue-docgen-loader to 1.3.0-beta.0 ([#9155](https://github.com/storybookjs/storybook/pull/9155))

## 5.3.0-beta.24 (December 15, 2019)

Failed NPM publish

## 5.3.0-beta.23 (December 14, 2019)

### Features

- Addon-docs: Render components as leaves in `--docs` mode ([#7700](https://github.com/storybookjs/storybook/pull/7700))

### Bug Fixes

- Addon-viewport: Allow viewports config to be optional ([#9137](https://github.com/storybookjs/storybook/pull/9137))

## 5.3.0-beta.22 (December 12, 2019)

### Bug Fixes

- React: Fix CRA preset check ([#9142](https://github.com/storybookjs/storybook/pull/9142))

### Maintenance

- Build: Change CI to chromatic on all examples ([#9114](https://github.com/storybookjs/storybook/pull/9114))
- Web-components: Clean up example `custom-elements.json` and expose `defaultValue` ([#9107](https://github.com/storybookjs/storybook/pull/9107))

### Dependency Upgrades

- Restore main jscodeshift package ([#9140](https://github.com/storybookjs/storybook/pull/9140))

## 5.3.0-beta.21 (December 11, 2019)

### Features

- CLI: Add Yarn workspaces support for init command ([#9104](https://github.com/storybookjs/storybook/pull/9104))

### Bug Fixes

- Addon-docs: Update MDX compiler to fix knobs ([#9118](https://github.com/storybookjs/storybook/pull/9118))
- CLI: Add web-components to sb init ([#9106](https://github.com/storybookjs/storybook/pull/9106))

### Maintenance

- UI: Remove css usage ([#9003](https://github.com/storybookjs/storybook/pull/9003))

## 5.3.0-beta.20 (December 9, 2019)

### Features

- Addon-essentials: Remove docs from essentials ([#9093](https://github.com/storybookjs/storybook/pull/9093))

### Bug Fixes

- Source-loader: Handle includeStories/excludeStories in CSF ([#9100](https://github.com/storybookjs/storybook/pull/9100))
- Source-loader: Support function declaration story exports ([#9092](https://github.com/storybookjs/storybook/pull/9092))

### Maintenance

- CSF: Refactor router utils into CSF library ([#9099](https://github.com/storybookjs/storybook/pull/9099))

## 5.3.0-beta.19 (December 7, 2019)

### Features

- Addon-essentials ([#9019](https://github.com/storybookjs/storybook/pull/9019))

### Bug Fixes

- Addon-docs: Fix prop table default value for web-components ([#9086](https://github.com/storybookjs/storybook/pull/9086))

## 5.3.0-beta.18 (December 6, 2019)

### Features

- CLI: Change generators to Triconfig ([#9075](https://github.com/storybookjs/storybook/pull/9075))
- Addon-docs: Add Props for Ember ([#9067](https://github.com/storybookjs/storybook/pull/9067))
- MDX: Handle quotes / template literals in title ([#9069](https://github.com/storybookjs/storybook/pull/9069))

### Bug Fixes

- Addon-docs: MDX Octicon anchors should not be tabbable ([#9063](https://github.com/storybookjs/storybook/pull/9063))

### Dependency Upgrades

- Addon-docs: Upgrade vue-docgen-loader ([#9082](https://github.com/storybookjs/storybook/pull/9082))

## 5.3.0-beta.17 (December 6, 2019)

NPM publish failed

## 5.3.0-beta.16 (December 5, 2019)

### Features

- Addon-docs: DocsPage Heading and Subheading anchor links ([#9060](https://github.com/storybookjs/storybook/pull/9060))

### Bug Fixes

- Core: Fix `api.selectStory` for component permalinks ([#9054](https://github.com/storybookjs/storybook/pull/9054))
- Storyshots: Escape Windows fileNames ([#9061](https://github.com/storybookjs/storybook/pull/9061))

### Dependency Upgrades

- Addon-docs: Upgrade vue-docgen-api ([#9066](https://github.com/storybookjs/storybook/pull/9066))

## 5.3.0-beta.15 (December 4, 2019)

### Features

- Addon-docs: MDX Linking ([#9051](https://github.com/storybookjs/storybook/pull/9051))

## 5.2.8 (December 2, 2019)

### Bug Fixes

- UI: Fix layout of Preview container ([#8628](https://github.com/storybookjs/storybook/pull/8628))
- Core: Use `stable` package to ensure story sorting is stable ([#8795](https://github.com/storybookjs/storybook/pull/8795))
- Source-loader: Warn if applied to non-stories file ([#8773](https://github.com/storybookjs/storybook/pull/8773))

## 5.3.0-beta.14 (December 2, 2019)

### Features

- Addon-docs: Increase Props summary and func length ([#8998](https://github.com/storybookjs/storybook/pull/8998))

### Bug Fixes

- Addon-docs: Restore IE11 compat by transpiling acorn-jsx ([#9021](https://github.com/storybookjs/storybook/pull/9021))
- Source-loader: Handle template strings in CSF title ([#8995](https://github.com/storybookjs/storybook/pull/8995))
- CLI: Fix various storiesof-to-csf cases based on chromatic stories upgrade ([#9013](https://github.com/storybookjs/storybook/pull/9013))

## 5.2.7 (November 30, 2019)

### Bug Fixes

- Addon-contexts: Fix 'cannot read property h of undefined' in preact ([#9001](https://github.com/storybookjs/storybook/pull/9001))
- Addon-viewports: Fix missing TypeScript types ([#8848](https://github.com/storybookjs/storybook/pull/8848))
- Addon-A11y: Show errors, reset config properly ([#8779](https://github.com/storybookjs/storybook/pull/8779))
- UI: Store layout state in sessionStorage ([#8786](https://github.com/storybookjs/storybook/pull/8786))
- UI: Fix MobileLayout component error on master ([#8941](https://github.com/storybookjs/storybook/pull/8941))
- Addon-analytics: Fix 'path is required in .pageview()' ([#8468](https://github.com/storybookjs/storybook/pull/8468))

## 5.3.0-beta.13 (November 30, 2019)

### Bug Fixes

- Addon-contexts: Fix 'cannot read property h of undefined' in preact ([#9001](https://github.com/storybookjs/storybook/pull/9001))

### Maintenance

- CLI: Code cleanup ([#9004](https://github.com/storybookjs/storybook/pull/9004))

## 5.3.0-beta.12 (November 29, 2019)

### Features

- Storyshots: Support a11y tests, generic tests ([#8934](https://github.com/storybookjs/storybook/pull/8934))

### Maintenance

- Dev: Add vscode launch.json for debugging ([#8993](https://github.com/storybookjs/storybook/pull/8993))
- UI: viewMode proptypes changed to any string ([#8994](https://github.com/storybookjs/storybook/pull/8994))
- Addon-docs: Remove deprecated framework-specific docs presets ([#8985](https://github.com/storybookjs/storybook/pull/8985))

### Dependency Upgrades

- Addon-docs: Upgrade MDX dependencies ([#8991](https://github.com/storybookjs/storybook/pull/8991))

## 5.3.0-beta.11 (November 28, 2019)

### Features

- UI: Escape hatch CSS on for "active" tablist buttons ([#8989](https://github.com/storybookjs/storybook/pull/8989))
- Addon-docs: Added dark theme option to source component ([#8732](https://github.com/storybookjs/storybook/pull/8732))
- Triconfig: Configure UI options overhaul ([#8871](https://github.com/storybookjs/storybook/pull/8871))

### Bug Fixes

- Addon-docs: Fix vertical alignment of props expandable ([#8953](https://github.com/storybookjs/storybook/pull/8953))
- Addon-links: Fix return type of linkTo and examples ([#8975](https://github.com/storybookjs/storybook/pull/8975))

## 5.3.0-beta.10 (November 27, 2019)

### Features

- MDX: Allow user to override `docs.container` parameter ([#8968](https://github.com/storybookjs/storybook/pull/8968))
- Addon-docs: Increase docs content wrapper max-width to 1000px ([#8970](https://github.com/storybookjs/storybook/pull/8970))
- Addon-docs: Prop table support for Angular directives ([#8922](https://github.com/storybookjs/storybook/pull/8922))
- Addon-docs: Increase width of props table type column ([#8950](https://github.com/storybookjs/storybook/pull/8950))

### Bug Fixes

- Addon-docs: Fix `Preview` theming escape hatch ([#8969](https://github.com/storybookjs/storybook/pull/8969))
- Core: Don't try to require .ts files from dist ([#8971](https://github.com/storybookjs/storybook/pull/8971))
- Core: Use logger in base-webpack.config.js ([#8966](https://github.com/storybookjs/storybook/pull/8966))

### Maintenance

- Examples: Add "debug" script for storybook-official ([#8973](https://github.com/storybookjs/storybook/pull/8973))
- Build: Upgrade to node 10 on netlify ([#8967](https://github.com/storybookjs/storybook/pull/8967))
- Core/triconfig everywhere: migrate examples ([#8942](https://github.com/storybookjs/storybook/pull/8942))

## 5.3.0-beta.9 (November 26, 2019)

### Features

- Storyshots: Remove abandoned storyshots when run with `-u` flag ([#8889](https://github.com/storybookjs/storybook/pull/8889))

### Bug Fixes

- Addon-docs: Support subcomponents as a top-level default export ([#8931](https://github.com/storybookjs/storybook/pull/8931))

### Dependency Upgrades

- Core: Add missing dependencies ([#8945](https://github.com/storybookjs/storybook/pull/8945))

## 5.3.0-beta.8 (November 26, 2019)

### Features

- Storyshots-puppeteer: Add afterScreenshot handler ([#8092](https://github.com/storybookjs/storybook/pull/8092))

### Bug Fixes

- Core: Upgrade telejson to fix cross-origin frame error ([#8940](https://github.com/storybookjs/storybook/pull/8940))

### Maintenance

- Build: Fix image snapshots setup in official-storybook ([#8932](https://github.com/storybookjs/storybook/pull/8932))

### Dependency Upgrades

- Core: Add @babel/core peer dependency to @storybook/core ([#8933](https://github.com/storybookjs/storybook/pull/8933))

## 5.3.0-beta.7 (November 26, 2019)

Failed npm publish

## 5.3.0-beta.6 (November 24, 2019)

### Features

- Presets: dynamic preset injection ([#8921](https://github.com/storybookjs/storybook/pull/8921))

### Bug Fixes

- Revert "feat: use `puppeteer-core` instead of `puppeteer`" ([#8925](https://github.com/storybookjs/storybook/pull/8925))
- Addon-docs: Fix props detail tooltip to prevent cutting end of content ([#8923](https://github.com/storybookjs/storybook/pull/8923))

### Maintenance

- Addon-docs: Base code to improve the props table for TS ([#8905](https://github.com/storybookjs/storybook/pull/8905))
- Build: Fix now deploy ([#8929](https://github.com/storybookjs/storybook/pull/8929))

### Dependency Upgrades

- Miscellaneous upgrades ([#8912](https://github.com/storybookjs/storybook/pull/8912))

## 5.3.0-beta.5 (November 23, 2019)

Failed npm publish

## 5.3.0-beta.4 (November 23, 2019)

Failed npm publish

## 5.3.0-beta.3 (November 21, 2019)

### Features

- Addon-docs: Rich props table UI ([#8887](https://github.com/storybookjs/storybook/pull/8887))
- Addon-docs: Improve basic support for Flow props ([#8890](https://github.com/storybookjs/storybook/pull/8890))
- CLI: Avoid id changes after `storiesof-to-csf` migration ([#8856](https://github.com/storybookjs/storybook/pull/8856))

### Bug Fixes

- Addon-docs: Fix props table for sections props ([#8904](https://github.com/storybookjs/storybook/pull/8904))
- Addon-docs: Fix Description block when no component provided ([#8902](https://github.com/storybookjs/storybook/pull/8902))
- Angular: Fix project without `architect.build` option ([#6737](https://github.com/storybookjs/storybook/pull/6737))

### Maintenance

- Addon-docs: Docgen lib maintenance ([#8896](https://github.com/storybookjs/storybook/pull/8896))
- Examples: Fix stories glob in official-storybook ([#8888](https://github.com/storybookjs/storybook/pull/8888))

## 5.3.0-beta.2 (November 19, 2019)

### Features

- Addon-docs: Customizable DocPage doc blocks ([#8855](https://github.com/storybookjs/storybook/pull/8855))

### Bug Fixes

- Addon-docs: Add back Props "exclude" support ([#8868](https://github.com/storybookjs/storybook/pull/8868))
- Addon-docs: Fix MDX component permalinking ([#8872](https://github.com/storybookjs/storybook/pull/8872))
- Addon-docs: Fix regression to @ignore in Props ([#8867](https://github.com/storybookjs/storybook/pull/8867))

### Maintenance

- Addon-docs: Add tests for prop types default value ([#8869](https://github.com/storybookjs/storybook/pull/8869))

## 5.3.0-beta.1 (November 18, 2019)

### Features

- Addon-google-analytics: Add gaOption config ([#8859](https://github.com/storybookjs/storybook/pull/8859))

### Bug Fixes

- Addon-docs: Fix props table props sorting for PropTypes ([#8857](https://github.com/storybookjs/storybook/pull/8857))
- Fix layout of Preview container ([#8628](https://github.com/storybookjs/storybook/pull/8628))

## 5.3.0-beta.0 (November 16, 2019)

Storybook 5.3 is in beta y'all 🔥🔥🔥 It includes:

- 📝 Longform documentation in MDX
- 🎨 Multi-framework SB Docs (React, Vue, Angular, WC)
- 📦 Web-components framework support
- 🔼 Tri-config (experimental)

See the [latest changelog](https://github.com/storybookjs/storybook/blob/next/CHANGELOG.md) for a full list of changes.

## 5.3.0-alpha.47 (November 16, 2019)

### Features

- Triconfig: Declarative story definition in main.js ([#8748](https://github.com/storybookjs/storybook/pull/8748))
- Storyshots: Triconfig support ([#8765](https://github.com/storybookjs/storybook/pull/8765))

### Bug Fixes

- Addon-viewports: Fix missing TypeScript types ([#8848](https://github.com/storybookjs/storybook/pull/8848))

### Dependency Upgrades

- Dependency upgrades ([#8847](https://github.com/storybookjs/storybook/pull/8847))

## 5.3.0-alpha.46 (November 16, 2019)

### Features

- Core: allow uppercase path names in url query param ([#8516](https://github.com/storybookjs/storybook/pull/8516))

### Bug Fixes

- Core: Fix null version check bug ([#8806](https://github.com/storybookjs/storybook/pull/8806))
- Addon-notes: Fix anchor links ([#8132](https://github.com/storybookjs/storybook/pull/8132))

### Maintenance

- Refactor: remove useless variables from eslint config ([#8843](https://github.com/storybookjs/storybook/pull/8843))

### Dependency Upgrades

- Addon-docs: Replace `storybook-addon-vue-info` with `vue-docgen-loader` ([#8831](https://github.com/storybookjs/storybook/pull/8831))

## 5.3.0-alpha.45 (November 14, 2019)

### Breaking Changes

- CSF: Deprecate displayName parameter ([#8775](https://github.com/storybookjs/storybook/pull/8775))

### Features

- Addon-docs: Rich prop tables ([#8826](https://github.com/storybookjs/storybook/pull/8826))
- Core: Simplified hierarchy separators ([#8796](https://github.com/storybookjs/storybook/pull/8796))
- CLI: Upgrade hierarchy separator codemod + examples ([#8818](https://github.com/storybookjs/storybook/pull/8818))
- CLI: Addon postinstall hooks ([#8700](https://github.com/storybookjs/storybook/pull/8700))
- CSF/MDX: Add component id for permalinks ([#8808](https://github.com/storybookjs/storybook/pull/8808))
- Addon-knobs: Add object[] support for select ([#7957](https://github.com/storybookjs/storybook/pull/7957))

### Bug Fixes

- Addon-A11y: Show errors, reset config properly ([#8779](https://github.com/storybookjs/storybook/pull/8779))

## 5.3.0-alpha.44 (November 13, 2019)

### Features

- React-native: Add theming to ondevice-addons ([#8738](https://github.com/storybookjs/storybook/pull/8738))

### Bug Fixes

- UI: Store layout state in sessionStorage ([#8786](https://github.com/storybookjs/storybook/pull/8786))
- Core: Use `stable` package to ensure story sorting is stable ([#8795](https://github.com/storybookjs/storybook/pull/8795))

### Maintenance

- Svelte: Migrate @storybook/svelte to Typescript ([#8770](https://github.com/storybookjs/storybook/pull/8770))

## 5.3.0-alpha.43 (November 11, 2019)

### Bug Fixes

- Source-loader: Warn if applied to non-stories file ([#8773](https://github.com/storybookjs/storybook/pull/8773))

### Maintenance

- Presets / Addon-docs: Cleanup framework-specific presets ([#8782](https://github.com/storybookjs/storybook/pull/8782))
- Add @babel/runtime to workspace ([#8774](https://github.com/storybookjs/storybook/pull/8774))

## 5.2.6 (November 9, 2019)

### Bug Fixes

- Addon-info: Remove jsnext:main ([#8764](https://github.com/storybookjs/storybook/pull/8764))
- Addon-info: Fix "The prop 'children' is marked as required in 'Td'" ([#8745](https://github.com/storybookjs/storybook/pull/8745))
- UI: Fix unmount components on Canvas/Docs tab switch ([#8625](https://github.com/storybookjs/storybook/pull/8625))
- Addon-docs: Fix code style inside LI ([#8708](https://github.com/storybookjs/storybook/pull/8708))
- Remove min-height CSS rule from DocsPage wrapper ([#8366](https://github.com/storybookjs/storybook/pull/8366))
- Core: Revert webpack rebuild changes in node_modules ([#8657](https://github.com/storybookjs/storybook/pull/8657))
- Addon-notes: Add key to render function ([#8633](https://github.com/storybookjs/storybook/pull/8633))
- Addon-docs: Fix story scroll-to heuristics ([#8629](https://github.com/storybookjs/storybook/pull/8629))
- React-native-server: Changed default port to number in CLI options ([#8584](https://github.com/storybookjs/storybook/pull/8584))
- Increase TooltipLinkList max-height to accommodate more links ([#8545](https://github.com/storybookjs/storybook/pull/8545))
- Prevent form submission as search is done while typing ([#8546](https://github.com/storybookjs/storybook/pull/8546))
- Ondevice-knobs: Fix peer dep ([#8644](https://github.com/storybookjs/storybook/pull/8644))

## 5.3.0-alpha.42 (November 9, 2019)

### Bug Fixes

- Addon-info: Remove jsnext:main ([#8764](https://github.com/storybookjs/storybook/pull/8764))
- Addon-info: Fix "The prop 'children' is marked as required in 'Td'" ([#8745](https://github.com/storybookjs/storybook/pull/8745))

### Maintenance

- React-native: Update compilation target - it was compiled for old browsers ([#8698](https://github.com/storybookjs/storybook/pull/8698))

## 5.3.0-alpha.41 (November 7, 2019)

### Features

- Addon-docs: Render array of shape properly in props table ([#8707](https://github.com/storybookjs/storybook/pull/8707))
- Addon-docs: Render params description in props table, support @ignore ([#8702](https://github.com/storybookjs/storybook/pull/8702))

### Bug Fixes

- Addon-docs: Fix "Cannot read property 'props'" ([#8731](https://github.com/storybookjs/storybook/pull/8731))
- UI: Fix unmount components on Canvas/Docs tab switch ([#8625](https://github.com/storybookjs/storybook/pull/8625))
- Angular: Fix loading baseConfig if no angular.json found ([#8727](https://github.com/storybookjs/storybook/pull/8727))

## 5.3.0-alpha.40 (November 6, 2019)

### Features

- TriConfig configuration refactor ([#8597](https://github.com/storybookjs/storybook/pull/8597))
- Presets: Ability to combine presets into another preset ([#6828](https://github.com/storybookjs/storybook/pull/6828))

### Bug Fixes

- Theming: Fix invisible hr styles in typography ([#8659](https://github.com/storybookjs/storybook/pull/8659))

### Maintenance

- Build: caching to github workflows ([#8724](https://github.com/storybookjs/storybook/pull/8724))

## 5.3.0-alpha.39 (November 5, 2019)

### Breaking Changes

- React-native: Require user-provided async storage ([#7801](https://github.com/storybookjs/storybook/pull/7801))

### Features

- Addon-docs: Inline rendering for web-components as default ([#8705](https://github.com/storybookjs/storybook/pull/8705))

### Bug Fixes

- Addon-docs: Fix recipe to use `notes` as component description ([#8718](https://github.com/storybookjs/storybook/pull/8718))
- Addon-docs: Fix code style inside LI ([#8708](https://github.com/storybookjs/storybook/pull/8708))
- React Native: Fix on-device-notes ([#8692](https://github.com/storybookjs/storybook/pull/8692))
- React Native: On Device Knobs Groups Fix ([#8694](https://github.com/storybookjs/storybook/pull/8694))
- React-native: Fix event listening for story navigation ([#8690](https://github.com/storybookjs/storybook/pull/8690))
- React-Native: Add safe area wrapper for iphone x and later ([#8679](https://github.com/storybookjs/storybook/pull/8679))

## 5.3.0-alpha.38 (November 3, 2019)

### Bug Fixes

- React-native: Patch rn-host-detect ([#8683](https://github.com/storybookjs/storybook/pull/8683))
- React-native: Fix layout in RN61 so addons no longer initially displayed ([#8681](https://github.com/storybookjs/storybook/pull/8681))

### Maintenance

- React-native: Catch touch events when preview is minimized ([#8680](https://github.com/storybookjs/storybook/pull/8680))
- React-native: Make menu bar have its own position instead of absolute ([#8678](https://github.com/storybookjs/storybook/pull/8678))

## 5.3.0-alpha.37 (November 2, 2019)

### Bug Fixes

- Source-loader: Fix Typescript support ([#8499](https://github.com/storybookjs/storybook/pull/8499))

## 5.3.0-alpha.36 (November 2, 2019)

### Features

- Addon-docs: Angular DocsPage props table ([#8621](https://github.com/storybookjs/storybook/pull/8621))
- Addon-docs: Support jsdoc params to describe function signature ([#8660](https://github.com/storybookjs/storybook/pull/8660))

### Bug Fixes

- Addon-docs: Remove min-height CSS rule from DocsPage wrapper ([#8366](https://github.com/storybookjs/storybook/pull/8366))
- Addon-docs: Check component propTypes before unwrapping ([#8665](https://github.com/storybookjs/storybook/pull/8665))

## 5.3.0-alpha.35 (November 1, 2019)

### Bug Fixes

- Core: Revert webpack rebuild changes in node_modules ([#8657](https://github.com/storybookjs/storybook/pull/8657))
- Ondevice-knobs: Fix peer dep ([#8643](https://github.com/storybookjs/storybook/pull/8643))

## 5.3.0-alpha.34 (October 30, 2019)

### Bug Fixes

- Addon-notes: Add key to render function ([#8633](https://github.com/storybookjs/storybook/pull/8633))
- Addon-docs: Fix story scroll-to heuristics ([#8629](https://github.com/storybookjs/storybook/pull/8629))
- Addon-docs: Fix props table in no props case ([#8632](https://github.com/storybookjs/storybook/pull/8632))
- Addon-docs/web-components: Add attributes to props table ([#8598](https://github.com/storybookjs/storybook/pull/8598))
- CLI: Fix package.json update ([#8615](https://github.com/storybookjs/storybook/pull/8615))
- React-native: Fix background style ([#8480](https://github.com/storybookjs/storybook/pull/8480))

### Maintenance

- Channel: Clean up test ([#8627](https://github.com/storybookjs/storybook/pull/8627))
- RAX: Fix example app ([#8617](https://github.com/storybookjs/storybook/pull/8617))

### Dependency Upgrades

- Misc. dependency upgrades ([#8612](https://github.com/storybookjs/storybook/pull/8612))

## 5.3.0-alpha.33 (October 28, 2019)

### Maintenance

- Web-components: Move custom-elements utils to app ([#8592](https://github.com/storybookjs/storybook/pull/8592))

## 5.3.0-alpha.32 (October 28, 2019)

### Features

- Addon-docs: Props / Description for web-components ([#8585](https://github.com/storybookjs/storybook/pull/8585))
- Core: Global addDecorator/addParameters ([#8573](https://github.com/storybookjs/storybook/pull/8573))
- Addon-docs: Generalize Description doc block ([#8590](https://github.com/storybookjs/storybook/pull/8590))

### Bug Fixes

- React-native-server: Changed default port to number in CLI options ([#8584](https://github.com/storybookjs/storybook/pull/8584))

### Maintenance

- Typescript: Use native package types now available ([#8588](https://github.com/storybookjs/storybook/pull/8588))
- Build: Fix now deploy maybe ([#8589](https://github.com/storybookjs/storybook/pull/8589))

## 5.3.0-alpha.31 (October 27, 2019)

### Dependency Upgrades

- Upgrade babel-plugin-react-docgen to 4.0.0-beta.1 ([#8581](https://github.com/storybookjs/storybook/pull/8581))

## 5.3.0-alpha.30 (October 27, 2019)

### Features

- Addon-docs: Modify Typeset doc block to accept units ([#8574](https://github.com/storybookjs/storybook/pull/8574))

### Bug Fixes

- Web-components: Use framework id 'web-components' ([#8579](https://github.com/storybookjs/storybook/pull/8579))

### Maintenance

- WC-kitchen-sink: Add babel-loader dependency ([#8578](https://github.com/storybookjs/storybook/pull/8578))

### Dependency Upgrades

- Upgrade babel-plugin-react-docgen to 3.2.0 ([#8580](https://github.com/storybookjs/storybook/pull/8580))

## 5.3.0-alpha.29 (October 25, 2019)

### Features

- Addon-docs: Add props loader to vue preset ([#8567](https://github.com/storybookjs/storybook/pull/8567))

### Dependency Upgrades

- Angular: bump zone.js version in peer dependencies ([#8558](https://github.com/storybookjs/storybook/pull/8558))

## 5.3.0-alpha.28 (October 25, 2019)

### Features

- Addon-docs: Publish web-components preset ([#8563](https://github.com/storybookjs/storybook/pull/8563))
- Addon-docs: Vue slots/events props table + generalization ([#8489](https://github.com/storybookjs/storybook/pull/8489))

## 5.3.0-alpha.27 (October 24, 2019)

### Features

- Core: Allow linking to kind/component ID ([#7648](https://github.com/storybookjs/storybook/pull/7648))
- Addon-docs: Jest MDX transform for storyshots ([#8189](https://github.com/storybookjs/storybook/pull/8189))
- CLI: Add flag to disable version checks ([#8488](https://github.com/storybookjs/storybook/pull/8488))
- Typescript: add types for react demo ([#8517](https://github.com/storybookjs/storybook/pull/8517))

### Bug Fixes

- UI: Increase TooltipLinkList max-height to accommodate more links ([#8545](https://github.com/storybookjs/storybook/pull/8545))
- UI: Prevent form submission as search is done while typing ([#8546](https://github.com/storybookjs/storybook/pull/8546))

### Dependency Upgrades

- Remove outdated and unused `jsx-to-string` library ([#8549](https://github.com/storybookjs/storybook/pull/8549))

## 5.3.0-alpha.26 (October 23, 2019)

Fix web-components storybook dependencies

## 5.3.0-alpha.25 (October 23, 2019)

### Features

- Web-components: New storybook app ([#8400](https://github.com/storybookjs/storybook/pull/8400))
- Core: Allow custom postcss config ([#8498](https://github.com/storybookjs/storybook/pull/8498))

## 5.3.0-alpha.24 (October 22, 2019)

### Features

- Docs: Highlight ts and tsx syntax ([#8493](https://github.com/storybookjs/storybook/pull/8493))

### Bug Fixes

- React-native-server: Convert port to number in CLI options ([#8491](https://github.com/storybookjs/storybook/pull/8491))

### Maintenance

- Automate codemod tests as jest snapshots ([#8506](https://github.com/storybookjs/storybook/pull/8506))

### Dependency Upgrades

- Add "@types/react-textarea-autosize" to dependencies ([#8503](https://github.com/storybookjs/storybook/pull/8503))

## 5.2.5 (October 22, 2019)

### Bug Fixes

- UI: Fix React15 support ([#8454](https://github.com/storybookjs/storybook/pull/8454))
- React-native-server: Convert port to number in CLI options ([#8491](https://github.com/storybookjs/storybook/pull/8491))
- Addon-docs: Fix React.forwardedRef/memo props ([#8445](https://github.com/storybookjs/storybook/pull/8445))
- MDX: Handle `<Story>` name starting with number ([#8469](https://github.com/storybookjs/storybook/pull/8469))
- React: Fix custom themes breaking the welcome demo ([#8259](https://github.com/storybookjs/storybook/pull/8259))
- Addon-jest: Make withTests type generic ([#8410](https://github.com/storybookjs/storybook/pull/8410))

### Dependency Upgrades

- [Security] Bump lodash from 4.17.11 to 4.17.15 ([#8351](https://github.com/storybookjs/storybook/pull/8351))

### Dependency Upgrades

- Add "@types/react-textarea-autosize" to dependencies ([#8503](https://github.com/storybookjs/storybook/pull/8503))

## 5.3.0-alpha.23 (October 19, 2019)

### Features

- Webpack: Enabled error details ([#8391](https://github.com/storybookjs/storybook/pull/8391))

### Bug Fixes

- Addon-docs: Fix React.forwardedRef/memo props ([#8445](https://github.com/storybookjs/storybook/pull/8445))
- MDX: Handle `<Story>` name starting with number ([#8469](https://github.com/storybookjs/storybook/pull/8469))

### Maintenance

- ADD a step in circleci to upload storybook for angular ([#8477](https://github.com/storybookjs/storybook/pull/8477))
- Core: Check module type in configure ([#8412](https://github.com/storybookjs/storybook/pull/8412))
- Angular: Convert angular-cli stories to CSF ([#7668](https://github.com/storybookjs/storybook/pull/7668))
- Typescript: Migrate @storybook/mithril ([#8320](https://github.com/storybookjs/storybook/pull/8320))

## 5.3.0-alpha.22 (October 18, 2019)

### Features

- CLI: Add component meta to framework templates ([#8462](https://github.com/storybookjs/storybook/pull/8462))

### Maintenance

- Build: Add cypress to Storybook CI ([#8397](https://github.com/storybookjs/storybook/pull/8397))
- Incorrect minimal required node version ([#8427](https://github.com/storybookjs/storybook/pull/8427))

## 5.3.0-alpha.21 (October 17, 2019)

### Features

- CLI: React-scripts TS template & test ([#8451](https://github.com/storybookjs/storybook/pull/8451))
- Addon-storysource: Add preset ([#8437](https://github.com/storybookjs/storybook/pull/8437))

### Bug Fixes

- UI: Fix React15 support ([#8454](https://github.com/storybookjs/storybook/pull/8454))
- Addon-centered: Fix zoom issues for non-Firefox browsers ([#8442](https://github.com/storybookjs/storybook/pull/8442))
- CLI: Add CRA preset to MDX template ([#8452](https://github.com/storybookjs/storybook/pull/8452))
- CLI: Add preset-create-react-app to CRA presets template ([#8449](https://github.com/storybookjs/storybook/pull/8449))
- CLI: Fix CRA-ts fixture package name ([#8457](https://github.com/storybookjs/storybook/pull/8457))

## 5.3.0-alpha.20 (October 15, 2019)

### Features

- Addon-docs: Support MDX source in Preview w/ no Story blocks ([#7966](https://github.com/storybookjs/storybook/pull/7966))

### Bug Fixes

- Addon-docs: Fix react inline stories ([#8419](https://github.com/storybookjs/storybook/pull/8419))
- React: Fix custom themes breaking welcome demo ([#8259](https://github.com/storybookjs/storybook/pull/8259))

## 5.3.0-alpha.19 (October 15, 2019)

### Features

- React: Move Create React App support to external preset ([#8416](https://github.com/storybookjs/storybook/pull/8416))
- CLI: MDX template support ([#8396](https://github.com/storybookjs/storybook/pull/8396))

### Bug Fixes

- Addon-jest: Make withTests type generic ([#8410](https://github.com/storybookjs/storybook/pull/8410))
- Addon-docs: Don't error in React when there's no `prepareForInline` ([#8415](https://github.com/storybookjs/storybook/pull/8415))

### Dependency Upgrades

- [Security] Bump lodash from 4.17.11 to 4.17.15 ([#8351](https://github.com/storybookjs/storybook/pull/8351))

## 5.3.0-alpha.18 (October 14, 2019)

### Bug Fixes

- CSF: Warn when CSF and `storiesOf` mixed in one file ([#8411](https://github.com/storybookjs/storybook/pull/8411))
- Addon API: Clean preview hooks when removing a story ([#8408](https://github.com/storybookjs/storybook/pull/8408))
- Addon-docs: Fix typo in default config ([#8403](https://github.com/storybookjs/storybook/pull/8403))
- Angular: Fix angular2-template-loader / raw-loader version conflicts ([#8269](https://github.com/storybookjs/storybook/pull/8269))
- CLI: Update button.svelte template ([#8369](https://github.com/storybookjs/storybook/pull/8369))

### Maintenance

- Official-storybook: Add a story with duplicate decorators ([#8407](https://github.com/storybookjs/storybook/pull/8407))

## 5.2.4 (October 14, 2019)

### Bug Fixes

- Angular: Fix angular2-template-loader / raw-loader version conflicts ([#8269](https://github.com/storybookjs/storybook/pull/8269))
- CSF: Warn when CSF and `storiesOf` mixed in one file ([#8411](https://github.com/storybookjs/storybook/pull/8411))
- Addon API: Clean preview hooks when removing a story ([#8408](https://github.com/storybookjs/storybook/pull/8408))
- Update button.svelte ([#8369](https://github.com/storybookjs/storybook/pull/8369))
- CSF: Ignore \_\_esModule export ([#8317](https://github.com/storybookjs/storybook/pull/8317))

### Maintenance

- Publish top-level .js and .d.ts files ([#8354](https://github.com/storybookjs/storybook/pull/8354))

## 5.3.0-alpha.17 (October 10, 2019)

### Maintenance

- Publish top-level .js and .d.ts files ([#8354](https://github.com/storybookjs/storybook/pull/8354))

## 5.3.0-alpha.16 (October 10, 2019)

Publish failed

## 5.3.0-alpha.15 (October 8, 2019)

### Features

- Addon-docs: support vue inline rendering ([#7929](https://github.com/storybookjs/storybook/pull/7929))

### Maintenance

- Typescript: Migrate addon-storyshots ([#7674](https://github.com/storybookjs/storybook/pull/7674))

## 5.3.0-alpha.14 (October 8, 2019)

NPM publish failed

## 5.3.0-alpha.13 (October 8, 2019)

### Features

- MDX: Better ergonomics for documenting CSF ([#8312](https://github.com/storybookjs/storybook/pull/8312))
- Addon-docs: Story parameter for disabling docs ([#8313](https://github.com/storybookjs/storybook/pull/8313))

### Dependency Upgrades

- Remove redundant dependency on hoist-non-react-statics (#6349) ([#8310](https://github.com/storybookjs/storybook/pull/8310))

## 5.3.0-alpha.12 (October 7, 2019)

### Features

- CSF: Allow multiple CSF with same title ([#8133](https://github.com/storybookjs/storybook/pull/8133))

### Bug Fixes

- CSF: Ignore \_\_esModule export ([#8317](https://github.com/storybookjs/storybook/pull/8317))
- React: Improve type of storyFn ([#8197](https://github.com/storybookjs/storybook/pull/8197))

## 5.2.3 (October 7, 2019)

### Bug Fixes

- Core: Fix lib/core whitelist ([#8182](https://github.com/storybookjs/storybook/pull/8182))

## 5.2.2 (October 7, 2019)

### Bug Fixes

- Storyshots: First-class CSF support ([#8000](https://github.com/storybookjs/storybook/pull/8000))
- UI: Move addon dependencies to devDependencies ([#8206](https://github.com/storybookjs/storybook/pull/8206))
- Addon-docs: CSS classes for escape-hatch theming wrapper/content ([#8061](https://github.com/storybookjs/storybook/pull/8061))
- CLI: Fix variable collisions in storiesof-to-csf ([#8106](https://github.com/storybookjs/storybook/pull/8106))
- Addon-knobs: Add missing type def #8105 ([#8118](https://github.com/storybookjs/storybook/pull/8118))
- Dependencies: add @types/webpack-env to apps that depend on it ([#8119](https://github.com/storybookjs/storybook/pull/8119))
- Core: Show exception rather than error on react error boundary ([#8100](https://github.com/storybookjs/storybook/pull/8100))
- UI: Fix inline code styling for dark theme ([#8260](https://github.com/storybookjs/storybook/pull/8260))
- Addon-ondevice-notes: Validate the state content ([#8261](https://github.com/storybookjs/storybook/pull/8261))
- Telejson: New version with typings and bugfixes ([#8228](https://github.com/storybookjs/storybook/pull/8228))
- React: Add DecoratorFn type to exports ([#8121](https://github.com/storybookjs/storybook/pull/8121))
- Addon-knobs: Handle undefined array value ([#8006](https://github.com/storybookjs/storybook/pull/8006))
- Preact: Allow JSX.Element story ([#8159](https://github.com/storybookjs/storybook/pull/8159))
- Storyshots: Fix STORYBOOK_HOOKS_CONTEXT error ([#8163](https://github.com/storybookjs/storybook/pull/8163))
- Update react-draggable to 4.0.3 ([#8145](https://github.com/storybookjs/storybook/pull/8145))

## 5.3.0-alpha.11 (October 6, 2019)

### Bug Fixes

- Storyshots: Update `read-pkg-up` usage to work with version `7` ([#8299](https://github.com/storybookjs/storybook/pull/8299))

### Maintenance

- Remove `weak` dependency Node 12 ([#8300](https://github.com/storybookjs/storybook/pull/8300))

## 5.3.0-alpha.10 (October 5, 2019)

### Bug Fixes

- Storyshots: First-class CSF support ([#8000](https://github.com/storybookjs/storybook/pull/8000))

### Maintenance

- Build: Add CLI test in github actions ([#8064](https://github.com/storybookjs/storybook/pull/8064))

## 5.3.0-alpha.9 (October 4, 2019)

### Features

- API: Add method to set manager config ([#8232](https://github.com/storybookjs/storybook/pull/8232))

### Bug Fixes

- Core: Show exception rather than error on react error boundary ([#8100](https://github.com/storybookjs/storybook/pull/8100))
- Addon-knobs: Fix issues caused by rerenders ([#8287](https://github.com/storybookjs/storybook/pull/8287))

### Maintenance

- Fix local `yarn lint` ([#8289](https://github.com/storybookjs/storybook/pull/8289))
- Fix button knob story ([#8282](https://github.com/storybookjs/storybook/pull/8282))
- Official examples: apply babel-preset-minify only in production mode ([#8283](https://github.com/storybookjs/storybook/pull/8283))
- Build: Upgrade chromatic to test ([#8246](https://github.com/storybookjs/storybook/pull/8246))

### Dependency Upgrades

- Upgrade regenerator-runtime to 0.13 in all packages ([#8258](https://github.com/storybookjs/storybook/pull/8258))
- Misc upgrades ([#8280](https://github.com/storybookjs/storybook/pull/8280))

## 5.3.0-alpha.9 (October 4, 2019)

NPM publish failed

## 5.3.0-alpha.7 (October 2, 2019)

### Features

- UI: Preferred color scheme awareness ([#8271](https://github.com/storybookjs/storybook/pull/8271))

### Bug Fixes

- UI: Fix inline code styling for dark theme ([#8260](https://github.com/storybookjs/storybook/pull/8260))

### Maintenance

- Regenerate lockfile ([#8263](https://github.com/storybookjs/storybook/pull/8263))

## 5.3.0-alpha.6 (October 1, 2019)

### Bug Fixes

- Addon-ondevice-notes: Validate the state content ([#8261](https://github.com/storybookjs/storybook/pull/8261))
- API: Fix require cycles in addons hooks ([#8236](https://github.com/storybookjs/storybook/pull/8236))
- API: Fix missing `channel.off` ([#8234](https://github.com/storybookjs/storybook/pull/8234))
- Telejson: New version with typings and bugfixes ([#8228](https://github.com/storybookjs/storybook/pull/8228))
- Addon-links: Update linkTo type to accept function ([#8117](https://github.com/storybookjs/storybook/pull/8117))
- React: Add DecoratorFn type to exports ([#8121](https://github.com/storybookjs/storybook/pull/8121))

### Maintenance

- Update angular example to v8 ([#7747](https://github.com/storybookjs/storybook/pull/7747))
- Hitting some flakiness in now deploys, this might help ([#8200](https://github.com/storybookjs/storybook/pull/8200))
- Remov hooks from extracted StoryItem ([#8256](https://github.com/storybookjs/storybook/pull/8256))

### Dependency Upgrades

- Bump react-native-swipe-gestures to 1.0.4 ([#8235](https://github.com/storybookjs/storybook/pull/8235))

## 5.3.0-alpha.5 (September 27, 2019)

### Maintenance

- UI: Improve code indentation ([#8218](https://github.com/storybookjs/storybook/pull/8218))
- Use the extracted linting configs ([#8213](https://github.com/storybookjs/storybook/pull/8213))

## 5.3.0-alpha.4 (September 26, 2019)

### Bug Fixes

- UI: Move addon dependencies to devDependencies ([#8206](https://github.com/storybookjs/storybook/pull/8206))
- Addon-knobs: Handle undefined array value ([#8006](https://github.com/storybookjs/storybook/pull/8006))

### Maintenance

- Build: Upgrade from node8 to node10 ([#8207](https://github.com/storybookjs/storybook/pull/8207))

## 5.3.0-alpha.3 (September 25, 2019)

### Bug Fixes

- Dependencies: add @types/webpack-env to apps that depend on it ([#8119](https://github.com/storybookjs/storybook/pull/8119))
- UI: Removes default CSS margins on viewport ([#7742](https://github.com/storybookjs/storybook/pull/7742))

## 5.3.0-alpha.2 (September 24, 2019)

### Bug Fixes

- Core: Fix lib/core files ([#8182](https://github.com/storybookjs/storybook/pull/8182))

## 5.3.0-alpha.1 (September 23, 2019)

### Bug Fixes

- Preact: Allow JSX.Element story ([#8159](https://github.com/storybookjs/storybook/pull/8159))
- Addon-docs: CSS classes for escape-hatch theming wrapper/content ([#8061](https://github.com/storybookjs/storybook/pull/8061))
- CLI: Fix variable collisions in storiesof-to-csf ([#8106](https://github.com/storybookjs/storybook/pull/8106))
- Storyshots: Fix STORYBOOK_HOOKS_CONTEXT error ([#8163](https://github.com/storybookjs/storybook/pull/8163))
- Addon-contexts: Remove peer dependencies ([#7675](https://github.com/storybookjs/storybook/pull/7675))
- Addon-knobs: Add missing type def ([#8118](https://github.com/storybookjs/storybook/pull/8118))

### Dependency Upgrades

- Update react-draggable to 4.0.3 ([#8145](https://github.com/storybookjs/storybook/pull/8145))

## 5.2.1 (September 17, 2019)

### Bug Fixes

- Core: Fix error handling ([#8097](https://github.com/storybookjs/storybook/pull/8097))

## 5.3.0-alpha.0 (September 16, 2019)

### Features

- UI: Debounce sidebar search filter ([#8032](https://github.com/storybookjs/storybook/pull/8032))

### Bug Fixes

- Core: Fix error handling ([#8097](https://github.com/storybookjs/storybook/pull/8097))

### Maintenance

- CLI: Add wrapper packages: sb & storybook ([#8034](https://github.com/storybookjs/storybook/pull/8034))
- Build: Update now config ([#8049](https://github.com/storybookjs/storybook/pull/8049))

## 5.2.0 (September 13, 2019)

Storybook 5.2 is here!

- 📚 DocsPage: Zero-config documentation
- 📦 Component Story Format: Portable ES6 modules
- 🖼 Design System: Best practice component development
- 🧩 Addon API: Simplified w/ hooks

  5.2 contains hundreds more fixes, features, and tweaks. Browse the changelogs matching `5.2.0-alpha.*`, `5.2.0-beta.*`, and `5.2.0-rc.*` for the full list of changes. See [MIGRATION.md](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) to upgrade from `5.0` or earlier.

## 5.2.0-rc.11 (September 10, 2019)

### Features

- DocsPage: show docs.storyDescription above story ([#8037](https://github.com/storybookjs/storybook/pull/8037))

### Maintenance

- Migrate to new github actions ([#8045](https://github.com/storybookjs/storybook/pull/8045))

## 5.2.0-rc.10 (September 9, 2019)

### Bug Fixes

- Angular: remove webpack-env from tsconfig types ([#8036](https://github.com/storybookjs/storybook/pull/8036))

### Documentation

- Guides: Update all guides to CSF ([#8030](https://github.com/storybookjs/storybook/pull/8030))

## 5.2.0-rc.9 (September 7, 2019)

### Bug Fixes

- Addon-knobs: allow array values in select and options knobs ([#8027](https://github.com/storybookjs/storybook/pull/8027))

## 5.2.0-rc.8 (September 6, 2019)

### Bug Fixes

- Addon-docs: Scroll story into view ([#7994](https://github.com/storybookjs/storybook/pull/7994))
- Addon-docs: Fix LI styling for dark color theme ([#8015](https://github.com/storybookjs/storybook/pull/8015))

## 5.2.0-rc.7 (September 6, 2019)

Publish failed

## 5.2.0-rc.6 (September 5, 2019)

### Bug Fixes

- Addon-docs: Doc blocks fixes for dark theme ([#7991](https://github.com/storybookjs/storybook/pull/7991))
- API: Fix useEfect in inline Docs ([#7992](https://github.com/storybookjs/storybook/pull/7992))
- UI: Fix enableShortcuts option ([#7990](https://github.com/storybookjs/storybook/pull/7990))
- Addon-docs: Error handling for invalid Story id ([#7965](https://github.com/storybookjs/storybook/pull/7965))

## 5.2.0-rc.5 (September 4, 2019)

### Bug Fixes

- CLI: Force welcome stories to show up first in load order ([#7979](https://github.com/storybookjs/storybook/pull/7979))

## 5.2.0-rc.4 (September 3, 2019)

### Bug Fixes

- Addon-docs: Fix MDX theme bleed with reset context ([#7974](https://github.com/storybookjs/storybook/pull/7974))

## 5.2.0-rc.3 (September 3, 2019)

Failed publish

## 5.2.0-rc.2 (September 1, 2019)

### Bug Fixes

- Addon-docs: Fix inline stories using react hooks ([#7946](https://github.com/storybookjs/storybook/pull/7946))

## 5.2.0-rc.1 (August 31, 2019)

### Features

- Core: Add html lang attribute to iframe ([#7892](https://github.com/storybookjs/storybook/pull/7892))

### Bug Fixes

- Source-loader: Fix CSF display name handling ([#7940](https://github.com/storybookjs/storybook/pull/7940))
- React-native: Resolve deprecated methods ([#7908](https://github.com/storybookjs/storybook/pull/7908))
- Addon-viewport: keep styles on rotation-change ([#7683](https://github.com/storybookjs/storybook/pull/7683))
- Addon-viewport: Fix defaultViewport ([#7934](https://github.com/storybookjs/storybook/pull/7934))

## 5.2.0-rc.0 (August 30, 2019)

5.2 is in RC!!! 🎉What this means:

- no glaring bugs relating to new features (that we know of)
- bugfixes only until 5.2 final
- follow-on features to be released in `5.3-alpha` ASAP

Track progress on the [5.2 release issue](https://github.com/storybookjs/storybook/issues/7430)

## 5.2.0-beta.48 (August 30, 2019)

### Bug Fixes

- Addon-docs: Fix docs-only story ID suffix ([#7921](https://github.com/storybookjs/storybook/pull/7921))

### Maintenance

- Replace favicon with new Storybook icon. ([#7922](https://github.com/storybookjs/storybook/pull/7922))

### Dependency Upgrades

- Bump react-draggable from 3.1.1 to 3.3.2 ([#7912](https://github.com/storybookjs/storybook/pull/7912))

## 5.2.0-beta.47 (August 30, 2019)

### Bug Fixes

- UI: Optimize treeview render/filter performance ([#7910](https://github.com/storybookjs/storybook/pull/7910))
- Addon-docs: Fix DocsPage to respect displayName ([#7915](https://github.com/storybookjs/storybook/pull/7915))

## 5.2.0-beta.46 (August 29, 2019)

CSF users: this reverts the `makeDisplayName` change introduced in `5.2.0-beta.43` for maintainability reasons. See [#7901](https://github.com/storybookjs/storybook/pull/7901) for full rationale. And apologies for the inconvenience!

### Bug Fixes

- React: Fix missing props in the Welcome.tsx demo ([#7774](https://github.com/storybookjs/storybook/pull/7774))

### Maintenance

- CSF: Revert `makeDisplayName` & add stable `storyNameFromExport` ([#7901](https://github.com/storybookjs/storybook/pull/7901))
- Addon-a11y: Upgrade axe to 3.3.2 which adds/mods rules ([#7888](https://github.com/storybookjs/storybook/pull/7888))

## 5.2.0-beta.45 (August 28, 2019)

### Bug Fixes

- Addon-docs: Fix MDX Story ID to match new CSF ([#7894](https://github.com/storybookjs/storybook/pull/7894))

## 5.2.0-beta.44 (August 28, 2019)

Publish failed

## 5.2.0-beta.43 (August 28, 2019)

CSF users: This is potentially a breaking change. If you want to opt-out of the new default display name calculation (`lodash.startCase`) you can add the following to your SB config:

```js
addParameters({ options: { makeDisplayName: (key) => key } });
```

### Features

- CSF: Transform CSF named exports w/ `makeDisplayName` ([#7878](https://github.com/storybookjs/storybook/pull/7878))

## 5.2.0-beta.42 (August 28, 2019)

Addon-docs users: This is a breaking change if you have been hacking the `docs` parameter manually. If you're using the zero-config option for `DocsPage` or `MDX`, you should be unaffected by it.

### Maintenance

- Addon-docs: Make config API consistent with other addons ([#7874](https://github.com/storybookjs/storybook/pull/7874))

## 5.2.0-beta.41 (August 27, 2019)

### Features

- Addon-info: Add configurable component comparator ([#7409](https://github.com/storybookjs/storybook/pull/7409))

### Bug Fixes

- Addon-viewports: Add back default viewports ([#7448](https://github.com/storybookjs/storybook/pull/7448))
- Core: Pass a separate hooks context per story ([#7860](https://github.com/storybookjs/storybook/pull/7860))
- UI: Fix TooltipLinkList not scrollable ([#7865](https://github.com/storybookjs/storybook/pull/7865))

### Maintenance

- UI: Add ignore `first-child` selector warning flag ([#7861](https://github.com/storybookjs/storybook/pull/7861))

## 5.2.0-beta.40 (August 23, 2019)

### Bug Fixes

- Addon-docs: Fix DocsPage primary story switching ([#7849](https://github.com/storybookjs/storybook/pull/7849))
- Source-loader: Selectively ignore typescript errors in generated code ([#7845](https://github.com/storybookjs/storybook/pull/7845))
- Addon-docs: Force hidden attribute on #root element ([#7841](https://github.com/storybookjs/storybook/pull/7841))

### Maintenance

- Remove temporarily added --no-dll option on examples ([#7647](https://github.com/storybookjs/storybook/pull/7647))

## 5.2.0-beta.39 (August 22, 2019)

### Bug Fixes

- React-Native: Fix tabs layout issue on simulator ([#7809](https://github.com/storybookjs/storybook/pull/7809))
- Source-loader: Selectively ignore typescript errors in generated code ([#7831](https://github.com/storybookjs/storybook/pull/7831))

## 5.2.0-beta.38 (August 21, 2019)

### Bug Fixes

- FIX issue where the block of build info (including url) wouldn't show if passed --ci #7821 ([#7822](https://github.com/storybookjs/storybook/pull/7822))

### Maintenance

- CLI: Remove babel-register in favor of esm ([#7823](https://github.com/storybookjs/storybook/pull/7823))

## 5.2.0-beta.37 (August 20, 2019)

### Breaking Changes

- Addon-docs: Add docsContainer parameter ([#7814](https://github.com/storybookjs/storybook/pull/7814))

## 5.2.0-beta.36 (August 20, 2019)

### Features

- Addon-docs: Improved "No docs" message ([#7785](https://github.com/storybookjs/storybook/pull/7785))
- Core: Add .pdf support to file-loader ([#7651](https://github.com/storybookjs/storybook/pull/7651))

### Bug Fixes

- Preview hooks: trigger effects after story render ([#7791](https://github.com/storybookjs/storybook/pull/7791))

## 5.2.0-beta.35 (August 20, 2019)

Failed publish

## 5.2.0-beta.34 (August 20, 2019)

Failed publish

## 5.2.0-beta.33 (August 18, 2019)

### Features

- Addon-jest: Add pending & todo items ([#7793](https://github.com/storybookjs/storybook/pull/7793))

### Bug Fixes

- Addon-docs: Fix unique key warning ([#7796](https://github.com/storybookjs/storybook/pull/7796))

## 5.2.0-beta.32 (August 17, 2019)

### Bug Fixes

- Addon-docs: Fix docs-only story load ([#7787](https://github.com/storybookjs/storybook/pull/7787))

### Maintenance

- Addon-docs: Unwrap doc blocks stories ([#7788](https://github.com/storybookjs/storybook/pull/7788))

## 5.2.0-beta.31 (August 16, 2019)

### Features

- Addon-docs: Add toolbar support to Preview ([#7778](https://github.com/storybookjs/storybook/pull/7778))

### Bug Fixes

- Addon-docs: Fix CSS bleed issue in doc blocks ([#7771](https://github.com/storybookjs/storybook/pull/7771))

## 5.2.0-beta.30 (August 14, 2019)

### Features

- CLI: Don't output startup information on smoke test ([#6949](https://github.com/storybookjs/storybook/pull/6949))
- Ondevice-knobs: Expose withKnobs from addon-knobs ([#7555](https://github.com/storybookjs/storybook/pull/7555))

### Maintenance

- Addon-Jest: Add flexibility ([#7748](https://github.com/storybookjs/storybook/pull/7748))

## 5.1.11 (August 13, 2019)

### Bug Fixes

- Core: Add polyfill for fetch ([#7401](https://github.com/storybookjs/storybook/pull/7401))
- Core: Revert "Fix #7167 addon-centered causes component to disappear when zooming" ([#7750](https://github.com/storybookjs/storybook/pull/7750))

## 5.2.0-beta.29 (August 13, 2019)

### Breaking Changes

- Addon-docs: Packaging for 5.2 release ([#7741](https://github.com/storybookjs/storybook/pull/7741))

### Bug Fixes

- Core: Revert "Fix #7167 addon-centered causes component to disappear when zooming" ([#7750](https://github.com/storybookjs/storybook/pull/7750))
- Core: Revert "Addon-centered: Fix disappearing when zoomed" ([#7749](https://github.com/storybookjs/storybook/pull/7749))

## 5.2.0-beta.28 (August 10, 2019)

### Features

- Core: Disable CRA behaviors when preset detected ([#7696](https://github.com/storybookjs/storybook/pull/7696))
- Addon-docs: Docs only MDX and navigation UI ([#7719](https://github.com/storybookjs/storybook/pull/7719))

## 5.2.0-beta.27 (August 10, 2019)

Publish failed

## 5.2.0-beta.26 (August 9, 2019)

### Features

- UI: Improved component nav UI ([#7716](https://github.com/storybookjs/storybook/pull/7716))

## 5.2.0-beta.25 (August 8, 2019)

### Features

- Addon-centered: ability to disable on specific story ([#7709](https://github.com/storybookjs/storybook/pull/7709))

### Bug Fixes

- Addon-jest: fix console warning ([#7705](https://github.com/storybookjs/storybook/pull/7705))
- Core: Remove Object.append(...) from index.ejs ([#7707](https://github.com/storybookjs/storybook/pull/7707))

## 5.2.0-beta.24 (August 7, 2019)

### Features

- Addon-docs: DocsPage slots for fine-grained user control ([#7680](https://github.com/storybookjs/storybook/pull/7680))

### Bug Fixes

- Core: Add polyfill for fetch ([#7401](https://github.com/storybookjs/storybook/pull/7401))

### Dependency Upgrades

- Addon-notes: Upgrade markdown-to-jsx dependency ([#7694](https://github.com/storybookjs/storybook/pull/7694))

## 5.2.0-beta.23 (August 6, 2019)

### Features

- CLI: Suggest possible matches on invalid command ([#7658](https://github.com/storybookjs/storybook/pull/7658))
- Core: Allow injecting preview-body.html ([#7417](https://github.com/storybookjs/storybook/pull/7417))

### Bug Fixes

- Core: Fix HMR error recovery ([#7684](https://github.com/storybookjs/storybook/pull/7684))

## 5.2.0-beta.22 (August 3, 2019)

### Bug Fixes

- Core: Fix HMR for CSF files ([#7669](https://github.com/storybookjs/storybook/pull/7669))

### Maintenance

- React: Cleanup CSF stories in cra-kitchen-sink ([#7670](https://github.com/storybookjs/storybook/pull/7670))

## 5.2.0-beta.21 (August 3, 2019)

### Features

- Addon-jest: Add placeholder info for missing tests ([#7660](https://github.com/storybookjs/storybook/pull/7660))

### Bug Fixes

- Addon-docs: Pass framework configs through babel ([#7667](https://github.com/storybookjs/storybook/pull/7667))
- Addon-centered: Fix disappearing when zoomed ([#7640](https://github.com/storybookjs/storybook/pull/7640))

## 5.2.0-beta.20 (August 1, 2019)

### Bug Fixes

- Addon-docs: Pass everything through babel & partial TS conversion ([#7653](https://github.com/storybookjs/storybook/pull/7653))
- Addon-docs: Error on non-string description ([#7650](https://github.com/storybookjs/storybook/pull/7650))
- CLI: Fix `npx -p @storybook/cli sb migrate` in yarn project ([#7649](https://github.com/storybookjs/storybook/pull/7649))

## 5.2.0-beta.19 (July 31, 2019)

### Bug Fixes

- Core: Change webpack-defined variables to globals ([#7622](https://github.com/storybookjs/storybook/pull/7622))
- Addon-notes: Fix dark theming bug ([#7623](https://github.com/storybookjs/storybook/pull/7623))
- CLI: Fix usage information ([#7627](https://github.com/storybookjs/storybook/pull/7627))
- CLI: Show additional package information with `sb info` ([#7624](https://github.com/storybookjs/storybook/pull/7624))

### Maintenance

- Typescript: Migrate Preact ([#7527](https://github.com/storybookjs/storybook/pull/7527))

## 5.1.10 (July 31, 2019)

### Breaking Changes

- Core: Remove project root `babel.config.js` loading ([#7573](https://github.com/storybookjs/storybook/pull/7573))

### Bug Fixes

- Addon-info: change stylesheetBase info height from 110vh to 100vh ([#7141](https://github.com/storybookjs/storybook/pull/7141))
- React-native: Fix react native server ([#7187](https://github.com/storybookjs/storybook/pull/7187))
- Addon-centered/contexts: Move optionalDependencies to peerDependencies ([#7315](https://github.com/storybookjs/storybook/pull/7315))
- Addon-notes/info: Fix indenting on markdown code blocks ([#7158](https://github.com/storybookjs/storybook/pull/7158))
- Addon-actions: fix serialization performance ([#7256](https://github.com/storybookjs/storybook/pull/7256))
- Addon-notes: Fix dark theming bug ([#7623](https://github.com/storybookjs/storybook/pull/7623))
- CLI: Fix usage information ([#7627](https://github.com/storybookjs/storybook/pull/7627))
- Addon-centered: Fix component disappearing on zoom ([#7400](https://github.com/storybookjs/storybook/pull/7400))
- Addon-analytics: Fix API signature ([#7410](https://github.com/storybookjs/storybook/pull/7410))
- UI: Fix Sidebar input refresh on 'Enter' ([#7342](https://github.com/storybookjs/storybook/pull/7342))
- Addon-knobs: Prevent rerender when a button callback returns false. ([#7197](https://github.com/storybookjs/storybook/pull/7197))
- Core: Keep story data and legacy data in sync ([#7319](https://github.com/storybookjs/storybook/pull/7319))
- CLI: Move the free port logic so that loadOptions don't override it ([#7237](https://github.com/storybookjs/storybook/pull/7237))
- Addon-backgrounds: Fix unstretched preview background wrapper ([#7173](https://github.com/storybookjs/storybook/pull/7173))

### Maintenance

- Build: delete tests & snapshots from dist ([#7358](https://github.com/storybookjs/storybook/pull/7358))

### Dependency Upgrades

- CLI: replaced merge-dirs dependency by fs-extra ([#7100](https://github.com/storybookjs/storybook/pull/7100))

## 5.2.0-beta.18 (July 30, 2019)

### Bug Fixes

- Addon-docs: Ensure getNotes/getInfo return string ([#7597](https://github.com/storybookjs/storybook/pull/7597))
- React/Angular/HTML/Vue: Fix typings for `configure` ([#7598](https://github.com/storybookjs/storybook/pull/7598))

### Maintenance

- Typescript: Migrate Vue ([#7578](https://github.com/storybookjs/storybook/pull/7578))

### Dependency Upgrades

- Upgrade corejs-upgrade-webpack-plugin lazy-universal-dotenv ([#7592](https://github.com/storybookjs/storybook/pull/7592))

## 5.2.0-beta.17 (July 29, 2019)

### Bug Fixes

- CLI: Fix storiesof-to-csf migration w/punctuation ([#7590](https://github.com/storybookjs/storybook/pull/7590))

## 5.2.0-beta.16 (July 29, 2019)

### Features

- Addon-docs: Configure jsx automagically ([#7581](https://github.com/storybookjs/storybook/pull/7581))
- Addon-docs: Add DocsPage automagically ([#7579](https://github.com/storybookjs/storybook/pull/7579))

## 5.2.0-beta.15 (July 29, 2019)

### Features

- CRA: Add support for TSX in config folder ([#7566](https://github.com/storybookjs/storybook/pull/7566))

### Bug Fixes

- Addon-info: only render Components in propTables ([#7477](https://github.com/storybookjs/storybook/pull/7477))

### Dependency Upgrades

- Update telejson dependency to 2.2.2 ([#7586](https://github.com/storybookjs/storybook/pull/7586))
- Angular: Fix @angular-devkit/build-angular version ([#7585](https://github.com/storybookjs/storybook/pull/7585))

## 5.2.0-beta.14 (July 29, 2019)

Failed publish

## 5.2.0-beta.13 (July 27, 2019)

This is a breaking change for anybody who used `load` on an earlier 5.2 pre-release. Simply rename `load` to `configure` in your storybook config and that should fix things.

If you're not using SB Docs, you probably don't have to worry about this.

### Breaking Changes

- Core: Rename `load` to `configure` ([#7576](https://github.com/storybookjs/storybook/pull/7576))

## 5.2.0-beta.12 (July 27, 2019)

### Bug Fixes

- Addon-knobs: Fix select knob default selection when using array values ([#7568](https://github.com/storybookjs/storybook/pull/7568))
- Addon-knobs: Call onChanges only for changed props ([#6884](https://github.com/storybookjs/storybook/pull/6884))

### Maintenance

- Angular: Print error message if angular.json has no default project specified ([#7574](https://github.com/storybookjs/storybook/pull/7574))

## 5.2.0-beta.11 (July 26, 2019)

Failed release

## 5.2.0-beta.10 (July 26, 2019)

This is a breaking release that undoes an unintentional breaking change introduced in 5.1.0 (and will also be released as a 5.1.x patch)

### Breaking Changes

- Core: Remove project root `babel.config.js` loading ([#7573](https://github.com/storybookjs/storybook/pull/7573))

### Features

- React: Add hooks support to stories ([#7571](https://github.com/storybookjs/storybook/pull/7571))

### Bug Fixes

- UI: Fix attribute warning on shortcut button click ([#7548](https://github.com/storybookjs/storybook/pull/7548))

## 5.2.0-beta.9 (July 26, 2019)

### Bug Fixes

- Angular: Fix automatic module metadata extraction for forRoot imports ([#7224](https://github.com/storybookjs/storybook/pull/7224))

### Maintenance

- Rename "Module" to Component Story Format ([#7564](https://github.com/storybookjs/storybook/pull/7564))

## 5.2.0-beta.8 (July 25, 2019)

### Breaking Changes

`source-loader` is now part of `addon-docs` preset. If you're using both the `addon-docs` preset and `source-loader` in your project, you need to update. You can remove `source-loader` and let the preset take care of it. Alternatively, you can disable `source-loader` in the preset by setting `sourceLoaderOptions` to `null`.

- Addon-docs: Add source-loader to preset ([#7547](https://github.com/storybookjs/storybook/pull/7547))
- Core: Don't allow duplicate titles ([#7542](https://github.com/storybookjs/storybook/pull/7542))

### Bug Fixes

- Addon-storysource: Add source-loader dep to avoid breaking change ([#7554](https://github.com/storybookjs/storybook/pull/7554))
- Addon-contexts: Ensure nodes is Array ([#7393](https://github.com/storybookjs/storybook/pull/7393))

### Maintenance

- Angular: Log angular cli config errors ([#7484](https://github.com/storybookjs/storybook/pull/7484))

## 5.2.0-beta.7 (July 23, 2019)

### Features

- Addon-docs: MDX function stories ([#7529](https://github.com/storybookjs/storybook/pull/7529))
- CLI: update `sb init` to module format for Ember/Marko/Mithril/Rax/Riot/Svelte ([#7504](https://github.com/storybookjs/storybook/pull/7504))
- CLI: update `sb init` to module format for Angular ([#7502](https://github.com/storybookjs/storybook/pull/7502))
- CLI: update `sb init` to module format for React ([#7500](https://github.com/storybookjs/storybook/pull/7500))

### Bug Fixes

- Ondevice-knobs: Graceful fail on missing default ([#7533](https://github.com/storybookjs/storybook/pull/7533))

### Maintenance

- Build: Attempt to fix travis timeouts ([#7531](https://github.com/storybookjs/storybook/pull/7531))

## 5.2.0-beta.6 (July 23, 2019)

### Breaking Changes

It is now recommended to only use ONE `load` call in your app and it will warn you if you call it more than once. The examples and docs have been updated to reflect this. Technically this is not a breaking change since the old API is supported, but it's a change in usage from previous versions.

### Features

- Core: Top-level components in MDX/Module formats ([#7524](https://github.com/storybookjs/storybook/pull/7524))
- Core: Module format `load` accept loader function ([#7518](https://github.com/storybookjs/storybook/pull/7518))

### Bug Fixes

- Addon-centered: Fix component disappearing on zoom ([#7400](https://github.com/storybookjs/storybook/pull/7400))

### Maintenance

- Addon-knobs: enable Typescript `strict` flag ([#7515](https://github.com/storybookjs/storybook/pull/7515))

## 5.2.0-beta.5 (July 21, 2019)

### Features

- CLI: update `sb init` to module format for Vue ([#7501](https://github.com/storybookjs/storybook/pull/7501))
- CLI: update `sb init` to module format for HTML/Polymer ([#7503](https://github.com/storybookjs/storybook/pull/7503))

### Bug Fixes

- Source-loader: Separate server and client code for IE support ([#7510](https://github.com/storybookjs/storybook/pull/7510))

## 5.2.0-beta.4 (July 20, 2019)

### Breaking Changes

- Core: Module format story decorators ([#7490](https://github.com/storybookjs/storybook/pull/7490))

### Features

- Addon-jest: UI Redesign ([#7424](https://github.com/storybookjs/storybook/pull/7424))
- Marko: support rerendering ([#7460](https://github.com/storybookjs/storybook/pull/7460))

### Bug Fixes

- Addon-docs: Fix MDX source string escaping ([#7497](https://github.com/storybookjs/storybook/pull/7497))

### Dependency Upgrades

- Marko: Upgrade loader & config ([#7459](https://github.com/storybookjs/storybook/pull/7459))
- Update core-js in addon-ondevice-actions package.json ([#7491](https://github.com/storybookjs/storybook/pull/7491))

## 5.2.0-beta.3 (July 19, 2019)

### Features

- React-native: Add storyId as testID ([#7482](https://github.com/storybookjs/storybook/pull/7482))

### Bug Fixes

- React-native: On-device knobs input fixes ([#7475](https://github.com/storybookjs/storybook/pull/7475))
- React-native: Fix crna-kitchen-sink ([#7200](https://github.com/storybookjs/storybook/pull/7200))

## 5.2.0-beta.2 (July 18, 2019)

### Features

- CLI: convert mdx to module format ([#7419](https://github.com/storybookjs/storybook/pull/7419))
- CLI: sb migrate npm & typescript support ([#7463](https://github.com/storybookjs/storybook/pull/7463))
- Addon-Docs: HTML support & example ([#7454](https://github.com/storybookjs/storybook/pull/7454))

### Bug Fixes

- Convert-storiesof-to-module: user exports, collisions, reserved keywords ([#7471](https://github.com/storybookjs/storybook/pull/7471))
- React-native: On-device knobs fixes ([#7470](https://github.com/storybookjs/storybook/pull/7470))

### Dependency Upgrades

- Addon-docs: Upgrade MDX to 1.1 ([#7476](https://github.com/storybookjs/storybook/pull/7476))

## 5.2.0-beta.1 (July 18, 2019)

### Features

- React native: Emit event when story is rendered ([#7449](https://github.com/storybookjs/storybook/pull/7449))

### Bug Fixes

- Addon-knobs: improve types via generics and readonlyarray ([#7411](https://github.com/storybookjs/storybook/pull/7411))
- Ondevice-backgrounds: use same param key as addon-backgrounds ([#7437](https://github.com/storybookjs/storybook/pull/7437))

## 5.2.0-beta.0 (July 15, 2019)

### Features

- Codemod: Convert module format to MDX ([#7418](https://github.com/storybookjs/storybook/pull/7418))

## 5.2.0-alpha.44 (July 15, 2019)

### Features

- CLI: Add migrate command ([#7414](https://github.com/storybookjs/storybook/pull/7414))

### Bug Fixes

- UI: Fix Panel rendered wrong at Docs-page ([#7327](https://github.com/storybookjs/storybook/pull/7327))

### Maintenance

- Typescript: Fix types of client-api & storystore ([#7337](https://github.com/storybookjs/storybook/pull/7337))

## 5.2.0-alpha.43 (July 13, 2019)

### Bug Fixes

- Addon-analytics: Fix API signature ([#7410](https://github.com/storybookjs/storybook/pull/7410))
- Addon-knobs: fix knobs function return types ([#7391](https://github.com/storybookjs/storybook/pull/7391))
- UI: Fix proptype for isToolshown ([#7405](https://github.com/storybookjs/storybook/pull/7405))
- UI: Fix propType warnings ([#7408](https://github.com/storybookjs/storybook/pull/7408))

### Maintenance

- Addon-actions: Use v4 UUID instead of v1 for action IDs ([#7397](https://github.com/storybookjs/storybook/pull/7397))
- UI: Remove recompose ([#7385](https://github.com/storybookjs/storybook/pull/7385))
- UI: FIX & IMPROVE styling interop of addon-background & addon-viewport ([#7385](https://github.com/storybookjs/storybook/pull/7385))

### Breaking Changes

- Move grid toolbar feature to background-addon ([#7385](https://github.com/storybookjs/storybook/pull/7385))

## 5.2.0-alpha.42 (July 12, 2019)

### Breaking Changes

- Addon-docs: Remove primary parameter ([#7383](https://github.com/storybookjs/storybook/pull/7383))

### Bug Fixes

- Addon-docs: Fix default separator inconsistency ([#7382](https://github.com/storybookjs/storybook/pull/7382))
- UI: Fix placement of notificationistList on docs page ([#7290](https://github.com/storybookjs/storybook/pull/7290))

### Maintenance

- Typescript: Migrate @storybook/html ([#7338](https://github.com/storybookjs/storybook/pull/7338))

### Dependency Upgrades

- Bump lodash from 4.17.13 to 4.17.14 ([#7384](https://github.com/storybookjs/storybook/pull/7384))
- [Security] Bump lodash.defaultsdeep from 4.6.0 to 4.6.1 ([#7370](https://github.com/storybookjs/storybook/pull/7370))
- [Security] Bump lodash from 4.17.11 to 4.17.13 ([#7374](https://github.com/storybookjs/storybook/pull/7374))
- [Security] Bump lodash.mergewith from 4.6.1 to 4.6.2 ([#7372](https://github.com/storybookjs/storybook/pull/7372))
- [Security] Bump lodash.merge from 4.6.1 to 4.6.2 ([#7373](https://github.com/storybookjs/storybook/pull/7373))
- [Security] Bump lodash-es from 4.17.11 to 4.17.14 ([#7371](https://github.com/storybookjs/storybook/pull/7371))
- Upgrade react-select dependency to version 3 for addon-knobs ([#7336](https://github.com/storybookjs/storybook/pull/7336))

## 5.2.0-alpha.41 (July 11, 2019)

### Features

- API: Preview hooks ([#6916](https://github.com/storybookjs/storybook/pull/6916))
- Core: Custom webpack option for standalone storybook ([#6886](https://github.com/storybookjs/storybook/pull/6886))

### Bug Fixes

- Addon-knobs: Fix TypeError on KnobManager channel ([#7341](https://github.com/storybookjs/storybook/pull/7341))
- React-native: Explicitly depend on emotion core and theming ([#7362](https://github.com/storybookjs/storybook/pull/7362))

### Dependency Upgrades

- Bump @babel/preset-env from 7.5.0 to 7.5.4 ([#7364](https://github.com/storybookjs/storybook/pull/7364))
- Update react-test-renderer requirement from 16.5.1 to 16.8.6 in /examples-native/crna-kitchen-sink ([#6372](https://github.com/storybookjs/storybook/pull/6372))
- Bump rax-text from 0.6.5 to 1.0.0 ([#7346](https://github.com/storybookjs/storybook/pull/7346))

## 5.2.0-alpha.40 (July 10, 2019)

### Bug Fixes

- Addon-knobs: Revert entrypoint deletion ([#7369](https://github.com/storybookjs/storybook/pull/7369))
- Typescript: Fix types in api package ([#7072](https://github.com/storybookjs/storybook/pull/7072))
- UI: Fix settings page route (about, shortcuts) ([#7241](https://github.com/storybookjs/storybook/pull/7241))

### Maintenance

- Linting: ADD an ignore for an eslint error about a missing dependency (puppeteer) ([#7239](https://github.com/storybookjs/storybook/pull/7239))
- CI: ADD travis ([#7252](https://github.com/storybookjs/storybook/pull/7252))
- Typescript: Migrate @storybook/angular ([#6570](https://github.com/storybookjs/storybook/pull/6570))

### Dependency Upgrades

- Bump express-graphql from 0.7.1 to 0.8.0 ([#7345](https://github.com/storybookjs/storybook/pull/7345))
- Bump react-native-modal-datetime-picker from 6.1.0 to 7.4.2 ([#6844](https://github.com/storybookjs/storybook/pull/6844))

## 5.2.0-alpha.39 (July 10, 2019)

### Bug Fixes

- UI: Fix Sidebar input refresh on 'Enter' ([#7342](https://github.com/storybookjs/storybook/pull/7342))
- Addon-knobs: Fix select options types to allow string[] and null ([#7356](https://github.com/storybookjs/storybook/pull/7356))

### Maintenance

- Typescript: Migrate @storybook/react ([#7054](https://github.com/storybookjs/storybook/pull/7054))
- Build: delete tests & snapshots from dist ([#7358](https://github.com/storybookjs/storybook/pull/7358))

## 5.2.0-alpha.38 (July 9, 2019)

### Bug Fixes

- Addon-storysource: Replace loader with source-loader ([#7272](https://github.com/storybookjs/storybook/pull/7272))

### Maintenance

- Typescript: Migrate @storybook/addon-knobs ([#7180](https://github.com/storybookjs/storybook/pull/7180))

### Dependency Upgrades

- Upgrade all dependencies ([#7329](https://github.com/storybookjs/storybook/pull/7329))

## 5.2.0-alpha.37 (July 8, 2019)

### Bug Fixes

- Addon-docs: Use storyFn instead of getDecorated ([#7334](https://github.com/storybookjs/storybook/pull/7334))
- Addon-knobs: Prevent rerender when a button callback returns false. ([#7197](https://github.com/storybookjs/storybook/pull/7197))
- Addons: Fix null parameters in disable addons tab logic ([#7333](https://github.com/storybookjs/storybook/pull/7333))
- Addon-docs: Fix renaming stories on module / MDX format ([#7319](https://github.com/storybookjs/storybook/pull/7319))
- Addon-centered/contexts: Move optionalDependencies to peerDependencies ([#7315](https://github.com/storybookjs/storybook/pull/7315))

### Maintenance

- Typescript: migrate client api ([#7147](https://github.com/storybookjs/storybook/pull/7147))
- Angular-cli: Add addon-docs example ([#7257](https://github.com/storybookjs/storybook/pull/7257))

## 5.2.0-alpha.36 (July 5, 2019)

### Features

- Addon-docs: Added inline option to Story block ([#7308](https://github.com/storybookjs/storybook/pull/7308))
- Addon-knobs: Ensure unique knob names across groups ([#6793](https://github.com/storybookjs/storybook/pull/6793))
- Core: Enable webpack to rebuild changes in node_modules ([#6265](https://github.com/storybookjs/storybook/pull/6265))
- Addons: Disable option for addon tab ([#6923](https://github.com/storybookjs/storybook/pull/6923))

### Bug Fixes

- Fix lint error from #6923 ([#7311](https://github.com/storybookjs/storybook/pull/7311))
- Addon-actions: fix serialization performance ([#7256](https://github.com/storybookjs/storybook/pull/7256))

### Maintenance

- Typescript: Migrate @storybook/addon-event ([#7190](https://github.com/storybookjs/storybook/pull/7190))
- Typescript: Improve actions type ([#7012](https://github.com/storybookjs/storybook/pull/7012))

## 5.2.0-alpha.35 (July 3, 2019)

### Bug Fixes

- React-Native: Fix null story check ([#7243](https://github.com/storybookjs/storybook/pull/7243))

## 5.2.0-alpha.34 (July 2, 2019)

### Bug Fixes

- CLI: Fix `--preview-url` for static builds ([#7245](https://github.com/storybookjs/storybook/pull/7245))
- Addon-docs: Fix non-React support & add Vue example ([#7222](https://github.com/storybookjs/storybook/pull/7222))
- CLI: Move the free port logic so that loadOptions don't override it ([#7237](https://github.com/storybookjs/storybook/pull/7237))

## 5.2.0-alpha.33 (July 1, 2019)

### Features

- CLI: Add `--preview-url` for custom preview ([#7235](https://github.com/storybookjs/storybook/pull/7235))

### Bug Fixes

- React-Native: Upgrade to new `story_store` API ([#7234](https://github.com/storybookjs/storybook/pull/7234))

## 5.2.0-alpha.32 (June 29, 2019)

### Features

- Addon-docs: Add .story.mdx support to preset ([#7229](https://github.com/storybookjs/storybook/pull/7229))

### Bug Fixes

- React-native: Fix react native server ([#7187](https://github.com/storybookjs/storybook/pull/7187))
- Addon-docs: Fix source-loader in monorepo examples ([#7214](https://github.com/storybookjs/storybook/pull/7214))

### Maintenance

- Addon-docs: Convert repo stories to new module format ([#7175](https://github.com/storybookjs/storybook/pull/7175))

## 5.2.0-alpha.31 (June 27, 2019)

### Breaking Changes

- Module format: story field for name/parameters annotation ([#7202](https://github.com/storybookjs/storybook/pull/7202))

### Features

- Core: Story sorting ([#6472](https://github.com/storybookjs/storybook/pull/6472))

### Maintenance

- Addon-docs: Fix source-loader CI errors ([#7203](https://github.com/storybookjs/storybook/pull/7203))

## 5.2.0-alpha.30 (June 25, 2019)

This release merges `release/docs-technical-preview` branch back into `next` through a series of PRs. It also contains other changes that came in on `next` since the last alpha.

### Features

- CLI: Add info command to print environment information ([#6937](https://github.com/storybookjs/storybook/pull/6937))
- CLI: Use process.env.CI if available ([#7118](https://github.com/storybookjs/storybook/pull/7118))
- Addon-docs: Source loader library ([#7117](https://github.com/storybookjs/storybook/pull/7117))
- Addon-docs: Support non-story exports in MDX ([#7188](https://github.com/storybookjs/storybook/pull/7188))
- Addon-docs: Support non-story exports in module format ([#7185](https://github.com/storybookjs/storybook/pull/7185))
- Addon-docs: Docs mode with `--docs` flag ([#7154](https://github.com/storybookjs/storybook/pull/7154))
- Addon-docs: Convert to module format codemod ([#7174](https://github.com/storybookjs/storybook/pull/7174))
- Addon-docs: MDX support ([#7145](https://github.com/storybookjs/storybook/pull/7145))
- Addon-docs: Component parameter codemod ([#7155](https://github.com/storybookjs/storybook/pull/7155))
- Addon-docs: DocsPage and doc blocks ([#7119](https://github.com/storybookjs/storybook/pull/7119))
- Addon-docs: Module story format & framework param ([#7110](https://github.com/storybookjs/storybook/pull/7110))
- Addon-docs: Basic skeleton, UI viewMode handling ([#7107](https://github.com/storybookjs/storybook/pull/7107))

### Bug Fixes

- Addon-backgrounds: Fix unstretched preview background wrapper ([#7173](https://github.com/storybookjs/storybook/pull/7173))
- Addon-notes/info: Fix indenting on markdown code blocks ([#7158](https://github.com/storybookjs/storybook/pull/7158))
- Core: Improve HMR error reporting, no refreshes needed for error recovery ([#6972](https://github.com/storybookjs/storybook/pull/6972))
- Addon-info: change stylesheetBase info height from 110vh to 100vh ([#7141](https://github.com/storybookjs/storybook/pull/7141))

### Maintenance

- Typescript: Migrate addon viewport ([#7177](https://github.com/storybookjs/storybook/pull/7177))

### Dependency Upgrades

- Bump css-loader from 2.1.1 to 3.0.0 ([#7122](https://github.com/storybookjs/storybook/pull/7122))
- Upgrade core-js to 3.x in devkits ([#7171](https://github.com/storybookjs/storybook/pull/7171))
- UPGRADE lazy-universal-dotenv ([#7151](https://github.com/storybookjs/storybook/pull/7151))

## 5.1.9 (June 20, 2019)

### Bug Fixes

- Core: Fix JSON babel config error reporting ([#7104](https://github.com/storybookjs/storybook/pull/7104))
- UI: Fix about page version check message ([#7105](https://github.com/storybookjs/storybook/pull/7105))

### Dependency Upgrades

- Add missing dependencies to ui/react ([#7081](https://github.com/storybookjs/storybook/pull/7081))
- UPGRADE lazy-universal-dotenv ([#7151](https://github.com/storybookjs/storybook/pull/7151))
- Make compatible with yarn Pnp ([#6922](https://github.com/storybookjs/storybook/pull/6922))

## 5.2.0-alpha.29 (June 17, 2019)

### Features

- Addon-notes: enable multiple sections in notes panel ([#6861](https://github.com/storybookjs/storybook/pull/6861))
- Addon-context: title fallback ([#7078](https://github.com/storybookjs/storybook/pull/7078))
- Addon-info: Fix rendering of code block ([#6016](https://github.com/storybookjs/storybook/pull/6016))

### Bug Fixes

- Core: Fix JSON babel config error reporting ([#7104](https://github.com/storybookjs/storybook/pull/7104))
- UI: Fix about page version check message ([#7105](https://github.com/storybookjs/storybook/pull/7105))

### Maintenance

- Core: Refactor story_store ([#6382](https://github.com/storybookjs/storybook/pull/6382))
- Core: Make compatible with yarn Pnp ([#6922](https://github.com/storybookjs/storybook/pull/6922))

### Dependency Upgrades

- Bump jest-expo from 32.0.1 to 33.0.2 ([#6996](https://github.com/storybookjs/storybook/pull/6996))

## 5.2.0-alpha.28 (June 17, 2019)

Publish failed

## 5.2.0-alpha.27 (June 17, 2019)

- CLI: improve bootstrap list ([#6993](https://github.com/storybookjs/storybook/pull/6993))
- CLI: replaced merge-dirs dependency by fs-extra ([#7100](https://github.com/storybookjs/storybook/pull/7100))

## 5.1.8 (June 14, 2019)

### Bug Fixes

- CLI: Fix RN template to not import addons ([#7096](https://github.com/storybookjs/storybook/pull/7096))

## 5.1.7 (June 14, 2019)

### Bug Fixes

- UI: Fix warning of loading prop not being a string ([#7080](https://github.com/storybookjs/storybook/pull/7080))

## 5.1.6 (June 14, 2019)

Publish failed

## 5.1.5 (June 14, 2019)

### Bug Fixes

- Core: Upgrade plugin core-js fix ([#7086](https://github.com/storybookjs/storybook/pull/7086))
- UI: Fix sidebar loading visibility ([#7073](https://github.com/storybookjs/storybook/pull/7073))
- UI: Fix unnecessary large bundlesize ([#7091](https://github.com/storybookjs/storybook/pull/7091))
- Addon-contexts, RN-server: Add core-js dep ([#7094](https://github.com/storybookjs/storybook/pull/7094))

## 5.2.0-alpha.26 (June 14, 2019)

- Merge in changes from 5.1.7/next branch.
- Fix earlier merge problems relating to addon-docs:
  - Restore `--docs` command-line functionality
  - Fix refreshing docs page bug

## 5.2.0-alpha.25 (June 14, 2019)

Publish failed

## 5.1.4 (June 13, 2019)

### Bug Fixes

- Core: Fix core-js 3 errors ([#7051](https://github.com/storybookjs/storybook/pull/7051))
- UI: Fix syntax highlighter plain text not visible ([#7057](https://github.com/storybookjs/storybook/pull/7057))
- Addon-actions: Add default options to action(s) ([#6438](https://github.com/storybookjs/storybook/pull/6438))

### Dependency Upgrades

- fix: add missing core-js dependency ([#7016](https://github.com/storybookjs/storybook/pull/7016))
- chore: set react version to 16.8.3 to match react native ([#7008](https://github.com/storybookjs/storybook/pull/7008))

## 5.2.0-alpha.24 (June 13, 2019)

Merge in changes from 5.1.3/next branch.

## 5.2.0-alpha.23 (June 10, 2019)

Merge in changes from 5.1.3/next branch. Releasing from the addon-docs branch to keep things moving until we can merge addon-docs into next.

## 5.2.0-alpha.22 (June 7, 2019)

- Merge in changes from 5.1.1
- Addon-docs:
  - Inline stories respect height prop
  - Export Description block

## 5.1.3 (June 6, 2019)

### Bug Fixes

- UI: Fix links that are not working with plain left click ([#6970](https://github.com/storybookjs/storybook/pull/6970))
- Core: Don't redefine `process` variable ([#6991](https://github.com/storybookjs/storybook/pull/6991))
- Core: Don't mutate user's babel config ([#6987](https://github.com/storybookjs/storybook/pull/6987))

## 5.1.2 (June 6, 2019)

Publish failed

## 5.1.1 (June 5, 2019)

Storybook 5.1 is a juicy upgrade including:

- 📱 Mobile: Standalone package architecture for React Native
- 🎟 A11y addon: Realtime accessibility checks and visual feedback
- 🛠 Context addon: New UI for themes, internationalization, & more
- 🎛 Presets: One-line configuration for babel, webpack, & addons

  5.1 contains hundreds more fixes, features, and tweaks. Browse the changelogs matching `5.1.0-alpha.*`, `5.1.0-beta.*`, and `5.1.0-rc.*` for the full list of changes. See [MIGRATION.md](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) to upgrade from `5.0` or earlier.

## 5.1.0 (June 5, 2019)

Publish failed

## 5.1.0-rc.5 (June 4, 2019)

### Features

- UI: Add copy button for individual story ([#6719](https://github.com/storybookjs/storybook/pull/6719))

### Bug Fixes

- UI: Fix canvas rendering issue ([#6968](https://github.com/storybookjs/storybook/pull/6968))
- Angular: Remove zonejs from devDeps; allow ^0.8.0 || ^0.9.0 ([#6957](https://github.com/storybookjs/storybook/pull/6957))
- Jest: layout/design fixes ([#6847](https://github.com/storybookjs/storybook/pull/6847))
- Angular: Add 'addParameters' to index.d.ts ([#6929](https://github.com/storybookjs/storybook/pull/6929))

### Maintenance

- FIX race condition in startup of verdaccio && FIX typos ([#6956](https://github.com/storybookjs/storybook/pull/6956))
- Github org rename to storybookjs ([#6954](https://github.com/storybookjs/storybook/pull/6954))

## 5.1.0-rc.4 (June 2, 2019)

### Features

- Core: deep merge global options parameter ([#6900](https://github.com/storybookjs/storybook/pull/6900))

### Bug Fixes

- Core: Fix webpack `process.*` variable definitions ([#6946](https://github.com/storybookjs/storybook/pull/6946))
- Angular: Fix tsconfig.app.json detection for Angular 8 ([#6940](https://github.com/storybookjs/storybook/pull/6940))

## 5.2.0-alpha.21 (June 2, 2019)

- Core: Convert module format to use default export for metadata
- Addon-docs: Compile MDX to default export modules format
- Source-loader: Support parameter injection for default export metadata

## 5.2.0-alpha.20 (May 31, 2019)

- Addon-docs: Use Meta doc block instead of exporting componentMeta

## 5.1.0-rc.3 (May 29, 2019)

### Features

- React-native: Add accessibility on searchbar ([#6819](https://github.com/storybookjs/storybook/pull/6819))

### Bug Fixes

- Storyshots: make compatible with read-pkg-up version ([#6907](https://github.com/storybookjs/storybook/pull/6907))
- Addon-info: Fix issue where forwardRefs throw ([#6859](https://github.com/storybookjs/storybook/pull/6859))
- Addon-notes: Fix whitespace rendering bug ([#6881](https://github.com/storybookjs/storybook/pull/6881))

### Dependency Upgrades

- Bump @types/enzyme from 3.9.2 to 3.9.3 ([#6891](https://github.com/storybookjs/storybook/pull/6891))
- Bump eslint-plugin-import from 2.17.2 to 2.17.3 ([#6894](https://github.com/storybookjs/storybook/pull/6894))
- Bump mini-css-extract-plugin from 0.6.0 to 0.7.0 ([#6895](https://github.com/storybookjs/storybook/pull/6895))
- Bump ts-node from 8.1.0 to 8.2.0 ([#6890](https://github.com/storybookjs/storybook/pull/6890))
- Bump svelte from 3.4.2 to 3.4.4 ([#6892](https://github.com/storybookjs/storybook/pull/6892))

## 5.2.0-alpha.19 (May 28, 2019)

- Source-loader: Fix bad package dependencies

## 5.1.0-rc.2 (May 27, 2019)

### Bug Fixes

- Core: Fix JS/JSON loading babel config ([#6878](https://github.com/storybookjs/storybook/pull/6878))

## 5.2.0-alpha.18 (May 26, 2019)

- Addon-docs: Codemod for adding component parameters
- Core: Babel config loading bugfix ([#6878](https://github.com/storybookjs/storybook/pull/6878))

## 5.2.0-alpha.17 (May 26, 2019)

- Addon-docs: Refer to selected story/component with `id="."` / `of="."`

## 5.2.0-alpha.16 (May 25, 2019)

- Addon-docs: Auto-configure `inlineStories` & `getPropDefs` based on framework

## 5.2.0-alpha.15 (May 25, 2019)

- Addon-docs: Expanded Vue support
  - Props table support
  - iframeHeight configuration parameter

## 5.2.0-alpha.14 (May 25, 2019)

- Addon-docs: Expanded source formats via `@storybook/source-loader`
  - Legacy `storiesOf` format x (JS / TSX)
  - Component modules format x (JS / TSX)
  - Component MDX format

## 5.2.0-alpha.13 (May 24, 2019)

- Addon-docs: Add documentation-only `--docs` option to build storybook

## 5.1.0-rc.1 (May 24, 2019)

### Features

- Core: Support loglevel for production/ci builds ([#6825](https://github.com/storybookjs/storybook/pull/6825))

### Bug Fixes

- Addon-storysource: Fix link color ([#6876](https://github.com/storybookjs/storybook/pull/6876))
- Addon-centered: Fix unnecessary scroll bar ([#6862](https://github.com/storybookjs/storybook/pull/6862))
- UI: Apply customQueryParams to eject iframe button ([#6817](https://github.com/storybookjs/storybook/pull/6817))
- Theming: resolve paths locally if possible ([#6808](https://github.com/storybookjs/storybook/pull/6808))
- Addon-links: Fix withLinks decorator ([#6823](https://github.com/storybookjs/storybook/pull/6823))

### Maintenance

- Addon-contexts: component tests and readability improvements ([#6716](https://github.com/storybookjs/storybook/pull/6716))

### Dependency Upgrades

- Upgrade CRA preset dependencies to match CRA v3 ([#6589](https://github.com/storybookjs/storybook/pull/6589))
- Bump schedule from 0.4.0 to 0.5.0 ([#6843](https://github.com/storybookjs/storybook/pull/6843))
- UPGRADE dependencies & fix a security vulnerability (low-prio) ([#6875](https://github.com/storybookjs/storybook/pull/6875))
- Bump simplebar-react from 1.0.0-alpha.9 to 1.0.0 ([#6842](https://github.com/storybookjs/storybook/pull/6842))
- Bump ts-loader from 5.4.5 to 6.0.1 ([#6839](https://github.com/storybookjs/storybook/pull/6839))
- Bump @types/react from 16.8.17 to 16.8.18 ([#6841](https://github.com/storybookjs/storybook/pull/6841))
- Bump core-js-pure from 3.1.0 to 3.1.1 ([#6840](https://github.com/storybookjs/storybook/pull/6840))

## 5.1.0-rc.0 (May 21, 2019)

### Bug Fixes

- UI: Fix initial bottom panel size ([#6822](https://github.com/storybookjs/storybook/pull/6822))
- UI: Fix syntaxhighlighter themes ([#6814](https://github.com/storybookjs/storybook/pull/6814))
- Addon-knobs: Fix Boolean knob (#6366) ([#6830](https://github.com/storybookjs/storybook/pull/6830))
- Theming: Change lib/theming so it no longer depends on react-inspector ([#6818](https://github.com/storybookjs/storybook/pull/6818))
- Core: Handle loading `.storybook/babel.config.js` (#6633) ([#6634](https://github.com/storybookjs/storybook/pull/6634))
- CLI: Fix init in create-react-library projects ([#6815](https://github.com/storybookjs/storybook/pull/6815))
- HTML: support knobs for both cached and uncached nodes ([#6783](https://github.com/storybookjs/storybook/pull/6783))
- Uncorrupt yarn lock ([#6811](https://github.com/storybookjs/storybook/pull/6811))
- Core: set a better value for process in manager webpack config ([#6767](https://github.com/storybookjs/storybook/pull/6767))

### Maintenance

- Typescript: Migrate addon-centered ([#6772](https://github.com/storybookjs/storybook/pull/6772))
- Add engine field to package.json in apps ([#6809](https://github.com/storybookjs/storybook/pull/6809))
- Fix required engine for apps ([#6810](https://github.com/storybookjs/storybook/pull/6810))

### Dependency Upgrades

- Upgrade lodash to latest ([#6832](https://github.com/storybookjs/storybook/pull/6832))
- Bump svelte from 3.4.1 to 3.4.2 ([#6838](https://github.com/storybookjs/storybook/pull/6838))
- Misc upgrades ([#6820](https://github.com/storybookjs/storybook/pull/6820))

## 5.2.0-alpha.12 (May 21, 2019)

- Addon-docs: Fix regression in preview source for legacy stories

## 5.2.0-alpha.11 (May 21, 2019)

- Addon-docs:
  - Source refer to stories by name
  - Source support for multi-story previews
  - Fix loader bug for plaintext stories

## 5.2.0-alpha.10 (May 19, 2019)

- Addon-docs: Display source dropdown in preview component

## 5.2.0-alpha.9 (May 17, 2019)

- Addon-docs bugfixes:
  - Fix broken components stories
  - Fix regression in iframe preview
  - Fix docgen props block
  - Fix margin styling on docs page

## 5.1.0-beta.1 (May 16, 2019)

### Bug Fixes

- UI: Scrollbar supports theming again ([#6794](https://github.com/storybookjs/storybook/pull/6794))
- UI: Fix scrolling styling ([#6785](https://github.com/storybookjs/storybook/pull/6785))
- UI: Fix iframe refresh ([#6787](https://github.com/storybookjs/storybook/pull/6787))
- UI: Preserve dimensions on resizing for panel ([#6696](https://github.com/storybookjs/storybook/pull/6696))

### Maintenance

- Move chromatic to circle ci ([#6752](https://github.com/storybookjs/storybook/pull/6752))

### Dependency Upgrades

- Bump fs-extra from 7.0.1 to 8.0.1 ([#6776](https://github.com/storybookjs/storybook/pull/6776))

## 5.2.0-alpha.8 (May 15, 2019)

- Addon-docs: Optimize docs pane rerendering

## 5.2.0-alpha.7 (May 15, 2019)

- Addon-docs: Docs page bugfix
- Addon-docs: Fix source block for legacy stories

NOTE: use `@storybook/source-loader` with option `injectParameters: true` for legacy source

## 5.2.0-alpha.6 (May 14, 2019)

- Addon-docs: Docs page content update
- Addon-docs: Preview component redefinition

#### Breaking changes

Preview behavior has been updated. Docs page content has been updated.

Before:

- `<Story name="a">` defines a story, `<Preview id="x--a"/>` references it

After:

- `<Story name="a">` defines a story, `<Story id="x--a"/>` references it
- `<Preview><Story .../><Story .../><Component/></Preview>` shows one or more stories in a grid

## 5.2.0-alpha.5 (May 12, 2019)

- Addon-docs: Description block refactor and bugfixes

## 5.2.0-alpha.4 (May 11, 2019)

- Addon-docs: Source, Props, DocsPage doc blocks

#### Breaking changes

- Doc blocks & presets have moved. Update your MDX stories and `presets.js` file accordingly:
  - `import { Preview, Story } from '@storybook/addon-docs/blocks';`
  - `module.exports = ['@storybook/addon-docs/common/preset'];`

## 5.1.0-beta.0 (May 10, 2019)

Welcome to the 5.1 beta! Feature development's done; `beta.0` kicks off the stabilization process for the 5.1 final release. 🚀

## 5.1.0-alpha.40 (May 8, 2019)

### Features

- Svelte: Add svelte v3 support ([#6698](https://github.com/storybookjs/storybook/pull/6698))
- Angular: Disable production mode for debugging components ([#6215](https://github.com/storybookjs/storybook/pull/6215))
- Angular: Allow optional component declaration without additional configuration ([#6666](https://github.com/storybookjs/storybook/pull/6666))
- Core: Allow browsing to a kind and get the first story ([#6720](https://github.com/storybookjs/storybook/pull/6720))

### Bug Fixes

- UI: Preserve dimensions on resizing for panel ([#6696](https://github.com/storybookjs/storybook/pull/6696))

### Maintenance

- Add CRA React15 example to test back-compat ([#6475](https://github.com/storybookjs/storybook/pull/6475))
- Remove teamcity CLI tests ([#6707](https://github.com/storybookjs/storybook/pull/6707))

### Dependency Upgrades

- Upgrade to core-js v3 ([#6655](https://github.com/storybookjs/storybook/pull/6655))
- Bump eslint-plugin-react from 7.12.4 to 7.13.0 ([#6728](https://github.com/storybookjs/storybook/pull/6728))
- Bump @types/react-native from 0.57.50 to 0.57.51 ([#6732](https://github.com/storybookjs/storybook/pull/6732))
- Bump @types/node from 11.13.7 to 12.0.0 ([#6730](https://github.com/storybookjs/storybook/pull/6730))
- Bump jest-cli from 24.7.1 to 24.8.0 ([#6729](https://github.com/storybookjs/storybook/pull/6729))
- Bump @babel/preset-env from 7.4.3 to 7.4.4 ([#6731](https://github.com/storybookjs/storybook/pull/6731))
- Bump raw-loader from 1.0.0 to 2.0.0 ([#6685](https://github.com/storybookjs/storybook/pull/6685))
- Bump react-color from 2.17.1 to 2.17.3 ([#6681](https://github.com/storybookjs/storybook/pull/6681))
- Bump @babel/plugin-proposal-class-properties from 7.4.0 to 7.4.4 ([#6686](https://github.com/storybookjs/storybook/pull/6686))
- Bump react-dev-utils from 8.0.0 to 9.0.0 ([#6682](https://github.com/storybookjs/storybook/pull/6682))
- Bump codelyzer from 5.0.0 to 5.0.1 ([#6687](https://github.com/storybookjs/storybook/pull/6687))
- Bump @types/react from 16.8.14 to 16.8.16 ([#6717](https://github.com/storybookjs/storybook/pull/6717))
- Bump react-redux from 7.0.2 to 7.0.3 ([#6684](https://github.com/storybookjs/storybook/pull/6684))

## 5.1.0-alpha.39 (May 2, 2019)

### Features

- React-native: Ondevice actions ([#6594](https://github.com/storybookjs/storybook/pull/6594))
- React-native: Use emotion to style RN UI ([#6603](https://github.com/storybookjs/storybook/pull/6603))

### Bug Fixes

- API: Mimic PureComponent behavior for Consumer children ([#6412](https://github.com/storybookjs/storybook/pull/6412))

## 5.1.0-alpha.38 (May 2, 2019)

Failed publish

## 5.1.0-alpha.37 (May 1, 2019)

### Bug Fixes

- Core: Fix regression with deep linking ([#6688](https://github.com/storybookjs/storybook/pull/6688))
- Addon-contexts: No cancel option in UI if the context have no param ([#6669](https://github.com/storybookjs/storybook/pull/6669))
- CLI: Fix `sb init` for projects with frozen lock files ([#6629](https://github.com/storybookjs/storybook/pull/6629))

### Maintenance

- CLI: Refactor how we install dev dependencies in cli ([#6695](https://github.com/storybookjs/storybook/pull/6695))

## 5.2.0-alpha.3 (May 1, 2019)

- Addon-docs: Add Story decorator and parameter support
- Addon-docs: Remove need for extra project babelrc

## 5.2.0-alpha.2 (April 30, 2019)

- Addon-docs: Streamline setup, fix MDX dependencies, improve MDX import, and update guide

## 5.2.0-alpha.0 (April 29, 2019)

Storybook Docs technical preview:

- Docs addon
- MDX story format
- Module story format
- Load API
- [Guide](https://docs.google.com/document/d/1un6YX7xDKEKl5-MVb-egnOYN8dynb5Hf7mq0hipk8JE/edit?usp=sharing)

## 5.0.11 (April 28, 2019)

### Bug Fixes

- Polymer: Fix re-rendering lit-html elements after non-lit-html element ([#5868](https://github.com/storybookjs/storybook/pull/5868))
- Addon-knobs: Check color knob value before applying uppercase ([#6598](https://github.com/storybookjs/storybook/pull/6598))
- Angular: Fix sourceMap property of angulars webpack config ([#6535](https://github.com/storybookjs/storybook/pull/6535))

### Maintenance

- UI: Add missing props in stories ([#6353](https://github.com/storybookjs/storybook/pull/6353))

## 5.1.0-alpha.36 (April 27, 2019)

### Features

- Addon-contexts: Preact support ([#6660](https://github.com/storybookjs/storybook/pull/6660))
- Angular: Allow optional component declaration ([#6346](https://github.com/storybookjs/storybook/pull/6346))

### Bug Fixes

- CLI: Fix `sb init` for projects with frozen lock files ([#6629](https://github.com/storybookjs/storybook/pull/6629))

### Dependency Upgrades

- [Snyk] Fix for 1 vulnerable dependencies ([#6647](https://github.com/storybookjs/storybook/pull/6647))

## 5.1.0-alpha.35 (April 27, 2019)

### Features

- Addon-notes: use @storybook/router <Link> to render links in notes ([#6398](https://github.com/storybookjs/storybook/pull/6398))
- Angular: Support default `storybook` project configuration ([#6484](https://github.com/storybookjs/storybook/pull/6484))
- Addon-contexts: Improve Vue integration ([#6632](https://github.com/storybookjs/storybook/pull/6632))
- Addon-a11y: Design enhancements ([#6563](https://github.com/storybookjs/storybook/pull/6563))

### Bug Fixes

- UI: `active` PropTypes on MobileLayout ([#6241](https://github.com/storybookjs/storybook/pull/6241))
- Core: Fix css import when sideEffects is false ([#6650](https://github.com/storybookjs/storybook/pull/6650))
- Core: Fix infinite loop with special characters in kind names ([#6607](https://github.com/storybookjs/storybook/pull/6607))
- UI: Fix 'Escape' onKeyUp event doesn't work ([#6578](https://github.com/storybookjs/storybook/pull/6578))

### Maintenance

- UI: Add missing props in stories ([#6353](https://github.com/storybookjs/storybook/pull/6353))
- Build: tslint, and use eslint for everything ([#6621](https://github.com/storybookjs/storybook/pull/6621))
- Build: deploy to local registry ([#6619](https://github.com/storybookjs/storybook/pull/6619))

### Dependency Upgrades

- Bump ts-node from 8.0.3 to 8.1.0 ([#6585](https://github.com/storybookjs/storybook/pull/6585))
- Bump semver from 5.7.0 to 6.0.0 ([#6580](https://github.com/storybookjs/storybook/pull/6580))
- Bump react-color from 2.17.0 to 2.17.1 ([#6583](https://github.com/storybookjs/storybook/pull/6583))

## 5.1.0-alpha.34 (April 24, 2019)

### Features

- Addon-contexts: Add URL query param feature ([#6601](https://github.com/storybookjs/storybook/pull/6601))
- UI: Add classNames to sidebar nav elements ([#6571](https://github.com/storybookjs/storybook/pull/6571))

### Bug Fixes

- Addon-knobs: Check color knob value before applying uppercase ([#6598](https://github.com/storybookjs/storybook/pull/6598))
- React-native: Restore title in section header ([#6599](https://github.com/storybookjs/storybook/pull/6599))

## 5.1.0-alpha.33 (April 23, 2019)

### Features

- React: Add support for create-react-app@3.0.0 ([#6560](https://github.com/storybookjs/storybook/pull/6560))

## 5.1.0-alpha.32 (April 22, 2019)

### Bug Fixes

- Addon-contexts: bug-fixing, testing, typing ([#6572](https://github.com/storybookjs/storybook/pull/6572))

### Dependency Upgrades

- CHANGE opn to open ([#6567](https://github.com/storybookjs/storybook/pull/6567))

## 5.1.0-alpha.31 (April 19, 2019)

### Features

- Addon-backgrounds: Emit event on updating background ([#6561](https://github.com/storybookjs/storybook/pull/6561))
- Addon-contexts: Merge into monorepo ([#6559](https://github.com/storybookjs/storybook/pull/6559))

### Bug Fixes

- Angular: Fix sourceMap property of angulars webpack config ([#6535](https://github.com/storybookjs/storybook/pull/6535))
- Addon-jest: Fix result display ([#6539](https://github.com/storybookjs/storybook/pull/6539))

### Dependency Upgrades

- Bump ember-source from 3.8.1 to 3.9.1 ([#6531](https://github.com/storybookjs/storybook/pull/6531))
- Bump typescript from 3.4.2 to 3.4.3 ([#6528](https://github.com/storybookjs/storybook/pull/6528))

## 5.0.10 (April 18, 2019)

### Bug Fixes

- Theming: legacy options don't override set config options ([#6543](https://github.com/storybookjs/storybook/pull/6543))
- Theming: Fix null brandImage ([#6544](https://github.com/storybookjs/storybook/pull/6544))

## 5.1.0-alpha.30 (April 18, 2019)

### Bug Fixes

- UI: Fix hard-coded viewmode to enable tabbed addons ([#6551](https://github.com/storybookjs/storybook/pull/6551))
- Theming: legacy options don't override set config options ([#6543](https://github.com/storybookjs/storybook/pull/6543))
- React-native: Fix preview only UI ([#6549](https://github.com/storybookjs/storybook/pull/6549))

### Dependency Upgrades

- Bump react-redux from 6.0.1 to 7.0.2 ([#6529](https://github.com/storybookjs/storybook/pull/6529))

### Maintenance

- Addon-storysource: Migrate from using channel to api ([#6550](https://github.com/storybookjs/storybook/pull/6550))

## 5.1.0-alpha.29 (April 17, 2019)

### Bug Fixes

- Theming: Fix null brandImage ([#6544](https://github.com/storybookjs/storybook/pull/6544))

### Maintenance

- Typescript: Migrate @storybook/components part 2 ([#6500](https://github.com/storybookjs/storybook/pull/6500))

### Dependency Upgrades

- Bump @types/node from 11.11.8 to 11.13.4 ([#6527](https://github.com/storybookjs/storybook/pull/6527))
- Bump danger from 7.0.19 to 7.1.2 ([#6530](https://github.com/storybookjs/storybook/pull/6530))

## 5.0.9 (April 17, 2019)

### Bug Fixes

- UI: Fix panel toggle behavior in fullscreen ([#6525](https://github.com/storybookjs/storybook/pull/6525))
- Addon-Knobs: Add missing groupId for files knob ([#6534](https://github.com/storybookjs/storybook/pull/6534))
- Theming: FIX brandImage when theme created with brandTitle ([#6120](https://github.com/storybookjs/storybook/pull/6120))

## 5.1.0-alpha.28 (April 16, 2019)

### Bug Fixes

- UI: Fix panel toggle behavior in fullscreen ([#6525](https://github.com/storybookjs/storybook/pull/6525))
- Addon-Knobs: Add missing groupId for files knob ([#6534](https://github.com/storybookjs/storybook/pull/6534))

### Maintenance

- Typescript: Fix ts-lint config to lint `tsx` files ([#6533](https://github.com/storybookjs/storybook/pull/6533))
- Typescript: Migrate app/react-native ([#6448](https://github.com/storybookjs/storybook/pull/6448))
- CLI: Improve cli for react-native ([#6515](https://github.com/storybookjs/storybook/pull/6515))
- Workflow: Automention for project maintainers ([#6509](https://github.com/storybookjs/storybook/pull/6509))

## 5.0.8 (April 15, 2019)

Bump version to make `5.0.x` latest since I just released a patch in `v4.1.18`

## 4.1.18 (April 15, 2019)

### Bug Fixes

- Pin react-treebeard dependency at 3.1.0 ([#6517](https://github.com/storybookjs/storybook/pull/6517))

## 4.1.17 (April 15, 2019)

NPM publish failed

## 5.0.7 (April 14, 2019)

### Bug Fixes

- Addon-Knobs: Fix sorting of knobs Panels ([#6480](https://github.com/storybookjs/storybook/pull/6480))
- UI: Fix clickable footer links on about page ([#6441](https://github.com/storybookjs/storybook/pull/6441))
- UI: Fix 'read full changelog' link on about page ([#6385](https://github.com/storybookjs/storybook/pull/6385))

## 5.1.0-alpha.27 (April 14, 2019)

### Features

- Core: Disable webpack performance hints in manager config ([#6390](https://github.com/storybookjs/storybook/pull/6390))
- Addon-A11y: Drop a11y filter on double click ([#6503](https://github.com/storybookjs/storybook/pull/6503))

### Bug Fixes

- Addon-Jest: use 'off' instead of 'removeListener' ([#6508](https://github.com/storybookjs/storybook/pull/6508))

## 5.1.0-alpha.26 (April 13, 2019)

### Bug Fixes

- Addon-background: Fix addon by moving 'iframe' styles ([#6502](https://github.com/storybookjs/storybook/pull/6502))

## 5.1.0-alpha.25 (April 12, 2019)

### Features

- Addon-info: Add support for memoized components ([#6347](https://github.com/storybookjs/storybook/pull/6347))
- Addon-notes: Register notes as a panel or tab ([#6091](https://github.com/storybookjs/storybook/pull/6091))

### Bug Fixes

- Core: Fix: custom parameters on preview url ([#6486](https://github.com/storybookjs/storybook/pull/6486))
- Addon-knobs: Fix sorting of ungrouped knobs panel ([#6480](https://github.com/storybookjs/storybook/pull/6480))
- Core: Use babel-loader from react-scripts ([#5308](https://github.com/storybookjs/storybook/pull/5308))

### Dependency Upgrades

- Bump opn from 5.4.0 to 6.0.0 ([#6370](https://github.com/storybookjs/storybook/pull/6370))
- Bump @angular/forms from 7.2.7 to 7.2.12 ([#6424](https://github.com/storybookjs/storybook/pull/6424))
- chore(deps): bump marko from 4.16.7 to 4.16.9 ([#6459](https://github.com/storybookjs/storybook/pull/6459))
- chore(deps-dev): bump @types/react from 16.8.12 to 16.8.13 ([#6457](https://github.com/storybookjs/storybook/pull/6457))
- chore(deps-dev): bump typescript from 3.4.1 to 3.4.2 ([#6456](https://github.com/storybookjs/storybook/pull/6456))

## 5.1.0-alpha.24 (April 9, 2019)

### Maintenance

- React-native: Remove channel dep from ondevice-notes ([#6431](https://github.com/storybookjs/storybook/pull/6431))
- Typescript: Migrate @storybook/components ([#6095](https://github.com/storybookjs/storybook/pull/6095))

## 5.1.0-alpha.23 (April 8, 2019)

### Features

- Addon-a11y: Add 'indeterminate' checkbox state for partial selected group ([#6405](https://github.com/storybookjs/storybook/pull/6405))
- Angular: Add out-of-the-box support for \*.md ([#6444](https://github.com/storybookjs/storybook/pull/6444))

### Bug Fixes

- UI: Move '@emotion/\*' path-resolutions to the dependent package ([#6435](https://github.com/storybookjs/storybook/pull/6435))
- Core: Set custom options on first load ([#6395](https://github.com/storybookjs/storybook/pull/6395))
- UI: clickable footer links ([#6441](https://github.com/storybookjs/storybook/pull/6441))

### Maintenance

- Typescript: Migrate @storybook/addon-jest ([#6403](https://github.com/storybookjs/storybook/pull/6403))

## 5.1.0-alpha.22 (April 5, 2019)

### Features

- Addon-actions: Add depth option for serialization ([#6410](https://github.com/storybookjs/storybook/pull/6410))

### Bug Fixes

- Core: Respect webpack config stats in static build ([#6401](https://github.com/storybookjs/storybook/pull/6401))

### Maintenance

- Typescript: Migrate addon-options ([#6428](https://github.com/storybookjs/storybook/pull/6428))

### Dependency Upgrades

- Bump danger from 7.0.15 to 7.0.19 ([#6371](https://github.com/storybookjs/storybook/pull/6371))
- Bump jest-cli from 23.6.0 to 24.0.0 ([#5389](https://github.com/storybookjs/storybook/pull/5389))

## 5.1.0-alpha.21 (April 4, 2019)

### Features

- Addon-centered: Fix horizontal scrolling overflow ([#6361](https://github.com/storybookjs/storybook/pull/6361))
- Angular: Support OnPush change detection for class-specified components ([#6360](https://github.com/storybookjs/storybook/pull/6360))
- Addon-storysource: Reuse clientApi when possible ([#6154](https://github.com/storybookjs/storybook/pull/6154))

### Bug Fixes

- React-native: Fix backgrounds addon ([#6393](https://github.com/storybookjs/storybook/pull/6393))
- UI: Fix 'read full changelog' link on about page ([#6385](https://github.com/storybookjs/storybook/pull/6385))
- Addon-a11y: Fix addon initialization with 'makeDecorator' ([#6354](https://github.com/storybookjs/storybook/pull/6354))
- Typescript: Fix a11y build by adding hoist-non-react-statics ([#6348](https://github.com/storybookjs/storybook/pull/6348))

### Maintenance

- Typescript: Use Babel instead of tsc ([#5109](https://github.com/storybookjs/storybook/pull/5109))

## 5.0.6 (April 1, 2019)

### Bug Fixes

- Addon-a11y: Fix color-blindness emulation in Firefox ([#6297](https://github.com/storybookjs/storybook/pull/6297))
- Addon-info: Fixed contrast of Show Info button for a11y ([#6301](https://github.com/storybookjs/storybook/pull/6301))
- Addon-cssresources: Fix panel layout ([#6263](https://github.com/storybookjs/storybook/pull/6263))
- Addon-info: forwardRef elements use displayName if available ([#6222](https://github.com/storybookjs/storybook/pull/6222))
- UI: Set expanded stories to objects instead of arrays ([#6290](https://github.com/storybookjs/storybook/pull/6290))
- Addon-actions: safe render for cyclic obj ([#6240](https://github.com/storybookjs/storybook/pull/6240))
- Core: Upgrade @babel/preset-env to fix corejs option ([#6281](https://github.com/storybookjs/storybook/pull/6281))
- Core: Enforces corejs v2 for babel ([#6267](https://github.com/storybookjs/storybook/pull/6267))
- Knobs: Rename ALL panel to Other for ungrouped knobs ([#6232](https://github.com/storybookjs/storybook/pull/6232))

## 5.1.0-alpha.20 (March 29, 2019)

### Features

- Addons: Manage local/session storage access with store2 ([#6310](https://github.com/storybookjs/storybook/pull/6310))

### Bug Fixes

- Addon-cssresources: Fix panel layout ([#6263](https://github.com/storybookjs/storybook/pull/6263))
- Addon-info: Fixed contrast of Show Info button for a11y ([#6301](https://github.com/storybookjs/storybook/pull/6301))

### Maintenance

- Migrate options and decorators in examples to new api ([#5954](https://github.com/storybookjs/storybook/pull/5954))

## 5.1.0-alpha.19 (March 28, 2019)

### Bug Fixes

- React-native: Fix "lib/addons" default export ([#6197](https://github.com/storybookjs/storybook/pull/6197))
- Addon-a11y: Remove element styling after re-running the a11y rules ([#6325](https://github.com/storybookjs/storybook/pull/6325))
- Addon-info: forwardRef elements use displayName if available ([#6222](https://github.com/storybookjs/storybook/pull/6222))
- React-native: Add background color for stories panel ([#6315](https://github.com/storybookjs/storybook/pull/6315))

### Dependency Upgrades

- Upgrade babel-plugin-react-docgen ([#6329](https://github.com/storybookjs/storybook/pull/6329))
- Bump babel-plugin-emotion from 10.0.7 to 10.0.9 ([#6227](https://github.com/storybookjs/storybook/pull/6227))
- Bump @types/lodash.isequal from 4.5.3 to 4.5.5 ([#6269](https://github.com/storybookjs/storybook/pull/6269))
- Bump react-scripts from 2.1.5 to 2.1.8 ([#6230](https://github.com/storybookjs/storybook/pull/6230))
- Bump esm from 3.2.10 to 3.2.20 ([#6270](https://github.com/storybookjs/storybook/pull/6270))

## 5.1.0-alpha.18 (March 27, 2019)

### Bug Fixes

- Addon-a11y: Fix color-blindness emulation in Firefox ([#6297](https://github.com/storybookjs/storybook/pull/6297))
- UI: Set expanded stories to objects instead of arrays ([#6290](https://github.com/storybookjs/storybook/pull/6290))

## 5.1.0-alpha.17 (March 26, 2019)

### Bug Fixes

- Addon-a11y: Move redux to dependencies ([#6286](https://github.com/storybookjs/storybook/pull/6286))

## 5.1.0-alpha.16 (March 26, 2019)

### Bug Fixes

- Upgrade `@babel/preset-env` to fix corejs option ([#6281](https://github.com/storybookjs/storybook/pull/6281))

## 5.1.0-alpha.15 (March 26, 2019)

### Features

- Addon-a11y: Highlight a11y violations on component ([#6218](https://github.com/storybookjs/storybook/pull/6218))
- HTML: Allow forced renders in @storybook/html ([#6190](https://github.com/storybookjs/storybook/pull/6190))

### Bug Fixes

- Core: Enforces corejs v2 for babel ([#6267](https://github.com/storybookjs/storybook/pull/6267))
- Knobs: Rename ALL panel to Other for ungrouped knobs ([#6232](https://github.com/storybookjs/storybook/pull/6232))
- UI: zoom iframe content instead zoom iframe wrapper ([#6126](https://github.com/storybookjs/storybook/pull/6126))
- Addon-actions: safe render for cyclic obj ([#6240](https://github.com/storybookjs/storybook/pull/6240))

### Maintenance

- Addon-knobs: adds an example of a boolean knob ([#6242](https://github.com/storybookjs/storybook/pull/6242))

### Dependency Upgrades

- Bump simplebar-react from 0.1.4 to 0.1.5 ([#6226](https://github.com/storybookjs/storybook/pull/6226))
- FIX storybook having a incompatible version of webpack with vue-cli ([#6259](https://github.com/storybookjs/storybook/pull/6259))

## 5.1.0-alpha.14 (March 25, 2019)

### Features

- Addon-backgrounds: Add custom grid size ([#6252](https://github.com/storybookjs/storybook/pull/6252))
- Addon-viewport: Show active viewport dimensions & rotate button ([#6045](https://github.com/storybookjs/storybook/pull/6045))

### Bug Fixes

- UI: Use Fuse.js package for search ([#6244](https://github.com/storybookjs/storybook/pull/6244))
- React: Use node-logger instead of console ([#6245](https://github.com/storybookjs/storybook/pull/6245))

### Maintenance

- Addon-links: Migrate to Typescript ([#6246](https://github.com/storybookjs/storybook/pull/6246))

### Dependency Upgrades

- Bump react-resize-detector from 4.0.2 to 4.0.5 ([#6229](https://github.com/storybookjs/storybook/pull/6229))

## 5.0.5 (March 25, 2019)

Bump version number (same as 5.0.4, but need to make this `latest` again!)

## 3.4.12 (March 24, 2019)

### Bug Fixes

- UI: Workaround broken treebeard animations ([#6249](https://github.com/storybookjs/storybook/pull/6249))

## 5.0.4 (March 24, 2019)

### Bug Fixes

- UI: Fix tooltip event bindings, logger import ([#6238](https://github.com/storybookjs/storybook/pull/6238))
- CLI: Fix stories regexp in config.js ([#6180](https://github.com/storybookjs/storybook/pull/6180))
- Accessibility: Add missing button titles ([#6124](https://github.com/storybookjs/storybook/pull/6124))
- React: Fix forked CRA support on Windows ([#6236](https://github.com/storybookjs/storybook/pull/6236))
- Addon-knobs: Fix color type button z-index ([#6203](https://github.com/storybookjs/storybook/pull/6203))
- Angular: Fix typo in demo example ([#6193](https://github.com/storybookjs/storybook/pull/6193))
- Addon-Info: Restore fonts and color styling ([#6186](https://github.com/storybookjs/storybook/pull/6186))
- Addon-knobs: Fix ObjectType knob react warning ([#6159](https://github.com/storybookjs/storybook/pull/6159))
- Core: Add core-js as a dep to client-api ([#6209](https://github.com/storybookjs/storybook/pull/6209))
- React: Fix logging in cra-config ([#6245](https://github.com/storybookjs/storybook/pull/6245))

## 4.1.16 (March 24, 2019)

### Bug Fixes

- UI: Workaround broken treebeard animations ([#6249](https://github.com/storybookjs/storybook/pull/6249))

## 4.1.15 (March 24, 2019)

NPM publish failed

## 5.1.0-alpha.13 (March 23, 2019)

### Features

- Svelte: add svelte cli generator ([#6132](https://github.com/storybookjs/storybook/pull/6132))

### Bug Fixes

- Addon-knobs: Fix ObjectType knob react warning ([#6159](https://github.com/storybookjs/storybook/pull/6159))
- React: Fix forked CRA support on Windows ([#6236](https://github.com/storybookjs/storybook/pull/6236))
- UI: Fix tooltip event bindings, logger import ([#6238](https://github.com/storybookjs/storybook/pull/6238))

## 5.1.0-alpha.12 (March 22, 2019)

### Bug Fixes

- CLI: Fix stories regexp in config.js ([#6180](https://github.com/storybookjs/storybook/pull/6180))
- Addon-Info: Restore fonts and color styling ([#6186](https://github.com/storybookjs/storybook/pull/6186))
- Core: Add core-js as a dep to client-api ([#6209](https://github.com/storybookjs/storybook/pull/6209))

### Dependency Upgrades

- Bump eslint-plugin-jest from 22.3.2 to 22.4.1 ([#6168](https://github.com/storybookjs/storybook/pull/6168))
- Bump ember-cli-babel from 7.5.0 to 7.6.0 ([#6165](https://github.com/storybookjs/storybook/pull/6165))
- Bump danger from 7.0.14 to 7.0.15 ([#6164](https://github.com/storybookjs/storybook/pull/6164))
- Bump babel-preset-expo from 5.0.0 to 5.1.1 ([#6167](https://github.com/storybookjs/storybook/pull/6167))
- Bump @emotion/core from 10.0.7 to 10.0.9 ([#6169](https://github.com/storybookjs/storybook/pull/6169))
- Bump marko from 4.15.4 to 4.16.2 ([#6205](https://github.com/storybookjs/storybook/pull/6205))

## 5.1.0-alpha.11 (March 21, 2019)

### Features

- Addon-notes: Support theming ([#5922](https://github.com/storybookjs/storybook/pull/5922))

### Bug Fixes

- Addon-knobs: Fix color type button z-index ([#6203](https://github.com/storybookjs/storybook/pull/6203))
- Angular: Fix typo in demo example ([#6193](https://github.com/storybookjs/storybook/pull/6193))
- UI: Fix problem with selectedPanel reset ([#6149](https://github.com/storybookjs/storybook/pull/6149))

### Maintenance

- React-native: Publish crna-kitchen-sink app to expo ([#6183](https://github.com/storybookjs/storybook/pull/6183))

## 5.1.0-alpha.10 (March 19, 2019)

### Features

- New @storybook/api manager API package ([#5402](https://github.com/storybookjs/storybook/pull/5402))

### Bug Fixes

- Angular: Fix rerender performance ([#6094](https://github.com/storybookjs/storybook/pull/6094))
- React-native: Add the raw method to preview ([#6182](https://github.com/storybookjs/storybook/pull/6182))
- Theming: Fix brandImage to occupy 100% width of BrandArea ([#5904](https://github.com/storybookjs/storybook/pull/5904))

### Dependency Upgrades

- Bump emotion-theming from 10.0.7 to 10.0.9 ([#6138](https://github.com/storybookjs/storybook/pull/6138))
- Bump webpack-cli from 3.2.3 to 3.3.0 ([#6140](https://github.com/storybookjs/storybook/pull/6140))
- Bump tslint from 5.13.1 to 5.14.0 ([#6141](https://github.com/storybookjs/storybook/pull/6141))
- Bump ember-cli from 3.7.1 to 3.8.1 ([#6142](https://github.com/storybookjs/storybook/pull/6142))
- Bump markdown-to-jsx from 6.9.1 to 6.9.3 ([#6139](https://github.com/storybookjs/storybook/pull/6139))

## 5.0.3 (March 18, 2019)

### Bug Fixes

- Accessibility: Add missing button titles ([#6124](https://github.com/storybookjs/storybook/pull/6124))

### Maintenance

- UI: Make update notifications much less aggressive ([#6143](https://github.com/storybookjs/storybook/pull/6143))

## 5.1.0-alpha.9 (March 18, 2019)

### Maintenance

- UI: Make update notifications much less aggressive ([#6143](https://github.com/storybookjs/storybook/pull/6143))

## 5.1.0-alpha.8 (March 17, 2019)

### Bug Fixes

- Accessibility: Add aria label to search box ([#6131](https://github.com/storybookjs/storybook/pull/6131))
- Accessibility: Add missing button titles ([#6124](https://github.com/storybookjs/storybook/pull/6124))
- Addon-cssresources: Fix `STORY_RENDERED` CSS reset ([#6050](https://github.com/storybookjs/storybook/pull/6050))

### Maintenance

- React-native: Integrate crna-kitchen-sink example into monorepo ([#6125](https://github.com/storybookjs/storybook/pull/6125))
- Fix deprecations in examples ([#6134](https://github.com/storybookjs/storybook/pull/6134))

## 5.0.2 (March 17, 2019)

### Features

- CLI: Add --debug-webpack option ([#6082](https://github.com/storybookjs/storybook/pull/6082))

### Bug Fixes

- Addon-a11y: Fix design icons ([#5991](https://github.com/storybookjs/storybook/pull/5991))
- Addon-cssresources: Fix `STORY_RENDERED` CSS reset ([#6050](https://github.com/storybookjs/storybook/pull/6050))
- CLI: Clear build folder in static build ([#6024](https://github.com/storybookjs/storybook/pull/6024))
- Addon-backgrounds: Set preview to theme color when "transparent" ([#6042](https://github.com/storybookjs/storybook/pull/6042))
- UI: Fix search item in menu ([#6027](https://github.com/storybookjs/storybook/pull/6027))
- Addon-knobs: Fix key press debouncing ([#6022](https://github.com/storybookjs/storybook/pull/6022))
- CLI: Fix welcome component in dark theme ([#5998](https://github.com/storybookjs/storybook/pull/5998))
- Addon-viewport: Fix viewport iframe dimensions ([#5993](https://github.com/storybookjs/storybook/pull/5993))
- Core: fix selectStory with one parameter ([#5983](https://github.com/storybookjs/storybook/pull/5983))

### Maintenance

- Addon-viewport: Change styling to more closely match v4 ([#5979](https://github.com/storybookjs/storybook/pull/5979))

## 5.1.0-alpha.7 (March 16, 2019)

### Breaking Changes

- Core: Restore v4 webpack extend mode behavior AND deprecate it ([#6104](https://github.com/storybookjs/storybook/pull/6104))
- React native: Use @storybook/core ([#4942](https://github.com/storybookjs/storybook/pull/4942))

### Features

- CLI: Add --debug-webpack option ([#6082](https://github.com/storybookjs/storybook/pull/6082))
- UI: open brandUrl in new window ([#6106](https://github.com/storybookjs/storybook/pull/6106))

### Bug Fixes

- CLI: Clear build folder in static build ([#6024](https://github.com/storybookjs/storybook/pull/6024))
- Addon-a11y: Fix tab navigation ([#6118](https://github.com/storybookjs/storybook/pull/6118))
- Theming: FIX brandImage when theme created with brandTitle ([#6120](https://github.com/storybookjs/storybook/pull/6120))
- Addon-backgrounds: Set preview to theme color when "transparent" ([#6042](https://github.com/storybookjs/storybook/pull/6042))

### Maintenance

- Sort package.json on precommit ([#6101](https://github.com/storybookjs/storybook/pull/6101))

### Dependency Upgrades

- Use community AsyncStorage instead of deprecated React Native one ([#6079](https://github.com/storybookjs/storybook/pull/6079))
- Fix expo ([#6121](https://github.com/storybookjs/storybook/pull/6121))
- Bump graphiql from 0.12.0 to 0.13.0 ([#5901](https://github.com/storybookjs/storybook/pull/5901))
- Update expo requirement from ^31.0.4 to ^32.0.6 in /examples-native/crna-kitchen-sink ([#5664](https://github.com/storybookjs/storybook/pull/5664))
- Bump @angular/cli from 7.3.4 to 7.3.6 ([#6103](https://github.com/storybookjs/storybook/pull/6103))
- Bump react-dom from 16.8.3 to 16.8.4 ([#5903](https://github.com/storybookjs/storybook/pull/5903))

## 5.1.0-alpha.6 (March 14, 2019)

### Features

- Angular: add autoprefixing like angular-cli ([#5612](https://github.com/storybookjs/storybook/pull/5612))

### Bug Fixes

- UI: Fixing search item in menu ([#6027](https://github.com/storybookjs/storybook/pull/6027))
- Addon-a11y: Run only when a11y tab is active ([#6044](https://github.com/storybookjs/storybook/pull/6044))

### Maintenance

- UI: Update syntaxhighlighter stories ([#6054](https://github.com/storybookjs/storybook/pull/6054))

## 5.1.0-alpha.5 (March 12, 2019)

### Bug Fixes

- Addon-a11y: Remove bg color from reports ([#6026](https://github.com/storybookjs/storybook/pull/6026))
- Addon-knobs: Fix key press debouncing ([#6022](https://github.com/storybookjs/storybook/pull/6022))
- Addon-knobs: Fix error when removing value from number knob ([#6043](https://github.com/storybookjs/storybook/pull/6043))

### Maintenance

- Theming: Improve typescript typings ([#5988](https://github.com/storybookjs/storybook/pull/5988))

### Dependency Upgrades

- build(deps): bump axe-core from 3.2.0 to 3.2.2 ([#6034](https://github.com/storybookjs/storybook/pull/6034))
- build(deps): bump css-loader from 2.1.0 to 2.1.1 ([#6033](https://github.com/storybookjs/storybook/pull/6033))
- build(deps): bump react-focus-lock from 1.17.7 to 1.18.3 ([#6031](https://github.com/storybookjs/storybook/pull/6031))
- Bump react-resize-detector from 3.4.0 to 4.0.2 ([#5899](https://github.com/storybookjs/storybook/pull/5899))

## 5.1.0-alpha.4 (March 11, 2019)

### Bug Fixes

- CLI: Fix welcome component in dark theme ([#5998](https://github.com/storybookjs/storybook/pull/5998))
- Polymer: Fix re-rendering lit-html elements after non-lit-html element ([#5868](https://github.com/storybookjs/storybook/pull/5868))
- Addon-a11y: Fix respect 'element' arg in config ([#5996](https://github.com/storybookjs/storybook/pull/5996))
- Addon-a11y: Fix design icons ([#5991](https://github.com/storybookjs/storybook/pull/5991))
- Addon-viewport: Fix viewport iframe dimensions ([#5993](https://github.com/storybookjs/storybook/pull/5993))

### Maintenance

- ADD parameters to compile-js to no longer copy .ts files into dist ([#5844](https://github.com/storybookjs/storybook/pull/5844))

### Dependency Upgrades

- build(deps): bump react-is from 16.8.3 to 16.8.4 ([#6010](https://github.com/storybookjs/storybook/pull/6010))
- build(deps): bump react-dev-utils from 7.0.3 to 8.0.0 ([#6011](https://github.com/storybookjs/storybook/pull/6011))

## 5.1.0-alpha.3 (March 9, 2019)

### Features

- Addon-a11y: add 'incomplete' tab ([#5984](https://github.com/storybookjs/storybook/pull/5984))

### Bug Fixes

- Core: fix `selectStory` with one parameter ([#5983](https://github.com/storybookjs/storybook/pull/5983))
- Core: remove custom presets warning ([#5911](https://github.com/storybookjs/storybook/pull/5911))

### Maintenance

- Addon-viewport: Change styling to more closely match v4 ([#5979](https://github.com/storybookjs/storybook/pull/5979))

### Dependency Upgrades

- Bump babel-preset-react-app from 7.0.1 to 7.0.2 ([#5937](https://github.com/storybookjs/storybook/pull/5937))
- Bump ts-node from 8.0.2 to 8.0.3 ([#5938](https://github.com/storybookjs/storybook/pull/5938))
- Bump react from 16.8.3 to 16.8.4 ([#5902](https://github.com/storybookjs/storybook/pull/5902))
- Bump marko from 4.15.3 to 4.15.4 ([#5939](https://github.com/storybookjs/storybook/pull/5939))

### Bug Fixes

- Addon-a11y: Fix design icons ([#5991](https://github.com/storybookjs/storybook/pull/5991))
- Addon-cssresources: Fix `STORY_RENDERED` CSS reset ([#6050](https://github.com/storybookjs/storybook/pull/6050))
- CLI: Clear build folder in static build ([#6024](https://github.com/storybookjs/storybook/pull/6024))
- Addon-backgrounds: Set preview to theme color when "transparent" ([#6042](https://github.com/storybookjs/storybook/pull/6042))
- UI: Fix search item in menu ([#6027](https://github.com/storybookjs/storybook/pull/6027))
- Addon-knobs: Fix key press debouncing ([#6022](https://github.com/storybookjs/storybook/pull/6022))
- CLI: Fix welcome component in dark theme ([#5998](https://github.com/storybookjs/storybook/pull/5998))
- Addon-viewport: Fix viewport iframe dimensions ([#5993](https://github.com/storybookjs/storybook/pull/5993))
- Core: fix selectStory with one parameter ([#5983](https://github.com/storybookjs/storybook/pull/5983))

### Maintenance

- Addon-viewport: Change styling to more closely match v4 ([#5979](https://github.com/storybookjs/storybook/pull/5979))

## 5.0.1 (March 9, 2019)

### Bug Fixes

- Core: Remove custom presets warning ([#5911](https://github.com/storybookjs/storybook/pull/5911))
- Core: support unicode chars in story IDs ([#5964](https://github.com/storybookjs/storybook/pull/5964))
- Core: Add core-js dependencies where it was missing ([#5961](https://github.com/storybookjs/storybook/pull/5961))
- CLI: Fix missing iframe.html in absolute path output directory([#5947](https://github.com/storybookjs/storybook/pull/5947))
- Addon-knobs: Added debouncing between keystrokes to speed up component rendering ([#5811](https://github.com/storybookjs/storybook/pull/5811))
- UI: Fix search in production mode ([#5909](https://github.com/storybookjs/storybook/pull/5909))

## 4.1.14 (March 8, 2019)

### Dependency Upgrades

- React-native: Fix RN 0.58.5 / support 0.59 via react-native-modal-datetime-picker 6.0.0 ([#4425](https://github.com/storybookjs/storybook/pull/4425))

## 5.1.0-alpha.2 (March 8, 2019)

### Bug Fixes

- Core: support unicode chars in story IDs ([#5964](https://github.com/storybookjs/storybook/pull/5964))
- Core: Add core-js dependencies where it was missing ([#5961](https://github.com/storybookjs/storybook/pull/5961))

### Maintenance

- Addon-a11y: Migrate to typescript ([#5738](https://github.com/storybookjs/storybook/pull/5738))

## 5.1.0-alpha.1 (March 7, 2019)

### Bug Fixes

- CLI: Fix missing iframe.html in absolute path output directory ([#5947](https://github.com/storybookjs/storybook/pull/5947))
- Addon-knobs: Added debouncing between keystrokes to speed up component rendering ([#5811](https://github.com/storybookjs/storybook/pull/5811))
- UI: Fix search in production mode ([#5909](https://github.com/storybookjs/storybook/pull/5909))

### Maintenance

- ADD delay to rendering the acceptance stories ([#5943](https://github.com/storybookjs/storybook/pull/5943))
- Split versions.json into two files ([#5896](https://github.com/storybookjs/storybook/pull/5896))

## 5.1.0-alpha.0 (March 6, 2019)

### Features

- UI: Custom scrollbars ([#5714](https://github.com/storybookjs/storybook/pull/5714))

### Bug Fixes

- Fix: Move `react-select` dependency to 2.2 ([#5867](https://github.com/storybookjs/storybook/pull/5867))

### Maintenance

- Cleanup unused dependencies ([#5453](https://github.com/storybookjs/storybook/pull/5453))
- Add directory attribute to repositories in package.json files ([#5643](https://github.com/storybookjs/storybook/pull/5643))

### Dependency Upgrades

- Project-wide dependency upgrades ([#5740](https://github.com/storybookjs/storybook/pull/5740))
- Bump react-is from 16.8.1 to 16.8.3 ([#5743](https://github.com/storybookjs/storybook/pull/5743))
- Bump danger from 7.0.13 to 7.0.14 ([#5744](https://github.com/storybookjs/storybook/pull/5744))
- Bump babel-plugin-named-asset-import from 0.3.0 to 0.3.1 ([#5745](https://github.com/storybookjs/storybook/pull/5745))
- Bump eslint-plugin-json from 1.3.2 to 1.4.0 ([#5719](https://github.com/storybookjs/storybook/pull/5719))
- Bump react-native-modal-datetime-picker from 5.1.0 to 6.0.0 ([#4425](https://github.com/storybookjs/storybook/pull/4425))
- Bump immer from 1.12.0 to 2.0.0 ([#5694](https://github.com/storybookjs/storybook/pull/5694))
- Bump danger from 7.0.11 to 7.0.13 ([#5696](https://github.com/storybookjs/storybook/pull/5696))
- Bump eslint-plugin-jsx-a11y from 6.2.0 to 6.2.1 ([#5698](https://github.com/storybookjs/storybook/pull/5698))
- Bump @angular/platform-browser-dynamic from 7.2.4 to 7.2.6 ([#5697](https://github.com/storybookjs/storybook/pull/5697))
- Bump eslint from 5.12.1 to 5.14.1 ([#5653](https://github.com/storybookjs/storybook/pull/5653))
- Bump babel-preset-react-app from 7.0.0 to 7.0.1 ([#5674](https://github.com/storybookjs/storybook/pull/5674))
- Bump react from 16.8.1 to 16.8.2 ([#5673](https://github.com/storybookjs/storybook/pull/5673))
- Bump @angular/cli from 7.3.0 to 7.3.2 ([#5654](https://github.com/storybookjs/storybook/pull/5654))
- Bump @types/jest from 24.0.0 to 24.0.6 ([#5655](https://github.com/storybookjs/storybook/pull/5655))
- Bump lint-staged from 8.1.3 to 8.1.4 ([#5606](https://github.com/storybookjs/storybook/pull/5606))
- Bump @types/lodash from 4.14.120 to 4.14.121 ([#5609](https://github.com/storybookjs/storybook/pull/5609))
- Bump webpack from 4.29.0 to 4.29.3 ([#5570](https://github.com/storybookjs/storybook/pull/5570))
- update modal manager for rn 0.58 support ([#5581](https://github.com/storybookjs/storybook/pull/5581))
- Bump danger from 7.0.7 to 7.0.11 ([#5568](https://github.com/storybookjs/storybook/pull/5568))
- Bump jest-jasmine2 from 24.0.0 to 24.1.0 ([#5569](https://github.com/storybookjs/storybook/pull/5569))
- Bump jest-jasmine2 from 24.0.0 to 24.1.0 ([#5567](https://github.com/storybookjs/storybook/pull/5567))
- Bump handlebars from 4.0.12 to 4.1.0 ([#5576](https://github.com/storybookjs/storybook/pull/5576))
- Bump esm from 3.2.1 to 3.2.4 ([#5556](https://github.com/storybookjs/storybook/pull/5556))
- Bump @types/jest from 23.3.13 to 24.0.0 ([#5554](https://github.com/storybookjs/storybook/pull/5554))
- Bump webpack-dev-middleware from 3.5.1 to 3.5.2 ([#5552](https://github.com/storybookjs/storybook/pull/5552))
- Bump @emotion/core from 10.0.6 to 10.0.7 ([#5555](https://github.com/storybookjs/storybook/pull/5555))
- Bump terser-webpack-plugin from 1.2.1 to 1.2.2 ([#5553](https://github.com/storybookjs/storybook/pull/5553))
- Bump fuse.js from 3.3.1 to 3.4.2 ([#5538](https://github.com/storybookjs/storybook/pull/5538))
- Bump @angular/platform-browser-dynamic from 7.2.3 to 7.2.4 ([#5540](https://github.com/storybookjs/storybook/pull/5540))
- Bump emotion-theming from 10.0.6 to 10.0.7 ([#5541](https://github.com/storybookjs/storybook/pull/5541))
- Bump eslint-config-prettier from 3.6.0 to 4.0.0 ([#5539](https://github.com/storybookjs/storybook/pull/5539))

## 5.0.0 (March 5, 2019)

Storybook 5.0 is a completely new UI with the following improvements:

- 🌓 New design with light and dark themes
- 🛠 Canvas toolbar for easy access to addons
- 🗺 Overhauled navigation sidebar with an intuitive menu
- 🗜 Redesigned addons panel with handy buttons to toggle visibility and orientation
- ⌨️ Improved keyboard shortcuts that are user configurable
- 🌍 New URL structure that eliminates long strings of query parameters

  5.0 contains hundreds more fixes, features, and tweaks. Browse the changelogs matching `5.0.0-alpha.*`, `5.0.0-beta.*`, and `5.0.0-rc.*` for the full list of changes. See [MIGRATION.md](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) to upgrade from `4.x`.

## 5.0.0-rc.11 (March 5, 2019)

### Bug Fixes

- UI: Fix base theme initialization and theme bootup ([#5843](https://github.com/storybookjs/storybook/pull/5843))
- UI: Fix SidebarItem feels "laggy" when clicked ([#5850](https://github.com/storybookjs/storybook/pull/5850))

## 5.0.0-rc.10 (March 4, 2019)

### Bug Fixes

- Addon-viewports: Restore v4 behaviour ([#5829](https://github.com/storybookjs/storybook/pull/5829))
- Addon-backgrounds: Remove previously deprecated default export ([#5828](https://github.com/storybookjs/storybook/pull/5828))

### Maintenance

- Addon-a11y: Cleanup and document migration ([#5833](https://github.com/storybookjs/storybook/pull/5833))

## 5.0.0-rc.9 (March 3, 2019)

### Features

- Core: Allow local decorators via params ([#5806](https://github.com/storybookjs/storybook/pull/5806))

### Bug Fixes

- Core: Add warning for decorators added "mid-kind" ([#5819](https://github.com/storybookjs/storybook/pull/5819))
- Addon-notes: Support inline code markdown ([#5802](https://github.com/storybookjs/storybook/pull/5802))
- Theming: Fix theme loading bugs ([#5787](https://github.com/storybookjs/storybook/pull/5787))
- CLI: Fix build-storybook with simplebar esm files ([#5816](https://github.com/storybookjs/storybook/pull/5816))

## 5.0.0-rc.8 (March 1, 2019)

### Features

- Core: Allow local decorators via params ([#5806](https://github.com/storybookjs/storybook/pull/5806))

### Bug Fixes

- UI: Sort storiesHash so grouped keys appear together ([#5805](https://github.com/storybookjs/storybook/pull/5805))
- UI: Close tooltips on iframe clicks on keypresses ([#5807](https://github.com/storybookjs/storybook/pull/5807))
- Addon-Info: Add font family to info panel ([#5759](https://github.com/storybookjs/storybook/pull/5759))

## 5.0.0-rc.7 (February 28, 2019)

### Features

- UI: Page load animation and `STORIES_CONFIGURED` event ([#5756](https://github.com/storybookjs/storybook/pull/5756))
- Theming: Improve `brand` API ([#5733](https://github.com/storybookjs/storybook/pull/5733))
- UI: Fuzzy search improvement ([#5748](https://github.com/storybookjs/storybook/pull/5748))
- UI: Add toolbar animation ([#5742](https://github.com/storybookjs/storybook/pull/5742))

### Bug Fixes

- UI: Fix update notifications placement ([#5716](https://github.com/storybookjs/storybook/pull/5716))
- Angular: Fix global style imports ([#5776](https://github.com/storybookjs/storybook/pull/5776))
- Addon-options: Add backwards compatibility ([#5758](https://github.com/storybookjs/storybook/pull/5758))
- Addon-options: Fix deprecated url/name options ([#5773](https://github.com/storybookjs/storybook/pull/5773))
- Addon-knobs: Remove call to `forceReRender()` on `STORY_CHANGED` ([#5753](https://github.com/storybookjs/storybook/pull/5753))
- UI: Fix active state in addon-background, addon-viewport tools ([#5749](https://github.com/storybookjs/storybook/pull/5749))

## 5.0.0-rc.6 (February 25, 2019)

### Bug Fixes

- Addon-actions: FIX performance by upgrading to telejson 2.1 ([#5751](https://github.com/storybookjs/storybook/pull/5751))
- UI: FIX bad treeview mockdata ([#5741](https://github.com/storybookjs/storybook/pull/5741))
- UI: About page styling fixes ([#5732](https://github.com/storybookjs/storybook/pull/5732))
- UI: Restore the toolbar eject button ([#5737](https://github.com/storybookjs/storybook/pull/5737))

## 5.0.0-rc.5 (February 23, 2019)

### Bug Fixes

- UI: Fix `/` search hotkey so it doesn't type into the input ([#5702](https://github.com/storybookjs/storybook/pull/5702))
- Addon-a11y: Fix a11y setup being undefined ([#5724](https://github.com/storybookjs/storybook/pull/5724))
- UI: Fix duplicate theming packages ([#5722](https://github.com/storybookjs/storybook/pull/5722))
- Core: Clean up debug logging ([#5705](https://github.com/storybookjs/storybook/pull/5705))
- UI: Minor addon ux tweaks ([#5712](https://github.com/storybookjs/storybook/pull/5712))
- Addon-a11y: Fix story scrolling ([#5713](https://github.com/storybookjs/storybook/pull/5713))
- UI: Fix mobile styling ([#5709](https://github.com/storybookjs/storybook/pull/5709))
- UI: Fix tooltip bugs ([#5692](https://github.com/storybookjs/storybook/pull/5692))
- UI: Fix toolbar separators ([#5711](https://github.com/storybookjs/storybook/pull/5711))

### Maintenance

- Typescript: migrate addon-backgrounds ([#5535](https://github.com/storybookjs/storybook/pull/5535))
- Typescript: fix typings for addon-backgrounds ([#5730](https://github.com/storybookjs/storybook/pull/5730))

## 5.0.0-rc.4 (February 21, 2019)

### Features

- UI: Handle prerelease versions in version check ([#5641](https://github.com/storybookjs/storybook/pull/5641))

### Bug Fixes

- UI: Fix scrollbar persistence ([#5689](https://github.com/storybookjs/storybook/pull/5689))
- UI: Fix keyboard shortcuts of toggleNav & togglePanel ([#5677](https://github.com/storybookjs/storybook/pull/5677))
- Core: Fix singleton module issue for manager & theme ([#5679](https://github.com/storybookjs/storybook/pull/5679))
- Addon-storysource: Fix source not updating ([#5672](https://github.com/storybookjs/storybook/pull/5672))
- Core: Fix broken error reporting ([#5678](https://github.com/storybookjs/storybook/pull/5678))
- Addon-info: Compare component name to story name, not story fn ([#5649](https://github.com/storybookjs/storybook/pull/5649))

### Maintenance

- CLI: Cleanup version notice ([#5699](https://github.com/storybookjs/storybook/pull/5699))
- Core: Fix story fn consistency ([#5669](https://github.com/storybookjs/storybook/pull/5669))

## 4.1.13 (February 21, 2019)

### Maintenance

- CLI: Cleanup version notice ([#5699](https://github.com/storybookjs/storybook/pull/5699))
- Docs: Use static versions.json file instead of hacking one in ([#5675](https://github.com/storybookjs/storybook/pull/5675))

## 5.0.0-rc.3 (February 19, 2019)

### Bug Fixes

- UI: Styling bug fixes, story updates, and more QA ([#5650](https://github.com/storybookjs/storybook/pull/5650))
- UI: V5 style refinements ([#5562](https://github.com/storybookjs/storybook/pull/5562))

## 5.0.0-rc.2 (February 19, 2019)

### Features

- UI: Allow collapsing active story and use separate expansion for filtered ([#5625](https://github.com/storybookjs/storybook/pull/5625))
- UI: Handle prerelease versions in version check ([#5641](https://github.com/storybookjs/storybook/pull/5641))

### Bug Fixes

- Addon-a11y: Fix tab highlighting ([#5646](https://github.com/storybookjs/storybook/pull/5646))
- Addon-jest: Fix event subscription ([#5644](https://github.com/storybookjs/storybook/pull/5644))
- UI: Handle old versions in version check ([#5638](https://github.com/storybookjs/storybook/pull/5638))

### Maintenance

- UI: Fix some prop warnings ([#5635](https://github.com/storybookjs/storybook/pull/5635))
- UI: Use the correct props to start the tooltip open ([#5610](https://github.com/storybookjs/storybook/pull/5610))

## 4.1.12 (February 18, 2019)

### Bug Fixes

- Addon-google-analytics: Add missing `register.js` file ([#5379](https://github.com/storybookjs/storybook/pull/5379))

### Dependency Upgrades

- Update modal manager for rn 0.58 support ([#5581](https://github.com/storybookjs/storybook/pull/5581))

## 5.0.0-rc.1 (February 16, 2019)

### Bug Fixes

- Core: Add missing babel-preset-env dependency ([#5617](https://github.com/storybookjs/storybook/pull/5617))

## 5.0.0-rc.0 (February 16, 2019)

Welcome to Storybook 5 (SB5) with a beautiful new user interface including:

- Navigation sidebar redesign
- New canvas toolbar
- Customizable keyboard shortcuts
- Improved search
- Version update notifications

SB5 also includes a new URL structure, expanded addon API, and many more features and architectural improvements.

See [the RC announcement](https://gist.github.com/shilman/0332090b63f1798a58ed8d85db44f4b4) for more details!

## 5.0.0-beta.4 (February 15, 2019)

### Bug Fixes

- UI: Fix mobile view ([#5603](https://github.com/storybookjs/storybook/pull/5603))
- UI: Misc warning fixes ([#5601](https://github.com/storybookjs/storybook/pull/5601))
- UI: Fix ie 11 ([#5599](https://github.com/storybookjs/storybook/pull/5599))
- CLI: Fix for when outputDir is an absolute path ([#5573](https://github.com/storybookjs/storybook/pull/5573))
- CLI: Avoid false-negative checks for port ([#5565](https://github.com/storybookjs/storybook/pull/5565))
- Core: Prioritise programmatic configuration ([#5564](https://github.com/storybookjs/storybook/pull/5564))
- UI: FIX clear search ([#5550](https://github.com/storybookjs/storybook/pull/5550))
- Core: Transpile safe-eval package ([#5498](https://github.com/storybookjs/storybook/pull/5498))
- UI: Add default backgrounds to official example ([#5585](https://github.com/storybookjs/storybook/pull/5585))

## 5.0.0-beta.3 (February 13, 2019)

### Bug Fixes

- UI: V5 styling refinements ([#5562](https://github.com/storybookjs/storybook/pull/5562))

## 5.0.0-beta.2 (February 9, 2019)

### Features

- Storyshots: puppeteer launch config for CI ([#5487](https://github.com/storybookjs/storybook/pull/5487))

### Bug Fixes

- Addon-notes: fix loading behavior ([#5514](https://github.com/storybookjs/storybook/pull/5514))
- CLI: Workaround -h shorthand conflict ([#5464](https://github.com/storybookjs/storybook/pull/5464))
- Addons: remove tool addon styling ([#5452](https://github.com/storybookjs/storybook/pull/5452))

### Maintenance

- UI: V5 style refinements ([#5444](https://github.com/storybookjs/storybook/pull/5444))
- Core: Allow ignoring preview bundle building in core ([#5523](https://github.com/storybookjs/storybook/pull/5523))
- Core: Extract client-api pkg from core ([#5521](https://github.com/storybookjs/storybook/pull/5521))
- UI: Add react element hoisting && ADD display names via babel-plugin ([#5454](https://github.com/storybookjs/storybook/pull/5454))
- Build: TEMP disable the image snapshots ([#5469](https://github.com/storybookjs/storybook/pull/5469))

### Dependency Upgrades

- Bump vue and vue-template-compiler ([#5516](https://github.com/storybookjs/storybook/pull/5516))
- Bump react from 16.7.0 to 16.8.1 ([#5517](https://github.com/storybookjs/storybook/pull/5517))
- Bump react-is from 16.7.0 to 16.8.1 ([#5504](https://github.com/storybookjs/storybook/pull/5504))
- Bump eslint-plugin-jest from 22.2.1 to 22.2.2 ([#5505](https://github.com/storybookjs/storybook/pull/5505))
- Bump babel-plugin-emotion from 10.0.6 to 10.0.7 ([#5502](https://github.com/storybookjs/storybook/pull/5502))
- Bump ember-source from 3.7.2 to 3.7.3 ([#5501](https://github.com/storybookjs/storybook/pull/5501))
- Bump lint-staged from 8.1.1 to 8.1.3 ([#5503](https://github.com/storybookjs/storybook/pull/5503))
- Bump enzyme-adapter-react-16 from 1.9.0 to 1.9.1 ([#5507](https://github.com/storybookjs/storybook/pull/5507))
- dependencies: update lit-html to 1.0.0 ([#5490](https://github.com/storybookjs/storybook/pull/5490))
- Bump esm from 3.2.0 to 3.2.1 ([#5492](https://github.com/storybookjs/storybook/pull/5492))
- Bump webpack-cli from 3.2.1 to 3.2.3 ([#5494](https://github.com/storybookjs/storybook/pull/5494))
- Bump @babel/plugin-proposal-object-rest-spread from 7.3.1 to 7.3.2 ([#5496](https://github.com/storybookjs/storybook/pull/5496))
- Bump fuse.js from 3.3.0 to 3.3.1 ([#5497](https://github.com/storybookjs/storybook/pull/5497))
- Bump jest-emotion from 10.0.6 to 10.0.7 ([#5495](https://github.com/storybookjs/storybook/pull/5495))
- Bump prettier from 1.16.1 to 1.16.4 ([#5482](https://github.com/storybookjs/storybook/pull/5482))
- Bump @types/webpack-env from 1.13.6 to 1.13.7 ([#5477](https://github.com/storybookjs/storybook/pull/5477))
- Bump typescript from 3.2.4 to 3.3.1 ([#5479](https://github.com/storybookjs/storybook/pull/5479))
- Bump eslint-plugin-import from 2.15.0 to 2.16.0 ([#5480](https://github.com/storybookjs/storybook/pull/5480))
- Bump storybook-chromatic from 1.2.5 to 1.2.6 ([#5481](https://github.com/storybookjs/storybook/pull/5481))
- Bump enzyme-adapter-react-16 from 1.8.0 to 1.9.0 ([#5478](https://github.com/storybookjs/storybook/pull/5478))
- Bump markdown-to-jsx from 6.9.0 to 6.9.1 ([#5465](https://github.com/storybookjs/storybook/pull/5465))
- Bump @angular/compiler from 7.2.2 to 7.2.3 ([#5466](https://github.com/storybookjs/storybook/pull/5466))
- Bump babel-plugin-react-docgen from 2.0.0 to 2.0.2 ([#5468](https://github.com/storybookjs/storybook/pull/5468))
- Bump danger from 7.0.4 to 7.0.7 ([#5467](https://github.com/storybookjs/storybook/pull/5467))
- Bump puppeteer from 1.11.0 to 1.12.0 ([#5450](https://github.com/storybookjs/storybook/pull/5450))
- Bump @angular/platform-browser-dynamic from 7.2.2 to 7.2.3 ([#5434](https://github.com/storybookjs/storybook/pull/5434))
- Bump esm from 3.1.4 to 3.2.0 ([#5447](https://github.com/storybookjs/storybook/pull/5447))
- Bump eslint-plugin-jest from 22.1.3 to 22.2.1 ([#5448](https://github.com/storybookjs/storybook/pull/5448))
- Bump danger from 7.0.2 to 7.0.4 ([#5449](https://github.com/storybookjs/storybook/pull/5449))
- Bump case-sensitive-paths-webpack-plugin from 2.1.2 to 2.2.0 ([#5451](https://github.com/storybookjs/storybook/pull/5451))

## 5.0.0-beta.1 (February 1, 2019)

### Bug Fixes

- Addon-backgrounds: Fix tool not appearing, or appearing only after a few navigations ([#5439](https://github.com/storybookjs/storybook/pull/5439))

### Maintenance

- UI:Added iframe stories ([#5428](https://github.com/storybookjs/storybook/pull/5428))
- UI: Broke up Sidebar (ex-nav) and made stories for subcomponents ([#5426](https://github.com/storybookjs/storybook/pull/5426))
- UI: Improve about/shortcuts stories by passing in `onClose` as a prop. ([#5425](https://github.com/storybookjs/storybook/pull/5425))

## 5.0.0-beta.0 (February 1, 2019)

Failed release

## 5.0.0-alpha.11 (February 1, 2019)

### Features

- Addon-knobs: Added property name into form fields ([#5414](https://github.com/storybookjs/storybook/pull/5414))

### Bug Fixes

- UI: Fix the layout issue where panels still sort-of appear on non story viewmodes ([#5413](https://github.com/storybookjs/storybook/pull/5413))

### Maintenance

- UI: Refactoring components and adding more stories ([#5404](https://github.com/storybookjs/storybook/pull/5404))
- UI: Add extra stories for StoryExplorer component & subcomponents ([#5424](https://github.com/storybookjs/storybook/pull/5424))
- UI: theming treeview & preview ([#5372](https://github.com/storybookjs/storybook/pull/5372))

### Dependency Upgrades

- Bump @ngrx/store from 7.1.0 to 7.2.0 ([#5433](https://github.com/storybookjs/storybook/pull/5433))
- Bump @angular/cli from 7.2.2 to 7.3.0 ([#5432](https://github.com/storybookjs/storybook/pull/5432))
- Bump ember-cli-babel from 7.4.0 to 7.4.1 ([#5431](https://github.com/storybookjs/storybook/pull/5431))
- Bump @ember/test-helpers from 1.3.0 to 1.3.1 ([#5430](https://github.com/storybookjs/storybook/pull/5430))
- Bump jest-diff from 23.6.0 to 24.0.0 ([#5429](https://github.com/storybookjs/storybook/pull/5429))
- Bump @types/react from 16.7.21 to 16.7.22 ([#5405](https://github.com/storybookjs/storybook/pull/5405))
- Bump @types/node from 10.12.18 to 10.12.19 ([#5406](https://github.com/storybookjs/storybook/pull/5406))
- Bump autoprefixer from 9.4.6 to 9.4.7 ([#5407](https://github.com/storybookjs/storybook/pull/5407))
- Bump storybook-chromatic from 1.2.4 to 1.2.5 ([#5408](https://github.com/storybookjs/storybook/pull/5408))
- Bump rxjs-compat from 6.3.3 to 6.4.0 ([#5409](https://github.com/storybookjs/storybook/pull/5409))
- Bump jest-config from 23.6.0 to 24.0.0 ([#5410](https://github.com/storybookjs/storybook/pull/5410))
- Bump jest-environment-jsdom from 23.4.0 to 24.0.0 ([#5398](https://github.com/storybookjs/storybook/pull/5398))
- Bump lint-staged from 8.1.0 to 8.1.1 ([#5395](https://github.com/storybookjs/storybook/pull/5395))
- Bump ts-node from 8.0.1 to 8.0.2 ([#5396](https://github.com/storybookjs/storybook/pull/5396))
- Bump @angular/compiler from 7.2.1 to 7.2.2 ([#5394](https://github.com/storybookjs/storybook/pull/5394))
- Bump eslint-plugin-jsx-a11y from 6.1.2 to 6.2.0 ([#5397](https://github.com/storybookjs/storybook/pull/5397))
- Bump telejson from 1.0.0 to 1.0.1 ([#5399](https://github.com/storybookjs/storybook/pull/5399))
- Bump @ember/test-helpers from 1.1.0 to 1.3.0 ([#5383](https://github.com/storybookjs/storybook/pull/5383))
- Bump esm from 3.1.1 to 3.1.4 ([#5384](https://github.com/storybookjs/storybook/pull/5384))
- Bump ws from 6.1.2 to 6.1.3 ([#5385](https://github.com/storybookjs/storybook/pull/5385))
- Bump jest-jasmine2 from 23.6.0 to 24.0.0 ([#5386](https://github.com/storybookjs/storybook/pull/5386))
- Bump vue-loader from 15.6.0 to 15.6.2 ([#5387](https://github.com/storybookjs/storybook/pull/5387))
- Bump @types/react from 16.7.20 to 16.7.21 ([#5388](https://github.com/storybookjs/storybook/pull/5388))

## 5.0.0-alpha.10 (January 28, 2019)

### Features

- Core: Version update use persistence ([#5370](https://github.com/storybookjs/storybook/pull/5370))
- Addon-Notes: Add giphy support ([#5381](https://github.com/storybookjs/storybook/pull/5381))

### Bug Fixes

- UI: Fix issue where "Tab" keyboard input => []. ([#5374](https://github.com/storybookjs/storybook/pull/5374))
- UI: FIX keybindings were pointing to null events ([#5375](https://github.com/storybookjs/storybook/pull/5375))
- Addon-GA: Add missing `register.js` file in base directory ([#5379](https://github.com/storybookjs/storybook/pull/5379))

### Maintenance

- Typescript: Migrate addon-cssresources ([#5380](https://github.com/storybookjs/storybook/pull/5380))
- UI: Keyboard shortcuts refactor ([#5359](https://github.com/storybookjs/storybook/pull/5359))

### Dependency Upgrades

- Bump enzyme-adapter-react-16 from 1.7.1 to 1.8.0 ([#5366](https://github.com/storybookjs/storybook/pull/5366))
- Bump typescript from 3.2.2 to 3.2.4 ([#5368](https://github.com/storybookjs/storybook/pull/5368))
- Bump @babel/plugin-transform-react-jsx from 7.2.0 to 7.3.0 ([#5367](https://github.com/storybookjs/storybook/pull/5367))
- Bump @babel/preset-env from 7.2.3 to 7.3.1 ([#5369](https://github.com/storybookjs/storybook/pull/5369))
- Bump vue-loader from 15.5.1 to 15.6.0 ([#5365](https://github.com/storybookjs/storybook/pull/5365))
- Bump prettier from 1.15.3 to 1.16.1 ([#5354](https://github.com/storybookjs/storybook/pull/5354))
- Bump ember-source from 3.7.0 to 3.7.2 ([#5358](https://github.com/storybookjs/storybook/pull/5358))
- Bump @angular/platform-browser-dynamic from 7.2.1 to 7.2.2 ([#5353](https://github.com/storybookjs/storybook/pull/5353))
- Bump ember-cli-babel from 7.2.0 to 7.4.0 ([#5357](https://github.com/storybookjs/storybook/pull/5357))
- Bump zone.js from 0.8.28 to 0.8.29 ([#5355](https://github.com/storybookjs/storybook/pull/5355))
- Bump lerna from 3.10.6 to 3.10.7 ([#5356](https://github.com/storybookjs/storybook/pull/5356))
- Bump eslint-plugin-import from 2.14.0 to 2.15.0 ([#5352](https://github.com/storybookjs/storybook/pull/5352))
- Bump immer from 1.10.5 to 1.12.0 ([#5345](https://github.com/storybookjs/storybook/pull/5345))
- Bump @babel/plugin-proposal-object-rest-spread from 7.2.0 to 7.3.1 ([#5342](https://github.com/storybookjs/storybook/pull/5342))
- Bump autoprefixer from 9.4.5 to 9.4.6 ([#5347](https://github.com/storybookjs/storybook/pull/5347))
- Bump react-focus-lock from 1.17.6 to 1.17.7 ([#5344](https://github.com/storybookjs/storybook/pull/5344))
- Bump @ngrx/store from 7.0.0 to 7.1.0 ([#5341](https://github.com/storybookjs/storybook/pull/5341))

## 4.1.11 (January 24, 2019)

### Bug Fixes

- React-native: Fixed isUIHidden param ([#5067](https://github.com/storybookjs/storybook/pull/5067))
- React-native: Disabling warning if story is not set in async storage ([#5068](https://github.com/storybookjs/storybook/pull/5068))

## 4.1.10 (January 24, 2019)

Release failed due to NPM error

## 5.0.0-alpha.9 (January 23, 2019)

### Features

- Core: Add a STORY_UNCHANGED event ([#5340](https://github.com/storybookjs/storybook/pull/5340))
- Core: Add a persistence API to context/state -- use for keyboard shortcuts ([#5289](https://github.com/storybookjs/storybook/pull/5289))

### Maintenance

- Addon-knobs: Fix story so array type is array ([#5318](https://github.com/storybookjs/storybook/pull/5318))

### Dependency Upgrades

- Bump ts-node from 7.0.1 to 8.0.1 ([#5346](https://github.com/storybookjs/storybook/pull/5346))
- Bump marko from 4.14.20 to 4.14.21 ([#5343](https://github.com/storybookjs/storybook/pull/5343))
- Bump @types/jest from 23.3.12 to 23.3.13 ([#5327](https://github.com/storybookjs/storybook/pull/5327))
- Bump @babel/plugin-proposal-class-properties from 7.2.3 to 7.3.0 ([#5326](https://github.com/storybookjs/storybook/pull/5326))
- Bump esm from 3.1.0 to 3.1.1 ([#5328](https://github.com/storybookjs/storybook/pull/5328))
- Bump resolve from 1.9.0 to 1.10.0 ([#5329](https://github.com/storybookjs/storybook/pull/5329))
- Bump webpack from 4.28.4 to 4.29.0 ([#5331](https://github.com/storybookjs/storybook/pull/5331))

## 4.1.9 (January 23, 2019)

Note that `4.1.7` contained a bad merge that missed an important change. This release fixes that:

### Bug Fixes

- Core: Add missing polyfills to manager to support IE ([#5238](https://github.com/storybookjs/storybook/pull/5238))

## 4.1.8 (January 23, 2019)

Bad release

## 5.0.0-alpha.8 (January 22, 2019)

### Features

- UI: Memoize treeview utils && ADD fuzzy search ([#5321](https://github.com/storybookjs/storybook/pull/5321))

### Maintenance

- Migrate addon google analytics to TS ([#5307](https://github.com/storybookjs/storybook/pull/5307))
- Storyshots: restore emotion snapshots ([#5305](https://github.com/storybookjs/storybook/pull/5305))

### Dependency Upgrades

- Bump eslint-config-prettier from 3.5.0 to 3.6.0 ([#5311](https://github.com/storybookjs/storybook/pull/5311))
- Bump eslint-plugin-react from 7.12.3 to 7.12.4 ([#5310](https://github.com/storybookjs/storybook/pull/5310))
- Bump vuex from 3.0.1 to 3.1.0 ([#5316](https://github.com/storybookjs/storybook/pull/5316))
- Bump lerna from 3.10.5 to 3.10.6 ([#5313](https://github.com/storybookjs/storybook/pull/5313))
- Bump react-docgen-typescript-loader from 3.0.0 to 3.0.1 ([#5315](https://github.com/storybookjs/storybook/pull/5315))
- Bump eslint from 5.12.0 to 5.12.1 ([#5314](https://github.com/storybookjs/storybook/pull/5314))
- Bump jscodeshift from 0.6.2 to 0.6.3 ([#5317](https://github.com/storybookjs/storybook/pull/5317))

## 5.0.0-alpha.7 (January 20, 2019)

### Breaking Changes

- Addon-centered: Add special entry-points for Vue and React ([#5296](https://github.com/storybookjs/storybook/pull/5296))

### Features

- CLI: new `add` command ([#4236](https://github.com/storybookjs/storybook/pull/4236))
- UI: set the document title when navigating stories ([#5277](https://github.com/storybookjs/storybook/pull/5277))

### Bug Fixes

- Addon-a11y: RE-ADD deprecated 'configureA11Y' for backwards compatibility ([#5302](https://github.com/storybookjs/storybook/pull/5302))
- UI: FIX navigation issue for `file://` URLs ([#5295](https://github.com/storybookjs/storybook/pull/5295))
- UI: FIX merge mutation ([#5300](https://github.com/storybookjs/storybook/pull/5300))
- Core: FIX issue where webpack process would hang when manager build failed ([#5290](https://github.com/storybookjs/storybook/pull/5290))

## 5.0.0-alpha.6 (January 18, 2019)

### Maintenance

- Restore official-storybook error test ([#5281](https://github.com/storybookjs/storybook/pull/5281))
- Add explicit return types to @storybook/addons ([#5212](https://github.com/storybookjs/storybook/pull/5212))
- REFACTOR router into @storybook/router ([#5252](https://github.com/storybookjs/storybook/pull/5252))

### Dependency Upgrades

- Bump react-select from 2.2.0 to 2.3.0 ([#5288](https://github.com/storybookjs/storybook/pull/5288))
- Bump webpack-dev-middleware from 3.5.0 to 3.5.1 ([#5285](https://github.com/storybookjs/storybook/pull/5285))
- Bump dotenv-webpack from 1.6.0 to 1.7.0 ([#5283](https://github.com/storybookjs/storybook/pull/5283))
- Bump graphql from 0.13.2 to 14.1.1 ([#5282](https://github.com/storybookjs/storybook/pull/5282))
- Bump marko from 4.14.19 to 4.14.20 ([#5284](https://github.com/storybookjs/storybook/pull/5284))
- Bumps webpack from 4.28.3 to 4.28.4 ([#5260](https://github.com/storybookjs/storybook/pull/5260))

## 4.1.7 (January 17, 2019)

### Bug Fixes

- Core: make absolute DLL path relative ([#5238](https://github.com/storybookjs/storybook/pull/5238))
- Addon-actions: import utils directly to prevent import cycles ([#5107](https://github.com/storybookjs/storybook/pull/5107))
- Add-knobs: render non-grouped knobs in the ALL tab ([#5106](https://github.com/storybookjs/storybook/pull/5106))

## 5.0.0-alpha.5 (January 17, 2019)

### Features

- Core: preserve user-specified iframe url params ([#5272](https://github.com/storybookjs/storybook/pull/5272))

### Bug Fixes

- Storyshots: FIX using the wrong parameter for disabling ([#5257](https://github.com/storybookjs/storybook/pull/5257))

## 5.0.0-alpha.4 (January 17, 2019)

### Bug Fixes

- Core: Fix iframe url params ([#5265](https://github.com/storybookjs/storybook/pull/5265))

### Maintenance

- Core: Rename viewMode/url from `components` to `story` ([#5266](https://github.com/storybookjs/storybook/pull/5266))
- Core: Export events constants as named exports ([#5186](https://github.com/storybookjs/storybook/pull/5186))

### Dependency Upgrades

- Bump vue and vue-template-compiler ([#5231](https://github.com/storybookjs/storybook/pull/5231))
- Bump ember-cli from 3.7.0 to 3.7.1 ([#5243](https://github.com/storybookjs/storybook/pull/5243))
- Bump ember-source from 3.6.1 to 3.7.0 ([#5258](https://github.com/storybookjs/storybook/pull/5258))
- Bump @angular/platform-browser-dynamic from 7.1.4 to 7.2.0 ([#5259](https://github.com/storybookjs/storybook/pull/5259))
- Bump vue-loader from 15.4.2 to 15.5.1 ([#5261](https://github.com/storybookjs/storybook/pull/5261))

## 5.0.0-alpha.3 (January 16, 2019)

Test publishing improvements

## 5.0.0-alpha.2 (January 16, 2019)

### Bug Fixes

- Storyshots: Fix async issue with obtaining custom Puppeteer instance … ([#5130](https://github.com/storybookjs/storybook/pull/5130))

### Maintenance

- MIGRATE to wrap emotion into a @storybook/theming package ([#5241](https://github.com/storybookjs/storybook/pull/5241))

### Dependency Upgrades

- Bump zone.js from 0.8.26 to 0.8.27 ([#5230](https://github.com/storybookjs/storybook/pull/5230))
- Bump lerna from 3.8.5 to 3.10.5 ([#5229](https://github.com/storybookjs/storybook/pull/5229))

## 5.0.0-alpha.1 (January 14, 2019)

### Bug Fixes

- Core: `no-dll` option to CLI to disable DllReferencePlugin, fix polyfills ([#5238](https://github.com/storybookjs/storybook/pull/5238))
- Core: Continue `{name, kind}` support on the `SET_CURRENT_STORY` event ([#5228](https://github.com/storybookjs/storybook/pull/5228))
- UI: FIX issue with accidentally thinking things are roots ([#5236](https://github.com/storybookjs/storybook/pull/5236))

### Dependency Upgrades

- Bump react-scripts from 2.1.1 to 2.1.3 ([#5214](https://github.com/storybookjs/storybook/pull/5214))

## 5.0.0-alpha.0 (January 13, 2019)

### Breaking Changes

- Core: Simplify custom webpack config ([#4927](https://github.com/storybookjs/storybook/pull/4927))
- UI: Storybook 5.0 UI and addons overhaul ([#5222](https://github.com/storybookjs/storybook/pull/5222))

### Features

- Core: Use new story format in official storybook ([#5058](https://github.com/storybookjs/storybook/pull/5058))
- UI: keyboard shortcuts ([#4257](https://github.com/storybookjs/storybook/pull/4257))

### Bug Fixes

- React: Merge CRA2 webpack plugins ([#5126](https://github.com/storybookjs/storybook/pull/5126))

### Dependency Upgrades

- Bump eslint-plugin-jest from 22.1.2 to 22.1.3 ([#5215](https://github.com/storybookjs/storybook/pull/5215))
- Bump eslint from 5.11.0 to 5.12.0 ([#5216](https://github.com/storybookjs/storybook/pull/5216))
- Bump jscodeshift from 0.5.1 to 0.6.2 ([#5213](https://github.com/storybookjs/storybook/pull/5213))
- Bump ember-cli from 3.6.1 to 3.7.0 ([#5203](https://github.com/storybookjs/storybook/pull/5203))
- Bump react-dev-utils from 7.0.0 to 7.0.1 ([#5202](https://github.com/storybookjs/storybook/pull/5202))
- Bump ember-cli from 3.6.0 to 3.6.1 ([#5188](https://github.com/storybookjs/storybook/pull/5188))
- Bump terser-webpack-plugin from 1.1.0 to 1.2.1 ([#5190](https://github.com/storybookjs/storybook/pull/5190))
- Bump chalk from 2.4.1 to 2.4.2 ([#5191](https://github.com/storybookjs/storybook/pull/5191))

## 4.2.0-alpha.11 (January 9, 2019)

### Maintenance

- Typescript: Add TypeScript CRA example ([#5120](https://github.com/storybookjs/storybook/pull/5120))
- Typescript: Migrate @storybook/channel-postmessage ([#5154](https://github.com/storybookjs/storybook/pull/5154))
- Typescript: Migrate @storybook/client-logger ([#5151](https://github.com/storybookjs/storybook/pull/5151))

### Dependency Upgrades

- Bump @babel/cli from 7.2.0 to 7.2.3 ([#5178](https://github.com/storybookjs/storybook/pull/5178))
- Bump babel-plugin-macros from 2.4.4 to 2.4.5 ([#5177](https://github.com/storybookjs/storybook/pull/5177))
- Bump babel-preset-react-app from 6.1.0 to 7.0.0 ([#5176](https://github.com/storybookjs/storybook/pull/5176))
- Bump interpret from 1.1.0 to 1.2.0 ([#5175](https://github.com/storybookjs/storybook/pull/5175))
- Bump file-loader from 2.0.0 to 3.0.1 ([#5174](https://github.com/storybookjs/storybook/pull/5174))
- Bump mini-css-extract-plugin from 0.4.5 to 0.5.0 ([#5173](https://github.com/storybookjs/storybook/pull/5173))
- Bump webpack-cli from 3.2.0 to 3.2.1 ([#5172](https://github.com/storybookjs/storybook/pull/5172))
- Bump marko from 4.14.12 to 4.14.15 ([#5157](https://github.com/storybookjs/storybook/pull/5157))
- Bump @types/jest from 23.3.10 to 23.3.12 ([#5158](https://github.com/storybookjs/storybook/pull/5158))
- Bump @angular/compiler from 7.1.3 to 7.1.4 ([#5159](https://github.com/storybookjs/storybook/pull/5159))
- Bump dotenv-webpack from 1.5.7 to 1.6.0 ([#5160](https://github.com/storybookjs/storybook/pull/5160))
- Bump babel-plugin-macros from 2.4.3 to 2.4.4 ([#5161](https://github.com/storybookjs/storybook/pull/5161))

## 4.1.6 (January 9, 2019)

### Bug Fixes

- React: Fix react version backwards compatibility ([#5148](https://github.com/storybookjs/storybook/pull/5148))
- UI: fix highlightColor ([#5150](https://github.com/storybookjs/storybook/pull/5150))
- Core: Transpile addons.js with Babel for IE11 ([#5081](https://github.com/storybookjs/storybook/pull/5081))

### Maintenance

- Add CORS headers to versions.json ([#5155](https://github.com/storybookjs/storybook/pull/5155))

### Dependency Upgrades

- Bump puppeteer from 1.9.0 to 1.11.0 ([#5119](https://github.com/storybookjs/storybook/pull/5119))

## 4.1.5 (January 9, 2019)

NPM failure, republishing as 4.1.6

## 4.2.0-alpha.10 (January 6, 2019)

### Features

- Addon-a11y: fix addon, add ability to configure context ([#5101](https://github.com/storybookjs/storybook/pull/5101))

### Bug Fixes

- Addon-knobs: Render non-grouped knobs in the ALL tab ([#5106](https://github.com/storybookjs/storybook/pull/5106))
- Addon-actions: import utils directly to prevent import cycles ([#5107](https://github.com/storybookjs/storybook/pull/5107))

### Maintenance

- TypeScript: Migrate @storybook/node-logger ([#5153](https://github.com/storybookjs/storybook/pull/5153))
- TypeScript: Migrate @storybook/core-events ([#5140](https://github.com/storybookjs/storybook/pull/5140))

### Dependency Upgrades

- bump puppeteer from 1.9.0 to 1.11.0 ([#5119](https://github.com/storybookjs/storybook/pull/5119))
- Bump lerna from 3.6.0 to 3.8.4 ([#5142](https://github.com/storybookjs/storybook/pull/5142))
- Bump svelte from 2.15.3 to 2.16.0 ([#5145](https://github.com/storybookjs/storybook/pull/5145))
- Bump react-dev-utils from 6.1.1 to 7.0.0 ([#5146](https://github.com/storybookjs/storybook/pull/5146))
- Bump react-is from 16.6.3 to 16.7.0 ([#5144](https://github.com/storybookjs/storybook/pull/5144))

## 4.2.0-alpha.9 (January 4, 2019)

### Bug Fixes

- Transpile addons.js with Babel ([#5081](https://github.com/storybookjs/storybook/pull/5081))

### Dependency Upgrades

- [Security] Bump webpack-dev-server from 3.1.10 to 3.1.14 ([#5108](https://github.com/storybookjs/storybook/pull/5108))
- Update @storybook/react to include peer dependency @emotion/core ([#5135](https://github.com/storybookjs/storybook/pull/5135))
- Bump webpack-cli from 3.1.2 to 3.2.0 ([#5137](https://github.com/storybookjs/storybook/pull/5137))
- Bump resolve from 1.8.1 to 1.9.0 ([#5139](https://github.com/storybookjs/storybook/pull/5139))
- Bump husky from 1.3.0 to 1.3.1 ([#5138](https://github.com/storybookjs/storybook/pull/5138))
- Bump @types/node from 10.12.17 to 10.12.18 ([#5098](https://github.com/storybookjs/storybook/pull/5098))
- Bump svelte-loader from 2.11.0 to 2.12.0 ([#5125](https://github.com/storybookjs/storybook/pull/5125))
- Bump react-modal from 3.7.1 to 3.8.1 ([#5124](https://github.com/storybookjs/storybook/pull/5124))
- Bump marko from 4.14.3 to 4.14.12 ([#5123](https://github.com/storybookjs/storybook/pull/5123))
- Bump css-loader from 1.0.1 to 2.1.0 ([#5115](https://github.com/storybookjs/storybook/pull/5115))
- Bump lit-html from 0.12.0 to 0.14.0 ([#5114](https://github.com/storybookjs/storybook/pull/5114))
- Bump @angular/platform-browser-dynamic from 7.1.3 to 7.1.4 ([#5113](https://github.com/storybookjs/storybook/pull/5113))

## 4.2.0-alpha.8 (December 28, 2018)

### Maintenance

- Typescript: Migrate @storybook/channel-websocket ([#5046](https://github.com/storybookjs/storybook/pull/5046))
- Typescript: Migrate @storybook/addons ([#5018](https://github.com/storybookjs/storybook/pull/5018))

### Dependency Upgrades

- Bump @babel/plugin-proposal-class-properties from 7.2.1 to 7.2.3 ([#5070](https://github.com/storybookjs/storybook/pull/5070))
- Bump babel-plugin-named-asset-import from 0.2.3 to 0.3.0 ([#5100](https://github.com/storybookjs/storybook/pull/5100))
- Bump eslint from 5.10.0 to 5.11.0 ([#5097](https://github.com/storybookjs/storybook/pull/5097))
- Bump loader-utils from 1.2.0 to 1.2.1 ([#5099](https://github.com/storybookjs/storybook/pull/5099))
- Bump boxen from 2.0.0 to 2.1.0 ([#5104](https://github.com/storybookjs/storybook/pull/5104))
- Bump @ngrx/store from 6.1.2 to 7.0.0 ([#5105](https://github.com/storybookjs/storybook/pull/5105))
- Bump react-select from 2.1.1 to 2.1.2 ([#5102](https://github.com/storybookjs/storybook/pull/5102))

## 4.1.4 (December 25, 2018)

### Bug Fixes

- Core: Load Symbol polyfill before any other code ([#5082](https://github.com/storybookjs/storybook/pull/5082))
- React: Fix error with new CRA Webpack config ([#5074](https://github.com/storybookjs/storybook/pull/5074))

## 4.2.0-alpha.7 (December 25, 2018)

### Bug Fixes

- React: Fix error with new CRA Webpack config ([#5074](https://github.com/storybookjs/storybook/pull/5074))
- Core: Load Symbol polyfill before any other code ([#5082](https://github.com/storybookjs/storybook/pull/5082))

### Dependency Upgrades

- Bump eslint-plugin-jest from 21.27.2 to 22.1.2 ([#5089](https://github.com/storybookjs/storybook/pull/5089))
- Bump react-color from 2.14.1 to 2.17.0 ([#5083](https://github.com/storybookjs/storybook/pull/5083))
- Bump @angular-devkit/build-angular from 0.10.7 to 0.11.4 ([#5084](https://github.com/storybookjs/storybook/pull/5084))
- Bump ts-loader from 5.3.1 to 5.3.2 ([#5085](https://github.com/storybookjs/storybook/pull/5085))
- Bump loader-utils from 1.1.0 to 1.2.0 ([#5086](https://github.com/storybookjs/storybook/pull/5086))
- Bump protractor from 5.4.1 to 5.4.2 ([#5087](https://github.com/storybookjs/storybook/pull/5087))
- Bump ember-cli from 3.5.1 to 3.6.0 ([#5088](https://github.com/storybookjs/storybook/pull/5088))
- Bump tslint from 5.11.0 to 5.12.0 ([#5090](https://github.com/storybookjs/storybook/pull/5090))
- Bump react-dom from 16.6.3 to 16.7.0 ([#5071](https://github.com/storybookjs/storybook/pull/5071))

## 4.1.3 (December 20, 2018)

### Bug Fixes

- React: remove unnecessary dependencies, fix aliasing ([#5047](https://github.com/storybookjs/storybook/pull/5047))
- React: alias to react & react-dom ([#5016](https://github.com/storybookjs/storybook/pull/5016))
- Addon-knobs: Fix color picker display ([#5010](https://github.com/storybookjs/storybook/pull/5010))

## 4.2.0-alpha.6 (December 20, 2018)

### Features

- React-Native: Change on-device layout to absolute position ([#4962](https://github.com/storybookjs/storybook/pull/4962))
- Addon-Info: add css classes for style overrides ([#4589](https://github.com/storybookjs/storybook/pull/4589))

### Bug Fixes

- Addon-Info: Display description when story name matches component ([#4863](https://github.com/storybookjs/storybook/pull/4863))
- React-Native: Disable warning if story is not set in async storage ([#5068](https://github.com/storybookjs/storybook/pull/5068))
- React-Native: Fixed isUIHidden param ([#5067](https://github.com/storybookjs/storybook/pull/5067))
- Vue: Fix reloading and story decoration ([#5057](https://github.com/storybookjs/storybook/pull/5057))

### Maintenance

- TypeScript: migrate @storybook/channels to typescript ([#4977](https://github.com/storybookjs/storybook/pull/4977))

### Dependency Upgrades

- Bump babel-plugin-macros from 2.4.2 to 2.4.3 ([#5060](https://github.com/storybookjs/storybook/pull/5060))
- Bump @babel/core from 7.2.0 to 7.2.2 ([#5059](https://github.com/storybookjs/storybook/pull/5059))
- Bump ember-cli-htmlbars-inline-precompile from 1.0.5 to 2.1.0 ([#5064](https://github.com/storybookjs/storybook/pull/5064))
- Bump react-test-renderer from 16.6.3 to 16.7.0 ([#5063](https://github.com/storybookjs/storybook/pull/5063))
- Bump autoprefixer from 9.4.2 to 9.4.3 ([#5061](https://github.com/storybookjs/storybook/pull/5061))

## 4.2.0-alpha.5 (December 19, 2018)

### Bug Fixes

- React: Remove unnecessary dependencies, fix aliasing ([#5047](https://github.com/storybookjs/storybook/pull/5047))

### Dependency Upgrades

- Bump @types/node from 10.12.14 to 10.12.17 ([#5045](https://github.com/storybookjs/storybook/pull/5045))
- Bump ember-source from 3.5.1 to 3.6.1 ([#5044](https://github.com/storybookjs/storybook/pull/5044))

## 4.2.0-alpha.4 (December 18, 2018)

### Bug Fixes

- React: fix alias for react(-dom) to resolve to the user's version ([#5042](https://github.com/storybookjs/storybook/pull/5042))

### Dependency Upgrades

- Bump husky from 1.2.0 to 1.3.0 ([#5038](https://github.com/storybookjs/storybook/pull/5038))
- Bump fork-ts-checker-webpack-plugin from 0.4.15 to 0.5.2 ([#5037](https://github.com/storybookjs/storybook/pull/5037))

## 4.2.0-alpha.3 (December 18, 2018)

### Bug Fixes

- React: add alias to react & react-dom ([#5016](https://github.com/storybookjs/storybook/pull/5016))
- Addon-knobs: fix color picker display ([#5010](https://github.com/storybookjs/storybook/pull/5010))

## 4.2.0-alpha.2 (December 16, 2018)

### Features

- Addon-Info: add markdown support for jsdoc comments ([#4983](https://github.com/storybookjs/storybook/pull/4983))
- Addon-Storysource: support Flow ([#4971](https://github.com/storybookjs/storybook/pull/4971))

### Maintenance

- Make applyPresets function signature more consistent ([#4988](https://github.com/storybookjs/storybook/pull/4988))

### Dependency Upgrades

- RESET lockfile ([#4991](https://github.com/storybookjs/storybook/pull/4991))

## 4.1.2 (December 15, 2018)

### Bug Fixes

- Addon-Knob: Add missing key property in Panel ([#4507](https://github.com/storybookjs/storybook/pull/4507))
- Fix package version dependencies ([#4960](https://github.com/storybookjs/storybook/pull/4960))

## 4.2.0-alpha.1 (December 12, 2018)

Fixes 4.2.0-alpha.0

### Features

- Addon-info: add forwardRef support ([#4961](https://github.com/storybookjs/storybook/pull/4961))

### Bug Fixes

- Addon-knobs: Add missing key property in Panel ([#4507](https://github.com/storybookjs/storybook/pull/4507))

### Maintenance

- Addon-notes: Migrated to TypeScript ([#4758](https://github.com/storybookjs/storybook/pull/4758))

### Dependency Upgrades

- Fix: Add missing peer dependencies to addon-knobs ([#4928](https://github.com/storybookjs/storybook/pull/4928))

## 4.2.0-alpha.0 (December 12, 2018)

Bad release

## 4.1.1 (December 12, 2018)

### Bug Fixes

- FIX react native by adding an empty array named dlls to the templateParameters ([#4985](https://github.com/storybookjs/storybook/pull/4985))

## 4.1.0 (December 12, 2018)

Storybook 4.1 with performance and compatibility improvements! Highlights include:

- Core: Performance optimizations on separate manager preview split, improved cold start, restart & rebuild ([#4834](https://github.com/storybookjs/storybook/pull/4834))
- React: add support for all versions of react ([#4808](https://github.com/storybookjs/storybook/pull/4808))
- Addon-CSSResources: new adddon to dynamically add/remove css ([#4622](https://github.com/storybookjs/storybook/pull/4622))
- React: use babel presets/plugins based on CRA. ([#4836](https://github.com/storybookjs/storybook/pull/4836))
- React-native: Add ability to filter story list ([#4806](https://github.com/storybookjs/storybook/pull/4806))
- React: Add TypeScript support for react-scripts ([#4824](https://github.com/storybookjs/storybook/pull/4824))

There are dozens more fixes, features, and tweaks in the 4.1 release. See changelogs for `4.1.0-*` for details.

## 4.1.0-alpha.13 (December 12, 2018)

### Maintenance

- React-native: add core-js to addons ([#4981](https://github.com/storybookjs/storybook/pull/4981))

## 4.1.0-alpha.12 (December 11, 2018)

### Bug Fixes

- Fix storyshots by compiling JS modules ([#4967](https://github.com/storybookjs/storybook/pull/4967))
- Angular: move 'core-js/modules/es6.promise' into storyshots ([#4929](https://github.com/storybookjs/storybook/pull/4929))

## 4.0.12 (December 5, 2018)

### Bug Fixes

- Addon-a11y: Fix runtime errors in older browsers ([#4904](https://github.com/storybookjs/storybook/pull/4904))

## 4.1.0-alpha.11 (December 5, 2018)

### Features

- Add CRA TypeScript support for .storybook folder ([#4902](https://github.com/storybookjs/storybook/pull/4902))

### Bug Fixes

- React-native: Fix async storage ([#4907](https://github.com/storybookjs/storybook/pull/4907))
- Core: replace babel/runtime with core-js to fix some aliasing issues ([#4900](https://github.com/storybookjs/storybook/pull/4900))

### Maintenance

- Core: More granular methods separation in "build-static" and "build-dev" ([#4919](https://github.com/storybookjs/storybook/pull/4919))
- Examples: replace deprecated setOptions with withOptions ([#4899](https://github.com/storybookjs/storybook/pull/4899))

## 4.0.11 (December 3, 2018)

### Bug Fixes

- Restore index.html in cra-kitchen-sink ([#4856](https://github.com/storybookjs/storybook/pull/4856))
- Add try, catch for IE11 as it breaks script execution ([#4870](https://github.com/storybookjs/storybook/pull/4870))

## 4.0.10 (December 2, 2018)

Fixes 4.0.9

### Bug Fixes

- Core: Use correct cache directory path ([#4792](https://github.com/storybookjs/storybook/pull/4792))
- Addon-Info: fix docgen description display ([#4685](https://github.com/storybookjs/storybook/pull/4685))
- Addon-storyshots-puppeteer: fix peerDependencies ([#4828](https://github.com/storybookjs/storybook/pull/4828))

## 4.1.0-alpha.10 (December 1, 2018)

### Maintenance

- Performance optimizations on separate manager preview split, improved cold start, restart & rebuild ([#4834](https://github.com/storybookjs/storybook/pull/4834))

## 4.1.0-alpha.9 (November 29, 2018)

### Features

- UI: Accessible success/fail colors ([#4843](https://github.com/storybookjs/storybook/pull/4843))
- React-native: add option to set keyboardVerticalOffset ([#4862](https://github.com/storybookjs/storybook/pull/4862))
- Addon-CSSResources: new adddon to dynamically add/remove css ([#4622](https://github.com/storybookjs/storybook/pull/4622))

### Bug Fixes

- Core: Add try, catch for history API for IE11 ([#4870](https://github.com/storybookjs/storybook/pull/4870))
- Core: Don't copy index.html on build-storybook ([#4856](https://github.com/storybookjs/storybook/pull/4856))
- React-native: properly set initial story out of Async Storage. ([#4872](https://github.com/storybookjs/storybook/pull/4872))
- React-native: show webpack-related build issues ([#4883](https://github.com/storybookjs/storybook/pull/4883))
- Addon-info: fix docgen description display ([#4685](https://github.com/storybookjs/storybook/pull/4685))

### Dependency Upgrades

- Bump svelte to 2.15.3, addresses !4478 ([#4842](https://github.com/storybookjs/storybook/pull/4842))

## 4.1.0-alpha.8 (November 25, 2018)

### Features

- React: use babel presets/plugins based on CRA. ([#4836](https://github.com/storybookjs/storybook/pull/4836))
- React-native: Add ability to filter story list ([#4806](https://github.com/storybookjs/storybook/pull/4806))

### Bug Fixes

- Core: Don't mangle production build ([#4838](https://github.com/storybookjs/storybook/pull/4838))
- HTML: Don't change rootElement when received node is the same ([#4822](https://github.com/storybookjs/storybook/pull/4822))

### Maintenance

- Fix snapshots to use "emotion/snapshot-serializer" ([#4837](https://github.com/storybookjs/storybook/pull/4837))

## 4.1.0-alpha.7 (November 22, 2018)

### Features

- Add TypeScript support for react-scripts ([#4824](https://github.com/storybookjs/storybook/pull/4824))

## 4.1.0-alpha.5/6 (November 22, 2018)

Publish failed

## 4.1.0-alpha.4 (November 21, 2018)

### Features

- ADD support for all versions of react ([#4808](https://github.com/storybookjs/storybook/pull/4808))

### Bug Fixes

- Use correct cache directory path ([#4792](https://github.com/storybookjs/storybook/pull/4792))

## 4.0.9 (November 26, 2018)

Broken release (see https://github.com/storybookjs/storybook/issues/4897)

## 4.0.8 (November 21, 2018)

### Bug Fixes

- Addon-knobs: Vue optimize on force render ([#4773](https://github.com/storybookjs/storybook/pull/4773))

## 4.1.0-alpha.3 (November 15, 2018)

### Maintenance

- REFACTOR dev-serve to output less noise ([#4791](https://github.com/storybookjs/storybook/pull/4791))
- Separate manager and preview part.2 ([#4789](https://github.com/storybookjs/storybook/pull/4789))

### Dependency Upgrades

- Use alpha minify dependency to upgrade transitive lodash dependencies ([#4771](https://github.com/storybookjs/storybook/pull/4771))

## 4.0.7 (November 15, 2018)

### Bug Fixes

- Vue/Angular/Mithril/Polymer: Add missing "forceReRender" and "addParameters" ([#4767](https://github.com/storybookjs/storybook/pull/4767))

## 4.1.0-alpha.2 (November 13, 2018)

### Features

- Core: Interpolation for multiple environment variables ([#4761](https://github.com/storybookjs/storybook/pull/4761))
- UI: deep theming for stories nav panel ([#4702](https://github.com/storybookjs/storybook/pull/4702))
- React-native: Persist last displayed story, allow to set initial story. ([#4713](https://github.com/storybookjs/storybook/pull/4713))

### Bug Fixes

- Better a11y ([#4704](https://github.com/storybookjs/storybook/pull/4704))
- Remove z-index from vertical resizer ([#4651](https://github.com/storybookjs/storybook/pull/4651))
- React: Ensure @storybook/react can be imported in Node.js without errors ([#4757](https://github.com/storybookjs/storybook/pull/4757))

### Maintenance

- Core: separate manager from preview ([#4590](https://github.com/storybookjs/storybook/pull/4590))
- Add tests for custom react-scripts packages ([#4768](https://github.com/storybookjs/storybook/pull/4768))
- FIX deprecation warning from husky ([#4755](https://github.com/storybookjs/storybook/pull/4755))
- Tech/silent smoke tests ([#4749](https://github.com/storybookjs/storybook/pull/4749))

### Dependency Upgrades

- Bump lint-staged from 7.3.0 to 8.0.4 ([#4673](https://github.com/storybookjs/storybook/pull/4673))
- Bump svelte from 2.13.5 to 2.15.2 ([#4726](https://github.com/storybookjs/storybook/pull/4726))
- [Security] Bump cached-path-relative from 1.0.1 to 1.0.2 ([#4745](https://github.com/storybookjs/storybook/pull/4745))
- Update expo requirement from ^30.0.1 to ^31.0.4 in /examples-native/crna-kitchen-sink ([#4728](https://github.com/storybookjs/storybook/pull/4728))
- Bump @storybook/addon-links from 3.4.11 to 4.0.4 in /docs ([#4732](https://github.com/storybookjs/storybook/pull/4732))
- Bump react-syntax-highlighter from 9.0.1 to 10.0.0 ([#4654](https://github.com/storybookjs/storybook/pull/4654))
- Bump @angular/compiler from 7.0.1 to 7.0.2 ([#4677](https://github.com/storybookjs/storybook/pull/4677))
- Bump @types/jest from 23.3.8 to 23.3.9 ([#4658](https://github.com/storybookjs/storybook/pull/4658))
- Bump copy-webpack-plugin from 4.5.4 to 4.6.0 ([#4674](https://github.com/storybookjs/storybook/pull/4674))
- Bump @ngrx/store from 6.1.1 to 6.1.2 ([#4678](https://github.com/storybookjs/storybook/pull/4678))
- [Security] Bump merge from 1.2.0 to 1.2.1 ([#4686](https://github.com/storybookjs/storybook/pull/4686))

## 4.0.6 (November 13, 2018)

### Features

- React: add support for custom `react-scripts` packages ([#4712](https://github.com/storybookjs/storybook/pull/4712))

### Bug Fixes

- Core: fix NODE_PATH is not being loaded from .env ([#4706](https://github.com/storybookjs/storybook/pull/4706))

## 4.0.5 (November 13, 2018)

Publish failed

## 4.1.0-alpha.1

2018-November-06

#### Features

- Core: add cursor images to webpack loader [#4498](https://github.com/storybookjs/storybook/pull/4498)
- Storyshots-puppeteer: Allow specifying an existing browser [#4721](https://github.com/storybookjs/storybook/pull/4721)
- React-native: close StoryListView after tap again in the current story [#4714](https://github.com/storybookjs/storybook/pull/4714)

#### Dependency Upgrades

- Bump @angular/compiler from 7.0.1 to 7.0.2 [#4677](https://github.com/storybookjs/storybook/pull/4677)
- Bump @types/jest from 23.3.8 to 23.3.9 [#4658](https://github.com/storybookjs/storybook/pull/4658)
- Bump copy-webpack-plugin from 4.5.4 to 4.6.0 [#4674](https://github.com/storybookjs/storybook/pull/4674)
- Bump @ngrx/store from 6.1.1 to 6.1.2 [#4678](https://github.com/storybookjs/storybook/pull/4678)
- [Security] Bump merge from 1.2.0 to 1.2.1 [#4686](https://github.com/storybookjs/storybook/pull/4686)

## 4.1.0-alpha.0

Publish failed

## 4.0.4

2018-November-06

#### Bug Fixes

- Core: Change extensions ordering in webpack config [#4708](https://github.com/storybookjs/storybook/pull/4708)
- Addon-Knobs: Fix PropTypes in NumberType [#4669](https://github.com/storybookjs/storybook/pull/4669)
- Addon-Viewport: Fix "defaultViewport" configuration [#4683](https://github.com/storybookjs/storybook/pull/4683)
- Addon-Jest: Fix test matching [#4689](https://github.com/storybookjs/storybook/pull/4689)
- Fix tests in node 11 by using `Array#sort` correctly [#4720](https://github.com/storybookjs/storybook/pull/4720)

#### Dependency Upgrades

- Bump react-syntax-highlighter from 9.0.1 to 10.0.0 [#4654](https://github.com/storybookjs/storybook/pull/4654)
- Remove SB deps from cli tests [#4705](https://github.com/storybookjs/storybook/pull/4705)

## 4.0.3

2018-November-06

#### Bug Fixes

- React: Fix css relative asset urls [#4695](https://github.com/storybookjs/storybook/pull/4695)
- Core: Fix a bug with buildStaticStandalone resolving too early [#4649](https://github.com/storybookjs/storybook/pull/4649)
- Angular: Fixes component imports from dist [#4682](https://github.com/storybookjs/storybook/pull/4682)
- Addon-info: Improve accessibility with contrast [#4698](https://github.com/storybookjs/storybook/pull/4698)
- Ember: update ergonomics to not require any manual setup [#4594](https://github.com/storybookjs/storybook/pull/4594)
- React-native: fix accessibility for component preview (iOS+VoiceOver) [#4601](https://github.com/storybookjs/storybook/pull/4601)

#### Maintenance

- Update release process and `master` becomes the stable branch [#4719](https://github.com/storybookjs/storybook/pull/4719)
- Report CLI tests to teamcity [#4671](https://github.com/storybookjs/storybook/pull/4671)

#### Dependency Upgrades

<details>
<summary>
30 PRs
</summary>

- Bump @angular/core from 7.0.1 to 7.0.2 [#4675](https://github.com/storybookjs/storybook/pull/4675)
- [Security] Bump merge from 1.2.0 to 1.2.1 in /docs [#4687](https://github.com/storybookjs/storybook/pull/4687)
- Bump typescript from 3.1.4 to 3.1.6 [#4699](https://github.com/storybookjs/storybook/pull/4699)
- Set zone.js as a peer and dev dependency [#4663](https://github.com/storybookjs/storybook/pull/4663)
- chore(core): update css-loader to latest [#4619](https://github.com/storybookjs/storybook/pull/4619)
- Bump css-loader from 1.0.0 to 1.0.1 [#4655](https://github.com/storybookjs/storybook/pull/4655)
- Bump @ngrx/store from 6.1.0 to 6.1.1 [#4653](https://github.com/storybookjs/storybook/pull/4653)
- Allow for angular-devkit/core version aligned with Angular v7 [#4652](https://github.com/storybookjs/storybook/pull/4652)
- Bump ember-load-initializers from 1.1.0 to 2.0.0 [#4634](https://github.com/storybookjs/storybook/pull/4634)
- Bump @ember/test-helpers from 0.7.27 to 1.0.0 [#4630](https://github.com/storybookjs/storybook/pull/4630)
- Bump @storybook/addon-actions from 3.4.11 to 4.0.0 in /docs [#4626](https://github.com/storybookjs/storybook/pull/4626)
- Bump gatsby-plugin-sharp from 2.0.7 to 2.0.10 in /docs [#4627](https://github.com/storybookjs/storybook/pull/4627)
- Bump typescript from 3.1.3 to 3.1.4 [#4629](https://github.com/storybookjs/storybook/pull/4629)
- Bump react-scripts from 2.0.5 to 2.1.0 [#4631](https://github.com/storybookjs/storybook/pull/4631)
- Bump ember-source from 3.5.0 to 3.5.1 [#4633](https://github.com/storybookjs/storybook/pull/4633)
- Bump @types/node from 10.12.0 to 10.12.1 [#4635](https://github.com/storybookjs/storybook/pull/4635)
- Bump react-dev-utils from 6.0.5 to 6.1.0 [#4636](https://github.com/storybookjs/storybook/pull/4636)
- Bump eslint from 5.7.0 to 5.8.0 [#4613](https://github.com/storybookjs/storybook/pull/4613)
- Bump express-graphql from 0.6.12 to 0.7.1 [#4610](https://github.com/storybookjs/storybook/pull/4610)
- Bump tslint-plugin-prettier from 2.0.0 to 2.0.1 [#4609](https://github.com/storybookjs/storybook/pull/4609)
- Bump eslint-plugin-jest from 21.26.1 to 21.26.2 [#4606](https://github.com/storybookjs/storybook/pull/4606)
- Bump @types/jest from 23.3.7 to 23.3.8 [#4611](https://github.com/storybookjs/storybook/pull/4611)
- Bump fork-ts-checker-webpack-plugin from 0.4.10 to 0.4.14 [#4607](https://github.com/storybookjs/storybook/pull/4607)
- Bump autoprefixer from 9.2.1 to 9.3.1 [#4605](https://github.com/storybookjs/storybook/pull/4605)
- Bump jasmine-core from 3.2.1 to 3.3.0 [#4581](https://github.com/storybookjs/storybook/pull/4581)
- Bump react-dom from 16.5.2 to 16.6.0 [#4580](https://github.com/storybookjs/storybook/pull/4580)
- Bump eslint-plugin-jest from 21.25.1 to 21.26.1 [#4583](https://github.com/storybookjs/storybook/pull/4583)
- Bump react from 16.5.2 to 16.6.0 [#4584](https://github.com/storybookjs/storybook/pull/4584)
- Bump react-syntax-highlighter from 9.0.0 to 9.0.1 [#4585](https://github.com/storybookjs/storybook/pull/4585)
- Bump remark-cli from 5.0.0 to 6.0.0 [#4551](https://github.com/storybookjs/storybook/pull/4551)

</details>

## 4.0.2

2018-October-31

Fix broken 4.0.1 release

#### Bug Fixes

- Addon-knobs: fix select array values showing k [#4586](https://github.com/storybookjs/storybook/pull/4586)

## 4.0.1

2018-October-31

Broken release - `@storybook/client-logger` [somehow didn't get published to NPM.](https://github.com/storybookjs/storybook/issues/4660)

## 4.0.0

2018-October-29

[Storybook 4.0](https://medium.com/storybookjs/storybook-4-0-is-here-10b9857fc7de) is our first major-version update in over a year! Key improvements include:

- Build tools
  - Webpack 4 [#3148](https://github.com/storybookjs/storybook/pull/3148)
  - Babel 7 [#3746](https://github.com/storybookjs/storybook/pull/3746)
- View layers
  - Storybook for Ember [#4237](https://github.com/storybookjs/storybook/pull/4237)
  - Storybook for MarkoJS [#3504](https://github.com/storybookjs/storybook/pull/3504)
  - Storybook for Mithril [#3244](https://github.com/storybookjs/storybook/pull/3244)
  - Storybook for HTML snippets [#3475](https://github.com/storybookjs/storybook/pull/3475)
  - Storybook for Svelte [#3770](https://github.com/storybookjs/storybook/pull/3770)
  - Storybook for Riot [#4070](https://github.com/storybookjs/storybook/pull/4070)
- Mobile
  - Mobile device view: toggling stories panel with ☰ button [#3337](https://github.com/storybookjs/storybook/pull/3337)
  - React Native: Remove the packager from storybook [#4261](https://github.com/storybookjs/storybook/pull/4261)
  - React-Native: On-device addons [#4381](https://github.com/storybookjs/storybook/pull/4381)
  - React-Native: On-device addons for notes, knobs, backgrounds [#4327](https://github.com/storybookjs/storybook/pull/4327)
- UI
  - Storybook UI theming [#3628](https://github.com/storybookjs/storybook/pull/3628)
- Core
  - Story parameters [#2679](https://github.com/storybookjs/storybook/pull/2679)
  - Generic addon decorators [#3555](https://github.com/storybookjs/storybook/pull/3555)
  - Support css-modules [#4405](https://github.com/storybookjs/storybook/pull/4405)
  - start-storybook: open browser tab on first compilation [#4149](https://github.com/storybookjs/storybook/pull/4149)
  - start-storybook: suggest an alternative when the port is occupied [#4146](https://github.com/storybookjs/storybook/pull/4146)
  - CLI-less Node api [#4344](https://github.com/storybookjs/storybook/pull/4344)
  - Rename CLI to sb [#4345](https://github.com/storybookjs/storybook/pull/4345)

There are hundreds of more fixes, features, and tweaks in the 4.0 release. See changelogs for `4.0.0-rc.*` and `4.0.0-alpha.*` for details; check out our [migration guide](https://medium.com/storybookjs/migrating-to-storybook-4-c65b19a03d2c) for a walkthrough of how to upgrade or the
[migration docs](https://github.com/storybookjs/storybook/blob/master/MIGRATION.md#from-version-34x-to-40x) for an enumeration of breaking changes.

## 4.0.0-rc.6

2018-October-25

#### Dependency Upgrades

- Upgrade react-komposer to 2.0.5 [#4547](https://github.com/storybookjs/storybook/pull/4547)

## 4.0.0-rc.5

2018-October-25

#### Maintenance

- Fix issue with `sb init` on the Vue CLI [#4535](https://github.com/storybookjs/storybook/pull/4535)

## 4.0.0-rc.4

2018-October-25

#### Features

- Ember: update to not require any manual setup [#4544](https://github.com/storybookjs/storybook/pull/4544)

#### Bug Fixes

- React: add mini-css-extract-plugin to app/react dependencies [#4534](https://github.com/storybookjs/storybook/pull/4534)

#### Maintenance

- Add angular@7 cli tests [#4524](https://github.com/storybookjs/storybook/pull/4524)
- Fix the node-logger version in app/react [#4539](https://github.com/storybookjs/storybook/pull/4539)

#### Dependency Upgrades

- Bump danger from 4.4.8 to 6.0.2 [#4538](https://github.com/storybookjs/storybook/pull/4538)
- Bump react-test-renderer from 16.5.2 to 16.6.0 [#4536](https://github.com/storybookjs/storybook/pull/4536)
- Bump fuse.js from 3.2.1 to 3.3.0 [#4537](https://github.com/storybookjs/storybook/pull/4537)
- Bump riot from 3.12.0 to 3.13.0 [#4511](https://github.com/storybookjs/storybook/pull/4511)

## 4.0.0-rc.3

2018-October-23

#### Bug Fixes

- Fix knobs select to support rich values [#4522](https://github.com/storybookjs/storybook/pull/4522)
- Turn off spell check in story filter [#4472](https://github.com/storybookjs/storybook/pull/4472)-

#### Maintenance

- ADD timeout to update check [#4530](https://github.com/storybookjs/storybook/pull/4530)
- REMOVE emotion from demo components to make backwards compatibility easier && ADD demo components to official example [#4527](https://github.com/storybookjs/storybook/pull/4527)
- Exclude story files from angular app build [#4485](https://github.com/storybookjs/storybook/pull/4485)

## 4.0.0-rc.2

2018-October-22

#### Features

- Support css-modules [#4405](https://github.com/storybookjs/storybook/pull/4405)
- Angular: Support sass files [#4343](https://github.com/storybookjs/storybook/pull/4343)
- Support "mjs" extensions [#4466](https://github.com/storybookjs/storybook/pull/4466)
- Allow presets to be async [#4450](https://github.com/storybookjs/storybook/pull/4450)

#### Bug Fixes

- Addon-Jest: undefined file extension [#4452](https://github.com/storybookjs/storybook/pull/4452)

#### Maintenance

- Override babelrc for the node related code [#4451](https://github.com/storybookjs/storybook/pull/4451)
- Use cross-env in official example [#4474](https://github.com/storybookjs/storybook/pull/4474)

#### Dependency Upgrades

- Bump copy-webpack-plugin from 4.5.3 to 4.5.4 [#4492](https://github.com/storybookjs/storybook/pull/4492)
- Bump jest-image-snapshot from 2.5.0 to 2.6.0 [#4494](https://github.com/storybookjs/storybook/pull/4494)
- Bump webpack from 4.20.2 to 4.21.0 [#4477](https://github.com/storybookjs/storybook/pull/4477)

## 4.0.0-rc.1

2018-October-18

#### Bug Fixes

- Angular: expose webpackFinal extension [#4431](https://github.com/storybookjs/storybook/pull/4431)
- Addon-Knobs: fix ints as values [#4465](https://github.com/storybookjs/storybook/pull/4465)

#### Maintenance

- Add Angular 6 fixture to the sb-cli tests [#4464](https://github.com/storybookjs/storybook/pull/4464)

#### Dependency Upgrades

- Require React 16.3 as a peer dependency [#4458](https://github.com/storybookjs/storybook/pull/4458)
- Bump @ember/test-helpers from 0.7.26 to 0.7.27 [#4455](https://github.com/storybookjs/storybook/pull/4455)
- Bump eslint-plugin-jest from 21.25.0 to 21.25.1 [#4456](https://github.com/storybookjs/storybook/pull/4456)
- Bump autoprefixer from 9.2.0 to 9.2.1 [#4457](https://github.com/storybookjs/storybook/pull/4457)
- Bump @types/node from 10.11.7 to 10.12.0 [#4434](https://github.com/storybookjs/storybook/pull/4434)
- Bump ember-cli-inject-live-reload from 2.0.0 to 2.0.1 [#4435](https://github.com/storybookjs/storybook/pull/4435)
- Bump gatsby-plugin-sharp from 1.6.48 to 2.0.7 in /docs [#4438](https://github.com/storybookjs/storybook/pull/4438)
- Bump marked from 0.4.0 to 0.5.1 in /docs [#4437](https://github.com/storybookjs/storybook/pull/4437)
- Bump highlight.js from 9.12.0 to 9.13.0 in /docs [#4440](https://github.com/storybookjs/storybook/pull/4440)

## 4.0.0-rc.0

2018-October-15

#### Features

- Addon: google analytics [#4138](https://github.com/storybookjs/storybook/pull/4138)

#### Bug Fixes

- Improve environment var loading [#4413](https://github.com/storybookjs/storybook/pull/4413)

#### Maintenance

- Skip preflight check when starting cra kitchen sink [#4408](https://github.com/storybookjs/storybook/pull/4408)
- Change crna-kitchen-sink path and Some CI maintenance [#4409](https://github.com/storybookjs/storybook/pull/4409)
- Create ember entry point to official storybook [#4426](https://github.com/storybookjs/storybook/pull/4426)

#### Dependency Upgrades

- Bump ember-cli from 3.4.3 to 3.5.0 [#4429](https://github.com/storybookjs/storybook/pull/4429)
- Bump react-native-modal-selector from 0.0.27 to 0.0.29 [#4428](https://github.com/storybookjs/storybook/pull/4428)
- Bump ember-cli-inject-live-reload from 1.8.2 to 1.10.1 [#4423](https://github.com/storybookjs/storybook/pull/4423)
- Bump html-webpack-plugin from 4.0.0-beta.1 to 4.0.0-beta.2 [#4421](https://github.com/storybookjs/storybook/pull/4421)
- Bump react-scripts from 2.0.4 to 2.0.5 [#4420](https://github.com/storybookjs/storybook/pull/4420)
- Bump autoprefixer from 9.1.5 to 9.2.0 [#4417](https://github.com/storybookjs/storybook/pull/4417)
- Bump redux from 4.0.0 to 4.0.1 [#4419](https://github.com/storybookjs/storybook/pull/4419)
- Bump ts-loader from 5.2.1 to 5.2.2 [#4418](https://github.com/storybookjs/storybook/pull/4418)
- Bump eslint-plugin-jest from 21.24.1 to 21.25.0 [#4424](https://github.com/storybookjs/storybook/pull/4424)
- Bump lazy-universal-dotenv from 1.9.1 to 2.0.0 [#4422](https://github.com/storybookjs/storybook/pull/4422)

## 4.0.0-alpha.25

2018-October-13

#### Breaking Changes

- CLI: Rename CLI to sb [#4345](https://github.com/storybookjs/storybook/pull/4345)
- React Native: Remove the packager from storybook [#4261](https://github.com/storybookjs/storybook/pull/4261)
- React-Native: On-device addons [#4381](https://github.com/storybookjs/storybook/pull/4381)

#### Features

- Storybook version update check [#4334](https://github.com/storybookjs/storybook/pull/4334)
- CLI: specify project type interactively or as option [#4184](https://github.com/storybookjs/storybook/pull/4184)
- Addon-Jest: expand supported file types [#3983](https://github.com/storybookjs/storybook/pull/3983)
- CLI-less Node api [#4344](https://github.com/storybookjs/storybook/pull/4344)
- React-Native: Updated channel to support async option [#4326](https://github.com/storybookjs/storybook/pull/4326)
- React-Native: On-device addons for notes, knobs, backgrounds [#4327](https://github.com/storybookjs/storybook/pull/4327)
- Angular: Add support for "baseUrl" and "paths" from angular-cli [#4162](https://github.com/storybookjs/storybook/pull/4162)
- Angular: Added basePath support [#4323](https://github.com/storybookjs/storybook/pull/4323)
- Vue: support string-only component [#4285](https://github.com/storybookjs/storybook/pull/4285)
- Storyshots: Add snapshot serializer option [#4283](https://github.com/storybookjs/storybook/pull/4283)
- Storyshots: Support story-specific options as function [#4282](https://github.com/storybookjs/storybook/pull/4282)

#### Bug Fixes

- React-native: Remove deprecated attempt to load default addons [#4308](https://github.com/storybookjs/storybook/pull/4308)
- Fix panel layouts [#4304](https://github.com/storybookjs/storybook/pull/4304)
- [logging] better error logging for when opn fails to opn [#4348](https://github.com/storybookjs/storybook/pull/4348)
- Fix iPhone viewport dimensions [#4293](https://github.com/storybookjs/storybook/pull/4293)
- Fix Array.js value to string [#4336](https://github.com/storybookjs/storybook/pull/4336)
- Fixes to cli ember support [#4318](https://github.com/storybookjs/storybook/pull/4318)
- Update `addon-jest` to new propType [#4252](https://github.com/storybookjs/storybook/pull/4252)

#### Maintenance

- Remove CRNA fixture [#4346](https://github.com/storybookjs/storybook/pull/4346)
- Try to fix cli tests [#4338](https://github.com/storybookjs/storybook/pull/4338)
- Updated installation for Angular [#4302](https://github.com/storybookjs/storybook/pull/4302)
- Fix the broken lint [#4310](https://github.com/storybookjs/storybook/pull/4310)
- [ember] add dependencies to root application [#4309](https://github.com/storybookjs/storybook/pull/4309)

#### Dependency Upgrades

- Knobs/replace datepicker [#4380](https://github.com/storybookjs/storybook/pull/4380)
- Re-generate lockfiles [#4404](https://github.com/storybookjs/storybook/pull/4404)
- Run `yarn upgrade-interactive --latest` in root and docs [#4403](https://github.com/storybookjs/storybook/pull/4403)
- chore(deps): #4267 upgrade lodash to latest [#4284](https://github.com/storybookjs/storybook/pull/4284)
- Bump express from 4.16.3 to 4.16.4 [#4370](https://github.com/storybookjs/storybook/pull/4370)
- Bump @angular/cli from 6.2.4 to 6.2.5 [#4390](https://github.com/storybookjs/storybook/pull/4390)
- CHANGE back to use html-webpack-plugin to keep compatibility with plugins that depend on it [#4375](https://github.com/storybookjs/storybook/pull/4375)
- Bump danger from 4.4.6 to 4.4.7 [#4365](https://github.com/storybookjs/storybook/pull/4365)
- Bump @storybook/react from 3.4.8 to 3.4.11 in /docs [#4354](https://github.com/storybookjs/storybook/pull/4354)
- Bump sitemap from 1.13.0 to 2.0.1 in /docs [#4356](https://github.com/storybookjs/storybook/pull/4356)
- Bump husky from 1.1.1 to 1.1.2 [#4358](https://github.com/storybookjs/storybook/pull/4358)
- Tech/upgrades 5 [#4347](https://github.com/storybookjs/storybook/pull/4347)

## 4.0.0-alpha.24

2018-October-04

#### Features

- Storybook for Ember [#4237](https://github.com/storybookjs/storybook/pull/4237)
- Riot: support the tagConstructor option [#4258](https://github.com/storybookjs/storybook/pull/4258)
- Presets: Add "addons" and "config" to preset extensions [#4240](https://github.com/storybookjs/storybook/pull/4240)

#### Bug Fixes

- Webpack: Fix broken SVGs [#4260](https://github.com/storybookjs/storybook/pull/4260)
- Babel/minify: use `builtIns: false` [#4262](https://github.com/storybookjs/storybook/pull/4262)
- Addon-Notes: Fix how markdownOptions are passed to marked [#4242](https://github.com/storybookjs/storybook/pull/4242)
- Addon-Knobs: Fix broken colorpicker [#4222](https://github.com/storybookjs/storybook/pull/4222)

## 4.0.0-alpha.23

2018-September-25

#### Features

- Angular build time optimization [#4118](https://github.com/storybookjs/storybook/pull/4118)
- Pass Jest done callback to testMethod [#3853](https://github.com/storybookjs/storybook/pull/3853)

#### Bug Fixes

- Fix getstorybook CLI [#4213](https://github.com/storybookjs/storybook/pull/4213)
- FIX regression devtool, in case of cross domain parent, window.parent might throw [#4199](https://github.com/storybookjs/storybook/pull/4199)

#### Dependency Upgrades

- Upgrade deps dealing with license issues [#4228](https://github.com/storybookjs/storybook/pull/4228)
- Use @emotion/snapshot-serializer [#4206](https://github.com/storybookjs/storybook/pull/4206)

## 4.0.0-alpha.22

2018-September-19

#### Features

- Storyshots: story params support [#4176](https://github.com/storybookjs/storybook/pull/4176)
- Addon-options: story params support [#3965](https://github.com/storybookjs/storybook/pull/3965)
- Presets - API generalization [#4173](https://github.com/storybookjs/storybook/pull/4173)
- start-storybook: open browser tab on first compilation [#4149](https://github.com/storybookjs/storybook/pull/4149)
- start-storybook: suggest an alternative when the port is occupied [#4146](https://github.com/storybookjs/storybook/pull/4146)
- Merge webpack optimisation configs [#4121](https://github.com/storybookjs/storybook/pull/4121)

#### Bug Fixes

- Angular cli - fix prebuild [#4187](https://github.com/storybookjs/storybook/pull/4187)
- Presets - add babelDefault extension [#4155](https://github.com/storybookjs/storybook/pull/4155)
- CHANGE index.html.ejs to use files over chunks && UPGRADE generate-page-webpack-plugin [#4134](https://github.com/storybookjs/storybook/pull/4134)
- Allow replacing of stories (with warning rather than error) [#4061](https://github.com/storybookjs/storybook/pull/4061)

#### Maintenance

- CLI refactor [#4168](https://github.com/storybookjs/storybook/pull/4168)
- Fix linter warnings [#4172](https://github.com/storybookjs/storybook/pull/4172)
- Remove gh-pages deploy in favor of netlify [#4128](https://github.com/storybookjs/storybook/pull/4128)

#### Dependency Upgrades

- [core]: widen `airbnb-js-shims` dep range [#4189](https://github.com/storybookjs/storybook/pull/4189)
- Updating react-split-pane to version 0.1.84 [#4153](https://github.com/storybookjs/storybook/pull/4153)
- Riot tag loader missing in cli [#4122](https://github.com/storybookjs/storybook/pull/4122)

## 3.4.11

2018-September-17

#### Dependencies

- Allow v1 or v2 in airbnb-js-shims [#4190](https://github.com/storybookjs/storybook/pull/4190)

## 4.0.0-alpha.21

2018-September-07

#### Features

- Presets support [#4027](https://github.com/storybookjs/storybook/pull/4027)

#### Bug Fixes

- CLI: Add missing @babel/core dependency [#4117](https://github.com/storybookjs/storybook/pull/4117)
- Addon-Info: Fix duplicated keys in PropTypes table [#4095](https://github.com/storybookjs/storybook/pull/4095)

#### Dependency Upgrades

- Moved to lerna 3 [#4067](https://github.com/storybookjs/storybook/pull/4067)

#### Other

- \[WIP\] Refactor core and frameworks to work with presets [#4043](https://github.com/storybookjs/storybook/pull/4043)
- \[WIP\] presets - merge default babel configs [#4107](https://github.com/storybookjs/storybook/pull/4107)

## 4.0.0-alpha.20

2018-August-31

#### Breaking Changes

- Use `babelrc: false` only for custom config in `.storybook` directory [#4077](https://github.com/storybookjs/storybook/pull/4077)

#### Features

- Storybook for Riot [#4070](https://github.com/storybookjs/storybook/pull/4070)
- Backgrounds addon: Allow setting background via name [#4081](https://github.com/storybookjs/storybook/pull/4081)
- Storysource addon: injectDecorator option custom stories [#4012](https://github.com/storybookjs/storybook/pull/4012)

#### Bug Fixes

- Disabled import for TabWrapper [#4100](https://github.com/storybookjs/storybook/pull/4100)
- Angular cli with projects assets: root dir not correctly used [#4058](https://github.com/storybookjs/storybook/pull/4058)

#### Maintenance

- Do not stale "good first issue" [#4092](https://github.com/storybookjs/storybook/pull/4092)
- Remove danger from circleci because it's not working for forked PRs [#4080](https://github.com/storybookjs/storybook/pull/4080)

#### Dependency Upgrades

- UPGRADE packages [#3996](https://github.com/storybookjs/storybook/pull/3996)

## 4.0.0-alpha.19

2018-August-31

Not published to NPM

## 4.0.0-alpha.18

2018-August-25

#### Bug Fixes

- Add missing `@babel/plugin-proposal-class-properties` dependency [#4076](https://github.com/storybookjs/storybook/pull/4076)
- Don't display wrong warning when loading ".js" or ".json" [#4060](https://github.com/storybookjs/storybook/pull/4060)
- Fix autodetection of used components in info addon [#4004](https://github.com/storybookjs/storybook/pull/4004)

#### Maintenance

- Faster CircleCI [#4068](https://github.com/storybookjs/storybook/pull/4068)

## 4.0.0-alpha.17

2018-August-24

#### Breaking Changes

- Babel 7 [#3746](https://github.com/storybookjs/storybook/pull/3746)

#### Features

- Emit messages when stories fail to render [#3967](https://github.com/storybookjs/storybook/pull/3967)
- Storybook for Svelte [#3770](https://github.com/storybookjs/storybook/pull/3770)
- Allow extending extensions without a full control mode [#3976](https://github.com/storybookjs/storybook/pull/3976)

#### Bug Fixes

- Storyshots puppeteer images do not match [#4045](https://github.com/storybookjs/storybook/pull/4045)
- Storyshots puppeteer images do not match [#4037](https://github.com/storybookjs/storybook/pull/4037)
- Bring .jsx back [#4024](https://github.com/storybookjs/storybook/pull/4024)
- Fix custom webpack config warnings [#4009](https://github.com/storybookjs/storybook/pull/4009)
- sorting by kind and nested stories [#3963](https://github.com/storybookjs/storybook/pull/3963)

#### Maintenance

- Temp revert the 36a2676 [#4062](https://github.com/storybookjs/storybook/pull/4062)
- Remove deprecation of --db-path and --enable-db [#4030](https://github.com/storybookjs/storybook/pull/4030)
- Remove git info extraction [#4031](https://github.com/storybookjs/storybook/pull/4031)
- Fixed homepage links \[skip ci\] [#4008](https://github.com/storybookjs/storybook/pull/4008)
- CHANGE html-webpack-plugin for generate-page-plugin [#3919](https://github.com/storybookjs/storybook/pull/3919)

## 4.0.0-alpha.16

2018-August-06

#### Features

- Make addon-options work with story parameters [#3958](https://github.com/storybookjs/storybook/pull/3958)

#### Bug Fixes

- \[BUG FIX\] Use fixed version of react-dev-utils [#3959](https://github.com/storybookjs/storybook/pull/3959)
- Inline emotion css calls that require theme to avoid using state [#3950](https://github.com/storybookjs/storybook/pull/3950)

#### Dependency Upgrades

- Upgrade even more dependencies [#3964](https://github.com/storybookjs/storybook/pull/3964)
- More dependency upgrades (major version bumps) [#3957](https://github.com/storybookjs/storybook/pull/3957)
- UPGRADE all minor dependencies [#3954](https://github.com/storybookjs/storybook/pull/3954)

## 4.0.0-alpha.15

2018-August-03

#### Breaking Changes

- dependencies(vue): Update vue-loader to 15.x.x [#3911](https://github.com/storybookjs/storybook/pull/3911)

#### Features

- Horizontal display for addon-knobs radios UI [#3922](https://github.com/storybookjs/storybook/pull/3922)
- Add customizePage method to imageSnapshot [#3930](https://github.com/storybookjs/storybook/pull/3930)
- Add additional device options to addon-viewport [#3918](https://github.com/storybookjs/storybook/pull/3918)
- Support different extensions for "config" and "addons" files [#3913](https://github.com/storybookjs/storybook/pull/3913)
- Add radio buttons knob type #3872 [#3894](https://github.com/storybookjs/storybook/pull/3894)
- Added arrow to a11y addon HeaderBar [#3788](https://github.com/storybookjs/storybook/pull/3788)
- Fix addons panel when using preact [#3882](https://github.com/storybookjs/storybook/pull/3882)

#### Bug Fixes

- Fix typo in addon-viewport [#3942](https://github.com/storybookjs/storybook/pull/3942)
- Fix knobs for React < 16.3 [#3866](https://github.com/storybookjs/storybook/pull/3866)

#### Maintenance

- Improve BettercodeHub [#3941](https://github.com/storybookjs/storybook/pull/3941)
- REFACTOR layout and REMOVE usplit component [#3914](https://github.com/storybookjs/storybook/pull/3914)
- Group deprecated stories [#3846](https://github.com/storybookjs/storybook/pull/3846)
- MOVE ui into it's own group [#3884](https://github.com/storybookjs/storybook/pull/3884)

#### Dependency Upgrades

- Use react-dev-utils@next [#3852](https://github.com/storybookjs/storybook/pull/3852)

## 3.4.10

2018-August-03

NOTE: `3.4.9` publish failed

#### Bug Fixes

- addons-jest: bug with the jest parameter [#3923](https://github.com/storybookjs/storybook/pull/3923)
- addon-info: fix copy button styling [#3896](https://github.com/storybookjs/storybook/pull/3896)

## 4.0.0-alpha.14

2018-July-11

#### Bug Fixes

- Upgrade universal-dotenv to fix core-js dependency [#3874](https://github.com/storybookjs/storybook/pull/3874)

## 4.0.0-alpha.13

2018-July-09

#### Features

- Refactor addon-jest to use a parameter-based pattern [#3678](https://github.com/storybookjs/storybook/pull/3678)

#### Bug Fixes

- Upgrade universal-dotenv to fix babel-runtime [#3863](https://github.com/storybookjs/storybook/pull/3863)

#### Maintenance

- Added a test for parameter combination [#3844](https://github.com/storybookjs/storybook/pull/3844)

## 4.0.0-alpha.12

2018-July-03

#### Bug Fixes

- Fix non-polyfilled themed UI components [#3829](https://github.com/storybookjs/storybook/pull/3829)

## 4.0.0-alpha.11

2018-July-02

#### Features

- Storybook UI theming [#3628](https://github.com/storybookjs/storybook/pull/3628)
- Replaced 'dotenv-webpack' with 'universal-dotenv' to support multiple dot env files (like CRA) [#3744](https://github.com/storybookjs/storybook/pull/3744)
- Support other type of webpack configs [#3785](https://github.com/storybookjs/storybook/pull/3785)

#### Bug Fixes

- Marko: fix welcome component [#3796](https://github.com/storybookjs/storybook/pull/3796)
- Addon-a11y: Run analysis on demand [#3690](https://github.com/storybookjs/storybook/pull/3690)

## 4.0.0-alpha.10

2018-June-21

#### Breaking Changes

- Storyshots - Replace require_context.js with babel-plugin-require-context-hook [#3757](https://github.com/storybookjs/storybook/pull/3757)
- Storyshots advanced config options [#3747](https://github.com/storybookjs/storybook/pull/3747)
- Storyshots addon refactoring [#3745](https://github.com/storybookjs/storybook/pull/3745)
- Extract imageSnapshots to a separate package [#3742](https://github.com/storybookjs/storybook/pull/3742)

#### Bug Fixes

- Addon-knobs: Allow number knob to be empty [#3775](https://github.com/storybookjs/storybook/pull/3775)
- Improvements to Info Docgen parsing [#3772](https://github.com/storybookjs/storybook/pull/3772)
- Angular-cli 6 assets as a glob-object compatibility fix [#3751](https://github.com/storybookjs/storybook/pull/3751)

#### Maintenance

- Try to fix linter issues [#3748](https://github.com/storybookjs/storybook/pull/3748)

## 3.4.8

2018-June-21

#### Bug Fixes

- Fix centered addon for IE11 [#3735](https://github.com/storybookjs/storybook/pull/3735)
- Display functions as variables not invocations [#3761](https://github.com/storybookjs/storybook/pull/3761)

## 4.0.0-alpha.9

2018-June-10

#### Breaking Changes

- storyshots: Remove deprecated props from storyshots [#3717](https://github.com/storybookjs/storybook/pull/3717)
- angular: angular-cli 6 (with webpack 4) compatibility [#3491](https://github.com/storybookjs/storybook/pull/3491)

#### Features

- addon-info: Use parameters for info addon [#3697](https://github.com/storybookjs/storybook/pull/3697)
- addon-backgrounds: Use parameters for backgrounds addon [#3676](https://github.com/storybookjs/storybook/pull/3676)
- storyshots: add renderWithOptions to @addons/storyshots [#3479](https://github.com/storybookjs/storybook/pull/3479)
- addon-knobs: Make withKnobs accept story parameters [#3675](https://github.com/storybookjs/storybook/pull/3675)

#### Bug Fixes

- storysource: Add default parser option. Support prettier v1.13.0 [#3660](https://github.com/storybookjs/storybook/pull/3660)
- react-native: using disableWebsockets instead of useWebsockets [#3686](https://github.com/storybookjs/storybook/pull/3686)
- Updates storybook-start.js to use child_process instead of shelljs [#3527](https://github.com/storybookjs/storybook/pull/3527)
- Force render on knob button click and update example [#3650](https://github.com/storybookjs/storybook/pull/3650)

#### Maintenance

- Refactor webpack and babel configs to core [#3655](https://github.com/storybookjs/storybook/pull/3655)
- Remove status bar hiding [#3634](https://github.com/storybookjs/storybook/pull/3634)
- React Native Refactored list view [#3635](https://github.com/storybookjs/storybook/pull/3635)
- Using only single channel for react native [#3636](https://github.com/storybookjs/storybook/pull/3636)

#### Dependency Upgrades

<details>
<summary>
88 Upgrades
</summary>

- Update gatsby-plugin-sharp in /docs from "1.6.46" to "1.6.47"
- Update gatsby-remark-images in /docs from "1.5.65" to "1.5.66"
- Update gatsby-transformer-remark in /docs from "1.7.41" to "1.7.42"
- Update react-router in /docs from "4.2.0" to "4.3.1"
- Update danger in / from "3.7.14" to "3.7.15"
- Update eslint-plugin-react in / from "7.8.2" to "7.9.1"
- Update eslint-teamcity in / from "2.0.0" to "2.0.1"
- Update lint-staged in / from "7.1.2" to "7.1.3"
- Update prettier in / from "1.13.2" to "1.13.4"
- Update remark-lint in / from "6.0.1" to "6.0.2"
- Update remark-preset-lint-recommended in / from "3.0.1" to "3.0.2"
- Update typescript in / from "2.8.3" to "2.9.1"
- Update airbnb-js-shims in lib/core from "1.5.2" to "1.6.0"
- Update autoprefixer in lib/core from "8.5.1" to "8.6.0"
- Update babel-plugin-macros in lib/core from "2.2.1" to "2.2.2"
- Update dotenv-webpack in lib/core from "1.5.5" to "1.5.6"
- Update webpack in lib/core from "4.10.1" to "4.10.2"
- Update sass-loader in app/angular from "7.0.1" to "7.0.2"
- Update ts-loader in app/angular from "4.3.0" to "4.3.1"
- Update axe-core in addons/a11y from "3.0.2" to "3.0.3"
- Update moment in addons/knobs from "2.22.1" to "2.22.2"
- Update prettier in addons/storysource from "1.13.3" to "1.13.4"
- Update react-modal in lib/ui from "3.4.4" to "3.4.5"
- Update babel-plugin-macros in app/react-native from "2.2.1" to "2.2.2"
- Update dotenv-webpack in app/react-native from "1.5.5" to "1.5.6"
- Update webpack in app/react-native from "4.10.1" to "4.10.2"
- Update prettier in examples/marko-cli from "1.13.2" to "1.13.4"
- Update webpack in examples/marko-cli from "4.10.1" to "4.10.2"
- Update webpack in examples/polymer-cli from "4.10.1" to "4.10.2"
- Update @types/jasmine in examples/angular-cli from "2.8.7" to "2.8.8"
- Update @types/node in examples/angular-cli from "9.6.18" to "9.6.20"
- Update ts-node in examples/angular-cli from "6.0.5" to "6.1.0"
- Update typescript in examples/angular-cli from "2.8.3" to "2.9.1"
- Update webpack in examples/cra-kitchen-sink from "4.10.1" to "4.10.2"
- Update webpack in examples/mithril-kitchen-sink from "4.10.1" to "4.10.2"
- Update webpack in examples/vue-kitchen-sink from "4.10.1" to "4.10.2"
- Update webpack in examgatsby-plugin-sharp in /docs from "1.6.44" to "1.6.46"
- Update gatsby-remark-copy-linked-files in /docs from "1.5.32" to "1.5.35"
- Update gatsby-remark-images in /docs from "1.5.63" to "1.5.65"
- Update gatsby-source-filesystem in /docs from "1.5.36" to "1.5.38"
- Update gatsby in /docs from "1.9.261" to "1.9.269"
- Update gh-pages in /docs from "1.1.0" to "1.2.0"
- Update @storybook/addon-actions in /docs from "3.4.5" to "3.4.6"
- Update @storybook/addon-links in /docs from "3.4.5" to "3.4.6"
- Update @storybook/addons in /docs from "3.4.5" to "3.4.6"
- Update @storybook/react in /docs from "3.4.5" to "3.4.6"
- Update cross-env in / from "5.1.5" to "5.1.6"
- Update eslint-plugin-jest in / from "21.15.1" to "21.17.0"
- Update jest-enzyme in / from "6.0.0" to "6.0.1"
- Update jest-image-snapshot in / from "2.4.1" to "2.4.2"
- Update prettier in / from "1.12.1" to "1.13.0"
- Update react in / from "16.3.2" to "16.4.0"
- Update react-dom in / from "16.3.2" to "16.4.0"
- Update react-test-renderer in / from "16.3.2" to "16.4.0"
- Update airbnb-js-shims in lib/core from "1.5.1" to "1.5.2"
- Update autoprefixer in lib/core from "8.5.0" to "8.5.1"
- Update webpack in lib/core from "4.8.3" to "4.9.2"
- Update core-js in app/angular from "2.5.6" to "2.5.7"
- Update common-tags in app/html from "1.7.2" to "1.8.0"
- Update common-tags in app/marko from "1.7.2" to "1.8.0"
- Update common-tags in app/mithril from "1.7.2" to "1.8.0"
- Update common-tags in app/polymer from "1.7.2" to "1.8.0"
- Update common-tags in app/react from "1.7.2" to "1.8.0"
- Update common-tags in app/vue from "1.7.2" to "1.8.0"
- Update vue-loader in app/vue from "14.2.2" to "14.2.3"
- Update core-js in addons/info from "2.5.6" to "2.5.7"
- Update react-test-renderer in addons/info from "16.3.2" to "16.4.0"
- Update prettier in addons/storysource from "1.12.1" to "1.13.0"
- Update events in lib/ui from "2.0.0" to "2.1.0"
- Update jest-image-snapshot in addons/storyshots from "2.4.1" to "2.4.2"
- Update react in addons/storyshots from "16.3.2" to "16.4.0"
- Update webpack in app/react-native from "4.8.3" to "4.9.2"
- Update marko in examples/marko-cli from "4.9.7" to "4.10.0"
- Update prettier in examples/marko-cli from "1.12.1" to "1.13.0"
- Update webpack in examples/marko-cli from "4.8.3" to "4.9.2"
- Update webpack in examples/polymer-cli from "4.8.3" to "4.9.2"
- Update core-js in examples/angular-cli from "2.5.6" to "2.5.7"
- Update rxjs in examples/angular-cli from "5.5.10" to "5.5.11"
- Update ts-node in examples/angular-cli from "6.0.3" to "6.0.5"
- Update react in examples/cra-kitchen-sink from "16.3.2" to "16.4.0"
- Update react-dom in examples/cra-kitchen-sink from "16.3.2" to "16.4.0"
- Update webpack in examples/cra-kitchen-sink from "4.8.3" to "4.9.2"
- Update webpack in examples/mithril-kitchen-sink from "4.8.3" to "4.9.2"
- Update cross-env in examples/vue-kitchen-sink from "5.1.5" to "5.1.6"
- Update vue-loader in examples/vue-kitchen-sink from "14.2.2" to "14.2.3"
- Update webpack in examples/vue-kitchen-sink from "4.8.3" to "4.9.2"
- Update react in examples/official-storybook from "16.3.2" to "16.4.0"
- Update react-dom in examples/official-storybook from "16.3.2" to "16.4.0"
- Update webpack in examples/official-storybook from "4.8.3" to "4.9.2"

</details>

## 3.4.7

2018-June-10

#### Bug Fixes

- Remove linebreaks in notes text when they are html elements [#3731](https://github.com/storybookjs/storybook/pull/3731)

## 4.0.0-alpha.8

2018-May-26

#### Breaking Changes

- Removed deprecated react-native built-in addons [#3631](https://github.com/storybookjs/storybook/pull/3631)
- Remove deprecated addWithInfo [#3630](https://github.com/storybookjs/storybook/pull/3630)

#### Bug Fixes

- Fix the output of the boolean knob [#3612](https://github.com/storybookjs/storybook/pull/3612)
- Don't scroll story on knob change [#3639](https://github.com/storybookjs/storybook/pull/3639)
- Few fixed related to marko support [#3609](https://github.com/storybookjs/storybook/pull/3609)

#### Documentation

- Angular background addon example [#3653](https://github.com/storybookjs/storybook/pull/3653)
- fix url as per issue #3565 [#3619](https://github.com/storybookjs/storybook/pull/3619)
- Document parameters for start command for RN [#3606](https://github.com/storybookjs/storybook/pull/3606)
- Update README.md [#3608](https://github.com/storybookjs/storybook/pull/3608)

#### Maintenance

- Build static storybooks utility script [#3648](https://github.com/storybookjs/storybook/pull/3648)
- Revert "Replace decorate with decorateAction" [#3600](https://github.com/storybookjs/storybook/pull/3600)
- addon-viewport: Use the new parameterized way of decorators [#3610](https://github.com/storybookjs/storybook/pull/3610)
- Make all licenses consistent to MIT [#3611](https://github.com/storybookjs/storybook/pull/3611)
- Theme-ability progress [#3572](https://github.com/storybookjs/storybook/pull/3572)
- fix(knobs): cancel debounced onChange on unmounting [#3607](https://github.com/storybookjs/storybook/pull/3607)

#### Dependency Upgrades

<details>
<summary>
36 Upgrades
</summary>

- Update @angular/common from 5.2.10 to 5.2.11 in /
- Update @angular/compiler from 5.2.10 to 5.2.11 in /
- Update @angular/core from 5.2.10 to 5.2.11 in /
- Update @angular/forms from 5.2.10 to 5.2.11 in /
- Update @angular/platform-browser from 5.2.10 to 5.2.11 in /
- Update @angular/platform-browser-dynamic from 5.2.10 to 5.2.11 in /
- Update danger from 3.7.0 to 3.7.14 in /
- Update eslint-plugin-import from 2.11.0 to 2.12.0 in /
- Update jest from 22.4.3 to 22.4.4 in /
- Update jest-cli from 22.4.3 to 22.4.4 in /
- Update jest-config from 22.4.3 to 22.4.4 in /
- Update jest-jasmine2 from 22.4.3 to 22.4.4 in /
- Update lint-staged from 7.1.0 to 7.1.2 in /
- Update marked from 0.3.19 to 0.4.0 in addons/notes
- Update tslint-config-prettier from 1.12.0 to 1.13.0 in /
- Update airbnb-js-shims from 1.4.1 to 1.5.1 in app/angular
- Update airbnb-js-shims from 1.4.1 to 1.5.1 in app/html
- Update airbnb-js-shims from 1.4.1 to 1.5.1 in app/mithril
- Update babel-preset-minify from 0.4.1 to 0.4.3 in app/polymer
- Update airbnb-js-shims from 1.4.1 to 1.5.1 in app/polymer
- Update airbnb-js-shims from 1.4.1 to 1.5.1 in app/react
- Update airbnb-js-shims from 1.4.1 to 1.5.1 in app/vue
- Update enzyme-to-json from 3.3.3 to 3.3.4 in addons/storyshots
- Update airbnb-js-shims from 1.4.1 to 1.5.1 in app/marko
- Update ws from 5.1.1 to 5.2.0 in app/react-native
- Update @angular/common from 5.2.10 to 5.2.11 in examples/angular-cli
- Update @angular/compiler from 5.2.10 to 5.2.11 in examples/angular-cli
- Update @angular/core from 5.2.10 to 5.2.11 in examples/angular-cli
- Update @angular/forms from 5.2.10 to 5.2.11 in examples/angular-cli
- Update @angular/platform-browser from 5.2.10 to 5.2.11 in examples/an… …
- Update @angular/platform-browser-dynamic from 5.2.10 to 5.2.11 in exa… …
- Update @angular/compiler-cli from 5.2.10 to 5.2.11 in examples/angula… …
- Update @types/node from 9.6.17 to 9.6.18 in examples/angular-cli
- Update jest from 22.4.3 to 22.4.4 in examples/angular-cli
- Update enzyme-to-json from 3.3.3 to 3.3.4 in examples/cra-kitchen-sink
- Update jest from 22.4.3 to 22.4.4 in examples/html-kitchen-sink
- Update enzyme-to-json from 3.3.3 to 3.3.4 in examples/official-storybook

</details>

## 3.4.6

2018-May-26

#### Features

- Addon-notes: Add classname to the container component to target with styles. [#3617](https://github.com/storybookjs/storybook/pull/3617)

## 4.0.0-alpha.7

2018-May-17

NOTE: As part of the generic addon decorators, we've reversed the order of addon-knob's `select` knob keys/values, which had been called `selectV2` prior to this breaking change.

#### Breaking Changes

- Support webpack4 modules format [#3576](https://github.com/storybookjs/storybook/pull/3576)
- Generic addon decorators [#3555](https://github.com/storybookjs/storybook/pull/3555)

#### Features

- Addon-centered for Angular [#3573](https://github.com/storybookjs/storybook/pull/3573)

#### Maintenance

- Refactor transitional decorator from addon-notes [#3559](https://github.com/storybookjs/storybook/pull/3559)

## 3.4.5

2018-May-17

#### Features

- Addon-info: improve prop options [#3428](https://github.com/storybookjs/storybook/pull/3428)

#### Bug Fixes

- Addon-storysource: Remove nested braces in code block [#3568](https://github.com/storybookjs/storybook/pull/3568)
- Addon-info: Fix double quotes in prop table, add additional examples [#3401](https://github.com/storybookjs/storybook/pull/3401)
- Ignore any unstructured output from the package managers [#3563](https://github.com/storybookjs/storybook/pull/3563)
- Use the --use-npm flag also for version checking [#3535](https://github.com/storybookjs/storybook/pull/3535)

## 4.0.0-alpha.6

2018-May-12

#### Breaking Changes

- Fix the import of external md files [#3472](https://github.com/storybookjs/storybook/pull/3472)

#### Features

- Storybook for Marko [#3504](https://github.com/storybookjs/storybook/pull/3504)
- Storybook addon Jest angular support [#3532](https://github.com/storybookjs/storybook/pull/3532)
- Storybook for HTML snippets [#3475](https://github.com/storybookjs/storybook/pull/3475)
- Feature/config custom chrome executable path [#3518](https://github.com/storybookjs/storybook/pull/3518)
- Channel-postmessage: handle events from the same window [#3519](https://github.com/storybookjs/storybook/pull/3519)
- Force re-render event [#3515](https://github.com/storybookjs/storybook/pull/3515)

#### Bug Fixes

- Ignore any unstructured output from the package managers [#3563](https://github.com/storybookjs/storybook/pull/3563)
- Use the --use-npm flag also for version checking [#3535](https://github.com/storybookjs/storybook/pull/3535)
- Clean out the store if `configure` fails [#3558](https://github.com/storybookjs/storybook/pull/3558)
- Fix render order in preview [#3520](https://github.com/storybookjs/storybook/pull/3520)

## 4.0.0-alpha.5

Broken release (@storybook/core-events had not been published publicly)

## 3.4.4

2018-May-12

#### Bug Fixes

- Ignore home package.json no license field [#3531](https://github.com/storybookjs/storybook/pull/3531)
- fixed Duplicate declaration h [#3409](https://github.com/storybookjs/storybook/pull/3409)
- Storyshots integrity tests options [#3418](https://github.com/storybookjs/storybook/pull/3418)
- Fix dynamic knobs [d2a289e](https://github.com/storybookjs/storybook/commit/d2a289e524c51e794f5f3a34164a69ba3d5409fa)

#### Dependency Upgrades

- jest-image-snapshot version to ^2.4.1 [#3500](https://github.com/storybookjs/storybook/pull/3500)

## 4.0.0-alpha.4

2018-April-27

#### Breaking Changes

- Knobs: add escapeHTML option; use it by default in Vue, Angular, and Polymer [#3473](https://github.com/storybookjs/storybook/pull/3473)

#### Features

- Added `actions` to addon-actions to create multiple actions [#3352](https://github.com/storybookjs/storybook/pull/3352)
- Add excludedPropTypes as an option to info addon [#3468](https://github.com/storybookjs/storybook/pull/3468)
- Addon-background: add Vue support [#3488](https://github.com/storybookjs/storybook/pull/3488)
- Suppress verbose build output [#3487](https://github.com/storybookjs/storybook/pull/3487)
- Provide a configuration option to limit the number of actions logged [#3447](https://github.com/storybookjs/storybook/pull/3447)
- Add IStory interface. [#3482](https://github.com/storybookjs/storybook/pull/3482)
- Add option to clear action logger [#3459](https://github.com/storybookjs/storybook/pull/3459)

#### Bug Fixes

- Fix auto focus of searchbox [#3494](https://github.com/storybookjs/storybook/pull/3494)
- Don't try to access the devtools hook if we are cross-origin [#3485](https://github.com/storybookjs/storybook/pull/3485)
- Improve yarn detection [#3453](https://github.com/storybookjs/storybook/pull/3453)

#### Maintenance

- Refactor error and "no preview" views into core [#3457](https://github.com/storybookjs/storybook/pull/3457)
- Refactor templates into core [#3422](https://github.com/storybookjs/storybook/pull/3422)

#### Dependency Upgrades

<details>
<summary>
15 Upgrades
</summary>

- Upgraded `@storybook/addon-actions` in `/docs` from "3.4.1" to "3.4.2" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgraded `@storybook/addon-links` in `/docs` from "3.4.1" to "3.4.2" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgraded `@storybook/addons` in `/docs` from "3.4.1" to "3.4.2" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgraded `@storybook/react` in `/docs` from "3.4.1" to "3.4.2" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgraded `gatsby-link` in `/docs` from "1.6.40" to "1.6.41" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.42" to "1.6.43" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgraded `gatsby-remark-autolink-headers` in `/docs` from "1.4.16" to "1.4.17" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.31" to "1.5.32" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.61" to "1.5.62" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgraded `gatsby` in `/docs` from "1.9.252" to "1.9.253" [#3478](https://github.com/storybookjs/storybook/pull/3478)
- Upgrade redux to 4.0.0 [#3470](https://github.com/storybookjs/storybook/pull/3470)
- Upgrade sass-loader to 7.0.1 & stop bringing node-sass bin to each user [#3467](https://github.com/storybookjs/storybook/pull/3467)
- Upgrade ts-node to 6.0.0 [#3460](https://github.com/storybookjs/storybook/pull/3460)
- Upgrade to json5@1.0.1 [#3466](https://github.com/storybookjs/storybook/pull/3466)
- Update webpack-hot-middleware to fix HMR [#3463](https://github.com/storybookjs/storybook/pull/3463)

</details>

## 3.4.3

2018-April-27

#### Features

- Suppress verbose build output [#3487](https://github.com/storybookjs/storybook/pull/3487)

#### Bug Fixes

- Improve yarn detection [#3453](https://github.com/storybookjs/storybook/pull/3453)
- Don't try to access the devtools hook if we are cross-origin [#3485](https://github.com/storybookjs/storybook/pull/3485)

#### Dependency Upgrades

- Update webpack-hot-middleware to fix HMR [#3463](https://github.com/storybookjs/storybook/pull/3463)

## 4.0.0-alpha.3

2018-April-17

Also includes changes from 3.4.2

#### Features

- Mobile device view: toggling stories panel with ☰ button [#3337](https://github.com/storybookjs/storybook/pull/3337)
- Add lit-html support [#3433](https://github.com/storybookjs/storybook/pull/3433)
- Addon info prop options [#3428](https://github.com/storybookjs/storybook/pull/3428)
- Use per-story parameters in Notes addon [#3373](https://github.com/storybookjs/storybook/pull/3373)

#### Bug Fixes

- Fixed Duplicate declaration h [#3409](https://github.com/storybookjs/storybook/pull/3409)
- Storyshots integrity tests options [#3418](https://github.com/storybookjs/storybook/pull/3418)
- Debounce Knob input to improve performance, fix number Knob undefined/NaN [#3412](https://github.com/storybookjs/storybook/pull/3412)
- Fix double quotes in prop table and add additional examples [#3401](https://github.com/storybookjs/storybook/pull/3401)

#### Documentation

- doc(addon-jest): fix option name [#3420](https://github.com/storybookjs/storybook/pull/3420)
- Storyshots integrity tests fixes - README [#3419](https://github.com/storybookjs/storybook/pull/3419)

#### Maintenance

- viewport-addon: configure => configureViewport [#3414](https://github.com/storybookjs/storybook/pull/3414)

#### Dependency Upgrades

<details>
<summary>
94 Upgrades
</summary>

- Upgraded `chalk` in `/` from "2.3.2" to "2.4.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `danger` in `/` from "3.4.7" to "3.5.1" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `prettier` in `/` from "1.12.0" to "1.12.1" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `app/react` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `prettier` in `addons/storysource` from "1.12.0" to "1.12.1" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `react-modal` in `lib/ui` from "3.3.2" to "3.4.1" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `chalk` in `lib/core` from "2.3.2" to "2.4.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `lib/core` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `app/angular` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `app/mithril` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `app/polymer` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `app/react-native` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `app/vue` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `chalk` in `lib/cli` from "2.3.2" to "2.4.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `examples/cra-kitchen-sink` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `examples/mithril-kitchen-sink` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `examples/polymer-cli` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `webpack` in `examples/vue-kitchen-sink` from "4.5.0" to "4.6.0" [#3440](https://github.com/storybookjs/storybook/pull/3440)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.32" to "1.5.33" [#3439](https://github.com/storybookjs/storybook/pull/3439)
- Upgraded `gatsby` in `/docs` from "1.9.251" to "1.9.252" [#3439](https://github.com/storybookjs/storybook/pull/3439)
- Update lerna in / from 2.10.1 to 2.10.2 [#3431](https://github.com/storybookjs/storybook/pull/3431)
- Update gatsby in /docs from 1.9.250 to 1.9.251 [#3430](https://github.com/storybookjs/storybook/pull/3430)
- Upgraded `@angular/common` in `/` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/compiler` in `/` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/core` in `/` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/forms` in `/` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/platform-browser` in `/` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/platform-browser-dynamic` in `/` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `babel-eslint` in `/` from "8.2.2" to "8.2.3" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `danger` in `/` from "3.4.5" to "3.4.7" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `eslint-plugin-import` in `/` from "2.10.0" to "2.11.0" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `lerna` in `/` from "2.10.0" to "2.10.1" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `prettier` in `/` from "1.11.1" to "1.12.0" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react` in `/` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `/` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-test-renderer` in `/` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `addons/centered` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-lifecycles-compat` in `addons/background` from "3.0.0" to "3.0.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-lifecycles-compat` in `addons/events` from "3.0.0" to "3.0.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `glamorous` in `app/react` from "4.12.1" to "4.12.3" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@types/react` in `addons/notes` from "16.3.5" to "16.3.11" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `glamorous` in `addons/actions` from "4.12.1" to "4.12.3" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-inspector` in `addons/actions` from "2.2.2" to "2.3.0" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `glamorous` in `lib/components` from "4.12.1" to "4.12.3" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `glamorous` in `addons/a11y` from "4.12.1" to "4.12.3" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `glamorous` in `addons/info` from "4.12.1" to "4.12.3" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-lifecycles-compat` in `addons/info` from "3.0.0" to "3.0.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-test-renderer` in `addons/info` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `glamorous` in `addons/jest` from "4.12.1" to "4.12.3" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `moment` in `addons/knobs` from "2.22.0" to "2.22.1" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-color` in `addons/knobs` from "2.14.0" to "2.14.1" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-lifecycles-compat` in `addons/knobs` from "3.0.0" to "3.0.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react` in `addons/links` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `addons/links` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `prettier` in `addons/storysource` from "1.11.1" to "1.12.0" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-lifecycles-compat` in `lib/ui` from "3.0.0" to "3.0.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `autoprefixer` in `lib/core` from "8.2.0" to "8.3.0" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `postcss-loader` in `lib/core` from "2.1.3" to "2.1.4" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `puppeteer` in `addons/storyshots` from "1.2.0" to "1.3.0" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react` in `addons/storyshots` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `addons/storyshots` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react` in `app/angular` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `app/angular` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react` in `app/mithril` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `app/mithril` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react` in `app/polymer` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `app/polymer` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react` in `app/vue` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `app/vue` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `update-notifier` in `lib/cli` from "2.4.0" to "2.5.0" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `npx` in `lib/cli` from "10.0.1" to "10.2.0" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `rxjs` in `examples/angular-cli` from "5.5.8" to "5.5.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.9" to "5.2.10" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@types/node` in `examples/angular-cli` from "9.6.2" to "9.6.5" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react` in `examples/cra-kitchen-sink` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `examples/cra-kitchen-sink` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-lifecycles-compat` in `examples/cra-kitchen-sink` from "3.0.0" to "3.0.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react` in `examples/official-storybook` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `react-dom` in `examples/official-storybook` from "16.3.1" to "16.3.2" [#3429](https://github.com/storybookjs/storybook/pull/3429)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.4.0" to "3.4.1" [#3426](https://github.com/storybookjs/storybook/pull/3426)
- Upgraded `@storybook/addon-links` in `/docs` from "3.4.0" to "3.4.1" [#3426](https://github.com/storybookjs/storybook/pull/3426)
- Upgraded `@storybook/addons` in `/docs` from "3.4.0" to "3.4.1" [#3426](https://github.com/storybookjs/storybook/pull/3426)
- Upgraded `@storybook/react` in `/docs` from "3.4.0" to "3.4.1" [#3426](https://github.com/storybookjs/storybook/pull/3426)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.41" to "1.6.42" [#3426](https://github.com/storybookjs/storybook/pull/3426)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.60" to "1.5.61" [#3426](https://github.com/storybookjs/storybook/pull/3426)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.29" to "1.5.32" [#3426](https://github.com/storybookjs/storybook/pull/3426)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.39" to "1.7.40" [#3426](https://github.com/storybookjs/storybook/pull/3426)
- Upgraded `gatsby` in `/docs` from "1.9.247" to "1.9.250" [#3426](https://github.com/storybookjs/storybook/pull/3426)

</details>

## 3.4.2

2018-April-17

#### Bug Fixes

- Serialize boolean type only for non-nullable values [#3432](https://github.com/storybookjs/storybook/pull/3432)
- Addon actions: fix slow logging [#3133](https://github.com/storybookjs/storybook/pull/3133)

#### Documentation

- Fix storyshots readme for image snapshotting [#3397](https://github.com/storybookjs/storybook/pull/3397)

## 4.0.0-alpha.2

2018-April-10

Also includes changes from 3.4.1

#### Breaking Changes

- Change addon panel keyboard shortcut to shift-meta-z [#3378](https://github.com/storybookjs/storybook/pull/3378)
- Move server/config to core [#3261](https://github.com/storybookjs/storybook/pull/3261)

#### Features

- React native Typescript transform [#3209](https://github.com/storybookjs/storybook/pull/3209)
- Split vendor and runtime chunk in static builds [#3316](https://github.com/storybookjs/storybook/pull/3316)
- Persist background for @addon/background [#3331](https://github.com/storybookjs/storybook/pull/3331)
- feat(notes): add marked options [#3225](https://github.com/storybookjs/storybook/pull/3225)

#### Bug Fixes

- Enforce addons store being a singleton by storing it in global variable [#3383](https://github.com/storybookjs/storybook/pull/3383)
- Scroll to top of the page when changing story [#3338](https://github.com/storybookjs/storybook/pull/3338)
- Fix HtmlWebpackPlugin error [#3328](https://github.com/storybookjs/storybook/pull/3328)

#### Maintenance

- Remove usages of deprecated React lifecycle methods [#3327](https://github.com/storybookjs/storybook/pull/3327)

#### Dependency Upgrades

<details>
<summary>
142 Updates
</summary>

- Migrate to react-lifecycles-compat@3 [#3392](https://github.com/storybookjs/storybook/pull/3392)
- Upgrade dev dependencies in Angular example [#3391](https://github.com/storybookjs/storybook/pull/3391)
- Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.30" to "1.5.31" [#3388](https://github.com/storybookjs/storybook/pull/3388)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.28" to "1.5.29" [#3388](https://github.com/storybookjs/storybook/pull/3388)
- Upgraded `gatsby` in `/docs` from "1.9.246" to "1.9.247" [#3388](https://github.com/storybookjs/storybook/pull/3388)
- Upgraded `lerna` in `/` from "2.9.1" to "2.10.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `babel-preset-minify` in `app/react` from "0.3.0" to "0.4.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `core-js` in `app/react` from "2.5.4" to "2.5.5" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-hot-middleware` in `app/react` from "2.21.2" to "2.22.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-dev-middleware` in `lib/core` from "3.1.1" to "3.1.2" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-hot-middleware` in `lib/core` from "2.21.2" to "2.22.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `core-js` in `app/angular` from "2.5.4" to "2.5.5" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `ts-loader` in `app/angular` from "4.1.0" to "4.2.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-hot-middleware` in `app/angular` from "2.21.2" to "2.22.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `zone.js` in `app/angular` from "0.8.25" to "0.8.26" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `babel-preset-minify` in `app/mithril` from "0.3.0" to "0.4.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `core-js` in `app/mithril` from "2.5.4" to "2.5.5" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-hot-middleware` in `app/mithril` from "2.21.2" to "2.22.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `@webcomponents/webcomponentsjs` in `app/polymer` from "1.1.1" to "1.2.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `babel-preset-minify` in `app/polymer` from "0.3.0" to "0.4.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `core-js` in `app/polymer` from "2.5.4" to "2.5.5" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-hot-middleware` in `app/polymer` from "2.21.2" to "2.22.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `babel-preset-minify` in `app/react-native` from "0.3.0" to "0.4.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `url-parse` in `app/react-native` from "1.2.0" to "1.3.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-dev-middleware` in `app/react-native` from "3.1.1" to "3.1.2" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-hot-middleware` in `app/react-native` from "2.21.2" to "2.22.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `babel-preset-minify` in `app/vue` from "0.3.0" to "0.4.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `core-js` in `app/vue` from "2.5.4" to "2.5.5" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-hot-middleware` in `app/vue` from "2.21.2" to "2.22.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `core-js` in `examples/angular-cli` from "2.5.4" to "2.5.5" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `zone.js` in `examples/angular-cli` from "0.8.25" to "0.8.26" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.7.3" to "1.7.4" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `@webcomponents/webcomponentsjs` in `examples/polymer-cli` from "1.1.1" to "1.2.0" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-dev-server` in `examples/polymer-cli` from "3.1.1" to "3.1.3" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "3.1.1" to "3.1.3" [#3387](https://github.com/storybookjs/storybook/pull/3387)
- Upgraded `lint-staged` in `/` from "7.0.3" to "7.0.4" [#3368](https://github.com/storybookjs/storybook/pull/3368)
- Upgraded `webpack-dev-middleware` in `lib/core` from "3.1.0" to "3.1.1" [#3368](https://github.com/storybookjs/storybook/pull/3368)
- Upgraded `webpack-dev-middleware` in `app/react-native` from "3.1.0" to "3.1.1" [#3368](https://github.com/storybookjs/storybook/pull/3368)
- Upgraded `react` in `/` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `/` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-test-renderer` in `/` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `addons/centered` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `app/react` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `@types/react` in `addons/notes` from "16.3.4" to "16.3.5" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-test-renderer` in `addons/info` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react` in `addons/links` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `addons/links` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `lib/core` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react` in `addons/storyshots` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `addons/storyshots` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react` in `app/angular` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `app/angular` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `app/angular` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `zone.js` in `app/angular` from "0.8.24" to "0.8.25" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react` in `app/mithril` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `app/mithril` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `app/mithril` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react` in `app/polymer` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `app/polymer` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `app/polymer` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `app/react-native` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react` in `app/vue` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `app/vue` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `app/vue` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `zone.js` in `examples/angular-cli` from "0.8.24" to "0.8.25" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `protractor` in `examples/angular-cli` from "5.3.0" to "5.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react` in `examples/cra-kitchen-sink` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `examples/cra-kitchen-sink` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-scripts` in `examples/cra-kitchen-sink` from "1.1.3" to "1.1.4" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `examples/cra-kitchen-sink` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `examples/mithril-kitchen-sink` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `examples/polymer-cli` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `webpack` in `examples/vue-kitchen-sink` from "4.4.1" to "4.5.0" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react` in `examples/official-storybook` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `react-dom` in `examples/official-storybook` from "16.3.0" to "16.3.1" [#3357](https://github.com/storybookjs/storybook/pull/3357)
- Upgraded `gatsby-remark-autolink-headers` in `/docs` from "1.4.15" to "1.4.16" [#3356](https://github.com/storybookjs/storybook/pull/3356)
- Upgraded `gatsby` in `/docs` from "1.9.244" to "1.9.246" [#3356](https://github.com/storybookjs/storybook/pull/3356)
- Upgraded `danger` in `/` from "3.4.4" to "3.4.5" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `lint-staged` in `/` from "7.0.2" to "7.0.3" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `react-lifecycles-compat` in `addons/background` from "1.1.1" to "1.1.4" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `react-lifecycles-compat` in `addons/events` from "1.1.1" to "1.1.4" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `html-webpack-plugin` in `app/react` from "3.1.0" to "3.2.0" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `@types/react` in `addons/notes` from "16.3.1" to "16.3.4" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `axe-core` in `addons/a11y` from "3.0.0" to "3.0.1" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `react-lifecycles-compat` in `addons/info` from "1.1.1" to "1.1.4" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `react-lifecycles-compat` in `addons/knobs` from "1.1.1" to "1.1.4" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `react-lifecycles-compat` in `lib/ui` from "1.1.1" to "1.1.4" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `html-webpack-plugin` in `app/angular` from "3.1.0" to "3.2.0" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `html-webpack-plugin` in `app/mithril` from "3.1.0" to "3.2.0" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `html-webpack-plugin` in `app/polymer` from "3.1.0" to "3.2.0" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `html-webpack-plugin` in `app/react-native` from "3.1.0" to "3.2.0" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `html-webpack-plugin` in `app/vue` from "3.1.0" to "3.2.0" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `@types/node` in `examples/angular-cli` from "9.6.1" to "9.6.2" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `react-lifecycles-compat` in `examples/cra-kitchen-sink` from "1.1.1" to "1.1.4" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `react-scripts` in `examples/cra-kitchen-sink` from "1.1.1" to "1.1.3" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Upgraded `html-webpack-plugin` in `examples/polymer-cli` from "3.1.0" to "3.2.0" [#3350](https://github.com/storybookjs/storybook/pull/3350)
- Update gatsby-source-filesystem in /docs from 1.5.27 to 1.5.28 [#3349](https://github.com/storybookjs/storybook/pull/3349)
- Update gatsby in /docs from 1.9.243 to 1.9.244 [#3345](https://github.com/storybookjs/storybook/pull/3345)
- Upgraded `danger` in `/` from "3.3.2" to "3.4.4" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `eslint-plugin-import` in `/` from "2.9.0" to "2.10.0" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `lerna` in `/` from "2.5.1" to "2.9.1" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `lint-staged` in `/` from "7.0.0" to "7.0.2" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `react-lifecycles-compat` in `addons/background` from "1.1.0" to "1.1.1" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `react-lifecycles-compat` in `addons/events` from "1.1.0" to "1.1.1" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `react-textarea-autosize` in `addons/events` from "6.1.0-0" to "6.1.0" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `babel-plugin-react-docgen` in `app/react` from "1.8.3" to "1.9.0" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `nodemon` in `app/react` from "1.17.2" to "1.17.3" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `@types/react` in `addons/notes` from "16.1.0" to "16.3.1" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `react-lifecycles-compat` in `addons/info` from "1.1.0" to "1.1.1" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `moment` in `addons/knobs` from "2.21.0" to "2.22.0" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `react-lifecycles-compat` in `addons/knobs` from "1.1.0" to "1.1.1" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `react-textarea-autosize` in `addons/knobs` from "6.1.0-0" to "6.1.0" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `react-lifecycles-compat` in `lib/ui` from "1.1.0" to "1.1.1" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `serve-favicon` in `lib/core` from "2.4.5" to "2.5.0" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `zone.js` in `app/angular` from "0.8.20" to "0.8.24" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `nodemon` in `app/angular` from "1.17.2" to "1.17.3" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `nodemon` in `app/mithril` from "1.17.2" to "1.17.3" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `nodemon` in `app/polymer` from "1.17.2" to "1.17.3" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `ws` in `app/react-native` from "5.1.0" to "5.1.1" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `nodemon` in `app/vue` from "1.17.2" to "1.17.3" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `react-lifecycles-compat` in `examples/cra-kitchen-sink` from "1.1.0" to "1.1.1" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Upgraded `zone.js` in `examples/angular-cli` from "0.8.20" to "0.8.24" [#3343](https://github.com/storybookjs/storybook/pull/3343)
- Migrate to axe-core@3.0.0 [#3332](https://github.com/storybookjs/storybook/pull/3332)
- Migrate to ws@5 [#3334](https://github.com/storybookjs/storybook/pull/3334)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.15" to "3.4.0" [#3325](https://github.com/storybookjs/storybook/pull/3325)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.15" to "3.4.0" [#3325](https://github.com/storybookjs/storybook/pull/3325)
- Upgraded `@storybook/addons` in `/docs` from "3.3.15" to "3.4.0" [#3325](https://github.com/storybookjs/storybook/pull/3325)
- Upgraded `@storybook/react` in `/docs` from "3.3.15" to "3.4.0" [#3325](https://github.com/storybookjs/storybook/pull/3325)
- Update gatsby-remark-autolink-headers in /docs from 1.4.13 to 1.4.15 [#3314](https://github.com/storybookjs/storybook/pull/3314)
- Upgraded `webpack` in `app/react` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `lib/core` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `app/angular` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `app/mithril` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `app/polymer` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `app/react-native` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `app/vue` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `examples/cra-kitchen-sink` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `@types/node` in `examples/angular-cli` from "9.6.0" to "9.6.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `examples/mithril-kitchen-sink` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `examples/polymer-cli` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Upgraded `webpack` in `examples/vue-kitchen-sink` from "4.3.0" to "4.4.1" [#3315](https://github.com/storybookjs/storybook/pull/3315)
- Add babel-core dev-deps [#3319](https://github.com/storybookjs/storybook/pull/3319)

</details>

## 3.4.1

2018-April-10

#### Features

- Make storybook addons channel available globally in `window` [#3243](https://github.com/storybookjs/storybook/pull/3243)

#### Bug Fixes

- Scroll preview pane for non-percentage heights [#3342](https://github.com/storybookjs/storybook/pull/3342)
- Replacing Report Fragment with div [#3372](https://github.com/storybookjs/storybook/pull/3372)
- Don't use direct react dependency in core [#3382](https://github.com/storybookjs/storybook/pull/3382)

#### Documentation

- Add typescript docs [#3361](https://github.com/storybookjs/storybook/pull/3361)
- Update links of the live examples for the new release [#3197](https://github.com/storybookjs/storybook/pull/3197)

## 3.4.0

2018-March-30

Welcome to Storybook 3.4 with the following key improvements:

- Polymer 2 support [#2225](https://github.com/storybookjs/storybook/pull/2225)
- Angular and Vue storyshots [#2564](https://github.com/storybookjs/storybook/pull/2564)
- Add image snapshots to addon-storyshots [#2413](https://github.com/storybookjs/storybook/pull/2413)
- Multiple story hierarchies [#2452](https://github.com/storybookjs/storybook/pull/2452)
- Addon-storysource: story source in addon pane [#2885](https://github.com/storybookjs/storybook/pull/2885)

Read on for more improvements, fixes. In addition, there are hundreds of dependency upgrades in the 3.4 release, so to see the details, please see the changelogs for `3.4.0-rc.*` and `3.4.0-alpha.*`.

#### Features

- Bind window access if `window` is defined; add `addons channel` access too [#3243](https://github.com/storybookjs/storybook/pull/3243)
- Fix screenshots tests & add getScreenshotOption to storyshots [#3102](https://github.com/storybookjs/storybook/pull/3102)
- Add `__STORYBOOK_CLIENT_API__` for external tools [#3058](https://github.com/storybookjs/storybook/pull/3058)
- Addon storysource: select stories from inside of the StoryPanel [#3154](https://github.com/storybookjs/storybook/pull/3154)
- Storyshots: env.NODE_PATH support [#2873](https://github.com/storybookjs/storybook/pull/2873)
- Knobs: Select knob key/value ordering [#1745](https://github.com/storybookjs/storybook/pull/1745)
- Angular: Add option to pass custom styles for ng components [#2856](https://github.com/storybookjs/storybook/pull/2856)
- Core: Add watch mode for build-storybook [#2866](https://github.com/storybookjs/storybook/pull/2866)
- Core: Add `__dirname` support [#2791](https://github.com/storybookjs/storybook/pull/2791)
- Pass default webpack config as third argument in Full Control Mode [#2796](https://github.com/storybookjs/storybook/pull/2796)
- Angular and Vue storyshots [#2564](https://github.com/storybookjs/storybook/pull/2564)
- Addon-info: Added "Copy button" for code example [#2713](https://github.com/storybookjs/storybook/pull/2713)
- Angular: Serve styles and assets using .angular-cli webpack configuration [#2735](https://github.com/storybookjs/storybook/pull/2735)
- API: Added an event that is emitted when a channel is created. [#2711](https://github.com/storybookjs/storybook/pull/2711)
- Addon-a11y: Handle components with delayed rendering [#2651](https://github.com/storybookjs/storybook/pull/2651)
- Polymer 2 support [#2225](https://github.com/storybookjs/storybook/pull/2225)
- Add image snapshots to addon-storyshots [#2413](https://github.com/storybookjs/storybook/pull/2413)
- Angular template support for Storybook [#2690](https://github.com/storybookjs/storybook/pull/2690)
- Custom tsconfig.json for angular apps. [#2669](https://github.com/storybookjs/storybook/pull/2669)
- Multiple story hierarchies [#2452](https://github.com/storybookjs/storybook/pull/2452)
- Change template story files extension to .ts [#2594](https://github.com/storybookjs/storybook/pull/2594)
- Use store revisions to ensure that stories re-render on HMR. [#2605](https://github.com/storybookjs/storybook/pull/2605)
- Ability to force re-render a story [#2463](https://github.com/storybookjs/storybook/pull/2463)
- Introduce framework-independent core library [#2241](https://github.com/storybookjs/storybook/pull/2241)

#### Bug Fixes

- \[Addon-storyshots\] Remove default options on "goto" call [#3298](https://github.com/storybookjs/storybook/pull/3298)
- CLI: add error handling for latest_version helper [#3297](https://github.com/storybookjs/storybook/pull/3297)
- Refactor CLI to use `npm` and `yarn` instead of third party packages [#3275](https://github.com/storybookjs/storybook/pull/3275)
- Fix issue when extending webpack config [#3279](https://github.com/storybookjs/storybook/pull/3279)
- Object proptype is shown in addon-info proptable [#3255](https://github.com/storybookjs/storybook/pull/3255)
- Fix storyshots renderer and serializer options [#3252](https://github.com/storybookjs/storybook/pull/3252)
- Angular: use resolveLoader from cliCommonConfig [#3251](https://github.com/storybookjs/storybook/pull/3251)
- Delaying update of height and width in Layout [#3180](https://github.com/storybookjs/storybook/pull/3180)
- Add 'waitUntil' option to puppeteer of storyshots [#3156](https://github.com/storybookjs/storybook/pull/3156)
- Move polymer loader to peerDependencies [#3161](https://github.com/storybookjs/storybook/pull/3161)
- Addons: avoid mixing manager and preview code together [#3068](https://github.com/storybookjs/storybook/pull/3068)
- React-Native: Fix by moving managerPath export to `server.js` [#2947](https://github.com/storybookjs/storybook/pull/2947)
- Addon-Info: Add type check to PropType on OneOf [#2653](https://github.com/storybookjs/storybook/pull/2653)
- Vue: Support .vue extension resolving [#2896](https://github.com/storybookjs/storybook/pull/2896)
- UI: remove zero on story loading [#2857](https://github.com/storybookjs/storybook/pull/2857)
- Angular: remove entryComponents prop from metadata [#2790](https://github.com/storybookjs/storybook/pull/2790)
- Use process.exitCode instead of process.exit() [#2717](https://github.com/storybookjs/storybook/pull/2717)
- Angular: knobs with template [#2766](https://github.com/storybookjs/storybook/pull/2766)
- Remove polymer-cli dependency [#2741](https://github.com/storybookjs/storybook/pull/2741)
- Add scss for components in angular apps by default. [#2703](https://github.com/storybookjs/storybook/pull/2703)

#### Documentation

- Add example for @ngrx/store [#3233](https://github.com/storybookjs/storybook/pull/3233)
- Fix missing declaration in Angular example [#3213](https://github.com/storybookjs/storybook/pull/3213)
- Update ADDONS_SUPPORT.md [#3114](https://github.com/storybookjs/storybook/pull/3114)
- StoryShots: Document ref mocking [#2869](https://github.com/storybookjs/storybook/pull/2869)
- Extending webpack section is no longer needed for the common usage [#2826](https://github.com/storybookjs/storybook/pull/2826)
- Updating Vue Jest Config [#2821](https://github.com/storybookjs/storybook/pull/2821)
- Angular inheritance example [#2787](https://github.com/storybookjs/storybook/pull/2787)
- Revisit addon/framework support [#3046](https://github.com/storybookjs/storybook/pull/3046)
- Docs live examples [#3019](https://github.com/storybookjs/storybook/pull/3019)
- Mention new supported frameworks [#2895](https://github.com/storybookjs/storybook/pull/2895)
- Update writing addons documentation [#2951](https://github.com/storybookjs/storybook/pull/2951)
- Update docs on LinkTo in addon-links [#2926](https://github.com/storybookjs/storybook/pull/2926)

#### Maintenance

- Fix errors on starting example Angular app [#3078](https://github.com/storybookjs/storybook/pull/3078)
- Use WatchMissingNodeModulesPlugin from react-dev-utils package [#3141](https://github.com/storybookjs/storybook/pull/3141)
- Don't use exact versions in peerDependencies [#3073](https://github.com/storybookjs/storybook/pull/3073)
- Remove integration tests [#3052](https://github.com/storybookjs/storybook/pull/3052)
- Fix "dev" script to be cross-platform [#2922](https://github.com/storybookjs/storybook/pull/2922)
- Typescript distribution [#2846](https://github.com/storybookjs/storybook/pull/2846)
- Use UTC timezone in formatting too for knobs test [#2861](https://github.com/storybookjs/storybook/pull/2861)
- ADD autolabeler.yml for <https://github.com/probot/autolabeler> [#2809](https://github.com/storybookjs/storybook/pull/2809)
- Fix css warning in angular-cli example [#2789](https://github.com/storybookjs/storybook/pull/2789)
- Move more things to core [#2788](https://github.com/storybookjs/storybook/pull/2788)
- Change ng stories dir [#2672](https://github.com/storybookjs/storybook/pull/2672)
- Only update CLI snapshots on postpublish script, skip smoke tests [#2671](https://github.com/storybookjs/storybook/pull/2671)
- Fix the timezone for example dates [#2654](https://github.com/storybookjs/storybook/pull/2654)
- Update prereq yarn install level [#2638](https://github.com/storybookjs/storybook/pull/2638)
- Separate stories in angular-cli example [#2592](https://github.com/storybookjs/storybook/pull/2592)

## 4.0.0-alpha.1

2018-March-29

#### Bug Fixes

- \[Hotfix\] Use published webpack 4 compatible fork of react-dev-utils [#3312](https://github.com/storybookjs/storybook/pull/3312)

## 4.0.0-alpha.0

2018-March-28

#### Breaking Changes

- Webpack 4 [#3148](https://github.com/storybookjs/storybook/pull/3148)

#### Features

- Viewport-addon Allow setting callback to be called whenever viewport changes [#3283](https://github.com/storybookjs/storybook/pull/3283)
- Storybook for Mithril [#3244](https://github.com/storybookjs/storybook/pull/3244)
- Feature request: adding aXe configuration for a11y addon [#3285](https://github.com/storybookjs/storybook/pull/3285)
- files knob [#2860](https://github.com/storybookjs/storybook/pull/2860)
- Using svg-url-loader for webpack configs that accept svgs [#3221](https://github.com/storybookjs/storybook/pull/3221)
- Addon Storysource typescript support [#3253](https://github.com/storybookjs/storybook/pull/3253)
- addon-options: Make shortcuts in storybook optional [#3237](https://github.com/storybookjs/storybook/pull/3237)
- Add parameters to stories in the story store, and render them in app layers [#2679](https://github.com/storybookjs/storybook/pull/2679)
- Add min, value, and max labels to range knob [#3128](https://github.com/storybookjs/storybook/pull/3128)
- viewport-addon: Make the addon configurable [#3099](https://github.com/storybookjs/storybook/pull/3099)
- Bind window access if `window` is defined; add `addons channel` access too [#3243](https://github.com/storybookjs/storybook/pull/3243)

#### Bug Fixes

- Update react-native symlink resolving and add support for flow [#3306](https://github.com/storybookjs/storybook/pull/3306)
- \[Addon-storyshots\] Remove default options on "goto" call [#3298](https://github.com/storybookjs/storybook/pull/3298)
- Remove onDeviceUI animation to support Detox screenshots [#3272](https://github.com/storybookjs/storybook/pull/3272)
- Angular: use resolveLoader from cliCommonConfig [#3251](https://github.com/storybookjs/storybook/pull/3251)

#### Maintenance

- Create CODEOWNERS from git history [#3296](https://github.com/storybookjs/storybook/pull/3296)
- Close inactive issues in 30 days [#3273](https://github.com/storybookjs/storybook/pull/3273)
- Refactor all startup code into `@storybook/core` also [#3259](https://github.com/storybookjs/storybook/pull/3259)
- Update ISSUE_TEMPLATE to help define work to be done [#3257](https://github.com/storybookjs/storybook/pull/3257)

#### Dependency Upgrades

<details>
<summary>
64 Updates
</summary>

- Update gatsby-transformer-remark in /docs from 1.7.38 to 1.7.39 [#3310](https://github.com/storybookjs/storybook/pull/3310)
- Upgraded `@types/react` in `addons/notes` from "16.0.41" to "16.1.0" [#3311](https://github.com/storybookjs/storybook/pull/3311)
- Upgraded `react-chromatic` in `examples/official-storybook` from "0.7.11" to "0.8.1" [#3311](https://github.com/storybookjs/storybook/pull/3311)
- Major upgrades for devDependencies [#3304](https://github.com/storybookjs/storybook/pull/3304)
- Upgraded `typescript` in `/` from "2.7.2" to "2.8.1" [#3303](https://github.com/storybookjs/storybook/pull/3303)
- Upgraded `core-js` in `app/react` from "2.5.3" to "2.5.4" [#3303](https://github.com/storybookjs/storybook/pull/3303)
- Upgraded `core-js` in `app/angular` from "2.5.3" to "2.5.4" [#3303](https://github.com/storybookjs/storybook/pull/3303)
- Upgraded `core-js` in `app/polymer` from "2.5.3" to "2.5.4" [#3303](https://github.com/storybookjs/storybook/pull/3303)
- Upgraded `core-js` in `app/vue` from "2.5.3" to "2.5.4" [#3303](https://github.com/storybookjs/storybook/pull/3303)
- Upgraded `core-js` in `examples/angular-cli` from "2.5.3" to "2.5.4" [#3303](https://github.com/storybookjs/storybook/pull/3303)
- Upgraded `typescript` in `examples/angular-cli` from "2.7.2" to "2.8.1" [#3303](https://github.com/storybookjs/storybook/pull/3303)
- Upgraded `gatsby-link` in `/docs` from "1.6.39" to "1.6.40" [#3300](https://github.com/storybookjs/storybook/pull/3300)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.59" to "1.5.60" [#3300](https://github.com/storybookjs/storybook/pull/3300)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.37" to "1.7.38" [#3300](https://github.com/storybookjs/storybook/pull/3300)
- Upgraded `gatsby` in `/docs` from "1.9.241" to "1.9.243" [#3300](https://github.com/storybookjs/storybook/pull/3300)
- Upgraded `webpack` in `app/react` from "4.2.0" to "4.3.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack` in `lib/core` from "4.2.0" to "4.3.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack-dev-middleware` in `lib/core` from "3.0.1" to "3.1.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack` in `app/angular` from "4.2.0" to "4.3.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack` in `app/polymer` from "4.2.0" to "4.3.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack` in `app/react-native` from "4.2.0" to "4.3.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack-dev-middleware` in `app/react-native` from "3.0.1" to "3.1.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack` in `app/vue` from "4.2.0" to "4.3.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack` in `examples/cra-kitchen-sink` from "4.2.0" to "4.3.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `rxjs` in `examples/angular-cli` from "5.5.7" to "5.5.8" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack` in `examples/polymer-cli` from "4.2.0" to "4.3.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `webpack` in `examples/vue-kitchen-sink` from "4.2.0" to "4.3.0" [#3299](https://github.com/storybookjs/storybook/pull/3299)
- Upgraded `inquirer` in `/` from "5.1.0" to "5.2.0" [#3294](https://github.com/storybookjs/storybook/pull/3294)
- Upgraded `marked` in `addons/notes` from "0.3.18" to "0.3.19" [#3294](https://github.com/storybookjs/storybook/pull/3294)
- Upgraded `update-notifier` in `lib/cli` from "2.3.0" to "2.4.0" [#3294](https://github.com/storybookjs/storybook/pull/3294)
- Update marked in /docs from 0.3.18 to 0.3.19 [#3292](https://github.com/storybookjs/storybook/pull/3292)
- Update gatsby in /docs from 1.9.240 to 1.9.241 [#3281](https://github.com/storybookjs/storybook/pull/3281)
- Update @types/react in addons/notes from 16.0.40 to 16.0.41 [#3282](https://github.com/storybookjs/storybook/pull/3282)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.56" to "1.5.59" [#3276](https://github.com/storybookjs/storybook/pull/3276)
- Upgraded `gatsby` in `/docs` from "1.9.239" to "1.9.240" [#3276](https://github.com/storybookjs/storybook/pull/3276)
- Upgraded `vue-loader` in `app/vue` from "14.2.1" to "14.2.2" [#3277](https://github.com/storybookjs/storybook/pull/3277)
- Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "14.2.1" to "14.2.2" [#3277](https://github.com/storybookjs/storybook/pull/3277)
- Upgraded `eslint` in `/` from "4.19.0" to "4.19.1" [#3265](https://github.com/storybookjs/storybook/pull/3265)
- Upgraded `marked` in `addons/notes` from "0.3.17" to "0.3.18" [#3265](https://github.com/storybookjs/storybook/pull/3265)
- Upgraded `autoprefixer` in `lib/core` from "8.1.0" to "8.2.0" [#3265](https://github.com/storybookjs/storybook/pull/3265)
- Upgraded `@webcomponents/webcomponentsjs` in `app/polymer` from "1.1.0" to "1.1.1" [#3265](https://github.com/storybookjs/storybook/pull/3265)
- Upgraded `@types/node` in `examples/angular-cli` from "9.4.7" to "9.6.0" [#3265](https://github.com/storybookjs/storybook/pull/3265)
- Upgraded `@polymer/polymer` in `examples/polymer-cli` from "2.5.0" to "2.6.0" [#3265](https://github.com/storybookjs/storybook/pull/3265)
- Upgraded `@webcomponents/webcomponentsjs` in `examples/polymer-cli` from "1.1.0" to "1.1.1" [#3265](https://github.com/storybookjs/storybook/pull/3265)
- Update marked in /docs from 0.3.17 to 0.3.18 [#3264](https://github.com/storybookjs/storybook/pull/3264)
- Update gatsby in /docs from 1.9.238 to 1.9.239 [#3262](https://github.com/storybookjs/storybook/pull/3262)
- Upgraded `danger` in `/` from "3.3.0" to "3.3.2" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `jest` in `/` from "22.4.2" to "22.4.3" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `jest-cli` in `/` from "22.4.2" to "22.4.3" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `jest-config` in `/` from "22.4.2" to "22.4.3" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `jest-diff` in `/` from "22.4.0" to "22.4.3" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `jest-environment-jsdom` in `/` from "22.4.1" to "22.4.3" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `jest-jasmine2` in `/` from "22.4.2" to "22.4.3" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `keycode` in `lib/ui` from "2.1.9" to "2.2.0" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `autoprefixer` in `lib/core` from "8.0.0" to "8.1.0" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `babel-preset-vue` in `examples/vue-kitchen-sink` from "2.0.1" to "2.0.2" [#3254](https://github.com/storybookjs/storybook/pull/3254)
- Upgraded `commander` in `/` from "2.15.0" to "2.15.1" [#3250](https://github.com/storybookjs/storybook/pull/3250)
- Upgraded `danger` in `/` from "3.2.0" to "3.3.0" [#3250](https://github.com/storybookjs/storybook/pull/3250)
- Upgraded `commander` in `lib/core` from "2.15.0" to "2.15.1" [#3250](https://github.com/storybookjs/storybook/pull/3250)
- Upgraded `postcss-loader` in `lib/core` from "2.1.2" to "2.1.3" [#3250](https://github.com/storybookjs/storybook/pull/3250)
- Upgraded `commander` in `app/react-native` from "2.15.0" to "2.15.1" [#3250](https://github.com/storybookjs/storybook/pull/3250)
- Upgraded `commander` in `lib/cli` from "2.15.0" to "2.15.1" [#3250](https://github.com/storybookjs/storybook/pull/3250)
- Core: upgrade autoprefixer from 7.2.6 to 8.0.0 & allow configuring browser list externally [#3076](https://github.com/storybookjs/storybook/pull/3076)
- Update gatsby in /docs from 1.9.236 to 1.9.238 [#3249](https://github.com/storybookjs/storybook/pull/3249)

</details>

## 3.4.0-rc.4

2018-March-28

#### Bug Fixes

- CLI: add error handling for latest_version helper [#3297](https://github.com/storybookjs/storybook/pull/3297)
- Refactor CLI to use `npm` and `yarn` instead of third party packages [#3275](https://github.com/storybookjs/storybook/pull/3275)
- Fix issue when extending webpack config [#3279](https://github.com/storybookjs/storybook/pull/3279)
- Object proptype is shown in addon-info proptable [#3255](https://github.com/storybookjs/storybook/pull/3255)
- Fix storyshots renderer and serializer options [#3252](https://github.com/storybookjs/storybook/pull/3252)
- Angular: use resolveLoader from cliCommonConfig [#3251](https://github.com/storybookjs/storybook/pull/3251)

## 3.4.0-rc.3

2018-March-19

#### Documentation

- Add example for @ngrx/store [#3233](https://github.com/storybookjs/storybook/pull/3233)
- Fix missing declaration in Angular example [#3213](https://github.com/storybookjs/storybook/pull/3213)

#### Dependency Upgrades

<details>
<summary>
58 Updates
</summary>

- Update node-sass in app/angular from 4.8.2 to 4.8.3 [#3239](https://github.com/storybookjs/storybook/pull/3239)
- Update postcss-loader in lib/core from 2.1.1 to 2.1.2 [#3234](https://github.com/storybookjs/storybook/pull/3234)
- Upgraded `eslint` in `/` from "4.18.2" to "4.19.0" [#3230](https://github.com/storybookjs/storybook/pull/3230)
- Upgraded `graphql` in `addons/graphql` from "0.13.1" to "0.13.2" [#3230](https://github.com/storybookjs/storybook/pull/3230)
- Update gatsby in /docs from 1.9.233 to 1.9.236 [#3229](https://github.com/storybookjs/storybook/pull/3229)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.36" to "1.7.37" [#3226](https://github.com/storybookjs/storybook/pull/3226)
- Upgraded `gatsby` in `/docs` from "1.9.232" to "1.9.233" [#3226](https://github.com/storybookjs/storybook/pull/3226)
- Upgraded `uglifyjs-webpack-plugin` in `app/react` from "1.2.3" to "1.2.4" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `puppeteer` in `addons/storyshots` from "1.1.1" to "1.2.0" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `enzyme-to-json` in `addons/storyshots` from "3.3.1" to "3.3.3" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `css-loader` in `lib/core` from "0.28.10" to "0.28.11" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `uglifyjs-webpack-plugin` in `app/angular` from "1.2.3" to "1.2.4" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `uglifyjs-webpack-plugin` in `app/polymer` from "1.2.3" to "1.2.4" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `uglifyjs-webpack-plugin` in `app/react-native` from "1.2.3" to "1.2.4" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `uglifyjs-webpack-plugin` in `app/vue` from "1.2.3" to "1.2.4" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `enzyme-to-json` in `examples/cra-kitchen-sink` from "3.3.1" to "3.3.3" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `enzyme-to-json` in `examples/official-storybook` from "3.3.1" to "3.3.3" [#3227](https://github.com/storybookjs/storybook/pull/3227)
- Upgraded `@angular/common` in `/` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/compiler` in `/` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/core` in `/` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/forms` in `/` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/platform-browser` in `/` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/platform-browser-dynamic` in `/` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `danger` in `/` from "3.1.8" to "3.2.0" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `eslint-plugin-jest` in `/` from "21.14.1" to "21.15.0" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `jest-vue-preprocessor` in `/` from "1.3.1" to "1.4.0" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `react-chromatic` in `examples/official-storybook` from "0.7.10" to "0.7.11" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.8" to "5.2.9" [#3219](https://github.com/storybookjs/storybook/pull/3219)
- Upgraded `eslint-plugin-jest` in `/` from "21.14.0" to "21.14.1" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `jest-image-snapshot` in `/` from "2.3.0" to "2.4.0" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `nodemon` in `app/react` from "1.17.1" to "1.17.2" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `vue` in `addons/knobs` from "2.5.15" to "2.5.16" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `jest-image-snapshot` in `addons/storyshots` from "2.3.0" to "2.4.0" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `nodemon` in `app/angular` from "1.17.1" to "1.17.2" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `nodemon` in `app/polymer` from "1.17.1" to "1.17.2" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `nodemon` in `app/vue` from "1.17.1" to "1.17.2" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `vue` in `app/vue` from "2.5.15" to "2.5.16" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.15" to "2.5.16" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.15" to "2.5.16" [#3210](https://github.com/storybookjs/storybook/pull/3210)
- Upgraded `tslint-config-prettier` in `/` from "1.9.0" to "1.10.0" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `glamorous` in `app/react` from "4.12.0" to "4.12.1" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `glamorous` in `addons/actions` from "4.12.0" to "4.12.1" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `glamorous` in `lib/components` from "4.12.0" to "4.12.1" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `glamorous` in `addons/a11y` from "4.12.0" to "4.12.1" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `glamorous` in `addons/info` from "4.12.0" to "4.12.1" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `glamorous` in `addons/jest` from "4.12.0" to "4.12.1" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `react-modal` in `lib/ui` from "3.3.1" to "3.3.2" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `express` in `lib/core` from "4.16.2" to "4.16.3" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `node-sass` in `app/angular` from "4.8.1" to "4.8.2" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `express` in `app/react-native` from "4.16.2" to "4.16.3" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Upgraded `rxjs` in `examples/angular-cli` from "5.5.6" to "5.5.7" [#3201](https://github.com/storybookjs/storybook/pull/3201)
- Update gatsby in /docs from 1.9.231 to 1.9.232 [#3200](https://github.com/storybookjs/storybook/pull/3200)

</details>

## 3.4.0-rc.2

2018-March-13

Fix publishing options to use exact versions for cross-dependencies per this change:

- use exact versions for cross-dependencies between our own packages [#3183](https://github.com/storybookjs/storybook/pull/3183)

## 3.4.0-rc.1

2018-March-13

#### Features

- Fix screenshots tests & add getScreenshotOption to storyshots [#3102](https://github.com/storybookjs/storybook/pull/3102)

#### Bug Fixes

- Delaying update of height and width in Layout [#3180](https://github.com/storybookjs/storybook/pull/3180)
- Add 'waitUntil' option to puppeteer of storyshots [#3156](https://github.com/storybookjs/storybook/pull/3156)
- Move polymer loader to peerDependencies [#3161](https://github.com/storybookjs/storybook/pull/3161)

#### Maintenance

- Feature-freeze master [#3149](https://github.com/storybookjs/storybook/pull/3149)

#### Dependency Upgrades

<details>
<summary>
57 updates
</summary>

- Update danger in / from 3.1.7 to 3.1.8 [#3191](https://github.com/storybookjs/storybook/pull/3191)
- Upgraded `polymer-webpack-loader` in `/` from "2.0.1" to "2.0.2" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `uglifyjs-webpack-plugin` in `app/react` from "1.2.2" to "1.2.3" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `vue` in `addons/knobs` from "2.5.14" to "2.5.15" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `node-sass` in `app/angular` from "4.7.2" to "4.8.1" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `uglifyjs-webpack-plugin` in `app/angular` from "1.2.2" to "1.2.3" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `uglifyjs-webpack-plugin` in `app/polymer` from "1.2.2" to "1.2.3" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `polymer-webpack-loader` in `app/polymer` from "2.0.1" to "2.0.2" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `uglifyjs-webpack-plugin` in `app/react-native` from "1.2.2" to "1.2.3" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `uglifyjs-webpack-plugin` in `app/vue` from "1.2.2" to "1.2.3" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `vue` in `app/vue` from "2.5.14" to "2.5.15" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.14" to "2.5.15" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `polymer-webpack-loader` in `examples/polymer-cli` from "2.0.1" to "2.0.2" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.14" to "2.5.15" [#3184](https://github.com/storybookjs/storybook/pull/3184)
- Update eslint-plugin-jest in / from 21.13.0 to 21.14.0 [#3182](https://github.com/storybookjs/storybook/pull/3182)
- Upgraded `cross-env` in `/` from "5.1.3" to "5.1.4" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `jest-preset-angular` in `/` from "5.2.0" to "5.2.1" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `@types/react` in `addons/notes` from "16.0.34" to "16.0.40" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `style-loader` in `addons/knobs` from "0.20.2" to "0.20.3" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `vue` in `addons/knobs` from "2.5.13" to "2.5.14" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `style-loader` in `lib/core` from "0.20.2" to "0.20.3" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `cross-env` in `app/angular` from "5.1.3" to "5.1.4" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `copy-webpack-plugin` in `app/polymer` from "4.5.0" to "4.5.1" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `vue` in `app/vue` from "2.5.13" to "2.5.14" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.13" to "2.5.14" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `@types/node` in `examples/angular-cli` from "9.4.6" to "9.4.7" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `copy-webpack-plugin` in `examples/polymer-cli` from "4.5.0" to "4.5.1" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.13" to "2.5.14" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `cross-env` in `examples/vue-kitchen-sink` from "5.1.3" to "5.1.4" [#3179](https://github.com/storybookjs/storybook/pull/3179)
- Upgraded `gatsby-link` in `/docs` from "1.6.38" to "1.6.39" [#3171](https://github.com/storybookjs/storybook/pull/3171)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.39" to "1.6.41" [#3171](https://github.com/storybookjs/storybook/pull/3171)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.26" to "1.5.27" [#3171](https://github.com/storybookjs/storybook/pull/3171)
- Upgraded `gatsby` in `/docs` from "1.9.225" to "1.9.231" [#3171](https://github.com/storybookjs/storybook/pull/3171)
- Upgraded `@angular/common` in `/` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/compiler` in `/` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/core` in `/` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/forms` in `/` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/platform-browser` in `/` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/platform-browser-dynamic` in `/` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `commander` in `/` from "2.14.1" to "2.15.0" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `acorn` in `addons/storysource` from "5.5.1" to "5.5.3" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `enzyme-to-json` in `addons/storyshots` from "3.3.1" to "3.3.2" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `commander` in `lib/core` from "2.14.1" to "2.15.0" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `commander` in `app/react-native` from "2.14.1" to "2.15.0" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `enzyme-to-json` in `examples/cra-kitchen-sink` from "3.3.1" to "3.3.2" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `enzyme-to-json` in `examples/official-storybook` from "3.3.1" to "3.3.2" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `commander` in `lib/cli` from "2.14.1" to "2.15.0" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.7.2" to "1.7.3" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.7" to "5.2.8" [#3170](https://github.com/storybookjs/storybook/pull/3170)
- use exact versions for cross-dependencies between our own packages [#3183](https://github.com/storybookjs/storybook/pull/3183)
- Move "@types/react" to dev dependencies [#3169](https://github.com/storybookjs/storybook/pull/3169)

</details>

## 3.4.0-rc.0

2018-March-08

#### Features

- Add `__STORYBOOK_CLIENT_API__` for external tools [#3058](https://github.com/storybookjs/storybook/pull/3058)
- Addon storysource: select stories from inside of the StoryPanel [#3154](https://github.com/storybookjs/storybook/pull/3154)

#### Bug Fixes

- Addons: avoid mixing manager and preview code together [#3068](https://github.com/storybookjs/storybook/pull/3068)

#### Documentation

- Update ADDONS_SUPPORT.md [#3114](https://github.com/storybookjs/storybook/pull/3114)
- Add `viewport` addon to the Addon Gallery [#3106](https://github.com/storybookjs/storybook/pull/3106)
- Fix links examples [#3096](https://github.com/storybookjs/storybook/pull/3096)
- Fix links addon examples [#3070](https://github.com/storybookjs/storybook/pull/3070)
- Fix inconsistencies in the background add-on README [#3080](https://github.com/storybookjs/storybook/pull/3080)

#### Maintenance

- Fix errors on starting example Angular app [#3078](https://github.com/storybookjs/storybook/pull/3078)
- Use WatchMissingNodeModulesPlugin from react-dev-utils package [#3141](https://github.com/storybookjs/storybook/pull/3141)
- Don't use exact versions in peerDependencies [#3073](https://github.com/storybookjs/storybook/pull/3073)
- Remove integration tests [#3052](https://github.com/storybookjs/storybook/pull/3052)

#### Dependency Upgrades

<details>
<summary>
229 Updates
</summary>

- Upgraded `jscodeshift` in `lib/codemod` from "0.4.1" to "0.5.0" [#3168](https://github.com/storybookjs/storybook/pull/3168)
- Upgraded `vue-loader` in `app/vue` from "14.1.1" to "14.2.1" [#3168](https://github.com/storybookjs/storybook/pull/3168)
- Upgraded `jscodeshift` in `lib/cli` from "0.4.1" to "0.5.0" [#3168](https://github.com/storybookjs/storybook/pull/3168)
- Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "14.1.1" to "14.2.1" [#3168](https://github.com/storybookjs/storybook/pull/3168)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.14" to "3.3.15" [#3167](https://github.com/storybookjs/storybook/pull/3167)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.14" to "3.3.15" [#3167](https://github.com/storybookjs/storybook/pull/3167)
- Upgraded `@storybook/addons` in `/docs` from "3.3.14" to "3.3.15" [#3167](https://github.com/storybookjs/storybook/pull/3167)
- Upgraded `@storybook/react` in `/docs` from "3.3.14" to "3.3.15" [#3167](https://github.com/storybookjs/storybook/pull/3167)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.55" to "1.5.56" [#3167](https://github.com/storybookjs/storybook/pull/3167)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.34" to "1.7.36" [#3167](https://github.com/storybookjs/storybook/pull/3167)
- Upgraded `gatsby` in `/docs` from "1.9.223" to "1.9.225" [#3167](https://github.com/storybookjs/storybook/pull/3167)
- Upgraded `eslint-plugin-jest` in `/` from "21.12.3" to "21.13.0" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `babel-loader` in `app/react` from "7.1.3" to "7.1.4" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `case-sensitive-paths-webpack-plugin` in `app/react` from "2.1.1" to "2.1.2" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `acorn` in `addons/storysource` from "5.5.0" to "5.5.1" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `react-syntax-highlighter` in `addons/storysource` from "7.0.1" to "7.0.2" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `babel-loader` in `app/angular` from "7.1.3" to "7.1.4" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `case-sensitive-paths-webpack-plugin` in `app/angular` from "2.1.1" to "2.1.2" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `babel-loader` in `app/polymer` from "7.1.3" to "7.1.4" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `case-sensitive-paths-webpack-plugin` in `app/polymer` from "2.1.1" to "2.1.2" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `babel-loader` in `app/react-native` from "7.1.3" to "7.1.4" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `case-sensitive-paths-webpack-plugin` in `app/react-native` from "2.1.1" to "2.1.2" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `babel-loader` in `app/vue` from "7.1.3" to "7.1.4" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `case-sensitive-paths-webpack-plugin` in `app/vue` from "2.1.1" to "2.1.2" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `karma-coverage-istanbul-reporter` in `examples/angular-cli` from "1.4.1" to "1.4.2" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `babel-loader` in `examples/polymer-cli` from "7.1.3" to "7.1.4" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `babel-loader` in `examples/vue-kitchen-sink` from "7.1.3" to "7.1.4" [#3160](https://github.com/storybookjs/storybook/pull/3160)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.38" to "1.6.39" [#3159](https://github.com/storybookjs/storybook/pull/3159)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.54" to "1.5.55" [#3159](https://github.com/storybookjs/storybook/pull/3159)
- Update jest-specific-snapshot in addons/storyshots from 0.4.0 to 0.5.0 [#3151](https://github.com/storybookjs/storybook/pull/3151)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.37" to "1.6.38" [#3146](https://github.com/storybookjs/storybook/pull/3146)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.53" to "1.5.54" [#3146](https://github.com/storybookjs/storybook/pull/3146)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.25" to "1.5.26" [#3146](https://github.com/storybookjs/storybook/pull/3146)
- Upgraded `gatsby` in `/docs` from "1.9.222" to "1.9.223" [#3146](https://github.com/storybookjs/storybook/pull/3146)
- Upgraded `webpack-hot-middleware` in `app/react` from "2.21.1" to "2.21.2" [#3145](https://github.com/storybookjs/storybook/pull/3145)
- Upgraded `webpack-hot-middleware` in `lib/core` from "2.21.1" to "2.21.2" [#3145](https://github.com/storybookjs/storybook/pull/3145)
- Upgraded `webpack-hot-middleware` in `app/angular` from "2.21.1" to "2.21.2" [#3145](https://github.com/storybookjs/storybook/pull/3145)
- Upgraded `webpack-hot-middleware` in `app/polymer` from "2.21.1" to "2.21.2" [#3145](https://github.com/storybookjs/storybook/pull/3145)
- Upgraded `webpack-hot-middleware` in `app/react-native` from "2.21.1" to "2.21.2" [#3145](https://github.com/storybookjs/storybook/pull/3145)
- Upgraded `webpack-hot-middleware` in `app/vue` from "2.21.1" to "2.21.2" [#3145](https://github.com/storybookjs/storybook/pull/3145)
- Upgraded `babel-plugin-macros` in `/` from "2.1.0" to "2.2.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `chalk` in `/` from "2.3.1" to "2.3.2" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `eslint` in `/` from "4.18.1" to "4.18.2" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `eslint-plugin-jest` in `/` from "21.12.2" to "21.12.3" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `babel-plugin-macros` in `app/react` from "2.1.0" to "2.2.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `glamorous` in `app/react` from "4.11.6" to "4.12.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `glamorous` in `addons/actions` from "4.11.6" to "4.12.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `glamorous` in `lib/components` from "4.11.6" to "4.12.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `glamorous` in `addons/a11y` from "4.11.6" to "4.12.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `glamorous` in `addons/info` from "4.11.6" to "4.12.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `glamorous` in `addons/jest` from "4.11.6" to "4.12.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `moment` in `addons/knobs` from "2.20.1" to "2.21.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `chalk` in `lib/core` from "2.3.1" to "2.3.2" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `babel-plugin-macros` in `app/angular` from "2.1.0" to "2.2.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `sass-loader` in `app/angular` from "6.0.6" to "6.0.7" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `babel-plugin-macros` in `app/polymer` from "2.1.0" to "2.2.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `babel-plugin-macros` in `app/react-native` from "2.1.0" to "2.2.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `babel-plugin-macros` in `app/vue` from "2.1.0" to "2.2.0" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `chalk` in `lib/cli` from "2.3.1" to "2.3.2" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `cross-spawn` in `lib/cli` from "6.0.4" to "6.0.5" [#3137](https://github.com/storybookjs/storybook/pull/3137)
- Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.29" to "1.5.30" [#3136](https://github.com/storybookjs/storybook/pull/3136)
- Upgraded `gatsby` in `/docs` from "1.9.221" to "1.9.222" [#3136](https://github.com/storybookjs/storybook/pull/3136)
- Upgraded `gatsby-link` in `/docs` from "1.6.37" to "1.6.38" [#3124](https://github.com/storybookjs/storybook/pull/3124)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.35" to "1.6.37" [#3124](https://github.com/storybookjs/storybook/pull/3124)
- Upgraded `gatsby-remark-autolink-headers` in `/docs` from "1.4.12" to "1.4.13" [#3124](https://github.com/storybookjs/storybook/pull/3124)
- Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.28" to "1.5.29" [#3124](https://github.com/storybookjs/storybook/pull/3124)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.51" to "1.5.53" [#3124](https://github.com/storybookjs/storybook/pull/3124)
- Upgraded `gatsby-remark-smartypants` in `/docs` from "1.4.11" to "1.4.12" [#3124](https://github.com/storybookjs/storybook/pull/3124)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.24" to "1.5.25" [#3124](https://github.com/storybookjs/storybook/pull/3124)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.33" to "1.7.34" [#3124](https://github.com/storybookjs/storybook/pull/3124)
- Upgraded `gatsby` in `/docs` from "1.9.216" to "1.9.221" [#3124](https://github.com/storybookjs/storybook/pull/3124)
- Upgraded `codelyzer` in `/` from "4.1.0" to "4.2.1" [#3131](https://github.com/storybookjs/storybook/pull/3131)
- Upgraded `file-loader` in `lib/core` from "1.1.10" to "1.1.11" [#3131](https://github.com/storybookjs/storybook/pull/3131)
- Upgraded `copy-webpack-plugin` in `app/polymer` from "4.4.2" to "4.5.0" [#3131](https://github.com/storybookjs/storybook/pull/3131)
- Upgraded `copy-webpack-plugin` in `examples/polymer-cli` from "4.4.2" to "4.5.0" [#3131](https://github.com/storybookjs/storybook/pull/3131)
- Upgraded `file-loader` in `examples/vue-kitchen-sink` from "1.1.10" to "1.1.11" [#3131](https://github.com/storybookjs/storybook/pull/3131)
- Upgraded `@angular/common` in `/` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/compiler` in `/` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/core` in `/` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/forms` in `/` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/platform-browser` in `/` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/platform-browser-dynamic` in `/` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `prettier` in `/` from "1.11.0" to "1.11.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `prettier` in `addons/storysource` from "1.11.0" to "1.11.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `babel-plugin-react-docgen` in `app/react` from "1.8.2" to "1.8.3" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `webpack-hot-middleware` in `app/react` from "2.21.0" to "2.21.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `nodemon` in `app/react` from "1.15.1" to "1.17.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `jest-specific-snapshot` in `addons/storyshots` from "0.3.0" to "0.4.0" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `react-color` in `addons/knobs` from "2.13.8" to "2.14.0" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `webpack-hot-middleware` in `lib/core` from "2.21.0" to "2.21.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `webpack-hot-middleware` in `app/angular` from "2.21.0" to "2.21.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `nodemon` in `app/angular` from "1.15.1" to "1.17.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `webpack-hot-middleware` in `app/polymer` from "2.21.0" to "2.21.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `nodemon` in `app/polymer` from "1.15.1" to "1.17.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `webpack-hot-middleware` in `app/react-native` from "2.21.0" to "2.21.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `webpack-hot-middleware` in `app/vue` from "2.21.0" to "2.21.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `nodemon` in `app/vue` from "1.15.1" to "1.17.1" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.7.1" to "1.7.2" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.6" to "5.2.7" [#3123](https://github.com/storybookjs/storybook/pull/3123)
- Vue example: upgrade vue-loader from 13.7.1 to 14.1.1 [#3077](https://github.com/storybookjs/storybook/pull/3077)
- Maintenance: upgrade lint-staged from `6.1.1` to `7.0.0` [#3067](https://github.com/storybookjs/storybook/pull/3067)
- Core & UI: upgrade events from 1.1.1 to 2.0.0 [#3075](https://github.com/storybookjs/storybook/pull/3075)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.34" to "1.6.35" [#3109](https://github.com/storybookjs/storybook/pull/3109)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.50" to "1.5.51" [#3109](https://github.com/storybookjs/storybook/pull/3109)
- Upgraded `gatsby` in `/docs` from "1.9.215" to "1.9.216" [#3109](https://github.com/storybookjs/storybook/pull/3109)
- Upgraded `marked` in `/docs` from "0.3.16" to "0.3.17" [#3109](https://github.com/storybookjs/storybook/pull/3109)
- Upgraded `prop-types` in `/docs` from "15.6.0" to "15.6.1" [#3109](https://github.com/storybookjs/storybook/pull/3109)
- RN app: upgrade ws from 3.3.3 to 4.1.0 [#3074](https://github.com/storybookjs/storybook/pull/3074)
- Upgraded `prettier` in `/` from "1.10.2" to "1.11.0" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/background` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/events` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `acorn` in `addons/storysource` from "5.4.1" to "5.5.0" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `acorn-stage3` in `addons/storysource` from "0.5.0" to "0.6.0" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prettier` in `addons/storysource` from "1.10.2" to "1.11.0" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/storysource` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `dotenv-webpack` in `app/react` from "1.5.4" to "1.5.5" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `app/react` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/graphql` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `marked` in `addons/notes` from "0.3.16" to "0.3.17" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/notes` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/actions` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/links` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `lib/components` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/a11y` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/info` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/jest` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/knobs` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `addons/viewport` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `lib/ui` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `dotenv` in `lib/core` from "5.0.0" to "5.0.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `file-loader` in `lib/core` from "1.1.9" to "1.1.10" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `lib/core` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `examples/cra-kitchen-sink` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `examples/official-storybook` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `dotenv-webpack` in `app/angular` from "1.5.4" to "1.5.5" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `dotenv-webpack` in `app/polymer` from "1.5.4" to "1.5.5" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `prop-types` in `app/react-native` from "15.6.0" to "15.6.1" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `dotenv-webpack` in `app/vue` from "1.5.4" to "1.5.5" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `webpack-dev-server` in `examples/polymer-cli` from "2.11.1" to "2.11.2" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `file-loader` in `examples/vue-kitchen-sink` from "1.1.9" to "1.1.10" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "2.11.1" to "2.11.2" [#3108](https://github.com/storybookjs/storybook/pull/3108)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.23" to "1.5.24" [#3103](https://github.com/storybookjs/storybook/pull/3103)
- Upgraded `gatsby` in `/docs` from "1.9.214" to "1.9.215" [#3103](https://github.com/storybookjs/storybook/pull/3103)
- Upgraded `jest-preset-angular` in `/` from "5.1.0" to "5.2.0" [#3104](https://github.com/storybookjs/storybook/pull/3104)
- Upgraded `postcss-loader` in `lib/core` from "2.1.0" to "2.1.1" [#3104](https://github.com/storybookjs/storybook/pull/3104)
- Upgraded `tslint-config-prettier` in `/` from "1.8.0" to "1.9.0" [#3097](https://github.com/storybookjs/storybook/pull/3097)
- Upgraded `babel-loader` in `app/react` from "7.1.2" to "7.1.3" [#3097](https://github.com/storybookjs/storybook/pull/3097)
- Upgraded `babel-loader` in `app/angular` from "7.1.2" to "7.1.3" [#3097](https://github.com/storybookjs/storybook/pull/3097)
- Upgraded `babel-loader` in `app/polymer` from "7.1.2" to "7.1.3" [#3097](https://github.com/storybookjs/storybook/pull/3097)
- Upgraded `babel-loader` in `app/react-native` from "7.1.2" to "7.1.3" [#3097](https://github.com/storybookjs/storybook/pull/3097)
- Upgraded `babel-loader` in `app/vue` from "7.1.2" to "7.1.3" [#3097](https://github.com/storybookjs/storybook/pull/3097)
- Upgraded `babel-loader` in `examples/polymer-cli` from "7.1.2" to "7.1.3" [#3097](https://github.com/storybookjs/storybook/pull/3097)
- Upgraded `babel-loader` in `examples/vue-kitchen-sink` from "7.1.2" to "7.1.3" [#3097](https://github.com/storybookjs/storybook/pull/3097)
- Update gatsby in /docs from 1.9.212 to 1.9.214 [#3095](https://github.com/storybookjs/storybook/pull/3095)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.33" to "1.6.34" [#3071](https://github.com/storybookjs/storybook/pull/3071)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.49" to "1.5.50" [#3071](https://github.com/storybookjs/storybook/pull/3071)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.22" to "1.5.23" [#3071](https://github.com/storybookjs/storybook/pull/3071)
- Upgraded `gatsby` in `/docs` from "1.9.209" to "1.9.212" [#3071](https://github.com/storybookjs/storybook/pull/3071)
- Upgraded `puppeteer` in `/` from "1.1.0" to "1.1.1" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `react-syntax-highlighter` in `addons/storysource` from "7.0.0" to "7.0.1" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `uglifyjs-webpack-plugin` in `app/react` from "1.2.0" to "1.2.2" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `puppeteer` in `addons/storyshots` from "1.0.0" to "1.1.1" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `uglifyjs-webpack-plugin` in `app/angular` from "1.2.0" to "1.2.2" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `copy-webpack-plugin` in `app/polymer` from "4.4.1" to "4.4.2" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `uglifyjs-webpack-plugin` in `app/polymer` from "1.2.0" to "1.2.2" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `uglifyjs-webpack-plugin` in `app/react-native` from "1.2.0" to "1.2.2" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `uglifyjs-webpack-plugin` in `app/vue` from "1.2.0" to "1.2.2" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `copy-webpack-plugin` in `examples/polymer-cli` from "4.4.1" to "4.4.2" [#3069](https://github.com/storybookjs/storybook/pull/3069)
- Upgraded `jest` in `/` from "22.4.0" to "22.4.2" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `jest-cli` in `/` from "22.4.0" to "22.4.2" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `jest-config` in `/` from "22.4.0" to "22.4.2" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `jest-environment-jsdom` in `/` from "22.4.0" to "22.4.1" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `jest-jasmine2` in `/` from "22.4.0" to "22.4.2" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `css-loader` in `app/react` from "0.28.9" to "0.28.10" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `babel-jest` in `addons/storyshots` from "22.4.0" to "22.4.1" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `jest` in `addons/storyshots` from "22.4.0" to "22.4.2" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `jest-cli` in `addons/storyshots` from "22.4.0" to "22.4.2" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `css-loader` in `lib/core` from "0.28.9" to "0.28.10" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `babel-jest` in `examples/cra-kitchen-sink` from "22.4.0" to "22.4.1" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.4.0" to "22.4.2" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `babel-jest` in `examples/official-storybook` from "22.4.0" to "22.4.1" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `jest` in `examples/official-storybook` from "22.4.0" to "22.4.2" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `css-loader` in `app/angular` from "0.28.9" to "0.28.10" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `css-loader` in `app/polymer` from "0.28.9" to "0.28.10" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `css-loader` in `app/react-native` from "0.28.9" to "0.28.10" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `css-loader` in `app/vue` from "0.28.9" to "0.28.10" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `css-loader` in `examples/vue-kitchen-sink` from "0.28.9" to "0.28.10" [#3063](https://github.com/storybookjs/storybook/pull/3063)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.32" to "1.6.33" [#3064](https://github.com/storybookjs/storybook/pull/3064)
- Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.27" to "1.5.28" [#3064](https://github.com/storybookjs/storybook/pull/3064)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.48" to "1.5.49" [#3064](https://github.com/storybookjs/storybook/pull/3064)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.21" to "1.5.22" [#3064](https://github.com/storybookjs/storybook/pull/3064)
- Upgraded `gatsby` in `/docs` from "1.9.206" to "1.9.209" [#3064](https://github.com/storybookjs/storybook/pull/3064)
- Upgraded `@angular/common` in `/` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/compiler` in `/` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/core` in `/` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/forms` in `/` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/platform-browser` in `/` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/platform-browser-dynamic` in `/` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `eslint-plugin-import` in `/` from "2.8.0" to "2.9.0" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `jest-preset-angular` in `/` from "5.0.0" to "5.1.0" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `file-loader` in `app/react` from "1.1.8" to "1.1.9" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `file-loader` in `lib/core` from "1.1.8" to "1.1.9" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `react-chromatic` in `examples/official-storybook` from "0.7.9" to "0.7.10" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `file-loader` in `app/angular` from "1.1.8" to "1.1.9" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `file-loader` in `app/polymer` from "1.1.8" to "1.1.9" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `file-loader` in `app/react-native` from "1.1.8" to "1.1.9" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `file-loader` in `app/vue` from "1.1.8" to "1.1.9" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/animations` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/http` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/router` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.7.0" to "1.7.1" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `@angular/language-service` in `examples/angular-cli` from "5.2.5" to "5.2.6" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `file-loader` in `examples/vue-kitchen-sink` from "1.1.8" to "1.1.9" [#3055](https://github.com/storybookjs/storybook/pull/3055)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.31" to "1.6.32" [#3056](https://github.com/storybookjs/storybook/pull/3056)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.47" to "1.5.48" [#3056](https://github.com/storybookjs/storybook/pull/3056)
- Upgraded `gatsby` in `/docs` from "1.9.204" to "1.9.206" [#3056](https://github.com/storybookjs/storybook/pull/3056)

</details>

## 3.3.15

2018-March-07

#### Bug Fixes

- Unset background when switching to a non-background story [#3142](https://github.com/storybookjs/storybook/pull/3142)
- Updated testIds in RN StoryListView to use kind [#3129](https://github.com/storybookjs/storybook/pull/3129)
- Added missing key prop to NoTests component. [#3111](https://github.com/storybookjs/storybook/pull/3111)
- Events addon: fix React keys warning [#3072](https://github.com/storybookjs/storybook/pull/3072)

## 3.4.0-alpha.9

2018-February-22

#### Features

- Addon-storysource: story source in addon pane [#2885](https://github.com/storybookjs/storybook/pull/2885)
- Addon Storysource improvements [#3040](https://github.com/storybookjs/storybook/pull/3040)
- Add moduleMetadata decorator for supplying common Angular metadata [#2959](https://github.com/storybookjs/storybook/pull/2959)
- `Addon Storysource` Add auto scrolling to the selected story [#3025](https://github.com/storybookjs/storybook/pull/3025)
- Enable groupId option for knobs to be organized into sub panels. [#2661](https://github.com/storybookjs/storybook/pull/2661)
- Added beforeScreenshot config option to addons/storyshots, to allow testing of components with mounting animations [#2972](https://github.com/storybookjs/storybook/pull/2972)
- Add GitHub flavored markdown notes [#2946](https://github.com/storybookjs/storybook/pull/2946)

#### Bug Fixes

- Fix problem with RN on latest `master` build [#3045](https://github.com/storybookjs/storybook/pull/3045)
- Use @storybook/podda to fix npm engine version in podda [#3033](https://github.com/storybookjs/storybook/pull/3033)

#### Documentation

- Revisit addon/framework support [#3046](https://github.com/storybookjs/storybook/pull/3046)
- Docs live examples [#3019](https://github.com/storybookjs/storybook/pull/3019)
- Mention new supported frameworks [#2895](https://github.com/storybookjs/storybook/pull/2895)

#### Maintenance

- Use core client api in react native [#3036](https://github.com/storybookjs/storybook/pull/3036)
- Optimize CI workflow [#3016](https://github.com/storybookjs/storybook/pull/3016)
- Integration tests: wait until stories appear [#3027](https://github.com/storybookjs/storybook/pull/3027)
- Add netlify for polymer [#3004](https://github.com/storybookjs/storybook/pull/3004)
- Add built storybooks to official storybook [#2958](https://github.com/storybookjs/storybook/pull/2958)

#### Dependency Upgrades

<details>
<summary>
169 Updates
</summary>

- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.13" to "3.3.14" [#3051](https://github.com/storybookjs/storybook/pull/3051)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.13" to "3.3.14" [#3051](https://github.com/storybookjs/storybook/pull/3051)
- Upgraded `@storybook/addons` in `/docs` from "3.3.13" to "3.3.14" [#3051](https://github.com/storybookjs/storybook/pull/3051)
- Upgraded `@storybook/react` in `/docs` from "3.3.13" to "3.3.14" [#3051](https://github.com/storybookjs/storybook/pull/3051)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.20" to "1.5.21" [#3051](https://github.com/storybookjs/storybook/pull/3051)
- Upgraded `gatsby` in `/docs` from "1.9.203" to "1.9.204" [#3051](https://github.com/storybookjs/storybook/pull/3051)
- Upgraded `marked` in `/docs` from "0.3.15" to "0.3.16" [#3051](https://github.com/storybookjs/storybook/pull/3051)
- Upgraded `eslint` in `/` from "4.18.0" to "4.18.1" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `jscodeshift` in `lib/codemod` from "0.4.0" to "0.4.1" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `file-loader` in `app/react` from "1.1.7" to "1.1.8" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `marked` in `addons/notes` from "0.3.15" to "0.3.16" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `react-modal` in `lib/ui` from "3.2.1" to "3.3.1" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `file-loader` in `lib/core` from "1.1.7" to "1.1.8" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `file-loader` in `app/angular` from "1.1.7" to "1.1.8" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `react-modal` in `app/angular` from "3.2.1" to "3.3.1" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `ts-loader` in `app/angular` from "3.3.1" to "3.5.0" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `file-loader` in `app/polymer` from "1.1.7" to "1.1.8" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `react-modal` in `app/polymer` from "3.2.1" to "3.3.1" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `file-loader` in `app/react-native` from "1.1.7" to "1.1.8" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `file-loader` in `app/vue` from "1.1.7" to "1.1.8" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `vue-hot-reload-api` in `app/vue` from "2.2.4" to "2.3.0" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `jscodeshift` in `lib/cli` from "0.4.0" to "0.4.1" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `file-loader` in `examples/vue-kitchen-sink` from "1.1.7" to "1.1.8" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `vue-hot-reload-api` in `examples/vue-kitchen-sink` from "2.2.4" to "2.3.0" [#3050](https://github.com/storybookjs/storybook/pull/3050)
- Upgraded `babel-eslint` in `/` from "8.2.1" to "8.2.2" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest` in `/` from "22.3.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest-cli` in `/` from "22.3.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest-config` in `/` from "22.3.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest-diff` in `/` from "22.1.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest-environment-jsdom` in `/` from "22.3.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest-jasmine2` in `/` from "22.3.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `babel-jest` in `addons/storyshots` from "22.1.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest` in `addons/storyshots` from "22.3.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest-cli` in `addons/storyshots` from "22.3.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `babel-jest` in `examples/cra-kitchen-sink` from "22.2.2" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.3.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `babel-jest` in `examples/official-storybook` from "22.1.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Upgraded `jest` in `examples/official-storybook` from "22.3.0" to "22.4.0" [#3041](https://github.com/storybookjs/storybook/pull/3041)
- Addon-storyshots: upgrade puppeteer to 1.0.0 [#2853](https://github.com/storybookjs/storybook/pull/2853)
- App-angular: upgrade ts-loader to 3.3.1 [#2855](https://github.com/storybookjs/storybook/pull/2855)
- Update cross-spawn in lib/cli from 6.0.3 to 6.0.4 [#3039](https://github.com/storybookjs/storybook/pull/3039)
- Update eslint-plugin-react in / from 7.6.1 to 7.7.0 [#3037](https://github.com/storybookjs/storybook/pull/3037)
- CLI: upgrade cross-spawn to 6.0.3 [#2854](https://github.com/storybookjs/storybook/pull/2854)
- Update gatsby in /docs from 1.9.202 to 1.9.203 [#3034](https://github.com/storybookjs/storybook/pull/3034)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.30" to "1.6.31" [#3030](https://github.com/storybookjs/storybook/pull/3030)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.46" to "1.5.47" [#3030](https://github.com/storybookjs/storybook/pull/3030)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.32" to "1.7.33" [#3030](https://github.com/storybookjs/storybook/pull/3030)
- Upgraded `nodemon` in `/` from "1.15.0" to "1.15.1" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `file-loader` in `app/react` from "1.1.6" to "1.1.7" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `nodemon` in `app/react` from "1.15.0" to "1.15.1" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `file-loader` in `lib/core` from "1.1.6" to "1.1.7" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `file-loader` in `app/angular` from "1.1.6" to "1.1.7" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `nodemon` in `app/angular` from "1.15.0" to "1.15.1" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `file-loader` in `app/polymer` from "1.1.6" to "1.1.7" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `nodemon` in `app/polymer` from "1.15.0" to "1.15.1" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `file-loader` in `app/react-native` from "1.1.6" to "1.1.7" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `file-loader` in `app/vue` from "1.1.6" to "1.1.7" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `nodemon` in `app/vue` from "1.15.0" to "1.15.1" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Upgraded `file-loader` in `examples/vue-kitchen-sink` from "1.1.6" to "1.1.7" [#3028](https://github.com/storybookjs/storybook/pull/3028)
- Update marked in /docs from 0.3.14 to 0.3.15 [#3021](https://github.com/storybookjs/storybook/pull/3021)
- Core: upgrade dotenv to 5.0.0 [#2878](https://github.com/storybookjs/storybook/pull/2878)
- Update acorn-stage3 in addons/storysource from 0.4.0 to 0.5.0 [#3014](https://github.com/storybookjs/storybook/pull/3014)
- Update gatsby in /docs from 1.9.201 to 1.9.202 [#3012](https://github.com/storybookjs/storybook/pull/3012)
- Update marked in addons/notes from 0.3.12 to 0.3.14 [#3015](https://github.com/storybookjs/storybook/pull/3015)
- Upgraded `danger` in `/` from "3.1.6" to "3.1.7" [#3013](https://github.com/storybookjs/storybook/pull/3013)
- Upgraded `eslint-plugin-jest` in `/` from "21.12.1" to "21.12.2" [#3013](https://github.com/storybookjs/storybook/pull/3013)
- Upgraded `glamorous` in `lib/components` from "4.11.5" to "4.11.6" [#3009](https://github.com/storybookjs/storybook/pull/3009)
- Upgraded `glamorous` in `addons/a11y` from "4.11.5" to "4.11.6" [#3009](https://github.com/storybookjs/storybook/pull/3009)
- Upgraded `glamorous` in `addons/info` from "4.11.5" to "4.11.6" [#3009](https://github.com/storybookjs/storybook/pull/3009)
- Upgraded `glamorous` in `addons/jest` from "4.11.5" to "4.11.6" [#3009](https://github.com/storybookjs/storybook/pull/3009)
- Upgraded `glamorous` in `app/react` from "4.11.5" to "4.11.6" [#3009](https://github.com/storybookjs/storybook/pull/3009)
- Upgraded `glamorous` in `examples/cra-kitchen-sink` from "4.11.5" to "4.11.6" [#3009](https://github.com/storybookjs/storybook/pull/3009)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.29" to "1.6.30" [#3008](https://github.com/storybookjs/storybook/pull/3008)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.45" to "1.5.46" [#3008](https://github.com/storybookjs/storybook/pull/3008)
- Upgraded `eslint` in `/` from "4.17.0" to "4.18.0" [#3006](https://github.com/storybookjs/storybook/pull/3006)
- Upgraded `uglifyjs-webpack-plugin` in `app/angular` from "1.1.8" to "1.2.0" [#3006](https://github.com/storybookjs/storybook/pull/3006)
- Upgraded `uglifyjs-webpack-plugin` in `app/polymer` from "1.1.8" to "1.2.0" [#3006](https://github.com/storybookjs/storybook/pull/3006)
- Upgraded `uglifyjs-webpack-plugin` in `app/react-native` from "1.1.8" to "1.2.0" [#3006](https://github.com/storybookjs/storybook/pull/3006)
- Upgraded `uglifyjs-webpack-plugin` in `app/react` from "1.1.8" to "1.2.0" [#3006](https://github.com/storybookjs/storybook/pull/3006)
- Upgraded `uglifyjs-webpack-plugin` in `app/vue` from "1.1.8" to "1.2.0" [#3006](https://github.com/storybookjs/storybook/pull/3006)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.28" to "1.6.29" [#3005](https://github.com/storybookjs/storybook/pull/3005)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.44" to "1.5.45" [#3005](https://github.com/storybookjs/storybook/pull/3005)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.19" to "1.5.20" [#3005](https://github.com/storybookjs/storybook/pull/3005)
- Upgraded `gatsby` in `/docs` from "1.9.200" to "1.9.201" [#3005](https://github.com/storybookjs/storybook/pull/3005)
- Upgraded `lint-staged` in `/` from "6.1.0" to "6.1.1" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `nodemon` in `/` from "1.14.12" to "1.15.0" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `puppeteer` in `/` from "1.0.0" to "1.1.0" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `typescript` in `/` from "2.7.1" to "2.7.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `graphql` in `addons/graphql` from "0.13.0" to "0.13.1" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `style-loader` in `addons/knobs` from "0.20.1" to "0.20.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `glamorous` in `lib/components` from "4.11.4" to "4.11.5" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `glamorous` in `addons/a11y` from "4.11.4" to "4.11.5" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `glamorous` in `addons/info` from "4.11.4" to "4.11.5" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `glamorous` in `addons/jest` from "4.11.4" to "4.11.5" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `style-loader` in `lib/core` from "0.20.1" to "0.20.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `style-loader` in `app/angular` from "0.20.1" to "0.20.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `nodemon` in `app/angular` from "1.14.12" to "1.15.0" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `typescript` in `app/angular` from "2.7.1" to "2.7.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `style-loader` in `app/polymer` from "0.20.1" to "0.20.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `nodemon` in `app/polymer` from "1.14.12" to "1.15.0" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `style-loader` in `app/react-native` from "0.20.1" to "0.20.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `glamorous` in `app/react` from "4.11.4" to "4.11.5" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `style-loader` in `app/react` from "0.20.1" to "0.20.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `nodemon` in `app/react` from "1.14.12" to "1.15.0" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `style-loader` in `app/vue` from "0.20.1" to "0.20.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `nodemon` in `app/vue` from "1.14.12" to "1.15.0" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.6.8" to "1.7.0" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `typescript` in `examples/angular-cli` from "2.7.1" to "2.7.2" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Upgraded `glamorous` in `examples/cra-kitchen-sink` from "4.11.4" to "4.11.5" [#3003](https://github.com/storybookjs/storybook/pull/3003)
- Update gatsby in /docs from 1.9.199 to 1.9.200 [#3001](https://github.com/storybookjs/storybook/pull/3001)
- Update marked in /docs from 0.3.12 to 0.3.14 [#2999](https://github.com/storybookjs/storybook/pull/2999)
- Upgraded `react-modal` in `lib/ui` from "3.1.13" to "3.2.1" [#2992](https://github.com/storybookjs/storybook/pull/2992)
- Upgraded `react-modal` in `app/angular` from "3.1.13" to "3.2.1" [#2992](https://github.com/storybookjs/storybook/pull/2992)
- Upgraded `react-modal` in `app/polymer` from "3.1.13" to "3.2.1" [#2992](https://github.com/storybookjs/storybook/pull/2992)
- Update 8 dependencies from npm [#2978](https://github.com/storybookjs/storybook/pull/2978)
- Update make-error in addons/actions from 1.3.3 to 1.3.4 [#2991](https://github.com/storybookjs/storybook/pull/2991)
- Update 2 dependencies from npm [#2712](https://github.com/storybookjs/storybook/pull/2712)
- Update tslint-config-prettier in / from 1.7.0 to 1.8.0 [#2990](https://github.com/storybookjs/storybook/pull/2990)
- Update lerna in / from 2.8.0 to 2.9.0 [#2987](https://github.com/storybookjs/storybook/pull/2987)
- Update `eslint-plugin-react` in `/` from "7.6.0" to "7.6.1" [#2864](https://github.com/storybookjs/storybook/pull/2864)
- Upgraded `@angular/common` in `/` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/compiler` in `/` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/core` in `/` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/forms` in `/` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/platform-browser` in `/` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/platform-browser-dynamic` in `/` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `jest` in `/` from "22.2.1" to "22.3.0" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `jest-cli` in `/` from "22.2.2" to "22.3.0" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `jest-config` in `/` from "22.2.2" to "22.3.0" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `jest-environment-jsdom` in `/` from "22.2.2" to "22.3.0" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `jest-jasmine2` in `/` from "22.2.2" to "22.3.0" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `jest` in `addons/storyshots` from "22.1.4" to "22.3.0" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `jest-cli` in `addons/storyshots` from "22.1.4" to "22.3.0" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/animations` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/http` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/router` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@angular/language-service` in `examples/angular-cli` from "5.2.4" to "5.2.5" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `@types/node` in `examples/angular-cli` from "9.4.5" to "9.4.6" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.2.2" to "22.3.0" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Upgraded `jest` in `examples/official-storybook` from "22.1.4" to "22.3.0" [#2986](https://github.com/storybookjs/storybook/pull/2986)
- Update gatsby in /docs from 1.9.198 to 1.9.199 [#2988](https://github.com/storybookjs/storybook/pull/2988)
- Update gatsby in /docs from 1.9.197 to 1.9.198 [#2985](https://github.com/storybookjs/storybook/pull/2985)
- Update gatsby in /docs from 1.9.193 to 1.9.197 [#2983](https://github.com/storybookjs/storybook/pull/2983)
- Upgraded `danger` in `/` from "3.1.3" to "3.1.6" [#2977](https://github.com/storybookjs/storybook/pull/2977)
- Upgraded `eslint-plugin-jest` in `/` from "21.12.0" to "21.12.1" [#2977](https://github.com/storybookjs/storybook/pull/2977)
- Upgraded `inquirer` in `/` from "5.0.1" to "5.1.0" [#2977](https://github.com/storybookjs/storybook/pull/2977)
- Upgraded `react-fuzzy` in `lib/ui` from "0.5.1" to "0.5.2" [#2977](https://github.com/storybookjs/storybook/pull/2977)
- Upgraded `@types/node` in `examples/angular-cli` from "9.4.0" to "9.4.5" [#2977](https://github.com/storybookjs/storybook/pull/2977)
- Upgraded `babel-preset-vue` in `examples/vue-kitchen-sink` from "2.0.0" to "2.0.1" [#2977](https://github.com/storybookjs/storybook/pull/2977)
- Update gatsby in /docs from 1.9.188 to 1.9.193 [#2973](https://github.com/storybookjs/storybook/pull/2973)
- Upgraded `eslint-plugin-jest` in `/` from "21.8.0" to "21.12.0" [#2975](https://github.com/storybookjs/storybook/pull/2975)
- Upgraded `ts-jest` in `/` from "22.0.3" to "22.0.4" [#2975](https://github.com/storybookjs/storybook/pull/2975)
- Upgraded `react-datetime` in `addons/knobs` from "2.13.0" to "2.14.0" [#2975](https://github.com/storybookjs/storybook/pull/2975)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.12" to "3.3.13" [#2960](https://github.com/storybookjs/storybook/pull/2960)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.12" to "3.3.13" [#2960](https://github.com/storybookjs/storybook/pull/2960)
- Upgraded `@storybook/addons` in `/docs` from "3.3.12" to "3.3.13" [#2960](https://github.com/storybookjs/storybook/pull/2960)
- Upgraded `@storybook/react` in `/docs` from "3.3.12" to "3.3.13" [#2960](https://github.com/storybookjs/storybook/pull/2960)
- Upgraded `chalk` in `/` from "2.3.0" to "2.3.1" [#2961](https://github.com/storybookjs/storybook/pull/2961)
- Upgraded `chalk` in `lib/node-logger` from "2.3.0" to "2.3.1" [#2961](https://github.com/storybookjs/storybook/pull/2961)
- Upgraded `react-split-pane` in `lib/ui` from "0.1.76" to "0.1.77" [#2961](https://github.com/storybookjs/storybook/pull/2961)
- Upgraded `chalk` in `lib/core` from "2.3.0" to "2.3.1" [#2961](https://github.com/storybookjs/storybook/pull/2961)
- Upgraded `chalk` in `lib/cli` from "2.3.0" to "2.3.1" [#2961](https://github.com/storybookjs/storybook/pull/2961)

</details>

## 3.3.14

2018-February-21

#### Bug Fixes

- RN: Add error handler on WS to fix crashing on page reload [#3002](https://github.com/storybookjs/storybook/pull/3002)
- Added safety net preventing storybook Jest addon from throwing. [#3023](https://github.com/storybookjs/storybook/pull/3023)
- Added "key" prop to list items inside test failure message. [#2867](https://github.com/storybookjs/storybook/pull/2867)
- Addon-info: Add type check to PropType on OneOf [#2653](https://github.com/storybookjs/storybook/pull/2653)
- Use @storybook/podda to fix npm engine version in podda [#3033](https://github.com/storybookjs/storybook/pull/3033)
- Addon-backgrounds: set background on iframe instead of adding a wrapper in preview [#2807](https://github.com/storybookjs/storybook/pull/3033)

## 3.4.0-alpha.8

2018-February-11

#### Bug Fixes

- React-Native: Fix by moving managerPath export to `server.js` [#2947](https://github.com/storybookjs/storybook/pull/2947)
- Addon-Info: Add type check to PropType on OneOf [#2653](https://github.com/storybookjs/storybook/pull/2653)
- Vue: Support .vue extension resolving [#2896](https://github.com/storybookjs/storybook/pull/2896)

#### Documentation

- Update writing addons documentation [#2951](https://github.com/storybookjs/storybook/pull/2951)
- Update docs on LinkTo in addon-links [#2926](https://github.com/storybookjs/storybook/pull/2926)

#### Maintenance

- Fix "dev" script to be cross-platform [#2922](https://github.com/storybookjs/storybook/pull/2922)

#### Dependency Upgrades

<details>
<summary>
98 Updates
</summary>

- Upgraded `jest-cli` in `/` from "22.2.1" to "22.2.2" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `jest-config` in `/` from "22.2.1" to "22.2.2" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `jest-environment-jsdom` in `/` from "22.2.0" to "22.2.2" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `jest-jasmine2` in `/` from "22.2.1" to "22.2.2" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `autoprefixer` in `lib/core` from "7.2.5" to "7.2.6" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `webpack` in `lib/core` from "3.10.0" to "3.11.0" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `autoprefixer` in `app/angular` from "7.2.5" to "7.2.6" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `webpack` in `app/angular` from "3.10.0" to "3.11.0" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `autoprefixer` in `app/polymer` from "7.2.5" to "7.2.6" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `webpack` in `app/polymer` from "3.10.0" to "3.11.0" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `autoprefixer` in `app/react-native` from "7.2.5" to "7.2.6" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `webpack` in `app/react-native` from "3.10.0" to "3.11.0" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `autoprefixer` in `app/react` from "7.2.5" to "7.2.6" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `webpack` in `app/react` from "3.10.0" to "3.11.0" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `autoprefixer` in `app/vue` from "7.2.5" to "7.2.6" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `webpack` in `app/vue` from "3.10.0" to "3.11.0" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `webpack` in `examples/polymer-cli` from "3.10.0" to "3.11.0" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `@types/node` in `examples/angular-cli` from "6.0.99" to "6.0.100" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `webpack` in `examples/vue-kitchen-sink` from "3.10.0" to "3.11.0" [#2957](https://github.com/storybookjs/storybook/pull/2957)
- Upgraded `eslint-plugin-jest` in `/` from "21.7.0" to "21.8.0" [#2952](https://github.com/storybookjs/storybook/pull/2952)
- Upgraded `react-datetime` in `addons/knobs` from "2.12.0" to "2.13.0" [#2952](https://github.com/storybookjs/storybook/pull/2952)
- Upgraded `react-modal` in `lib/ui` from "3.1.12" to "3.1.13" [#2952](https://github.com/storybookjs/storybook/pull/2952)
- Upgraded `react-modal` in `app/angular` from "3.1.12" to "3.1.13" [#2952](https://github.com/storybookjs/storybook/pull/2952)
- Upgraded `react-modal` in `app/polymer` from "3.1.12" to "3.1.13" [#2952](https://github.com/storybookjs/storybook/pull/2952)
- Upgraded `babel-jest` in `examples/cra-kitchen-sink` from "22.2.0" to "22.2.2" [#2952](https://github.com/storybookjs/storybook/pull/2952)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.2.1" to "22.2.2" [#2952](https://github.com/storybookjs/storybook/pull/2952)
- Upgraded `react-scripts` in `examples/cra-kitchen-sink` from "1.1.0" to "1.1.1" [#2952](https://github.com/storybookjs/storybook/pull/2952)
- Update gatsby in /docs from 1.9.184 to 1.9.187 [#2950](https://github.com/storybookjs/storybook/pull/2950)
- Upgraded `copy-webpack-plugin` in `app/polymer` from "4.3.1" to "4.4.0" [#2945](https://github.com/storybookjs/storybook/pull/2945)
- Upgraded `copy-webpack-plugin` in `examples/polymer-cli` from "4.3.1" to "4.4.0" [#2945](https://github.com/storybookjs/storybook/pull/2945)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.6.7" to "1.6.8" [#2945](https://github.com/storybookjs/storybook/pull/2945)
- Upgraded `@types/node` in `examples/angular-cli` from "6.0.97" to "6.0.99" [#2945](https://github.com/storybookjs/storybook/pull/2945)
- Upgraded `jasmine-core` in `examples/angular-cli` from "2.99.0" to "2.99.1" [#2945](https://github.com/storybookjs/storybook/pull/2945)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.42" to "1.5.43" [#2944](https://github.com/storybookjs/storybook/pull/2944)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.30" to "1.7.31" [#2944](https://github.com/storybookjs/storybook/pull/2944)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.41" to "1.5.42" [#2939](https://github.com/storybookjs/storybook/pull/2939)
- Upgraded `gatsby` in `/docs` from "1.9.183" to "1.9.184" [#2939](https://github.com/storybookjs/storybook/pull/2939)
- Upgraded `@angular/common` in `/` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/compiler` in `/` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/core` in `/` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/forms` in `/` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/platform-browser` in `/` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/platform-browser-dynamic` in `/` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `commander` in `/` from "2.14.0" to "2.14.1" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `jest` in `/` from "22.1.4" to "22.2.0" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `jest-cli` in `/` from "22.1.4" to "22.2.0" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `jest-config` in `/` from "22.1.4" to "22.2.0" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `jest-environment-jsdom` in `/` from "22.1.4" to "22.2.0" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `jest-jasmine2` in `/` from "22.1.4" to "22.2.0" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `graphql` in `addons/graphql` from "0.12.3" to "0.13.0" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `commander` in `lib/core` from "2.14.0" to "2.14.1" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `commander` in `app/react-native` from "2.14.0" to "2.14.1" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `commander` in `lib/cli` from "2.14.0" to "2.14.1" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/animations` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/http` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/router` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `@angular/language-service` in `examples/angular-cli` from "5.2.3" to "5.2.4" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `babel-jest` in `examples/cra-kitchen-sink` from "22.1.0" to "22.2.0" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.1.4" to "22.2.0" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Upgraded `eventemitter3` in `examples/official-storybook` from "3.0.0" to "3.0.1" [#2938](https://github.com/storybookjs/storybook/pull/2938)
- Update @types/node in examples/angular-cli from 6.0.96 to 6.0.97 [#2932](https://github.com/storybookjs/storybook/pull/2932)
- Update gatsby in /docs from 1.9.181 to 1.9.182 [#2929](https://github.com/storybookjs/storybook/pull/2929)
- Update jasmine-core in examples/angular-cli from 2.9.1 to 2.99.0 [#2930](https://github.com/storybookjs/storybook/pull/2930)
- Upgraded `commander` in `/` from "2.13.0" to "2.14.0" [#2928](https://github.com/storybookjs/storybook/pull/2928)
- Upgraded `make-error` in `addons/actions` from "1.3.2" to "1.3.3" [#2928](https://github.com/storybookjs/storybook/pull/2928)
- Upgraded `commander` in `app/angular` from "2.13.0" to "2.14.0" [#2928](https://github.com/storybookjs/storybook/pull/2928)
- Upgraded `commander` in `app/polymer` from "2.13.0" to "2.14.0" [#2928](https://github.com/storybookjs/storybook/pull/2928)
- Upgraded `commander` in `app/react-native` from "2.13.0" to "2.14.0" [#2928](https://github.com/storybookjs/storybook/pull/2928)
- Upgraded `react-native` in `app/react-native` from "0.52.2" to "0.53.0" [#2928](https://github.com/storybookjs/storybook/pull/2928)
- Upgraded `commander` in `app/react` from "2.13.0" to "2.14.0" [#2928](https://github.com/storybookjs/storybook/pull/2928)
- Upgraded `commander` in `app/vue` from "2.13.0" to "2.14.0" [#2928](https://github.com/storybookjs/storybook/pull/2928)
- Upgraded `commander` in `lib/cli` from "2.13.0" to "2.14.0" [#2928](https://github.com/storybookjs/storybook/pull/2928)
- Upgraded `jest-enzyme` in `/` from "4.1.1" to "4.2.0" [#2919](https://github.com/storybookjs/storybook/pull/2919)
- Upgraded `react-modal` in `lib/ui` from "3.1.11" to "3.1.12" [#2919](https://github.com/storybookjs/storybook/pull/2919)
- Upgraded `react-modal` in `app/angular` from "3.1.11" to "3.1.12" [#2919](https://github.com/storybookjs/storybook/pull/2919)
- Upgraded `react-modal` in `app/polymer` from "3.1.11" to "3.1.12" [#2919](https://github.com/storybookjs/storybook/pull/2919)
- Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.25" to "1.5.26" [#2927](https://github.com/storybookjs/storybook/pull/2927)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.16" to "1.5.18" [#2927](https://github.com/storybookjs/storybook/pull/2927)
- Upgraded `gatsby` in `/docs` from "1.9.178" to "1.9.179" [#2927](https://github.com/storybookjs/storybook/pull/2927)
- Update lodash in /docs from 4.17.4 to 4.17.5 [#2914](https://github.com/storybookjs/storybook/pull/2914)
- Update lodash in / from 4.17.4 to 4.17.5 [#2915](https://github.com/storybookjs/storybook/pull/2915)
- Upgraded `gatsby-link` in `/docs` from "1.6.35" to "1.6.36" [#2908](https://github.com/storybookjs/storybook/pull/2908)
- Upgraded `gatsby` in `/docs` from "1.9.175" to "1.9.177" [#2908](https://github.com/storybookjs/storybook/pull/2908)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.11" to "3.3.12" [#2911](https://github.com/storybookjs/storybook/pull/2911)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.11" to "3.3.12" [#2911](https://github.com/storybookjs/storybook/pull/2911)
- Upgraded `@storybook/addons` in `/docs` from "3.3.11" to "3.3.12" [#2911](https://github.com/storybookjs/storybook/pull/2911)
- Upgraded `@storybook/react` in `/docs` from "3.3.11" to "3.3.12" [#2911](https://github.com/storybookjs/storybook/pull/2911)
- Upgraded `gatsby` in `/docs` from "1.9.175" to "1.9.178" [#2911](https://github.com/storybookjs/storybook/pull/2911)
- Upgraded `eslint` in `/` from "4.16.0" to "4.17.0" [#2912](https://github.com/storybookjs/storybook/pull/2912)
- Upgraded `ts-jest` in `/` from "22.0.1" to "22.0.3" [#2912](https://github.com/storybookjs/storybook/pull/2912)
- Upgraded `@polymer/polymer` in `examples/polymer-cli` from "2.4.0" to "2.5.0" [#2912](https://github.com/storybookjs/storybook/pull/2912)

</details>

## 3.3.13

2018-February-11

#### Bug Fixes

- Angular: add rule for .md to webpack.config.prod.js [#2924](https://github.com/storybookjs/storybook/pull/2924)
- Check for correct props in Flow or prop-types [#2902](https://github.com/storybookjs/storybook/pull/2902)

## 3.4.0-alpha.7

2018-February-03

#### Features

- Storyshots: env.NODE_PATH support [#2873](https://github.com/storybookjs/storybook/pull/2873)
- Knobs: Select knob key/value ordering [#1745](https://github.com/storybookjs/storybook/pull/1745)
- Angular: Add option to pass custom styles for ng components [#2856](https://github.com/storybookjs/storybook/pull/2856)
- Core: Add watch mode for build-storybook [#2866](https://github.com/storybookjs/storybook/pull/2866)
- Core: Add `__dirname` support [#2791](https://github.com/storybookjs/storybook/pull/2791)

#### Bug Fixes

- UI: remove zero on story loading [#2857](https://github.com/storybookjs/storybook/pull/2857)

#### Documentation

- StoryShots: Document ref mocking [#2869](https://github.com/storybookjs/storybook/pull/2869)

#### Maintenance

- Typescript distribution [#2846](https://github.com/storybookjs/storybook/pull/2846)
- Use UTC timezone in formatting too for knobs test [#2861](https://github.com/storybookjs/storybook/pull/2861)

#### Dependency Upgrades

<details>
<summary>
76 Upgrades
</summary>

- Upgraded `eslint-plugin-prettier` in `/` from "2.5.0" to "2.6.0" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `nodemon` in `/` from "1.14.11" to "1.14.12" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `postcss-loader` in `lib/core` from "2.0.10" to "2.1.0" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `postcss-loader` in `app/angular` from "2.0.10" to "2.1.0" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `nodemon` in `app/angular` from "1.14.11" to "1.14.12" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `postcss-loader` in `app/polymer` from "2.0.10" to "2.1.0" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `nodemon` in `app/polymer` from "1.14.11" to "1.14.12" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `postcss-loader` in `app/react-native` from "2.0.10" to "2.1.0" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `postcss-loader` in `app/react` from "2.0.10" to "2.1.0" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `nodemon` in `app/react` from "1.14.11" to "1.14.12" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `postcss-loader` in `app/vue` from "2.0.10" to "2.1.0" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `nodemon` in `app/vue` from "1.14.11" to "1.14.12" [#2910](https://github.com/storybookjs/storybook/pull/2910)
- Upgraded `@angular/common` in `/` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/compiler` in `/` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/core` in `/` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/forms` in `/` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/platform-browser` in `/` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/platform-browser-dynamic` in `/` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `tslint-config-prettier` in `/` from "1.6.0" to "1.7.0" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `react-split-pane` in `lib/ui` from "0.1.74" to "0.1.75" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/animations` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/http` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/router` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.6.6" to "1.6.7" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `@angular/language-service` in `examples/angular-cli` from "5.2.2" to "5.2.3" [#2901](https://github.com/storybookjs/storybook/pull/2901)
- Upgraded `babel-plugin-macros` in `/` from "2.0.0" to "2.1.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `babel-plugin-macros` in `app/angular` from "2.0.0" to "2.1.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `typescript` in `app/angular` from "2.6.2" to "2.7.1" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `babel-plugin-macros` in `app/polymer` from "2.0.0" to "2.1.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `babel-preset-minify` in `app/polymer` from "0.2.0" to "0.3.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `babel-plugin-macros` in `app/react-native` from "2.0.0" to "2.1.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `babel-preset-minify` in `app/react-native` from "0.2.0" to "0.3.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `babel-plugin-macros` in `app/react` from "2.0.0" to "2.1.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `babel-preset-minify` in `app/react` from "0.2.0" to "0.3.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `babel-plugin-macros` in `app/vue` from "2.0.0" to "2.1.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `babel-preset-minify` in `app/vue` from "0.2.0" to "0.3.0" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `vue-style-loader` in `app/vue` from "3.1.1" to "3.1.2" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `vue-loader` in `app/vue` from "13.7.0" to "13.7.1" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `typescript` in `examples/angular-cli` from "2.6.2" to "2.7.1" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "13.7.0" to "13.7.1" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `vue-style-loader` in `examples/vue-kitchen-sink` from "3.1.1" to "3.1.2" [#2891](https://github.com/storybookjs/storybook/pull/2891)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.15" to "1.5.16" [#2875](https://github.com/storybookjs/storybook/pull/2875)
- Upgraded `gatsby` in `/docs` from "1.9.172" to "1.9.174" [#2875](https://github.com/storybookjs/storybook/pull/2875)
- Upgraded `@types/lodash` in `/` from "4.14.97" to "4.14.98" [#2876](https://github.com/storybookjs/storybook/pull/2876)
- Upgraded `jest-enzyme` in `/` from "4.0.2" to "4.1.0" [#2876](https://github.com/storybookjs/storybook/pull/2876)
- Upgraded `uglifyjs-webpack-plugin` in `app/angular` from "1.1.6" to "1.1.7" [#2876](https://github.com/storybookjs/storybook/pull/2876)
- Upgraded `uglifyjs-webpack-plugin` in `app/react-native` from "1.1.6" to "1.1.7" [#2876](https://github.com/storybookjs/storybook/pull/2876)
- Upgraded `uglifyjs-webpack-plugin` in `app/react` from "1.1.6" to "1.1.7" [#2876](https://github.com/storybookjs/storybook/pull/2876)
- Upgraded `uglifyjs-webpack-plugin` in `app/vue` from "1.1.6" to "1.1.7" [#2876](https://github.com/storybookjs/storybook/pull/2876)
- Upgraded `gatsby-link` in `/docs` from "1.6.34" to "1.6.35" [#2858](https://github.com/storybookjs/storybook/pull/2858)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.29" to "1.7.30" [#2858](https://github.com/storybookjs/storybook/pull/2858)
- Upgraded `gatsby` in `/docs` from "1.9.169" to "1.9.171" [#2858](https://github.com/storybookjs/storybook/pull/2858)
- Make dependencies in polymer & angular up to date with other apps [#2852](https://github.com/storybookjs/storybook/pull/2852)
- Upgraded `@types/lodash` in `/` from "4.14.96" to "4.14.97" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `react-datetime` in `addons/knobs` from "2.11.1" to "2.12.0" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `style-loader` in `addons/knobs` from "0.19.1" to "0.20.1" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `style-loader` in `lib/core` from "0.19.1" to "0.20.1" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `style-loader` in `app/angular` from "0.18.2" to "0.20.1" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `style-loader` in `app/polymer` from "0.18.2" to "0.20.1" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `style-loader` in `app/react-native` from "0.19.1" to "0.20.1" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `style-loader` in `app/react` from "0.19.1" to "0.20.1" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `style-loader` in `app/vue` from "0.19.1" to "0.20.1" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `@polymer/polymer` in `examples/polymer-cli` from "2.3.1" to "2.4.0" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `@types/jasmine` in `examples/angular-cli` from "2.8.5" to "2.8.6" [#2850](https://github.com/storybookjs/storybook/pull/2850)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.10" to "3.3.11" [#2849](https://github.com/storybookjs/storybook/pull/2849)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.10" to "3.3.11" [#2849](https://github.com/storybookjs/storybook/pull/2849)
- Upgraded `@storybook/addons` in `/docs` from "3.3.10" to "3.3.11" [#2849](https://github.com/storybookjs/storybook/pull/2849)
- Upgraded `@storybook/react` in `/docs` from "3.3.10" to "3.3.11" [#2849](https://github.com/storybookjs/storybook/pull/2849)
- Update url-loader from 0.5.8 to 0.6.2 in app/angular [#2847](https://github.com/storybookjs/storybook/pull/2847)

</details>

## 3.3.12

2018-February-02

#### Bug Fixes

- Fix browser navigation again [#2870](https://github.com/storybookjs/storybook/pull/2870)

#### Dependency Upgrades

- Update url-loader from 0.5.8 to 0.6.2 in app/angular [#2847](https://github.com/storybookjs/storybook/pull/2847)

## 3.4.0-alpha.6

2018-January-27

#### Features

- Pass default webpack config as third argument in Full Control Mode [#2796](https://github.com/storybookjs/storybook/pull/2796)

#### Bug Fixes

- Angular: remove entryComponents prop from metadata [#2790](https://github.com/storybookjs/storybook/pull/2790)
- Use process.exitCode instead of process.exit() [#2717](https://github.com/storybookjs/storybook/pull/2717)

#### Documentation

- Extending webpack section is no longer needed for the common usage [#2826](https://github.com/storybookjs/storybook/pull/2826)
- Updating Vue Jest Config [#2821](https://github.com/storybookjs/storybook/pull/2821)
- Angular inheritance example [#2787](https://github.com/storybookjs/storybook/pull/2787)

#### Maintenance

- ADD autolabeler.yml for <https://github.com/probot/autolabeler> [#2809](https://github.com/storybookjs/storybook/pull/2809)
- Fix css warning in angular-cli example [#2789](https://github.com/storybookjs/storybook/pull/2789)
- Move more things to core [#2788](https://github.com/storybookjs/storybook/pull/2788)

#### Dependency Upgrades

<details>
<summary>
76 Upgrades
</summary>

- Upgraded `eslint-plugin-react` in `/` from "7.5.1" to "7.6.0" [#2844](https://github.com/storybookjs/storybook/pull/2844)
- Upgraded `lint-staged` in `/` from "6.0.1" to "6.1.0" [#2844](https://github.com/storybookjs/storybook/pull/2844)
- Upgraded `react-native` in `app/react-native` from "0.52.1" to "0.52.2" [#2844](https://github.com/storybookjs/storybook/pull/2844)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.6.5" to "1.6.6" [#2844](https://github.com/storybookjs/storybook/pull/2844)
- Upgraded `protractor` in `examples/angular-cli` from "5.2.2" to "5.3.0" [#2844](https://github.com/storybookjs/storybook/pull/2844)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.26" to "1.6.27" [#2843](https://github.com/storybookjs/storybook/pull/2843)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.40" to "1.5.41" [#2843](https://github.com/storybookjs/storybook/pull/2843)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.14" to "1.5.15" [#2843](https://github.com/storybookjs/storybook/pull/2843)
- Upgraded `gatsby` in `/docs` from "1.9.166" to "1.9.169" [#2843](https://github.com/storybookjs/storybook/pull/2843)
- Upgraded `@types/lodash` in `/` from "4.14.95" to "4.14.96" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `airbnb-js-shims` in `app/angular` from "1.4.0" to "1.4.1" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `airbnb-js-shims` in `app/polymer` from "1.4.0" to "1.4.1" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `airbnb-js-shims` in `app/react` from "1.4.0" to "1.4.1" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `airbnb-js-shims` in `app/vue` from "1.4.0" to "1.4.1" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/animations` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/http` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/router` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `@angular/language-service` in `examples/angular-cli` from "5.2.1" to "5.2.2" [#2840](https://github.com/storybookjs/storybook/pull/2840)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.25" to "1.6.26" [#2828](https://github.com/storybookjs/storybook/pull/2828)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.39" to "1.5.40" [#2828](https://github.com/storybookjs/storybook/pull/2828)
- Upgraded `gatsby` in `/docs` from "1.9.165" to "1.9.166" [#2828](https://github.com/storybookjs/storybook/pull/2828)
- Upgraded `@types/lodash` in `/` from "4.14.93" to "4.14.95" [#2829](https://github.com/storybookjs/storybook/pull/2829)
- Upgraded `vue-style-loader` in `app/vue` from "3.0.3" to "3.1.1" [#2829](https://github.com/storybookjs/storybook/pull/2829)
- Upgraded `karma-coverage-istanbul-reporter` in `examples/angular-cli` from "1.3.3" to "1.4.1" [#2829](https://github.com/storybookjs/storybook/pull/2829)
- Upgraded `vue-style-loader` in `examples/vue-kitchen-sink` from "3.0.3" to "3.1.1" [#2829](https://github.com/storybookjs/storybook/pull/2829)
- Upgraded `@webcomponents/webcomponentsjs` in `app/polymer` from "1.0.22" to "1.1.0" [#2818](https://github.com/storybookjs/storybook/pull/2818)
- Upgraded `enzyme-to-json` in `addons/storyshots` from "3.3.0" to "3.3.1" [#2818](https://github.com/storybookjs/storybook/pull/2818)
- Upgraded `@webcomponents/webcomponentsjs` in `examples/polymer-cli` from "1.0.22" to "1.1.0" [#2818](https://github.com/storybookjs/storybook/pull/2818)
- Upgraded `@types/jasmine` in `examples/angular-cli` from "2.8.4" to "2.8.5" [#2818](https://github.com/storybookjs/storybook/pull/2818)
- Upgraded `enzyme-to-json` in `examples/cra-kitchen-sink` from "3.3.0" to "3.3.1" [#2818](https://github.com/storybookjs/storybook/pull/2818)
- Upgraded `enzyme-to-json` in `examples/official-storybook` from "3.3.0" to "3.3.1" [#2818](https://github.com/storybookjs/storybook/pull/2818)
- Upgraded `react-chromatic` in `examples/official-storybook` from "0.7.8" to "0.7.9" [#2818](https://github.com/storybookjs/storybook/pull/2818)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.28" to "1.7.29" [#2816](https://github.com/storybookjs/storybook/pull/2816)
- Upgraded `gatsby` in `/docs` from "1.9.164" to "1.9.165" [#2816](https://github.com/storybookjs/storybook/pull/2816)
- Upgraded `eslint` in `/` from "4.15.0" to "4.16.0" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `github-release-from-changelog` in `/` from "1.3.0" to "1.3.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `jest` in `/` from "22.1.3" to "22.1.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `jest-cli` in `/` from "22.1.3" to "22.1.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `jest-config` in `/` from "22.1.3" to "22.1.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `jest-environment-jsdom` in `/` from "22.1.2" to "22.1.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `jest-jasmine2` in `/` from "22.1.3" to "22.1.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `lerna` in `/` from "2.6.0" to "2.8.0" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `lint-staged` in `/` from "6.0.0" to "6.0.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `shelljs` in `/` from "0.8.0" to "0.8.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `shelljs` in `addons/links` from "0.8.0" to "0.8.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `glamorous` in `lib/components` from "4.11.3" to "4.11.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `glamorous` in `addons/a11y` from "4.11.3" to "4.11.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `glamorous` in `addons/info` from "4.11.3" to "4.11.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `glamorous` in `addons/jest` from "4.11.3" to "4.11.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `shelljs` in `app/angular` from "0.8.0" to "0.8.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `shelljs` in `app/polymer` from "0.7.8" to "0.8.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `shelljs` in `app/react-native` from "0.8.0" to "0.8.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `react-native` in `app/react-native` from "0.52.0" to "0.52.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `glamorous` in `app/react` from "4.11.3" to "4.11.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `shelljs` in `app/react` from "0.8.0" to "0.8.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `shelljs` in `app/vue` from "0.8.0" to "0.8.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `webpack-dev-server` in `examples/polymer-cli` from "2.11.0" to "2.11.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `shelljs` in `lib/cli` from "0.8.0" to "0.8.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `jasmine-core` in `examples/angular-cli` from "2.9.0" to "2.9.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `glamorous` in `examples/cra-kitchen-sink` from "4.11.3" to "4.11.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.1.3" to "22.1.4" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "2.11.0" to "2.11.1" [#2806](https://github.com/storybookjs/storybook/pull/2806)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.9" to "3.3.10" [#2799](https://github.com/storybookjs/storybook/pull/2799)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.9" to "3.3.10" [#2799](https://github.com/storybookjs/storybook/pull/2799)
- Upgraded `@storybook/addons` in `/docs` from "3.3.9" to "3.3.10" [#2799](https://github.com/storybookjs/storybook/pull/2799)
- Upgraded `@storybook/react` in `/docs` from "3.3.9" to "3.3.10" [#2799](https://github.com/storybookjs/storybook/pull/2799)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.37" to "1.5.39" [#2799](https://github.com/storybookjs/storybook/pull/2799)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.11" to "1.5.14" [#2799](https://github.com/storybookjs/storybook/pull/2799)
- Upgraded `gatsby` in `/docs` from "1.9.158" to "1.9.164" [#2799](https://github.com/storybookjs/storybook/pull/2799)

</details>

## 3.3.11

2018-January-26

#### Bug Fixes

- Angular: update helpers.ts [#2777](https://github.com/storybookjs/storybook/pull/2777)

## 3.4.0-alpha.5

2018-January-19

#### Features

- Angular and Vue storyshots [#2564](https://github.com/storybookjs/storybook/pull/2564)
- Addon-info: Added "Copy button" for code example [#2713](https://github.com/storybookjs/storybook/pull/2713)
- Angular: Serve styles and assets using .angular-cli webpack configuration [#2735](https://github.com/storybookjs/storybook/pull/2735)
- API: Added an event that is emitted when a channel is created. [#2711](https://github.com/storybookjs/storybook/pull/2711)
- Addon-a11y: Handle components with delayed rendering [#2651](https://github.com/storybookjs/storybook/pull/2651)

#### Bug Fixes

- Angular: knobs with template [#2766](https://github.com/storybookjs/storybook/pull/2766)

#### Documentation

<details>
<summary>
4 PRs
</summary>

- Updating css-style testing docs to mention StoryShots image snapshots feature [#2767](https://github.com/storybookjs/storybook/pull/2767)
- Fix introduction page header [#2757](https://github.com/storybookjs/storybook/pull/2757)
- fix Storyshots README, add missing export for image snapshots [#2759](https://github.com/storybookjs/storybook/pull/2759)
- Update MIGRATION.md [#2709](https://github.com/storybookjs/storybook/pull/2709)

</details>

#### Dependency Upgrades

<details>
<summary>
91 upgrades
</summary>

- Upgraded `@types/lodash` in `/` from "4.14.92" to "4.14.93" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `jest` in `/` from "22.1.2" to "22.1.3" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `jest-cli` in `/` from "22.1.2" to "22.1.3" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `jest-config` in `/` from "22.1.2" to "22.1.3" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `jest-jasmine2` in `/` from "22.1.2" to "22.1.3" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `postcss-flexbugs-fixes` in `app/angular` from "3.2.0" to "3.3.0" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `postcss-flexbugs-fixes` in `app/polymer` from "3.2.0" to "3.3.0" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `postcss-flexbugs-fixes` in `app/react` from "3.2.0" to "3.3.0" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `postcss-flexbugs-fixes` in `app/vue` from "3.2.0" to "3.3.0" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.6.4" to "1.6.5" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.1.2" to "22.1.3" [#2783](https://github.com/storybookjs/storybook/pull/2783)
- Update gatsby in /docs from 1.9.157 to 1.9.158 [#2779](https://github.com/storybookjs/storybook/pull/2779)
- Upgraded `jasmine-core` in `examples/angular-cli` from "2.8.0" to "2.9.0" [#2780](https://github.com/storybookjs/storybook/pull/2780)
- Upgraded `react-chromatic` in `examples/official-storybook` from "0.7.7" to "0.7.8" [#2780](https://github.com/storybookjs/storybook/pull/2780)
- Upgraded `eslint-plugin-jest` in `/` from "21.6.2" to "21.7.0" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `jest` in `/` from "22.1.1" to "22.1.2" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `jest-cli` in `/` from "22.1.1" to "22.1.2" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `jest-config` in `/` from "22.1.1" to "22.1.2" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `jest-environment-jsdom` in `/` from "22.1.0" to "22.1.2" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `jest-jasmine2` in `/` from "22.1.1" to "22.1.2" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `uuid` in `addons/actions` from "3.2.0" to "3.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `uuid` in `addons/events` from "3.2.0" to "3.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `glamorous` in `lib/components` from "4.11.2" to "4.11.3" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `glamorous` in `addons/a11y` from "4.11.2" to "4.11.3" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `glamorous` in `addons/info` from "4.11.2" to "4.11.3" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `glamorous` in `addons/jest` from "4.11.2" to "4.11.3" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `css-loader` in `app/angular` from "0.28.8" to "0.28.9" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `html-loader` in `app/angular` from "0.5.4" to "0.5.5" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `uuid` in `app/angular` from "3.2.0" to "3.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `css-loader` in `app/polymer` from "0.28.8" to "0.28.9" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `uuid` in `app/polymer` from "3.2.0" to "3.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `css-loader` in `app/react-native` from "0.28.8" to "0.28.9" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `uuid` in `app/react-native` from "3.2.0" to "3.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `css-loader` in `app/react` from "0.28.8" to "0.28.9" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `glamorous` in `app/react` from "4.11.2" to "4.11.3" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `html-loader` in `app/react` from "0.5.4" to "0.5.5" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `uuid` in `app/react` from "3.2.0" to "3.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `css-loader` in `app/vue` from "0.28.8" to "0.28.9" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `html-loader` in `app/vue` from "0.5.4" to "0.5.5" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `uuid` in `app/vue` from "3.2.0" to "3.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `semver` in `lib/cli` from "5.4.1" to "5.5.0" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/animations` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/http` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/router` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `@angular/language-service` in `examples/angular-cli` from "5.2.0" to "5.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `glamorous` in `examples/cra-kitchen-sink` from "4.11.2" to "4.11.3" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.1.1" to "22.1.2" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `css-loader` in `examples/vue-kitchen-sink` from "0.28.8" to "0.28.9" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `uuid` in `examples/official-storybook` from "3.2.0" to "3.2.1" [#2770](https://github.com/storybookjs/storybook/pull/2770)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.24" to "1.6.25" [#2768](https://github.com/storybookjs/storybook/pull/2768)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.36" to "1.5.37" [#2768](https://github.com/storybookjs/storybook/pull/2768)
- Upgraded `eslint-plugin-prettier` in `/` from "2.4.0" to "2.5.0" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `lerna` in `/` from "2.7.0" to "2.7.1" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `uuid` in `addons/actions` from "3.1.0" to "3.2.0" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `uuid` in `addons/events` from "3.1.0" to "3.2.0" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `react-modal` in `lib/ui` from "3.1.10" to "3.1.11" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `uuid` in `app/angular` from "3.1.0" to "3.2.0" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `uuid` in `app/polymer` from "3.1.0" to "3.2.0" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `uuid` in `app/react-native` from "3.1.0" to "3.2.0" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `uuid` in `app/react` from "3.1.0" to "3.2.0" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `uuid` in `app/vue` from "3.1.0" to "3.2.0" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Upgraded `uuid` in `examples/official-storybook` from "3.1.0" to "3.2.0" [#2764](https://github.com/storybookjs/storybook/pull/2764)
- Update gatsby in /docs from 1.9.155 to 1.9.157 [#2763](https://github.com/storybookjs/storybook/pull/2763)
- Upgraded `jest` in `/` from "22.0.6" to "22.1.1" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `jest-cli` in `/` from "22.0.6" to "22.1.1" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `jest-config` in `/` from "22.0.6" to "22.1.1" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `jest-diff` in `/` from "22.0.6" to "22.1.0" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `jest-environment-jsdom` in `/` from "22.0.6" to "22.1.0" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `jest-jasmine2` in `/` from "22.0.6" to "22.1.1" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `babel-plugin-react-docgen` in `app/angular` from "1.8.1" to "1.8.2" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `babel-preset-react-app` in `app/angular` from "3.1.0" to "3.1.1" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `babel-plugin-react-docgen` in `app/polymer` from "1.8.1" to "1.8.2" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `babel-preset-react-app` in `app/polymer` from "3.1.0" to "3.1.1" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `babel-plugin-react-docgen` in `app/react` from "1.8.1" to "1.8.2" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `babel-preset-react-app` in `app/react` from "3.1.0" to "3.1.1" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `babel-plugin-react-docgen` in `app/vue` from "1.8.1" to "1.8.2" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `babel-preset-react-app` in `app/vue` from "3.1.0" to "3.1.1" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `babel-jest` in `examples/cra-kitchen-sink` from "22.0.6" to "22.1.0" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.0.6" to "22.1.1" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `react-scripts` in `examples/cra-kitchen-sink` from "1.0.17" to "1.1.0" [#2754](https://github.com/storybookjs/storybook/pull/2754)
- Upgraded `eslint-plugin-jest` in `/` from "21.6.1" to "21.6.2" [#2746](https://github.com/storybookjs/storybook/pull/2746)
- Upgraded `webpack-dev-server` in `examples/polymer-cli` from "2.10.1" to "2.11.0" [#2746](https://github.com/storybookjs/storybook/pull/2746)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "2.10.1" to "2.11.0" [#2746](https://github.com/storybookjs/storybook/pull/2746)
- Upgraded `jest-image-snapshot` in `/` from "2.2.1" to "2.3.0" [#2740](https://github.com/storybookjs/storybook/pull/2740)
- Upgraded `polymer-webpack-loader` in `app/polymer` from "2.0.0" to "2.0.1"

</details>

## 3.3.10

2018-January-19

#### Bug Fixes

- Addon-backgrounds: remove redundant scrollbars [#2744](https://github.com/storybookjs/storybook/pull/2744)
- Addon-info: add keys for separator spans in OneOfType [#2743](https://github.com/storybookjs/storybook/pull/2743)

## 3.4.0-alpha.4

2018-January-13

Republish `3.4.0-alpha.3` due to potential publishing errors

## 3.4.0-alpha.3

2018-January-13

#### Features

- Polymer 2 support [#2225](https://github.com/storybookjs/storybook/pull/2225)
- Add image snapshots to addon-storyshots [#2413](https://github.com/storybookjs/storybook/pull/2413)
- Angular template support for Storybook [#2690](https://github.com/storybookjs/storybook/pull/2690)

#### Bug Fixes

- Remove polymer-cli dependency [#2741](https://github.com/storybookjs/storybook/pull/2741)
- Add scss for components in angular apps by default. [#2703](https://github.com/storybookjs/storybook/pull/2703)

#### Maintenance

- Change ng stories dir [#2672](https://github.com/storybookjs/storybook/pull/2672)

#### Dependency Upgrades

<details>
<summary>
54 Upgrades
</summary>

- Upgraded `jest-image-snapshot` in `/` from "2.2.1" to "2.3.0" [#2740](https://github.com/storybookjs/storybook/pull/2740)
- Upgraded `polymer-webpack-loader` in `app/polymer` from "2.0.0" to "2.0.1" [#2740](https://github.com/storybookjs/storybook/pull/2740)
- Upgraded `jest-image-snapshot` in `addons/storyshots` from "2.2.1" to "2.3.0" [#2740](https://github.com/storybookjs/storybook/pull/2740)
- Upgraded `shelljs` in `/` from "0.7.8" to "0.8.0" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `shelljs` in `addons/links` from "0.7.8" to "0.8.0" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `autoprefixer` in `app/react` from "7.2.4" to "7.2.5" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `shelljs` in `app/react` from "0.7.8" to "0.8.0" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `autoprefixer` in `app/angular` from "7.2.4" to "7.2.5" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `shelljs` in `app/angular` from "0.7.8" to "0.8.0" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `autoprefixer` in `app/react-native` from "7.2.4" to "7.2.5" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `shelljs` in `app/react-native` from "0.7.8" to "0.8.0" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `autoprefixer` in `app/vue` from "7.2.4" to "7.2.5" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `shelljs` in `app/vue` from "0.7.8" to "0.8.0" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Upgraded `shelljs` in `lib/cli` from "0.7.8" to "0.8.0" [#2734](https://github.com/storybookjs/storybook/pull/2734)
- Update gatsby in /docs from 1.9.153 to 1.9.154 [#2733](https://github.com/storybookjs/storybook/pull/2733)
- Update @angular/cli in examples/angular-cli from 1.6.3 to 1.6.4 [#2726](https://github.com/storybookjs/storybook/pull/2726)
- Upgraded `commander` in `/` from "2.12.2" to "2.13.0" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `jest` in `/` from "22.0.5" to "22.0.6" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `jest-cli` in `/` from "22.0.5" to "22.0.6" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `jest-config` in `/` from "22.0.5" to "22.0.6" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `jest-diff` in `/` from "22.0.5" to "22.0.6" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `jest-environment-jsdom` in `/` from "22.0.5" to "22.0.6" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `jest-jasmine2` in `/` from "22.0.5" to "22.0.6" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `nodemon` in `/` from "1.14.10" to "1.14.11" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `prettier` in `/` from "1.9.2" to "1.10.2" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `tslint` in `/` from "5.8.0" to "5.9.1" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `commander` in `app/react` from "2.12.2" to "2.13.0" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `common-tags` in `app/react` from "1.7.0" to "1.7.2" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `nodemon` in `app/react` from "1.14.10" to "1.14.11" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `commander` in `app/angular` from "2.12.2" to "2.13.0" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `common-tags` in `app/angular` from "1.7.0" to "1.7.2" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `zone.js` in `app/angular` from "0.8.19" to "0.8.20" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `nodemon` in `app/angular` from "1.14.10" to "1.14.11" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `commander` in `app/react-native` from "2.12.2" to "2.13.0" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `commander` in `app/vue` from "2.12.2" to "2.13.0" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `common-tags` in `app/vue` from "1.7.0" to "1.7.2" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `nodemon` in `app/vue` from "1.14.10" to "1.14.11" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `babel-jest` in `examples/cra-kitchen-sink` from "22.0.4" to "22.0.6" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.0.5" to "22.0.6" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `commander` in `lib/cli` from "2.12.2" to "2.13.0" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `zone.js` in `examples/angular-cli` from "0.8.19" to "0.8.20" [#2724](https://github.com/storybookjs/storybook/pull/2724)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.7" to "3.3.8" [#2722](https://github.com/storybookjs/storybook/pull/2722)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.7" to "3.3.8" [#2722](https://github.com/storybookjs/storybook/pull/2722)
- Upgraded `@storybook/addons` in `/docs` from "3.3.7" to "3.3.8" [#2722](https://github.com/storybookjs/storybook/pull/2722)
- Upgraded `@storybook/react` in `/docs` from "3.3.7" to "3.3.8" [#2722](https://github.com/storybookjs/storybook/pull/2722)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.27" to "1.7.28" [#2722](https://github.com/storybookjs/storybook/pull/2722)
- Upgraded `gatsby` in `/docs` from "1.9.151" to "1.9.153" [#2722](https://github.com/storybookjs/storybook/pull/2722)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.6" to "3.3.7" [#2710](https://github.com/storybookjs/storybook/pull/2710)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.6" to "3.3.7" [#2710](https://github.com/storybookjs/storybook/pull/2710)
- Upgraded `@storybook/addons` in `/docs` from "3.3.6" to "3.3.7" [#2710](https://github.com/storybookjs/storybook/pull/2710)
- Upgraded `@storybook/react` in `/docs` from "3.3.6" to "3.3.7" [#2710](https://github.com/storybookjs/storybook/pull/2710)
- Upgraded `gatsby-link` in `/docs` from "1.6.33" to "1.6.34" [#2710](https://github.com/storybookjs/storybook/pull/2710)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.26" to "1.7.27" [#2710](https://github.com/storybookjs/storybook/pull/2710)
- Upgraded `gatsby` in `/docs` from "1.9.150" to "1.9.151" [#2710](https://github.com/storybookjs/storybook/pull/2710)

</details>

## 3.3.9

2018-January-13

#### Bug Fixes

- Start haul/react-native using named binaries instead of cli.js [#2715](https://github.com/storybookjs/storybook/pull/2715)
- Reflect the new peer dependencies in docs and CLI templates [#2714](https://github.com/storybookjs/storybook/pull/2714)
- Don't mangle function names for production builds [#2705](https://github.com/storybookjs/storybook/pull/2705)

## 3.4.0-alpha.2

2018-January-11

This is a duplicate of `3.4.0-alpha.1`, re-published because I accidentally published `3.4.0-alpha.1` on the `latest` NPM tag.

## 3.3.8

2018-January-11

This is a duplicate of `3.3.7`, re-published because I accidentally published `3.4.0-alpha.1` on the `latest` NPM tag.

## 3.4.0-alpha.1

2018-January-10

In addition to the changes listed here, also contains fixes from [3.3.5](#335) and [3.3.6](#336) and [3.3.7](#337).

#### Features

- Custom tsconfig.json for angular apps. [#2669](https://github.com/storybookjs/storybook/pull/2669)

#### Dependency Upgrades

<details>
<summary>
105 Upgrades
</summary>

- Upgraded `babel-eslint` in `/` from "8.1.2" to "8.2.1" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `eslint-plugin-jest` in `/` from "21.5.0" to "21.6.1" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `jest` in `/` from "22.0.4" to "22.0.5" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `jest-cli` in `/` from "22.0.4" to "22.0.5" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `jest-config` in `/` from "22.0.4" to "22.0.5" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `jest-diff` in `/` from "22.0.3" to "22.0.5" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `jest-environment-jsdom` in `/` from "22.0.4" to "22.0.5" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `jest-jasmine2` in `/` from "22.0.4" to "22.0.5" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `lerna` in `/` from "2.5.1" to "2.6.0" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `nodemon` in `/` from "1.14.9" to "1.14.10" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `common-tags` in `app/react` from "1.6.0" to "1.7.0" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `nodemon` in `app/react` from "1.14.9" to "1.14.10" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `common-tags` in `app/angular` from "1.6.0" to "1.7.0" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `nodemon` in `app/angular` from "1.14.9" to "1.14.10" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `common-tags` in `app/vue` from "1.6.0" to "1.7.0" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `nodemon` in `app/vue` from "1.14.9" to "1.14.10" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `vue-loader` in `app/vue` from "13.6.2" to "13.7.0" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `jest` in `examples/cra-kitchen-sink` from "22.0.4" to "22.0.5" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "13.6.2" to "13.7.0" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "2.10.0" to "2.10.1" [#2700](https://github.com/storybookjs/storybook/pull/2700)
- Upgraded `marked` in `/docs` from "0.3.7" to "0.3.12" [#2699](https://github.com/storybookjs/storybook/pull/2699)
- Upgraded `react-stack-grid` in `/docs` from "0.7.0" to "0.7.1" [#2699](https://github.com/storybookjs/storybook/pull/2699)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.4" to "3.3.6" [#2686](https://github.com/storybookjs/storybook/pull/2686)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.4" to "3.3.6" [#2686](https://github.com/storybookjs/storybook/pull/2686)
- Upgraded `@storybook/addons` in `/docs` from "3.3.4" to "3.3.6" [#2686](https://github.com/storybookjs/storybook/pull/2686)
- Upgraded `@storybook/react` in `/docs` from "3.3.4" to "3.3.6" [#2686](https://github.com/storybookjs/storybook/pull/2686)
- Upgraded `gatsby-link` in `/docs` from "1.6.32" to "1.6.33" [#2686](https://github.com/storybookjs/storybook/pull/2686)
- Upgraded `gatsby` in `/docs` from "1.9.149" to "1.9.150" [#2686](https://github.com/storybookjs/storybook/pull/2686)
- Upgraded `nodemon` in `/` from "1.14.8" to "1.14.9" [#2687](https://github.com/storybookjs/storybook/pull/2687)
- Upgraded `markdown-loader` in `app/react` from "2.0.1" to "2.0.2" [#2687](https://github.com/storybookjs/storybook/pull/2687)
- Upgraded `nodemon` in `app/react` from "1.14.8" to "1.14.9" [#2687](https://github.com/storybookjs/storybook/pull/2687)
- Upgraded `nodemon` in `app/angular` from "1.14.8" to "1.14.9" [#2687](https://github.com/storybookjs/storybook/pull/2687)
- Upgraded `react-native` in `app/react-native` from "0.51.0" to "0.52.0" [#2687](https://github.com/storybookjs/storybook/pull/2687)
- Upgraded `nodemon` in `app/vue` from "1.14.8" to "1.14.9" [#2687](https://github.com/storybookjs/storybook/pull/2687)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.3" to "3.3.4" [#2674](https://github.com/storybookjs/storybook/pull/2674)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.3" to "3.3.4" [#2674](https://github.com/storybookjs/storybook/pull/2674)
- Upgraded `@storybook/addons` in `/docs` from "3.3.3" to "3.3.4" [#2674](https://github.com/storybookjs/storybook/pull/2674)
- Upgraded `@storybook/react` in `/docs` from "3.3.3" to "3.3.4" [#2674](https://github.com/storybookjs/storybook/pull/2674)
- Update eslint in / from 4.14.0 to 4.15.0 [#2673](https://github.com/storybookjs/storybook/pull/2673)
- Upgraded `nodemon` in `/` from "1.14.7" to "1.14.8" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `marksy` in `addons/info` from "6.0.2" to "6.0.3" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `nodemon` in `app/react` from "1.14.7" to "1.14.8" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `nodemon` in `app/angular` from "1.14.7" to "1.14.8" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `nodemon` in `app/vue` from "1.14.7" to "1.14.8" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "2.9.7" to "2.10.0" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `@types/lodash` in `/` from "4.14.91" to "4.14.92" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `marksy` in `addons/info` from "6.0.1" to "6.0.2" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/react` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `html-loader` in `app/react` from "0.5.1" to "0.5.4" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/react` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/angular` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/angular` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/react-native` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/react-native` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/vue` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/vue` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `@types/node` in `examples/angular-cli` from "6.0.95" to "6.0.96" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `examples/vue-kitchen-sink` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `@angular/animations` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/http` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/router` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/language-service` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `postcss-loader` in `app/react` from "2.0.9" to "2.0.10" [#2637](https://github.com/storybookjs/storybook/pull/2637)
- Upgraded `postcss-loader` in `app/angular` from "2.0.9" to "2.0.10" [#2637](https://github.com/storybookjs/storybook/pull/2637)
- Upgraded `postcss-loader` in `app/react-native` from "2.0.9" to "2.0.10" [#2637](https://github.com/storybookjs/storybook/pull/2637)
- Upgraded `postcss-loader` in `app/vue` from "2.0.9" to "2.0.10" [#2637](https://github.com/storybookjs/storybook/pull/2637)
- Update inquirer in / from 4.0.1 to 4.0.2 [#2632](https://github.com/storybookjs/storybook/pull/2632)
- Upgraded `danger` in `/` from "2.1.8" to "2.1.10" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `autoprefixer` in `app/react` from "7.2.3" to "7.2.4" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `autoprefixer` in `app/angular` from "7.2.3" to "7.2.4" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `autoprefixer` in `app/react-native` from "7.2.3" to "7.2.4" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `autoprefixer` in `app/vue` from "7.2.3" to "7.2.4" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `nodemon` in `/` from "1.14.6" to "1.14.7" [#2612](https://github.com/storybookjs/storybook/pull/2612)
- Upgraded `nodemon` in `app/react` from "1.14.6" to "1.14.7" [#2612](https://github.com/storybookjs/storybook/pull/2612)
- Upgraded `nodemon` in `app/angular` from "1.14.6" to "1.14.7" [#2612](https://github.com/storybookjs/storybook/pull/2612)
- Upgraded `nodemon` in `app/vue` from "1.14.6" to "1.14.7" [#2612](https://github.com/storybookjs/storybook/pull/2612)
- Upgraded `vue-loader` in `app/vue` from "13.6.1" to "13.6.2" [#2611](https://github.com/storybookjs/storybook/pull/2611)
- Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "13.6.1" to "13.6.2" [#2611](https://github.com/storybookjs/storybook/pull/2611)
- Upgraded `nodemon` in `/` from "1.14.5" to "1.14.6" [#2609](https://github.com/storybookjs/storybook/pull/2609)
- Upgraded `nodemon` in `app/react` from "1.14.5" to "1.14.6" [#2609](https://github.com/storybookjs/storybook/pull/2609)
- Upgraded `nodemon` in `app/angular` from "1.14.5" to "1.14.6" [#2609](https://github.com/storybookjs/storybook/pull/2609)
- Upgraded `nodemon` in `app/vue` from "1.14.5" to "1.14.6" [#2609](https://github.com/storybookjs/storybook/pull/2609)
- Upgraded `enzyme` in `/` from "3.2.0" to "3.3.0" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `nodemon` in `/` from "1.14.3" to "1.14.5" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `graphiql` in `addons/graphql` from "0.11.10" to "0.11.11" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `enzyme` in `addons/links` from "3.2.0" to "3.3.0" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `nodemon` in `app/react` from "1.14.3" to "1.14.5" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `nodemon` in `app/angular` from "1.14.3" to "1.14.5" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `nodemon` in `app/vue` from "1.14.3" to "1.14.5" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `enzyme` in `examples/cra-kitchen-sink` from "3.2.0" to "3.3.0" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `enzyme` in `examples/official-storybook` from "3.2.0" to "3.3.0" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Update 2 dependencies from npm [#2597](https://github.com/storybookjs/storybook/pull/2597)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.1" to "3.3.3" [#2598](https://github.com/storybookjs/storybook/pull/2598)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.1" to "3.3.3" [#2598](https://github.com/storybookjs/storybook/pull/2598)
- Upgraded `@storybook/addons` in `/docs` from "3.3.1" to "3.3.3" [#2598](https://github.com/storybookjs/storybook/pull/2598)
- Upgraded `@storybook/react` in `/docs` from "3.3.1" to "3.3.3" [#2598](https://github.com/storybookjs/storybook/pull/2598)
- Upgraded `danger` in `/` from "2.1.6" to "2.1.8" [#2599](https://github.com/storybookjs/storybook/pull/2599)
- Upgraded `axe-core` in `addons/a11y` from "2.6.0" to "2.6.1" [#2599](https://github.com/storybookjs/storybook/pull/2599)

</details>

## 3.3.7

2018-January-10

#### Maintenance

- Extract tslint exclusions out of package.json scripts [#2684](https://github.com/storybookjs/storybook/pull/2684)
- Add tslint to the linting pipe [#2682](https://github.com/storybookjs/storybook/pull/2682)

#### Bug Fixes

- Angular: add entry components to modulemetadata - #2701 [#2702](https://github.com/storybookjs/storybook/pull/2702)
- Add html and markup loaders to angular and vue apps [#2692](https://github.com/storybookjs/storybook/pull/2692)

## 3.3.6

2018-January-08

#### Bug Fixes

- Remove `src/` from remaining `.npmignore`s [#2678](https://github.com/storybookjs/storybook/pull/2678)

## 3.3.5

2018-January-08

#### Bug Fixes

- Remove src from individual .npmignore files [#2677](https://github.com/storybookjs/storybook/pull/2677)

## 3.4.0-alpha.0

2018-January-07

#### Features

- Multiple hierarchies [#2452](https://github.com/storybookjs/storybook/pull/2452)
- Change template story files extension to .ts [#2594](https://github.com/storybookjs/storybook/pull/2594)
- Use store revisions to ensure that stories re-render on HMR. [#2605](https://github.com/storybookjs/storybook/pull/2605)
- Ability to force re-render a story [#2463](https://github.com/storybookjs/storybook/pull/2463)
- Introduce framework-independent core library [#2241](https://github.com/storybookjs/storybook/pull/2241)

#### Documentation

<details>
<summary>
4 PRs
</summary>

- Update webpack extend warning. [#2660](https://github.com/storybookjs/storybook/pull/2660)
- ADD demo images to a new img folder with the documentation site [#2644](https://github.com/storybookjs/storybook/pull/2644)
- write doc about .css/.scss rules for Angular [#2634](https://github.com/storybookjs/storybook/pull/2634)
- Updated documentation wrt ejs exclusion [#2633](https://github.com/storybookjs/storybook/pull/2633)

</details>

#### Maintenance

<details>
<summary>
4 PRs
</summary>

- Only update CLI snapshots on postpublish script, skip smoke tests [#2671](https://github.com/storybookjs/storybook/pull/2671)
- Fix the timezone for example dates [#2654](https://github.com/storybookjs/storybook/pull/2654)
- Update prereq yarn install level [#2638](https://github.com/storybookjs/storybook/pull/2638)
- Separate stories in angular-cli example [#2592](https://github.com/storybookjs/storybook/pull/2592)

</details>

#### Dependency Upgrades

<details>
<summary>
66 Upgrades
</summary>

- Upgraded `nodemon` in `/` from "1.14.7" to "1.14.8" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `marksy` in `addons/info` from "6.0.2" to "6.0.3" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `nodemon` in `app/react` from "1.14.7" to "1.14.8" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `nodemon` in `app/angular` from "1.14.7" to "1.14.8" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `nodemon` in `app/vue` from "1.14.7" to "1.14.8" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "2.9.7" to "2.10.0" [#2664](https://github.com/storybookjs/storybook/pull/2664)
- Upgraded `@types/lodash` in `/` from "4.14.91" to "4.14.92" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `marksy` in `addons/info` from "6.0.1" to "6.0.2" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/react` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `html-loader` in `app/react` from "0.5.1" to "0.5.4" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/react` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/angular` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/angular` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/react-native` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/react-native` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/vue` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/vue` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `@types/node` in `examples/angular-cli` from "6.0.95" to "6.0.96" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `examples/vue-kitchen-sink` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `@angular/animations` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/common` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/compiler` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/core` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/forms` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/http` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/platform-browser` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/platform-browser-dynamic` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/router` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/compiler-cli` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `@angular/language-service` in `examples/angular-cli` from "5.1.2" to "5.1.3" [#2648](https://github.com/storybookjs/storybook/pull/2648)
- Upgraded `postcss-loader` in `app/react` from "2.0.9" to "2.0.10" [#2637](https://github.com/storybookjs/storybook/pull/2637)
- Upgraded `postcss-loader` in `app/angular` from "2.0.9" to "2.0.10" [#2637](https://github.com/storybookjs/storybook/pull/2637)
- Upgraded `postcss-loader` in `app/react-native` from "2.0.9" to "2.0.10" [#2637](https://github.com/storybookjs/storybook/pull/2637)
- Upgraded `postcss-loader` in `app/vue` from "2.0.9" to "2.0.10" [#2637](https://github.com/storybookjs/storybook/pull/2637)
- Update inquirer in / from 4.0.1 to 4.0.2 [#2632](https://github.com/storybookjs/storybook/pull/2632)
- Upgraded `danger` in `/` from "2.1.8" to "2.1.10" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `autoprefixer` in `app/react` from "7.2.3" to "7.2.4" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `autoprefixer` in `app/angular` from "7.2.3" to "7.2.4" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `autoprefixer` in `app/react-native` from "7.2.3" to "7.2.4" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `autoprefixer` in `app/vue` from "7.2.3" to "7.2.4" [#2618](https://github.com/storybookjs/storybook/pull/2618)
- Upgraded `nodemon` in `/` from "1.14.6" to "1.14.7" [#2612](https://github.com/storybookjs/storybook/pull/2612)
- Upgraded `nodemon` in `app/react` from "1.14.6" to "1.14.7" [#2612](https://github.com/storybookjs/storybook/pull/2612)
- Upgraded `nodemon` in `app/angular` from "1.14.6" to "1.14.7" [#2612](https://github.com/storybookjs/storybook/pull/2612)
- Upgraded `nodemon` in `app/vue` from "1.14.6" to "1.14.7" [#2612](https://github.com/storybookjs/storybook/pull/2612)
- Upgraded `vue-loader` in `app/vue` from "13.6.1" to "13.6.2" [#2611](https://github.com/storybookjs/storybook/pull/2611)
- Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "13.6.1" to "13.6.2" [#2611](https://github.com/storybookjs/storybook/pull/2611)
- Upgraded `nodemon` in `/` from "1.14.5" to "1.14.6" [#2609](https://github.com/storybookjs/storybook/pull/2609)
- Upgraded `nodemon` in `app/react` from "1.14.5" to "1.14.6" [#2609](https://github.com/storybookjs/storybook/pull/2609)
- Upgraded `nodemon` in `app/angular` from "1.14.5" to "1.14.6" [#2609](https://github.com/storybookjs/storybook/pull/2609)
- Upgraded `nodemon` in `app/vue` from "1.14.5" to "1.14.6" [#2609](https://github.com/storybookjs/storybook/pull/2609)
- Upgraded `enzyme` in `/` from "3.2.0" to "3.3.0" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `nodemon` in `/` from "1.14.3" to "1.14.5" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `graphiql` in `addons/graphql` from "0.11.10" to "0.11.11" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `enzyme` in `addons/links` from "3.2.0" to "3.3.0" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `nodemon` in `app/react` from "1.14.3" to "1.14.5" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `nodemon` in `app/angular` from "1.14.3" to "1.14.5" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `nodemon` in `app/vue` from "1.14.3" to "1.14.5" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `enzyme` in `examples/cra-kitchen-sink` from "3.2.0" to "3.3.0" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Upgraded `enzyme` in `examples/official-storybook` from "3.2.0" to "3.3.0" [#2608](https://github.com/storybookjs/storybook/pull/2608)
- Update 2 dependencies from npm [#2597](https://github.com/storybookjs/storybook/pull/2597)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.3.1" to "3.3.3" [#2598](https://github.com/storybookjs/storybook/pull/2598)
- Upgraded `@storybook/addon-links` in `/docs` from "3.3.1" to "3.3.3" [#2598](https://github.com/storybookjs/storybook/pull/2598)
- Upgraded `@storybook/addons` in `/docs` from "3.3.1" to "3.3.3" [#2598](https://github.com/storybookjs/storybook/pull/2598)
- Upgraded `@storybook/react` in `/docs` from "3.3.1" to "3.3.3" [#2598](https://github.com/storybookjs/storybook/pull/2598)
- Upgraded `danger` in `/` from "2.1.6" to "2.1.8" [#2599](https://github.com/storybookjs/storybook/pull/2599)
- Upgraded `axe-core` in `addons/a11y` from "2.6.0" to "2.6.1" [#2599](https://github.com/storybookjs/storybook/pull/2599)

</details>

## 3.3.4

2018-January-07

#### Bug Fixes

- Fix config dir detection [#2666](https://github.com/storybookjs/storybook/pull/2666)
- Removed lowercase-only restriction for knobs [#2646](https://github.com/storybookjs/storybook/pull/2646)
- Add IE11 compatibility meta tag [#2650](https://github.com/storybookjs/storybook/pull/2650)
- Allow transparency in color knob [#2624](https://github.com/storybookjs/storybook/pull/2624)
- RN: Use haul/bin/cli.js for cross-platform support [#2577](https://github.com/storybookjs/storybook/pull/2577)
- Publish package sources along with transpiled files [#2604](https://github.com/storybookjs/storybook/pull/2604)
- Fixed all peerDependencies for apps. [#2601](https://github.com/storybookjs/storybook/pull/2601)
- Renamed angular root node to avoid name collisions [#2657](https://github.com/storybookjs/storybook/pull/2657)
- Add .ts compatibility to storyshots [#2639](https://github.com/storybookjs/storybook/pull/2639)
- Remove @angular/core dep from knobs peer. [#2640](https://github.com/storybookjs/storybook/pull/2640)
- Angular: Change template story files extension .ts [#2594](https://github.com/storybookjs/storybook/pull/2594)
- Skip serializing (Synthetic)Events [#2626](https://github.com/storybookjs/storybook/pull/2626)

#### Maintenance

- Separate stories in angular-cli example [#2592](https://github.com/storybookjs/storybook/pull/2592)

#### Dependency Upgrades

<details>
<summary>
13 Upgrades
</summary>

- Upgraded `@types/lodash` in `/` from "4.14.91" to "4.14.92" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `marksy` in `addons/info` from "6.0.1" to "6.0.2" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/react` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `html-loader` in `app/react` from "0.5.1" to "0.5.4" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/react` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/angular` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/angular` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/react-native` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/react-native` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `app/vue` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `uglifyjs-webpack-plugin` in `app/vue` from "1.1.5" to "1.1.6" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `@types/node` in `examples/angular-cli` from "6.0.95" to "6.0.96" [#2659](https://github.com/storybookjs/storybook/pull/2659)
- Upgraded `css-loader` in `examples/vue-kitchen-sink` from "0.28.7" to "0.28.8" [#2659](https://github.com/storybookjs/storybook/pull/2659)

</details>

## 3.3.3

2017-December-29

#### Bug Fixes

- `app:angular` Fixed dependency injection for components [#2566](https://github.com/storybookjs/storybook/pull/2566)
- Revert "Move everything from lodash to lodash-es" [#2591](https://github.com/storybookjs/storybook/pull/2591)

#### Maintenance

- Update CLI snapshots as a postpublish step [#2565](https://github.com/storybookjs/storybook/pull/2565)
- Add more `imports` eslint rules [#2589](https://github.com/storybookjs/storybook/pull/2589)

#### Dependency Upgrades

- Upgraded `@storybook/addon-actions` in `/docs` from "3.2.18" to "3.3.1" [#2580](https://github.com/storybookjs/storybook/pull/2580)
- Upgraded `@storybook/addon-links` in `/docs` from "3.2.18" to "3.3.1" [#2580](https://github.com/storybookjs/storybook/pull/2580)
- Upgraded `@storybook/addons` in `/docs` from "3.2.18" to "3.3.1" [#2580](https://github.com/storybookjs/storybook/pull/2580)
- Upgraded `@storybook/react` in `/docs` from "3.2.18" to "3.3.1" [#2580](https://github.com/storybookjs/storybook/pull/2580)

## 3.3.2

2017-December-28

#### Bug Fixes

- Use store revisions to ensure that stories re-render on HMR. [#2588](https://github.com/storybookjs/storybook/pull/2588)
- Fix @storybook/client-logger import [#2576](https://github.com/storybookjs/storybook/pull/2576)
- Fixed react peer dependency [#2584](https://github.com/storybookjs/storybook/pull/2584)

#### Documentation

- Docs: fix logos display & add babelrc [#2585](https://github.com/storybookjs/storybook/pull/2585)
- add guide for Angular [#2574](https://github.com/storybookjs/storybook/pull/2574)
- Update custom webpack config docs [#2578](https://github.com/storybookjs/storybook/pull/2578)
- Attempt to make propTablesExclude usage clearer [#2568](https://github.com/storybookjs/storybook/pull/2568)

#### Maintenance

- Add chromatic visual tests [#2505](https://github.com/storybookjs/storybook/pull/2505)
- Update snapshots to fix tests [#2579](https://github.com/storybookjs/storybook/pull/2579)

#### Dependency Upgrades

- Upgraded `make-error` in `addons/actions` from "1.3.0" to "1.3.2" [#2586](https://github.com/storybookjs/storybook/pull/2586)
- Upgraded `zone.js` in `app/angular` from "0.8.18" to "0.8.19" [#2586](https://github.com/storybookjs/storybook/pull/2586)
- Upgraded `zone.js` in `examples/angular-cli` from "0.8.18" to "0.8.19" [#2586](https://github.com/storybookjs/storybook/pull/2586)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.6.2" to "1.6.3" [#2586](https://github.com/storybookjs/storybook/pull/2586)
- Upgraded `uglifyjs-webpack-plugin` in `app/react` from "1.1.4" to "1.1.5" [#2581](https://github.com/storybookjs/storybook/pull/2581)
- Upgraded `uglifyjs-webpack-plugin` in `app/angular` from "1.1.4" to "1.1.5" [#2581](https://github.com/storybookjs/storybook/pull/2581)
- Upgraded `uglifyjs-webpack-plugin` in `app/react-native` from "1.1.4" to "1.1.5" [#2581](https://github.com/storybookjs/storybook/pull/2581)
- Upgraded `uglifyjs-webpack-plugin` in `app/vue` from "1.1.4" to "1.1.5" [#2581](https://github.com/storybookjs/storybook/pull/2581)
- Upgraded `karma-coverage-istanbul-reporter` in `examples/angular-cli` from "1.3.1" to "1.3.3" [#2581](https://github.com/storybookjs/storybook/pull/2581)

## 3.3.1

2017-December-26

#### Bug Fixes

- Fix storybook CLI for angular: dev dependencies and fix addon-notes usage [#2572](https://github.com/storybookjs/storybook/pull/2572)

#### Documentation

- Add migration note about #2570 [#2571](https://github.com/storybookjs/storybook/pull/2571)

## 3.3.0

2017-December-26

At long last! 3.3 contains a few major features and a ginormous backlog of smaller changes. A few highlights:

- Add angular support: Storybook for Angular [#1474](https://github.com/storybookjs/storybook/pull/1474)
- Viewport Addon: simulate device sizes [#1740](https://github.com/storybookjs/storybook/pull/1740)
- Jest Addon: preview test results in Storybook [#2295](https://github.com/storybookjs/storybook/pull/2295)
- Stories panel: Stories on each hierarchy level [#1763](https://github.com/storybookjs/storybook/pull/1763)
- Storyshots: Generate snapshot per story file [#1584](https://github.com/storybookjs/storybook/pull/1584)
- Add support for importing markdown in storybook [#2299](https://github.com/storybookjs/storybook/pull/2299)

We'll do a better job of getting out smaller releases next time around. ;-)

#### Features

- Add support for importing markdown in storybook [#2299](https://github.com/storybookjs/storybook/pull/2299)
- Add `TableComponent` option for addon-info [#2400](https://github.com/storybookjs/storybook/pull/2400)
- Change keyboard shortcuts to platform safe [#1858](https://github.com/storybookjs/storybook/pull/1858)
- Replace `console` with `client-logger` and `node-logger` packages [#2347](https://github.com/storybookjs/storybook/pull/2347)
- Add renderer option to storyshots [#2414](https://github.com/storybookjs/storybook/pull/2414)
- Added type annotation to helpers, added ts declaration files for angu… [#2459](https://github.com/storybookjs/storybook/pull/2459)
- Adding extra metadata to module/components [#2526](https://github.com/storybookjs/storybook/pull/2526)
- Fix ng component prop output override [#2456](https://github.com/storybookjs/storybook/pull/2456)
- `WIP` Angular versions support [#2467](https://github.com/storybookjs/storybook/pull/2467)
- Angular Add custom pipes support [#2518](https://github.com/storybookjs/storybook/pull/2518)
- Add angular support: Storybook for Angular [#1474](https://github.com/storybookjs/storybook/pull/1474)
- Fix addon Knobs: add array in Object PropTypes [#2227](https://github.com/storybookjs/storybook/pull/2227)
- Adds error when storyshots finds no stories [#2079](https://github.com/storybookjs/storybook/pull/2079)
- Add addon background to monorepo [#2220](https://github.com/storybookjs/storybook/pull/2220)
- Add ability to parse line breaks into <br/> for Docgen descriptions [#2053](https://github.com/storybookjs/storybook/pull/2053)
- Ability for custom storyshots testFunctions to utilise "snapshot per story file" [#1841](https://github.com/storybookjs/storybook/pull/1841)
- Viewport Addon [#1753](https://github.com/storybookjs/storybook/pull/1753)
- Viewport Addon [#1740](https://github.com/storybookjs/storybook/pull/1740)
- Generate snapshot per story file [#1584](https://github.com/storybookjs/storybook/pull/1584)
- addon-links: add `LinkTo` component, and `hrefTo` function [#1829](https://github.com/storybookjs/storybook/pull/1829)
- Viewport addon: simulate device sizes in preview window [#1753](https://github.com/storybookjs/storybook/pull/1753)
- CLI: Add codemod for deprecated addon-links and addon-actions from app [#1368](https://github.com/storybookjs/storybook/pull/1368)
- Info addon: More detailed props table [#1485](https://github.com/storybookjs/storybook/pull/1485)
- React native: Add accessibility labels to OnDeviceUI [#1780](https://github.com/storybookjs/storybook/pull/1780)
- Stories panel: Stories on each hierarchy level [#1763](https://github.com/storybookjs/storybook/pull/1763)
- Storyshots: Generate snapshot per story file [#1584](https://github.com/storybookjs/storybook/pull/1584)
- CLI: Add support for Vue projects using Nuxt [#1794](https://github.com/storybookjs/storybook/pull/1794)

#### Bug Fixes

- Fix whitespace on info add-on card [#2543](https://github.com/storybookjs/storybook/pull/2543)
- Angular component props assignment improvements [#2554](https://github.com/storybookjs/storybook/pull/2554)
- Remove redundant render in react [#2503](https://github.com/storybookjs/storybook/pull/2503)
- Addon-actions: Fix types and refactor [#2438](https://github.com/storybookjs/storybook/pull/2438)
- Fix warnings in search box [#2479](https://github.com/storybookjs/storybook/pull/2479)
- Migrate to marksy@6 [#2464](https://github.com/storybookjs/storybook/pull/2464)
- Extract Jest config from package.json to config file [#2424](https://github.com/storybookjs/storybook/pull/2424)
- Fix Horizontal Scrollbar of DownPanel [#2410](https://github.com/storybookjs/storybook/pull/2410)
- Move `@storybook/addons` to peerDependencies in all addons [#2335](https://github.com/storybookjs/storybook/pull/2335)
- Fix compatibility with @babel/core v7 [#2494](https://github.com/storybookjs/storybook/pull/2494)
- Unmount after storyshot snapshot [#2417](https://github.com/storybookjs/storybook/pull/2417)
- Fix HMR by saving the preview frame URL as the story changes [#2349](https://github.com/storybookjs/storybook/pull/2349)
- Fix CLI babel transpilation [#2350](https://github.com/storybookjs/storybook/pull/2350)
- Move LinkTo component to a separate `addon-links/react` endpoint [#2239](https://github.com/storybookjs/storybook/pull/2239)
- Fix Array Knob deserialization [#2217](https://github.com/storybookjs/storybook/pull/2217)
- Return the test in storyshots to respect promises. [#2218](https://github.com/storybookjs/storybook/pull/2218)
- Knobs refactor accidentally removed select [#2210](https://github.com/storybookjs/storybook/pull/2210)
- Add HMR to other RN app templates [#2213](https://github.com/storybookjs/storybook/pull/2213)
- Autoload all `*.stories.js` files in cli templates [#2195](https://github.com/storybookjs/storybook/pull/2195)
- Fix info upgrade codemod failing when optional description string is not supplied [#2138](https://github.com/storybookjs/storybook/pull/2138)
- Fix `flex-basis` of `DownPanel` content div [#2126](https://github.com/storybookjs/storybook/pull/2126)
- CLI: Use actions in sample stories for vue + fix them in SFC_VUE template [#1867](https://github.com/storybookjs/storybook/pull/1867)
- Improve rendering of 'types' in addon-actions [#1887](https://github.com/storybookjs/storybook/pull/1887)
- Circular json can possibly hang [#1881](https://github.com/storybookjs/storybook/pull/1881)
- Use HtmlWebpackPlugin to import all assets (importing chunks in order) [#1775](https://github.com/storybookjs/storybook/pull/1775)
- Fix preview scrolling [#1782](https://github.com/storybookjs/storybook/pull/1782)
- Search box: make found options selectable with click [#1697](https://github.com/storybookjs/storybook/pull/1697)
- Fix Docgen in static builds for Info [#1725](https://github.com/storybookjs/storybook/pull/1725)
- Return empty array when Array knob is empty [#1811](https://github.com/storybookjs/storybook/pull/1811)
- Import chunks/assets in correct order using HtmlWebpackPlugin [#1775](https://github.com/storybookjs/storybook/pull/1775)
- Fix preview scrolling [#1782](https://github.com/storybookjs/storybook/pull/1782)
- Height aligned 2 buttons in manager's header [#1769](https://github.com/storybookjs/storybook/pull/1769)
- Search box: make found options selectable with click [#1697](https://github.com/storybookjs/storybook/pull/1697)
- Info addon: Fix Docgen in static builds [#1725](https://github.com/storybookjs/storybook/pull/1725)
- Knobs: allow arrays in object knob proptypes [#1701](https://github.com/storybookjs/storybook/pull/1701)

#### Documentation

- Make dependencies more deterministic [#1703](https://github.com/storybookjs/storybook/pull/1703)
- Addon-info: deep merge passed styles with default ones [#2449](https://github.com/storybookjs/storybook/pull/2449)
- Test documentation duplication fix [#2228](https://github.com/storybookjs/storybook/pull/2228)
- Updated local test documentation [#2224](https://github.com/storybookjs/storybook/pull/2224)
- Add state addon to the addons page [#2012](https://github.com/storybookjs/storybook/pull/2012)
- Add community addon to add the ability to customize styles in the story preview area [#2007](https://github.com/storybookjs/storybook/pull/2007)
- Add Figma addon to community supported section [#2009](https://github.com/storybookjs/storybook/pull/2009)
- Update storybook-router description in the addon gallery. [#1991](https://github.com/storybookjs/storybook/pull/1991)
- Make dependencies more deterministic [#1703](https://github.com/storybookjs/storybook/pull/1703)
- Synced changes from new-docs to CONTRIBUTING.md [#1911](https://github.com/storybookjs/storybook/pull/1911)
- Fix incorrect yarn command in docs [#1758](https://github.com/storybookjs/storybook/pull/1758)
- Improve linkTo documentation [#1793](https://github.com/storybookjs/storybook/pull/1793)
- Add carbon to examples page [#1764](https://github.com/storybookjs/storybook/pull/1764)
- Minor grammar fixes and clarification to Vue documentation [#1756](https://github.com/storybookjs/storybook/pull/1756)
- Fix incorrect yarn command in docs [#1758](https://github.com/storybookjs/storybook/pull/1758)
- Add storybook-chrome-screenshot to addon gallery [#1761](https://github.com/storybookjs/storybook/pull/1761)
- Fixing typo on VueJS withNotes Example [#1787](https://github.com/storybookjs/storybook/pull/1787)
- Improve linkTo documentation [#1793](https://github.com/storybookjs/storybook/pull/1793)
- Add carbon to examples page [#1764](https://github.com/storybookjs/storybook/pull/1764)
- Minor grammar fixes and clarification to Vue documentation [#1756](https://github.com/storybookjs/storybook/pull/1756)
- Fix incorrect yarn command in docs [#1758](https://github.com/storybookjs/storybook/pull/1758)
- Add storybook-chrome-screenshot to addon gallery [#1761](https://github.com/storybookjs/storybook/pull/1761)
- Fixing typo on VueJS withNotes Example [#1787](https://github.com/storybookjs/storybook/pull/1787)

#### Maintenance

- Switch to UglifyJS that supports ES6 and up [#2530](https://github.com/storybookjs/storybook/pull/2530)
- Move everything from lodash to lodash-es [#2558](https://github.com/storybookjs/storybook/pull/2558)
- Misc fixes [#2556](https://github.com/storybookjs/storybook/pull/2556)
- CI: test that angular example works [#2557](https://github.com/storybookjs/storybook/pull/2557)
- FIX `yarn test` & selecting only core [#2219](https://github.com/storybookjs/storybook/pull/2219)
- CLI test: always remove `run` directory before exiting [#2201](https://github.com/storybookjs/storybook/pull/2201)
- Bot for closing old issues [#2186](https://github.com/storybookjs/storybook/pull/2186)
- Drop "Install latest yarn version" step on CI [#1910](https://github.com/storybookjs/storybook/pull/1910)
- CLI: A more human-friendly message for undetected project types [#1825](https://github.com/storybookjs/storybook/pull/1825)
- CLI: handle promise rejections [#1826](https://github.com/storybookjs/storybook/pull/1826)
- Add tests for CLI [#1767](https://github.com/storybookjs/storybook/pull/1767)
- Yarn workspaces [#1810](https://github.com/storybookjs/storybook/pull/1810)
- Knobs: allow arrays in object knob proptypes [#1701](https://github.com/storybookjs/storybook/pull/1701)
- Deprecate confusing option names [#1692](https://github.com/storybookjs/storybook/pull/1692)
- A CLI for running specific tests suites, like bootstrap CLI [#1752](https://github.com/storybookjs/storybook/pull/1752)
- Remove check for sender on channel. [#1407](https://github.com/storybookjs/storybook/pull/1407)
- Exit with code 1 if `start-storybook --smoke-test` fails [#1851](https://github.com/storybookjs/storybook/pull/1851)
- Refactor CLI [#1840](https://github.com/storybookjs/storybook/pull/1840)
- Refactor knobs - no longer include all runtimes [#1832](https://github.com/storybookjs/storybook/pull/1832)
- Added addon-knobs to crna and vanilla react native. [#1636](https://github.com/storybookjs/storybook/pull/1636)
- Deprecate confusing option names [#1692](https://github.com/storybookjs/storybook/pull/1692)
- A CLI for running specific tests suites, like bootstrap CLI [#1752](https://github.com/storybookjs/storybook/pull/1752)
- Remove check for sender on channel. [#1407](https://github.com/storybookjs/storybook/pull/1407)
- Use yarn instead of NPM [#1703](https://github.com/storybookjs/storybook/pull/1703)
- Add config for dependencies.io [#1770](https://github.com/storybookjs/storybook/pull/1770)
- Added addon-knobs to crna and vanilla react native. [#1636](https://github.com/storybookjs/storybook/pull/1636)
- Fixed Jest warnings [#1744](https://github.com/storybookjs/storybook/pull/1744)
- Smoke test master [#1801](https://github.com/storybookjs/storybook/pull/1801)

#### Dependency Upgrades

<details>
<summary>
57 Upgrades
</summary>

- Update babel-eslint in / from 8.1.1 to 8.1.2 [#2562](https://github.com/storybookjs/storybook/pull/2562)
- Update babel-eslint in / from 8.1.0 to 8.1.1 [#2561](https://github.com/storybookjs/storybook/pull/2561)
- Update babel-eslint in / from 8.0.3 to 8.1.0 [#2559](https://github.com/storybookjs/storybook/pull/2559)
- Upgraded `eslint` in `/` from "4.13.1" to "4.14.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `jest-specific-snapshot` in `addons/storyshots` from "0.2.0" to "0.3.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `style-loader` in `app/angular` from "0.17.0" to "0.18.2" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `npx` in `lib/cli` from "9.6.0" to "9.7.1" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.3.0" to "1.6.2" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `@types/jasmine` in `examples/angular-cli` from "2.5.54" to "2.8.2" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `jasmine-core` in `examples/angular-cli` from "2.6.4" to "2.8.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `jasmine-spec-reporter` in `examples/angular-cli` from "4.1.1" to "4.2.1" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `karma-chrome-launcher` in `examples/angular-cli` from "2.1.1" to "2.2.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `karma-coverage-istanbul-reporter` in `examples/angular-cli` from "1.3.0" to "1.3.1" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `protractor` in `examples/angular-cli` from "5.1.2" to "5.2.2" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `ts-node` in `examples/angular-cli` from "3.2.2" to "3.3.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `tslint` in `examples/angular-cli` from "5.3.2" to "5.8.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- UPGRADE jest & react-native [#2542](https://github.com/storybookjs/storybook/pull/2542)
- Move back to original fuse.js package [#2478](https://github.com/storybookjs/storybook/pull/2478)
- UPDATE "react-split-pane": "^0.1.74", to FIX an breaking issue [#2528](https://github.com/storybookjs/storybook/pull/2528)
- Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.24" to "1.5.25" [#2529](https://github.com/storybookjs/storybook/pull/2529)
- Upgraded `gatsby` in `/docs` from "1.9.144" to "1.9.146" [#2529](https://github.com/storybookjs/storybook/pull/2529)
- Update gatsby in /docs from 1.9.143 to 1.9.144 [#2524](https://github.com/storybookjs/storybook/pull/2524)
- Update gatsby in /docs from 1.9.142 to 1.9.143 [#2521](https://github.com/storybookjs/storybook/pull/2521)
- Upgraded `enzyme-adapter-react-16` in `/` from "1.1.0" to "1.1.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `jest-image-snapshot` in `/` from "2.2.0" to "2.2.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `axe-core` in `addons/a11y` from "2.5.0" to "2.6.0" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `moment` in `addons/knobs` from "2.20.0" to "2.20.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue` in `addons/knobs` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue` in `app/vue` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `moment` in `addons/comments` from "2.20.0" to "2.20.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `@storybook/addon-links` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `@storybook/addons` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `@storybook/react` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `gatsby` in `/docs` from "1.9.141" to "1.9.142" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `nodemon` in `/` from "1.13.2" to "1.13.3" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `graphql` in `addons/graphql` from "0.11.7" to "0.12.0" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `@types/react` in `addons/knobs` from "16.0.30" to "16.0.31" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `file-loader` in `app/react-native` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `file-loader` in `app/react` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `nodemon` in `app/react` from "1.13.2" to "1.13.3" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `file-loader` in `app/vue` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `nodemon` in `app/vue` from "1.13.2" to "1.13.3" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `vue-loader` in `app/vue` from "13.5.0" to "13.6.0" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `file-loader` in `examples/vue-kitchen-sink` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "13.5.0" to "13.6.0" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Update danger in / from 2.1.5 to 2.1.6 [#2511](https://github.com/storybookjs/storybook/pull/2511)
- Update react-native from 0.43.4 to 0.49.3 in app/react-native [#1971](https://github.com/storybookjs/storybook/pull/1971)
- React-Native - Docs - Add Issues section for Android Emulator [#2078](https://github.com/storybookjs/storybook/pull/2078)
- Upgrade eslint-config-airbnb and make it pass [#2212](https://github.com/storybookjs/storybook/pull/2212)
- Add config for dependencies.io [#1770](https://github.com/storybookjs/storybook/pull/1770)
- Upgrade root dependencies and sync with packages [#1802](https://github.com/storybookjs/storybook/pull/1802)
- Update jest to the latest version 🚀 [#1799](https://github.com/storybookjs/storybook/pull/1799)
- Update eslint-plugin-jest to the latest version 🚀 [#1795](https://github.com/storybookjs/storybook/pull/1795)
- Update lerna to the latest version 🚀 [#1768](https://github.com/storybookjs/storybook/pull/1768)

</details>

## 3.3.0-rc.1

2017-December-26

#### Bug Fixes

- Fix whitespace on info add-on card [#2543](https://github.com/storybookjs/storybook/pull/2543)

#### Documentation

- Make dependencies more deterministic [#1703](https://github.com/storybookjs/storybook/pull/1703)

#### Maintenance

- Switch to UglifyJS that supports ES6 and up [#2530](https://github.com/storybookjs/storybook/pull/2530)
- Move everything from lodash to lodash-es [#2558](https://github.com/storybookjs/storybook/pull/2558)
- Misc fixes [#2556](https://github.com/storybookjs/storybook/pull/2556)
- CI: test that angular example works [#2557](https://github.com/storybookjs/storybook/pull/2557)

#### Dependency Upgrades

<details>
<summary>
17 Upgrades
</summary>

- Update babel-eslint in / from 8.1.1 to 8.1.2 [#2562](https://github.com/storybookjs/storybook/pull/2562)
- Update babel-eslint in / from 8.1.0 to 8.1.1 [#2561](https://github.com/storybookjs/storybook/pull/2561)
- Update babel-eslint in / from 8.0.3 to 8.1.0 [#2559](https://github.com/storybookjs/storybook/pull/2559)
- Upgraded `eslint` in `/` from "4.13.1" to "4.14.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `jest-specific-snapshot` in `addons/storyshots` from "0.2.0" to "0.3.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `style-loader` in `app/angular` from "0.17.0" to "0.18.2" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `npx` in `lib/cli` from "9.6.0" to "9.7.1" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `@angular/cli` in `examples/angular-cli` from "1.3.0" to "1.6.2" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `@types/jasmine` in `examples/angular-cli` from "2.5.54" to "2.8.2" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `jasmine-core` in `examples/angular-cli` from "2.6.4" to "2.8.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `jasmine-spec-reporter` in `examples/angular-cli` from "4.1.1" to "4.2.1" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `karma-chrome-launcher` in `examples/angular-cli` from "2.1.1" to "2.2.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `karma-coverage-istanbul-reporter` in `examples/angular-cli` from "1.3.0" to "1.3.1" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `protractor` in `examples/angular-cli` from "5.1.2" to "5.2.2" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `ts-node` in `examples/angular-cli` from "3.2.2" to "3.3.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)
- Upgraded `tslint` in `examples/angular-cli` from "5.3.2" to "5.8.0" [#2555](https://github.com/storybookjs/storybook/pull/2555)

</details>

## 3.3.0-rc.0

2017-December-23

#### Bug Fixes

- Angular component props assignment improvements [#2554](https://github.com/storybookjs/storybook/pull/2554)

#### Dependency Upgrades

- UPGRADE jest & react-native [#2542](https://github.com/storybookjs/storybook/pull/2542)

## 3.3.0-alpha.6

2017-December-23

#### Features

- Add support for importing markdown in storybook [#2299](https://github.com/storybookjs/storybook/pull/2299)
- Add `TableComponent` option for addon-info [#2400](https://github.com/storybookjs/storybook/pull/2400)
- Change keyboard shortcuts to platform safe [#1858](https://github.com/storybookjs/storybook/pull/1858)
- Replace `console` with `client-logger` and `node-logger` packages [#2347](https://github.com/storybookjs/storybook/pull/2347)
- Add renderer option to storyshots [#2414](https://github.com/storybookjs/storybook/pull/2414)

#### Angular Support

- Added type annotation to helpers, added ts declaration files for angu… [#2459](https://github.com/storybookjs/storybook/pull/2459)
- Adding extra metadata to module/components [#2526](https://github.com/storybookjs/storybook/pull/2526)
- Fix ng component prop output override [#2456](https://github.com/storybookjs/storybook/pull/2456)
- `WIP` Angular versions support [#2467](https://github.com/storybookjs/storybook/pull/2467)
- Angular Add custom pipes support [#2518](https://github.com/storybookjs/storybook/pull/2518)

#### Bug Fixes

- Remove redundant render in react [#2503](https://github.com/storybookjs/storybook/pull/2503)
- Addon-actions: Fix types and refactor [#2438](https://github.com/storybookjs/storybook/pull/2438)
- Fix warnings in search box [#2479](https://github.com/storybookjs/storybook/pull/2479)
- Migrate to marksy@6 [#2464](https://github.com/storybookjs/storybook/pull/2464)
- Extract Jest config from package.json to config file [#2424](https://github.com/storybookjs/storybook/pull/2424)
- Fix Horizontal Scrollbar of DownPanel [#2410](https://github.com/storybookjs/storybook/pull/2410)
- Move `@storybook/addons` to peerDependencies in all addons [#2335](https://github.com/storybookjs/storybook/pull/2335)
- Fix compatibility with @babel/core v7 [#2494](https://github.com/storybookjs/storybook/pull/2494)
- Unmount after storyshot snapshot [#2417](https://github.com/storybookjs/storybook/pull/2417)

#### Documentation

- Addon-info: deep merge passed styles with default ones [#2449](https://github.com/storybookjs/storybook/pull/2449)
- Test documentation duplication fix [#2228](https://github.com/storybookjs/storybook/pull/2228)

#### Maintenance

- Netlify for angularexample [#2533](https://github.com/storybookjs/storybook/pull/2533)
- Netlify for officialexample [#2532](https://github.com/storybookjs/storybook/pull/2532)
- Add a storybook for the ui package [#2504](https://github.com/storybookjs/storybook/pull/2504)
- FIX the failing netlify builds [#2527](https://github.com/storybookjs/storybook/pull/2527)
- fix tests not actually running [#2450](https://github.com/storybookjs/storybook/pull/2450)
- Add method to channel that ignores event from self [#1879](https://github.com/storybookjs/storybook/pull/1879)
- Fix broken CI build [#2255](https://github.com/storybookjs/storybook/pull/2255)
- Fix unittest warnings r3.3 [#2381](https://github.com/storybookjs/storybook/pull/2381)
- Move addon events into its own story file [#2502](https://github.com/storybookjs/storybook/pull/2502)

#### Dependency Upgrades

<details>
<summary>
33 Upgrades
</summary>

- Move back to original fuse.js package [#2478](https://github.com/storybookjs/storybook/pull/2478)
- UPDATE "react-split-pane": "^0.1.74", to FIX an breaking issue [#2528](https://github.com/storybookjs/storybook/pull/2528)
- Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.24" to "1.5.25" [#2529](https://github.com/storybookjs/storybook/pull/2529)
- Upgraded `gatsby` in `/docs` from "1.9.144" to "1.9.146" [#2529](https://github.com/storybookjs/storybook/pull/2529)
- Update gatsby in /docs from 1.9.143 to 1.9.144 [#2524](https://github.com/storybookjs/storybook/pull/2524)
- Update gatsby in /docs from 1.9.142 to 1.9.143 [#2521](https://github.com/storybookjs/storybook/pull/2521)
- Upgraded `enzyme-adapter-react-16` in `/` from "1.1.0" to "1.1.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `jest-image-snapshot` in `/` from "2.2.0" to "2.2.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `axe-core` in `addons/a11y` from "2.5.0" to "2.6.0" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `moment` in `addons/knobs` from "2.20.0" to "2.20.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue` in `addons/knobs` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue` in `app/vue` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `moment` in `addons/comments` from "2.20.0" to "2.20.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `@storybook/addon-links` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `@storybook/addons` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `@storybook/react` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `gatsby` in `/docs` from "1.9.141" to "1.9.142" [#2519](https://github.com/storybookjs/storybook/pull/2519)
- Upgraded `nodemon` in `/` from "1.13.2" to "1.13.3" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `graphql` in `addons/graphql` from "0.11.7" to "0.12.0" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `@types/react` in `addons/knobs` from "16.0.30" to "16.0.31" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `file-loader` in `app/react-native` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `file-loader` in `app/react` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `nodemon` in `app/react` from "1.13.2" to "1.13.3" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `file-loader` in `app/vue` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `nodemon` in `app/vue` from "1.13.2" to "1.13.3" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `vue-loader` in `app/vue` from "13.5.0" to "13.6.0" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `file-loader` in `examples/vue-kitchen-sink` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "13.5.0" to "13.6.0" [#2498](https://github.com/storybookjs/storybook/pull/2498)
- Update danger in / from 2.1.5 to 2.1.6 [#2511](https://github.com/storybookjs/storybook/pull/2511)

</details>

## 3.3.0-alpha.4

2017-November-22

#### Bug Fixes

- Fix HMR by saving the preview frame URL as the story changes [#2349](https://github.com/storybookjs/storybook/pull/2349)
- Fix CLI babel transpilation [#2350](https://github.com/storybookjs/storybook/pull/2350)

## 3.3.0-alpha.3

2017-November-07

#### Features

- Add angular support: Storybook for Angular [#1474](https://github.com/storybookjs/storybook/pull/1474)
- Fix addon Knobs: add array in Object PropTypes [#2227](https://github.com/storybookjs/storybook/pull/2227)
- Adds error when storyshots finds no stories [#2079](https://github.com/storybookjs/storybook/pull/2079)
- Add addon background to monorepo [#2220](https://github.com/storybookjs/storybook/pull/2220)
- Add ability to parse line breaks into <br/> for Docgen descriptions [#2053](https://github.com/storybookjs/storybook/pull/2053)

#### Bug Fixes

- Move LinkTo component to a separate `addon-links/react` endpoint [#2239](https://github.com/storybookjs/storybook/pull/2239)
- Fix Array Knob deserialization [#2217](https://github.com/storybookjs/storybook/pull/2217)
- Return the test in storyshots to respect promises. [#2218](https://github.com/storybookjs/storybook/pull/2218)
- Knobs refactor accidentally removed select [#2210](https://github.com/storybookjs/storybook/pull/2210)
- Add HMR to other RN app templates [#2213](https://github.com/storybookjs/storybook/pull/2213)
- Autoload all `*.stories.js` files in cli templates [#2195](https://github.com/storybookjs/storybook/pull/2195)
- Fix info upgrade codemod failing when optional description string is not supplied [#2138](https://github.com/storybookjs/storybook/pull/2138)
- Fix `flex-basis` of `DownPanel` content div [#2126](https://github.com/storybookjs/storybook/pull/2126)

#### Documentation

- Updated local test documentation [#2224](https://github.com/storybookjs/storybook/pull/2224)
- Add state addon to the addons page [#2012](https://github.com/storybookjs/storybook/pull/2012)
- Add community addon to add the ability to customize styles in the story preview area [#2007](https://github.com/storybookjs/storybook/pull/2007)
- Add Figma addon to community supported section [#2009](https://github.com/storybookjs/storybook/pull/2009)
- Update storybook-router description in the addon gallery. [#1991](https://github.com/storybookjs/storybook/pull/1991)

#### Maintenance

- FIX `yarn test` & selecting only core [#2219](https://github.com/storybookjs/storybook/pull/2219)
- CLI test: always remove `run` directory before exiting [#2201](https://github.com/storybookjs/storybook/pull/2201)
- Bot for closing old issues [#2186](https://github.com/storybookjs/storybook/pull/2186)

#### Dependency Upgrades

- Update react-native from 0.43.4 to 0.49.3 in app/react-native [#1971](https://github.com/storybookjs/storybook/pull/1971)
- React-Native - Docs - Add Issues section for Android Emulator [#2078](https://github.com/storybookjs/storybook/pull/2078)
- Upgrade eslint-config-airbnb and make it pass [#2212](https://github.com/storybookjs/storybook/pull/2212)

## 3.3.0-alpha.2

2017-October-03

#### Features

- Ability for custom storyshots testFunctions to utilise "snapshot per story file" [#1841](https://github.com/storybookjs/storybook/pull/1841)
- Viewport Addon [#1753](https://github.com/storybookjs/storybook/pull/1753)
- More detailed props table [#1485](https://github.com/storybookjs/storybook/pull/1485)
- RN: Add accessibility labels to OnDeviceUI [#1780](https://github.com/storybookjs/storybook/pull/1780)
- Have Stories on each level of hierarchy [#1763](https://github.com/storybookjs/storybook/pull/1763)
- Viewport Addon [#1740](https://github.com/storybookjs/storybook/pull/1740)
- Generate snapshot per story file [#1584](https://github.com/storybookjs/storybook/pull/1584)
- addon-links: add `LinkTo` component, and `hrefTo` function [#1829](https://github.com/storybookjs/storybook/pull/1829)

#### Bug Fixes

- CLI: Use actions in sample stories for vue + fix them in SFC_VUE template [#1867](https://github.com/storybookjs/storybook/pull/1867)
- Improve rendering of 'types' in addon-actions [#1887](https://github.com/storybookjs/storybook/pull/1887)
- Circular json can possibly hang [#1881](https://github.com/storybookjs/storybook/pull/1881)
- Use HtmlWebpackPlugin to import all assets (importing chunks in order) [#1775](https://github.com/storybookjs/storybook/pull/1775)
- Fix preview scrolling [#1782](https://github.com/storybookjs/storybook/pull/1782)
- Search box: make found options selectable with click [#1697](https://github.com/storybookjs/storybook/pull/1697)
- Fix Docgen in static builds for Info [#1725](https://github.com/storybookjs/storybook/pull/1725)
- Return empty array when Array knob is empty [#1811](https://github.com/storybookjs/storybook/pull/1811)

#### Documentation

- Make dependencies more deterministic [#1703](https://github.com/storybookjs/storybook/pull/1703)
- Synced changes from new-docs to CONTRIBUTING.md [#1911](https://github.com/storybookjs/storybook/pull/1911)
- Fix incorrect yarn command in docs [#1758](https://github.com/storybookjs/storybook/pull/1758)

#### Maintenance

- Drop "Install latest yarn version" step on CI [#1910](https://github.com/storybookjs/storybook/pull/1910)
- CLI: A more human-friendly message for undetected project types [#1825](https://github.com/storybookjs/storybook/pull/1825)
- CLI: handle promise rejections [#1826](https://github.com/storybookjs/storybook/pull/1826)
- Add tests for CLI [#1767](https://github.com/storybookjs/storybook/pull/1767)
- Yarn workspaces [#1810](https://github.com/storybookjs/storybook/pull/1810)
- Knobs: allow arrays in object knob proptypes [#1701](https://github.com/storybookjs/storybook/pull/1701)
- Deprecate confusing option names [#1692](https://github.com/storybookjs/storybook/pull/1692)
- A CLI for running specific tests suites, like bootstrap CLI [#1752](https://github.com/storybookjs/storybook/pull/1752)
- Remove check for sender on channel. [#1407](https://github.com/storybookjs/storybook/pull/1407)
- Exit with code 1 if `start-storybook --smoke-test` fails [#1851](https://github.com/storybookjs/storybook/pull/1851)
- Refactor CLI [#1840](https://github.com/storybookjs/storybook/pull/1840)
- Refactor knobs - no longer include all runtimes [#1832](https://github.com/storybookjs/storybook/pull/1832)
- Added addon-knobs to crna and vanilla react native. [#1636](https://github.com/storybookjs/storybook/pull/1636)

#### Dependency Upgrades

- Add config for dependencies.io [#1770](https://github.com/storybookjs/storybook/pull/1770)

## 3.3.0-alpha.0

2017-September-06

#### Features

- Viewport addon: simulate device sizes in preview window [#1753](https://github.com/storybookjs/storybook/pull/1753)
- CLI: Add codemod for deprecated addon-links and addon-actions from app [#1368](https://github.com/storybookjs/storybook/pull/1368)
- Info addon: More detailed props table [#1485](https://github.com/storybookjs/storybook/pull/1485)
- React native: Add accessibility labels to OnDeviceUI [#1780](https://github.com/storybookjs/storybook/pull/1780)
- Stories panel: Stories on each hierarchy level [#1763](https://github.com/storybookjs/storybook/pull/1763)
- Storyshots: Generate snapshot per story file [#1584](https://github.com/storybookjs/storybook/pull/1584)
- CLI: Add support for Vue projects using Nuxt [#1794](https://github.com/storybookjs/storybook/pull/1794)

#### Bug Fixes

- Import chunks/assets in correct order using HtmlWebpackPlugin [#1775](https://github.com/storybookjs/storybook/pull/1775)
- Fix preview scrolling [#1782](https://github.com/storybookjs/storybook/pull/1782)
- Height aligned 2 buttons in manager's header [#1769](https://github.com/storybookjs/storybook/pull/1769)
- Search box: make found options selectable with click [#1697](https://github.com/storybookjs/storybook/pull/1697)
- Info addon: Fix Docgen in static builds [#1725](https://github.com/storybookjs/storybook/pull/1725)
- Knobs: allow arrays in object knob proptypes [#1701](https://github.com/storybookjs/storybook/pull/1701)

#### Documentation

- Improve linkTo documentation [#1793](https://github.com/storybookjs/storybook/pull/1793)
- Add carbon to examples page [#1764](https://github.com/storybookjs/storybook/pull/1764)
- Minor grammar fixes and clarification to Vue documentation [#1756](https://github.com/storybookjs/storybook/pull/1756)
- Fix incorrect yarn command in docs [#1758](https://github.com/storybookjs/storybook/pull/1758)
- Add storybook-chrome-screenshot to addon gallery [#1761](https://github.com/storybookjs/storybook/pull/1761)
- Fixing typo on VueJS withNotes Example [#1787](https://github.com/storybookjs/storybook/pull/1787)

#### Maintenance

- Deprecate confusing option names [#1692](https://github.com/storybookjs/storybook/pull/1692)
- A CLI for running specific tests suites, like bootstrap CLI [#1752](https://github.com/storybookjs/storybook/pull/1752)
- Remove check for sender on channel. [#1407](https://github.com/storybookjs/storybook/pull/1407)
- Use yarn instead of NPM [#1703](https://github.com/storybookjs/storybook/pull/1703)
- Add config for dependencies.io [#1770](https://github.com/storybookjs/storybook/pull/1770)
- Added addon-knobs to crna and vanilla react native. [#1636](https://github.com/storybookjs/storybook/pull/1636)
- Fixed Jest warnings [#1744](https://github.com/storybookjs/storybook/pull/1744)
- Smoke test master [#1801](https://github.com/storybookjs/storybook/pull/1801)

#### Dependency Upgrades

- Upgrade root dependencies and sync with packages [#1802](https://github.com/storybookjs/storybook/pull/1802)
- Update jest to the latest version 🚀 [#1799](https://github.com/storybookjs/storybook/pull/1799)
- Update eslint-plugin-jest to the latest version 🚀 [#1795](https://github.com/storybookjs/storybook/pull/1795)
- Update lerna to the latest version 🚀 [#1768](https://github.com/storybookjs/storybook/pull/1768)

## 3.2.19

2017-December-23

#### Bug Fixes

- fix compatibility with @babel/core v7 [#2494](https://github.com/storybookjs/storybook/pull/2494)

#### Maintenance

- FIX the failing netlify builds [#2527](https://github.com/storybookjs/storybook/pull/2527)

#### Documentation

- UPDATE readme with new slackin link [#2536](https://github.com/storybookjs/storybook/pull/2536)

#### Dependency Upgrades

<details>
<summary>
55 Updates
</summary>
-   UPDATE "react-split-pane": "^0.1.74", to FIX an breaking issue [#2528](https://github.com/storybookjs/storybook/pull/2528)
-   Upgraded `cross-env` in `/` from "5.1.1" to "5.1.3" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `nodemon` in `/` from "1.13.3" to "1.14.3" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `glamorous` in `lib/components` from "4.11.0" to "4.11.2" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `glamorous` in `addons/jest` from "4.11.0" to "4.11.2" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `@types/node` in `addons/knobs` from "8.5.1" to "8.5.2" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `vue` in `addons/knobs` from "2.5.12" to "2.5.13" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `common-tags` in `app/react` from "1.5.1" to "1.6.0" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `glamorous` in `app/react` from "4.11.0" to "4.11.2" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `nodemon` in `app/react` from "1.13.3" to "1.14.3" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `common-tags` in `app/vue` from "1.5.1" to "1.6.0" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `nodemon` in `app/vue` from "1.13.3" to "1.14.3" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `vue` in `app/vue` from "2.5.12" to "2.5.13" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `vue-loader` in `app/vue` from "13.6.0" to "13.6.1" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `vue-template-compiler` in `app/vue` from "2.5.12" to "2.5.13" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.12" to "2.5.13" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `cross-env` in `examples/vue-kitchen-sink` from "5.1.1" to "5.1.3" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "13.6.0" to "13.6.1" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.12" to "2.5.13" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `glamorous` in `examples/cra-kitchen-sink` from "4.11.0" to "4.11.2" [#2540](https://github.com/storybookjs/storybook/pull/2540)
-   Upgraded `gatsby-remark-autolink-headers` in `/docs` from "1.4.10" to "1.4.11" [#2541](https://github.com/storybookjs/storybook/pull/2541)
-   Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.25" to "1.7.26" [#2541](https://github.com/storybookjs/storybook/pull/2541)
-   Upgraded `gatsby` in `/docs` from "1.9.148" to "1.9.149" [#2541](https://github.com/storybookjs/storybook/pull/2541)
-   Update gatsby in /docs from 1.9.146 to 1.9.147 [#2535](https://github.com/storybookjs/storybook/pull/2535)
-   Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.24" to "1.5.25" [#2529](https://github.com/storybookjs/storybook/pull/2529)
-   Upgraded `gatsby` in `/docs` from "1.9.144" to "1.9.146" [#2529](https://github.com/storybookjs/storybook/pull/2529)
-   Update gatsby in /docs from 1.9.143 to 1.9.144 [#2524](https://github.com/storybookjs/storybook/pull/2524)
-   Update gatsby in /docs from 1.9.142 to 1.9.143 [#2521](https://github.com/storybookjs/storybook/pull/2521)
-   Upgraded `enzyme-adapter-react-16` in `/` from "1.1.0" to "1.1.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `jest-image-snapshot` in `/` from "2.2.0" to "2.2.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `axe-core` in `addons/a11y` from "2.5.0" to "2.6.0" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `moment` in `addons/knobs` from "2.20.0" to "2.20.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `vue` in `addons/knobs` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `vue` in `app/vue` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `vue-template-compiler` in `app/vue` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `moment` in `addons/comments` from "2.20.0" to "2.20.1" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.11" to "2.5.12" [#2520](https://github.com/storybookjs/storybook/pull/2520)
-   Upgraded `@storybook/addon-actions` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
-   Upgraded `@storybook/addon-links` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
-   Upgraded `@storybook/addons` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
-   Upgraded `@storybook/react` in `/docs` from "3.2.17" to "3.2.18" [#2519](https://github.com/storybookjs/storybook/pull/2519)
-   Upgraded `gatsby` in `/docs` from "1.9.141" to "1.9.142" [#2519](https://github.com/storybookjs/storybook/pull/2519)
-   Upgraded `nodemon` in `/` from "1.13.2" to "1.13.3" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `graphql` in `addons/graphql` from "0.11.7" to "0.12.0" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `@types/react` in `addons/knobs` from "16.0.30" to "16.0.31" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `file-loader` in `app/react-native` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `file-loader` in `app/react` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `nodemon` in `app/react` from "1.13.2" to "1.13.3" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `file-loader` in `app/vue` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `nodemon` in `app/vue` from "1.13.2" to "1.13.3" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `vue-loader` in `app/vue` from "13.5.0" to "13.6.0" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `file-loader` in `examples/vue-kitchen-sink` from "1.1.5" to "1.1.6" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Upgraded `vue-loader` in `examples/vue-kitchen-sink` from "13.5.0" to "13.6.0" [#2498](https://github.com/storybookjs/storybook/pull/2498)
-   Update danger in / from 2.1.5 to 2.1.6 [#2511](https://github.com/storybookjs/storybook/pull/2511)

</details>

## 3.2.18

2017-December-18

#### Bug Fixes

- Number knob: apply default min/max/step values only in range mode [#2437](https://github.com/storybookjs/storybook/pull/2437)
- `addon-actions` Check result of getPropertyDescriptor for IE11 [#2428](https://github.com/storybookjs/storybook/pull/2428)
- Edited template of search box result item to fix overflow text in row [#2419](https://github.com/storybookjs/storybook/pull/2419)
- Fix missing supported extension check in case when asset is a string [#2468](https://github.com/storybookjs/storybook/pull/2468)

#### Documentation

- Fix react-native-vanilla to actually run storybook and document how to run it [#2274](https://github.com/storybookjs/storybook/pull/2274)
- Add another state addon to the gallery [#2391](https://github.com/storybookjs/storybook/pull/2391)
- Create ISSUE_TEMPLATE.md [#2426](https://github.com/storybookjs/storybook/pull/2426)
- fix Button dependency & typo in composant name in documentation [#2465](https://github.com/storybookjs/storybook/pull/2465)
- add vue storybook boilerplate [#2421](https://github.com/storybookjs/storybook/pull/2421)
- fix: update links to webpack docs [#2512](https://github.com/storybookjs/storybook/pull/2512)

#### Maintenance

- Do not remove debugger-statements during development [#2493](https://github.com/storybookjs/storybook/pull/2493)
- FIX react-native-test in CI [#2444](https://github.com/storybookjs/storybook/pull/2444)

#### Dependency Upgrades

<details>
<summary>
139 Updates
</summary>

- Update gatsby in /docs from 1.9.139 to 1.9.141 [#2510](https://github.com/storybookjs/storybook/pull/2510)
- Update gatsby in /docs from 1.9.138 to 1.9.139 [#2499](https://github.com/storybookjs/storybook/pull/2499)
- Upgraded `eslint-plugin-prettier` in `/` from "2.3.1" to "2.4.0" [#2500](https://github.com/storybookjs/storybook/pull/2500)
- Upgraded `graphql` in `addons/graphql` from "0.11.7" to "0.12.3" [#2500](https://github.com/storybookjs/storybook/pull/2500)
- Upgraded `moment` in `addons/knobs` from "2.19.4" to "2.20.0" [#2500](https://github.com/storybookjs/storybook/pull/2500)
- Upgraded `ws` in `app/react-native` from "3.3.2" to "3.3.3" [#2500](https://github.com/storybookjs/storybook/pull/2500)
- Upgraded `moment` in `addons/comments` from "2.19.4" to "2.20.0" [#2500](https://github.com/storybookjs/storybook/pull/2500)
- Update gatsby in /docs from 1.9.135 to 1.9.138 [#2497](https://github.com/storybookjs/storybook/pull/2497)
- Upgraded `eslint-plugin-jest` in `/` from "21.4.3" to "21.5.0" [#2496](https://github.com/storybookjs/storybook/pull/2496)
- Upgraded `nodemon` in `/` from "1.12.7" to "1.13.2" [#2496](https://github.com/storybookjs/storybook/pull/2496)
- Upgraded `nodemon` in `app/react` from "1.12.7" to "1.13.2" [#2496](https://github.com/storybookjs/storybook/pull/2496)
- Upgraded `nodemon` in `app/vue` from "1.12.7" to "1.13.2" [#2496](https://github.com/storybookjs/storybook/pull/2496)
- Update gatsby-remark-copy-linked-files in /docs from 1.5.23 to 1.5.24 [#2495](https://github.com/storybookjs/storybook/pull/2495)
- Update gatsby in /docs from 1.9.134 to 1.9.135 [#2491](https://github.com/storybookjs/storybook/pull/2491)
- Update danger in / from 2.1.4 to 2.1.5 [#2489](https://github.com/storybookjs/storybook/pull/2489)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.23" to "1.6.24" [#2490](https://github.com/storybookjs/storybook/pull/2490)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.35" to "1.5.36" [#2490](https://github.com/storybookjs/storybook/pull/2490)
- Upgraded `eslint-plugin-jest` in `/` from "21.4.2" to "21.4.3" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `nodemon` in `/` from "1.12.6" to "1.12.7" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `symlink-dir` in `/` from "1.1.0" to "1.1.1" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `@types/node` in `addons/knobs` from "8.0.58" to "8.5.1" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `@types/react` in `addons/knobs` from "16.0.29" to "16.0.30" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `style-loader` in `addons/knobs` from "0.19.0" to "0.19.1" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `vue` in `addons/knobs` from "2.5.10" to "2.5.11" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `autoprefixer` in `app/react-native` from "7.2.2" to "7.2.3" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `style-loader` in `app/react-native` from "0.18.2" to "0.19.1" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `autoprefixer` in `app/react` from "7.2.2" to "7.2.3" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `style-loader` in `app/react` from "0.18.2" to "0.19.1" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `nodemon` in `app/react` from "1.12.6" to "1.12.7" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `autoprefixer` in `app/vue` from "7.2.2" to "7.2.3" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `style-loader` in `app/vue` from "0.18.2" to "0.19.1" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `nodemon` in `app/vue` from "1.12.6" to "1.12.7" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `vue` in `app/vue` from "2.5.10" to "2.5.11" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.10" to "2.5.11" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.10" to "2.5.11" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.10" to "2.5.11" [#2488](https://github.com/storybookjs/storybook/pull/2488)
- Upgraded `gatsby-link` in `/docs` from "1.6.31" to "1.6.32" [#2486](https://github.com/storybookjs/storybook/pull/2486)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.24" to "1.7.25" [#2486](https://github.com/storybookjs/storybook/pull/2486)
- Upgraded `gatsby` in `/docs` from "1.9.131" to "1.9.134" [#2486](https://github.com/storybookjs/storybook/pull/2486)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.34" to "1.5.35" [#2476](https://github.com/storybookjs/storybook/pull/2476)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.10" to "1.5.11" [#2476](https://github.com/storybookjs/storybook/pull/2476)
- Upgraded `gatsby` in `/docs` from "1.9.130" to "1.9.131" [#2476](https://github.com/storybookjs/storybook/pull/2476)
- Upgraded `eslint-plugin-jsx-a11y` in `/` from "6.0.2" to "6.0.3" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `nodemon` in `/` from "1.12.5" to "1.12.6" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `vue` in `addons/knobs` from "2.5.9" to "2.5.10" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `react-modal` in `lib/ui` from "3.1.7" to "3.1.8" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `nodemon` in `app/react` from "1.12.5" to "1.12.6" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `nodemon` in `app/vue` from "1.12.5" to "1.12.6" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `vue` in `app/vue` from "2.5.9" to "2.5.10" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.9" to "2.5.10" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.9" to "2.5.10" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.9" to "2.5.10" [#2477](https://github.com/storybookjs/storybook/pull/2477)
- Upgraded `danger` in `/` from "2.1.3" to "2.1.4" [#2473](https://github.com/storybookjs/storybook/pull/2473)
- Upgraded `eslint` in `/` from "4.13.0" to "4.13.1" [#2473](https://github.com/storybookjs/storybook/pull/2473)
- Upgraded `prettier` in `/` from "1.9.1" to "1.9.2" [#2473](https://github.com/storybookjs/storybook/pull/2473)
- Upgraded `@types/node` in `addons/knobs` from "8.0.57" to "8.0.58" [#2473](https://github.com/storybookjs/storybook/pull/2473)
- Upgraded `@types/react` in `addons/knobs` from "16.0.28" to "16.0.29" [#2473](https://github.com/storybookjs/storybook/pull/2473)
- Upgraded `core-js` in `app/react` from "2.5.2" to "2.5.3" [#2473](https://github.com/storybookjs/storybook/pull/2473)
- Upgraded `core-js` in `app/vue` from "2.5.2" to "2.5.3" [#2473](https://github.com/storybookjs/storybook/pull/2473)
- Upgraded `moment` in `addons/knobs` from "2.19.3" to "2.19.4" [#2462](https://github.com/storybookjs/storybook/pull/2462)
- Upgraded `moment` in `addons/comments` from "2.19.3" to "2.19.4" [#2462](https://github.com/storybookjs/storybook/pull/2462)
- Upgraded `react-inspector` in `addons/actions` from "2.2.1" to "2.2.2" [#2457](https://github.com/storybookjs/storybook/pull/2457)
- Upgraded `react-inspector` in `lib/ui` from "2.2.1" to "2.2.2" [#2457](https://github.com/storybookjs/storybook/pull/2457)
- Upgraded `gatsby-link` in `/docs` from "1.6.30" to "1.6.31" [#2458](https://github.com/storybookjs/storybook/pull/2458)
- Upgraded `gatsby-plugin-sharp` in `/docs` from "1.6.22" to "1.6.23" [#2458](https://github.com/storybookjs/storybook/pull/2458)
- Upgraded `gatsby-remark-autolink-headers` in `/docs` from "1.4.9" to "1.4.10" [#2458](https://github.com/storybookjs/storybook/pull/2458)
- Upgraded `gatsby-remark-copy-linked-files` in `/docs` from "1.5.22" to "1.5.23" [#2458](https://github.com/storybookjs/storybook/pull/2458)
- Upgraded `gatsby-remark-images` in `/docs` from "1.5.33" to "1.5.34" [#2458](https://github.com/storybookjs/storybook/pull/2458)
- Upgraded `gatsby-remark-smartypants` in `/docs` from "1.4.9" to "1.4.10" [#2458](https://github.com/storybookjs/storybook/pull/2458)
- Upgraded `gatsby-source-filesystem` in `/docs` from "1.5.9" to "1.5.10" [#2458](https://github.com/storybookjs/storybook/pull/2458)
- Upgraded `gatsby-transformer-remark` in `/docs` from "1.7.23" to "1.7.24" [#2458](https://github.com/storybookjs/storybook/pull/2458)
- Upgraded `gatsby` in `/docs` from "1.9.128" to "1.9.130" [#2458](https://github.com/storybookjs/storybook/pull/2458)
- Update react-stack-grid in /docs from 0.6.0 to 0.7.0 [#2453](https://github.com/storybookjs/storybook/pull/2453)
- Upgraded `eslint` in `/` from "4.12.1" to "4.13.0" [#2454](https://github.com/storybookjs/storybook/pull/2454)
- Upgraded `core-js` in `app/react` from "2.5.1" to "2.5.2" [#2454](https://github.com/storybookjs/storybook/pull/2454)
- Upgraded `core-js` in `app/vue` from "2.5.1" to "2.5.2" [#2454](https://github.com/storybookjs/storybook/pull/2454)
- Upgraded `@types/node` in `addons/knobs` from "8.0.56" to "8.0.57" [#2448](https://github.com/storybookjs/storybook/pull/2448)
- Upgraded `@types/react` in `addons/knobs` from "16.0.27" to "16.0.28" [#2448](https://github.com/storybookjs/storybook/pull/2448)
- Upgraded `autoprefixer` in `app/react-native` from "7.2.1" to "7.2.2" [#2448](https://github.com/storybookjs/storybook/pull/2448)
- Upgraded `autoprefixer` in `app/react` from "7.2.1" to "7.2.2" [#2448](https://github.com/storybookjs/storybook/pull/2448)
- Upgraded `autoprefixer` in `app/vue` from "7.2.1" to "7.2.2" [#2448](https://github.com/storybookjs/storybook/pull/2448)
- Upgraded `danger` in `/` from "2.1.2" to "2.1.3" [#2447](https://github.com/storybookjs/storybook/pull/2447)
- Upgraded `jscodeshift` in `lib/codemod` from "0.3.32" to "0.4.0" [#2447](https://github.com/storybookjs/storybook/pull/2447)
- Upgraded `jscodeshift` in `lib/cli` from "0.3.32" to "0.4.0" [#2447](https://github.com/storybookjs/storybook/pull/2447)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "2.9.6" to "2.9.7" [#2447](https://github.com/storybookjs/storybook/pull/2447)
- Upgraded `danger` in `/` from "2.0.3" to "2.1.2" [#2442](https://github.com/storybookjs/storybook/pull/2442)
- Upgraded `eslint-plugin-jest` in `/` from "21.4.1" to "21.4.2" [#2442](https://github.com/storybookjs/storybook/pull/2442)
- Upgraded `github-release-from-changelog` in `/` from "1.2.1" to "1.3.0" [#2442](https://github.com/storybookjs/storybook/pull/2442)
- Upgraded `nodemon` in `/` from "1.12.4" to "1.12.5" [#2442](https://github.com/storybookjs/storybook/pull/2442)
- Upgraded `prettier` in `/` from "1.9.0" to "1.9.1" [#2442](https://github.com/storybookjs/storybook/pull/2442)
- Upgraded `@types/node` in `addons/knobs` from "8.0.54" to "8.0.55" [#2442](https://github.com/storybookjs/storybook/pull/2442)
- Upgraded `react-native` in `app/react-native` from "0.50.4" to "0.51.0" [#2442](https://github.com/storybookjs/storybook/pull/2442)
- Upgraded `nodemon` in `app/react` from "1.12.4" to "1.12.5" [#2442](https://github.com/storybookjs/storybook/pull/2442)
- Upgraded `nodemon` in `app/vue` from "1.12.4" to "1.12.5" [#2442](https://github.com/storybookjs/storybook/pull/2442)
- Upgraded `@types/node` in `addons/knobs` from "8.0.54" to "8.0.56" [#2443](https://github.com/storybookjs/storybook/pull/2443)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "2.9.5" to "2.9.6" [#2443](https://github.com/storybookjs/storybook/pull/2443)
- Update fs-extra in / from 4.0.2 to 4.0.3 [#2433](https://github.com/storybookjs/storybook/pull/2433)
- Upgraded `eslint-plugin-jest` in `/` from "21.4.0" to "21.4.1" [#2430](https://github.com/storybookjs/storybook/pull/2430)
- Upgraded `prettier` in `/` from "1.8.2" to "1.9.0" [#2430](https://github.com/storybookjs/storybook/pull/2430)
- Upgraded `babel-eslint` in `/` from "8.0.2" to "8.0.3" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `commander` in `/` from "2.12.1" to "2.12.2" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `eslint` in `/` from "4.12.0" to "4.12.1" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `eslint-plugin-jest` in `/` from "21.3.2" to "21.4.0" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `inquirer` in `/` from "4.0.0" to "4.0.1" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `nodemon` in `/` from "1.12.1" to "1.12.4" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `moment` in `addons/knobs` from "2.19.2" to "2.19.3" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `react-datetime` in `addons/knobs` from "2.11.0" to "2.11.1" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `@types/node` in `addons/knobs` from "8.0.53" to "8.0.54" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `@types/react` in `addons/knobs` from "16.0.25" to "16.0.27" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `typescript` in `addons/knobs` from "2.6.1" to "2.6.2" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `vue` in `addons/knobs` from "2.5.8" to "2.5.9" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `commander` in `lib/cli` from "2.12.1" to "2.12.2" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `react-modal` in `lib/ui` from "3.1.4" to "3.1.7" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `autoprefixer` in `app/react-native` from "7.1.6" to "7.2.1" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `commander` in `app/react-native` from "2.12.1" to "2.12.2" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `webpack` in `app/react-native` from "3.8.1" to "3.10.0" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `airbnb-js-shims` in `app/react` from "1.3.0" to "1.4.0" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `autoprefixer` in `app/react` from "7.1.6" to "7.2.1" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `commander` in `app/react` from "2.12.1" to "2.12.2" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `webpack` in `app/react` from "3.8.1" to "3.10.0" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `nodemon` in `app/react` from "1.12.1" to "1.12.4" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `airbnb-js-shims` in `app/vue` from "1.3.0" to "1.4.0" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `autoprefixer` in `app/vue` from "7.1.6" to "7.2.1" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `commander` in `app/vue` from "2.12.1" to "2.12.2" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `webpack` in `app/vue` from "3.8.1" to "3.10.0" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `nodemon` in `app/vue` from "1.12.1" to "1.12.4" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `vue` in `app/vue` from "2.5.8" to "2.5.9" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.8" to "2.5.9" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `marked` in `addons/comments` from "0.3.6" to "0.3.7" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `moment` in `addons/comments` from "2.19.2" to "2.19.3" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.8" to "2.5.9" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.8" to "2.5.9" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `webpack` in `examples/vue-kitchen-sink` from "3.8.1" to "3.10.0" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `webpack-dev-server` in `examples/vue-kitchen-sink` from "2.9.4" to "2.9.5" [#2429](https://github.com/storybookjs/storybook/pull/2429)
- Upgraded `@storybook/addon-actions` in `/docs` from "3.2.16" to "3.2.17" [#2427](https://github.com/storybookjs/storybook/pull/2427)
- Upgraded `@storybook/addon-links` in `/docs` from "3.2.16" to "3.2.17" [#2427](https://github.com/storybookjs/storybook/pull/2427)
- Upgraded `@storybook/addons` in `/docs` from "3.2.16" to "3.2.17" [#2427](https://github.com/storybookjs/storybook/pull/2427)
- Upgraded `@storybook/react` in `/docs` from "3.2.16" to "3.2.17" [#2427](https://github.com/storybookjs/storybook/pull/2427)
- React 16.2 [#2393](https://github.com/storybookjs/storybook/pull/2393)

</details>

## 3.2.17

2017-December-03

#### Features

- Add dotenv support for storybook in vue and react [#2345](https://github.com/storybookjs/storybook/pull/2345)
- Addon jest [#2295](https://github.com/storybookjs/storybook/pull/2295)
- Addon-knobs: add number config options [#2371](https://github.com/storybookjs/storybook/pull/2371)
- Addon-info: Expose style for customization [#2370](https://github.com/storybookjs/storybook/pull/2370)

#### Bug Fixes

- Fix addon-actions in legacy Android browser [#2365](https://github.com/storybookjs/storybook/pull/2365)
- Remove superfluous vertical scrollbar in fullscreen [#2394](https://github.com/storybookjs/storybook/pull/2394)
- Made jest test file extension name optional [#2373](https://github.com/storybookjs/storybook/pull/2373)
- Render navigation and addons panels even when they are hidden [#2336](https://github.com/storybookjs/storybook/pull/2336)
- Fix wrong "withTests" examples + add documentation [#2398](https://github.com/storybookjs/storybook/pull/2398)

#### Maintenance

- Issue #2196 - Set console.warn and console.error to throw in tests [#2297](https://github.com/storybookjs/storybook/pull/2297)
- Optimize CI workflow [#2331](https://github.com/storybookjs/storybook/pull/2331)
- Ignore shelljs in bithound [#2322](https://github.com/storybookjs/storybook/pull/2322)
- Fix netlify vue instance [#2386](https://github.com/storybookjs/storybook/pull/2386)
- Keep examples' deps up to date [#2353](https://github.com/storybookjs/storybook/pull/2353)
- Separate netlify instances [#2340](https://github.com/storybookjs/storybook/pull/2340)
- Issue 2196 fix unittest warnings [#2343](https://github.com/storybookjs/storybook/pull/2343)

#### Documentation

- Document return type of `date` knob (see #1489) [#2332](https://github.com/storybookjs/storybook/pull/2332)

#### Dependency Upgrades

<details>
<summary>
72 PRs
</summary>

- Update gatsby in /docs from 1.9.127 to 1.9.128 [#2420](https://github.com/storybookjs/storybook/pull/2420)
- Update marked in /docs from 0.3.6 to 0.3.7 [#2416](https://github.com/storybookjs/storybook/pull/2416)
- Upgraded `gatsby` in `docs` from "1.9.126" to "1.9.127" [#2406](https://github.com/storybookjs/storybook/pull/2406)
- Upgraded `gatsby-transformer-remark` in `docs` from "1.7.22" to "1.7.23" [#2406](https://github.com/storybookjs/storybook/pull/2406)
- Upgraded `gatsby` in `docs` from "1.9.125" to "1.9.126" [#2399](https://github.com/storybookjs/storybook/pull/2399)
- Upgraded `gatsby-link` in `docs` from "1.6.29" to "1.6.30" [#2399](https://github.com/storybookjs/storybook/pull/2399)
- Upgraded `gatsby` in `docs` from "1.9.119" to "1.9.125" [#2392](https://github.com/storybookjs/storybook/pull/2392)
- Upgraded `gatsby-link` in `docs` from "1.6.28" to "1.6.29" [#2392](https://github.com/storybookjs/storybook/pull/2392)
- Upgraded `gatsby-plugin-sharp` in `docs` from "1.6.21" to "1.6.22" [#2392](https://github.com/storybookjs/storybook/pull/2392)
- Upgraded `gatsby-remark-autolink-headers` in `docs` from "1.4.8" to "1.4.9" [#2392](https://github.com/storybookjs/storybook/pull/2392)
- Upgraded `gatsby-remark-copy-linked-files` in `docs` from "1.5.21" to "1.5.22" [#2392](https://github.com/storybookjs/storybook/pull/2392)
- Upgraded `gatsby-remark-images` in `docs` from "1.5.32" to "1.5.33" [#2392](https://github.com/storybookjs/storybook/pull/2392)
- Upgraded `gatsby-remark-smartypants` in `docs` from "1.4.8" to "1.4.9" [#2392](https://github.com/storybookjs/storybook/pull/2392)
- Upgraded `gatsby-source-filesystem` in `docs` from "1.5.8" to "1.5.9" [#2392](https://github.com/storybookjs/storybook/pull/2392)
- Upgraded `gatsby-transformer-remark` in `docs` from "1.7.21" to "1.7.22" [#2392](https://github.com/storybookjs/storybook/pull/2392)
- Upgraded `webpack-dev-middleware` in `app/react-native` from "1.12.1" to "1.12.2" [#2385](https://github.com/storybookjs/storybook/pull/2385)
- Upgraded `webpack-hot-middleware` in `app/react-native` from "2.20.0" to "2.21.0" [#2385](https://github.com/storybookjs/storybook/pull/2385)
- Upgraded `webpack-dev-middleware` in `app/react` from "1.12.1" to "1.12.2" [#2385](https://github.com/storybookjs/storybook/pull/2385)
- Upgraded `webpack-hot-middleware` in `app/react` from "2.20.0" to "2.21.0" [#2385](https://github.com/storybookjs/storybook/pull/2385)
- Upgraded `webpack-dev-middleware` in `app/vue` from "1.12.1" to "1.12.2" [#2385](https://github.com/storybookjs/storybook/pull/2385)
- Upgraded `webpack-hot-middleware` in `app/vue` from "2.20.0" to "2.21.0" [#2385](https://github.com/storybookjs/storybook/pull/2385)
- Upgraded `danger` in `/` from "2.0.1" to "2.0.3" [#2380](https://github.com/storybookjs/storybook/pull/2380)
- Upgraded `eslint` in `/` from "4.11.0" to "4.12.0" [#2380](https://github.com/storybookjs/storybook/pull/2380)
- Upgraded `eslint-config-prettier` in `/` from "2.8.0" to "2.9.0" [#2380](https://github.com/storybookjs/storybook/pull/2380)
- Upgraded `react-modal` in `lib/ui` from "3.1.3" to "3.1.4" [#2364](https://github.com/storybookjs/storybook/pull/2364)
- Upgraded `postcss-loader` in `app/react-native` from "2.0.8" to "2.0.9" [#2364](https://github.com/storybookjs/storybook/pull/2364)
- Upgraded `react-native` in `app/react-native` from "0.50.3" to "0.50.4" [#2364](https://github.com/storybookjs/storybook/pull/2364)
- Upgraded `common-tags` in `app/react` from "1.4.0" to "1.5.1" [#2364](https://github.com/storybookjs/storybook/pull/2364)
- Upgraded `postcss-loader` in `app/react` from "2.0.8" to "2.0.9" [#2364](https://github.com/storybookjs/storybook/pull/2364)
- Upgraded `common-tags` in `app/vue` from "1.4.0" to "1.5.1" [#2364](https://github.com/storybookjs/storybook/pull/2364)
- Upgraded `postcss-loader` in `app/vue` from "2.0.8" to "2.0.9" [#2364](https://github.com/storybookjs/storybook/pull/2364)
- Upgraded `commander` in `/` from "2.11.0" to "2.12.1" [#2359](https://github.com/storybookjs/storybook/pull/2359)
- Upgraded `commander` in `lib/cli` from "2.11.0" to "2.12.1" [#2359](https://github.com/storybookjs/storybook/pull/2359)
- Upgraded `react-modal` in `lib/ui` from "3.1.2" to "3.1.3" [#2359](https://github.com/storybookjs/storybook/pull/2359)
- Upgraded `commander` in `app/react-native` from "2.11.0" to "2.12.1" [#2359](https://github.com/storybookjs/storybook/pull/2359)
- Upgraded `webpack-dev-middleware` in `app/react-native` from "1.12.0" to "1.12.1" [#2359](https://github.com/storybookjs/storybook/pull/2359)
- Upgraded `commander` in `app/react` from "2.11.0" to "2.12.1" [#2359](https://github.com/storybookjs/storybook/pull/2359)
- Upgraded `webpack-dev-middleware` in `app/react` from "1.12.0" to "1.12.1" [#2359](https://github.com/storybookjs/storybook/pull/2359)
- Upgraded `commander` in `app/vue` from "2.11.0" to "2.12.1" [#2359](https://github.com/storybookjs/storybook/pull/2359)
- Upgraded `webpack-dev-middleware` in `app/vue` from "1.12.0" to "1.12.1" [#2359](https://github.com/storybookjs/storybook/pull/2359)
- Update gatsby in docs from 1.9.118 to 1.9.119 [#2354](https://github.com/storybookjs/storybook/pull/2354)
- Upgraded `vue` in `addons/knobs` from "2.5.6" to "2.5.8" [#2344](https://github.com/storybookjs/storybook/pull/2344)
- Upgraded `ws` in `app/react-native` from "3.3.1" to "3.3.2" [#2344](https://github.com/storybookjs/storybook/pull/2344)
- Upgraded `vue` in `app/vue` from "2.5.6" to "2.5.8" [#2344](https://github.com/storybookjs/storybook/pull/2344)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.6" to "2.5.8" [#2344](https://github.com/storybookjs/storybook/pull/2344)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.6" to "2.5.8" [#2344](https://github.com/storybookjs/storybook/pull/2344)
- Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.6" to "2.5.8" [#2344](https://github.com/storybookjs/storybook/pull/2344)
- Upgraded `eslint-config-prettier` in `/` from "2.7.0" to "2.8.0" [#2342](https://github.com/storybookjs/storybook/pull/2342)
- Upgraded `eslint-plugin-react` in `/` from "7.4.0" to "7.5.0" [#2342](https://github.com/storybookjs/storybook/pull/2342)
- Upgraded `vue` in `addons/knobs` from "2.5.5" to "2.5.6" [#2342](https://github.com/storybookjs/storybook/pull/2342)
- Upgraded `vue` in `app/vue` from "2.5.5" to "2.5.6" [#2342](https://github.com/storybookjs/storybook/pull/2342)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.5" to "2.5.6" [#2342](https://github.com/storybookjs/storybook/pull/2342)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.5" to "2.5.6" [#2342](https://github.com/storybookjs/storybook/pull/2342)
- Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.5" to "2.5.6" [#2342](https://github.com/storybookjs/storybook/pull/2342)
- Update gatsby in docs from 1.9.117 to 1.9.118 [#2341](https://github.com/storybookjs/storybook/pull/2341)
- Upgraded `gatsby` in `docs` from "1.9.114" to "1.9.117" [#2338](https://github.com/storybookjs/storybook/pull/2338)
- Upgraded `gh-pages` in `docs` from "1.0.0" to "1.1.0" [#2338](https://github.com/storybookjs/storybook/pull/2338)
- Update gh-pages in / from 1.0.0 to 1.1.0 [#2339](https://github.com/storybookjs/storybook/pull/2339)
- Upgraded `@types/react` in `addons/knobs` from "16.0.23" to "16.0.25" [#2334](https://github.com/storybookjs/storybook/pull/2334)
- Upgraded `vue` in `addons/knobs` from "2.5.3" to "2.5.5" [#2334](https://github.com/storybookjs/storybook/pull/2334)
- Upgraded `vue-hot-reload-api` in `app/vue` from "2.2.3" to "2.2.4" [#2334](https://github.com/storybookjs/storybook/pull/2334)
- Upgraded `vue` in `app/vue` from "2.5.3" to "2.5.5" [#2334](https://github.com/storybookjs/storybook/pull/2334)
- Upgraded `vue-template-compiler` in `app/vue` from "2.5.3" to "2.5.5" [#2334](https://github.com/storybookjs/storybook/pull/2334)
- Upgraded `vue` in `examples/vue-kitchen-sink` from "2.5.3" to "2.5.5" [#2334](https://github.com/storybookjs/storybook/pull/2334)
- Upgraded `vue-hot-reload-api` in `examples/vue-kitchen-sink` from "2.2.3" to "2.2.4" [#2334](https://github.com/storybookjs/storybook/pull/2334)
- Upgraded `vue-template-compiler` in `examples/vue-kitchen-sink` from "2.5.3" to "2.5.5" [#2334](https://github.com/storybookjs/storybook/pull/2334)
- Update gatsby in docs from 1.9.112 to 1.9.114 [#2333](https://github.com/storybookjs/storybook/pull/2333)
- Upgraded `@storybook/addon-actions` in `docs` from "3.2.15" to "3.2.16" [#2327](https://github.com/storybookjs/storybook/pull/2327)
- Upgraded `@storybook/addon-links` in `docs` from "3.2.15" to "3.2.16" [#2327](https://github.com/storybookjs/storybook/pull/2327)
- Upgraded `@storybook/addons` in `docs` from "3.2.15" to "3.2.16" [#2327](https://github.com/storybookjs/storybook/pull/2327)
- Upgraded `@storybook/react` in `docs` from "3.2.15" to "3.2.16" [#2327](https://github.com/storybookjs/storybook/pull/2327)
- Update @types/node in addons/knobs from 8.0.52 to 8.0.53 [#2326](https://github.com/storybookjs/storybook/pull/2326)

</details>

## 3.2.16

2017-November-15

#### Features

- Add addon-a11y to monorepo [#2292](https://github.com/storybookjs/storybook/pull/2292)

#### Bug Fixes

- Addon actions: replace eval with function name assignment [#2321](https://github.com/storybookjs/storybook/pull/2321)
- FIX propwarning on basebutton && ADD style prop on basebutton [#2305](https://github.com/storybookjs/storybook/pull/2305)
- React-native: fix drawer width [#2300](https://github.com/storybookjs/storybook/pull/2300)

#### Maintenance

- Add Previews of deployed examples via Netlify [#2304](https://github.com/storybookjs/storybook/pull/2304)

#### Dependency Upgrades

<details>
<summary>
30 upgrades
</summary>

- Update 5 dependencies from npm [#2312](https://github.com/storybookjs/storybook/pull/2312)
- Upgraded gatsby-link in `docs` from `1.6.27` to `1.6.28` [#2311](https://github.com/storybookjs/storybook/pull/2311)
- Upgraded gatsby-plugin-sharp in `docs` from `1.6.20` to `1.6.21` [#2311](https://github.com/storybookjs/storybook/pull/2311)
- Upgraded gatsby-remark-images in `docs` from `1.5.31` to `1.5.32` [#2311](https://github.com/storybookjs/storybook/pull/2311)
- Upgraded gatsby in `docs` from `1.9.108` to `1.9.112` [#2308](https://github.com/storybookjs/storybook/pull/2308)
- Upgraded gatsby-link in `docs` from `1.6.26` to `1.6.27` [#2308](https://github.com/storybookjs/storybook/pull/2308)
- Upgraded gatsby-remark-copy-linked-files in `docs` from `1.5.20` to `1.5.21` [#2308](https://github.com/storybookjs/storybook/pull/2308)
- Upgraded gatsby-transformer-remark in `docs` from `1.7.20` to `1.7.21` [#2308](https://github.com/storybookjs/storybook/pull/2308)
- Upgraded react-textarea-autosize in `addons/events` from `5.2.0` to `5.2.1` [#2309](https://github.com/storybookjs/storybook/pull/2309)
- Upgraded react-datetime in `addons/knobs` from `2.10.3` to `2.11.0` [#2309](https://github.com/storybookjs/storybook/pull/2309)
- Upgraded react-textarea-autosize in `addons/knobs` from `5.2.0` to `5.2.1` [#2309](https://github.com/storybookjs/storybook/pull/2309)
- Upgraded react-textarea-autosize in `addons/comments` from `5.2.0` to `5.2.1` [#2309](https://github.com/storybookjs/storybook/pull/2309)
- Upgraded moment in `addons/knobs` from `2.19.1` to `2.19.2` [#2293](https://github.com/storybookjs/storybook/pull/2293)
- Upgraded moment in `addons/comments` from `2.19.1` to `2.19.2` [#2293](https://github.com/storybookjs/storybook/pull/2293)
- Upgraded gatsby in `docs` from `1.9.100` to `1.9.108` [#2294](https://github.com/storybookjs/storybook/pull/2294)
- Upgraded gatsby-link in `docs` from `1.6.24` to `1.6.26` [#2294](https://github.com/storybookjs/storybook/pull/2294)
- Upgraded gatsby-plugin-sharp in `docs` from `1.6.19` to `1.6.20` [#2294](https://github.com/storybookjs/storybook/pull/2294)
- Upgraded gatsby-remark-autolink-headers in `docs` from `1.4.7` to `1.4.8` [#2294](https://github.com/storybookjs/storybook/pull/2294)
- Upgraded gatsby-remark-copy-linked-files in `docs` from `1.5.16` to `1.5.20` [#2294](https://github.com/storybookjs/storybook/pull/2294)
- Upgraded gatsby-remark-images in `docs` from `1.5.30` to `1.5.31` [#2294](https://github.com/storybookjs/storybook/pull/2294)
- Upgraded gatsby-source-filesystem in `docs` from `1.5.7` to `1.5.8` [#2294](https://github.com/storybookjs/storybook/pull/2294)
- Upgraded gatsby-transformer-remark in `docs` from `1.7.19` to `1.7.20` [#2294](https://github.com/storybookjs/storybook/pull/2294)
- Update lint-staged to 5.0.0 [#2291](https://github.com/storybookjs/storybook/pull/2291)
- Upgraded eslint in `/` from `4.10.0` to `4.11.0` [#2290](https://github.com/storybookjs/storybook/pull/2290)
- Upgraded puppeteer in `/` from `0.12.0` to `0.13.0` [#2290](https://github.com/storybookjs/storybook/pull/2290)
- Update 6 dependencies from npm [#2286](https://github.com/storybookjs/storybook/pull/2286)
- Update React to 16.1.0 [#2285](https://github.com/storybookjs/storybook/pull/2285)
- Update 4 dependencies from npm [#2284](https://github.com/storybookjs/storybook/pull/2284)
- use @storybook published deprecated dependencies [#2314](https://github.com/storybookjs/storybook/pull/2314)
- Update inquirer to 4.0.0 [#2298](https://github.com/storybookjs/storybook/pull/2298)

</details>

## 3.2.15

2017-November-10

#### Features

- Optimizing for iphone x [#2260](https://github.com/storybookjs/storybook/pull/2260)
- Fix accessibility warnings [#2270](https://github.com/storybookjs/storybook/pull/2270)

#### Bug Fixes

- Fix propTypes in addon-background [#2279](https://github.com/storybookjs/storybook/pull/2279)
- Addon-info: allow duplicate displayNames [#2269](https://github.com/storybookjs/storybook/pull/2269)
- Fix browser navigation [#2261](https://github.com/storybookjs/storybook/pull/2261)

#### Maintenance

- Fixes to build scripts for Windows. [#2051](https://github.com/storybookjs/storybook/pull/2051)
- Update dependencies.yml to include batch updates for docs dependencies [#2252](https://github.com/storybookjs/storybook/pull/2252)

#### Dependency Upgrades

<details>
<summary>
11 PRs
</summary>

- Update 4 dependencies from npm [#2267](https://github.com/storybookjs/storybook/pull/2267)
- Update 8 dependencies from npm [#2262](https://github.com/storybookjs/storybook/pull/2262)
- Update 3 dependencies from npm [#2257](https://github.com/storybookjs/storybook/pull/2257)
- Update babel-eslint in / from 8.0.1 to 8.0.2 [#2253](https://github.com/storybookjs/storybook/pull/2253)
- 3 packages updated by dependencies.io [#2251](https://github.com/storybookjs/storybook/pull/2251)
- Update devDependencies [#2232](https://github.com/storybookjs/storybook/pull/2232)
- Update react-textarea-autosize to 5.1.0 [#2233](https://github.com/storybookjs/storybook/pull/2233)
- Update insert-css to 2.0.0 [#2234](https://github.com/storybookjs/storybook/pull/2234)
- Update file-loader to 1.1.5 [#2236](https://github.com/storybookjs/storybook/pull/2236)
- Update read-pkg-up to 3.0.0 [#2237](https://github.com/storybookjs/storybook/pull/2237)
- Update react-modal to 3.1.0 [#2238](https://github.com/storybookjs/storybook/pull/2238)

</details>

## 3.2.14

2017-November-01

#### Features

- React-native: Add platform option for haul bundler [#2129](https://github.com/storybookjs/storybook/pull/2129)

#### Bug Fixes

- Fixed addon-info not importing docgen descriptions [#2133](https://github.com/storybookjs/storybook/pull/2133)
- Handle full screen scrolling on iOS [#2040](https://github.com/storybookjs/storybook/pull/2040)
- Fixed infinite render loop [#2100](https://github.com/storybookjs/storybook/pull/2100)
- Fix hmr in react-native template [#2194](https://github.com/storybookjs/storybook/pull/2194)
- Fix prop type in react-native [#2185](https://github.com/storybookjs/storybook/pull/2185)
- Avoid logging an object on compilation errors [#2199](https://github.com/storybookjs/storybook/pull/2199)

#### Documentation

- CRA Example Cleanup - Info [#2143](https://github.com/storybookjs/storybook/pull/2143)

#### Maintenance

- IMPROVE integration tests so they all output a diff image when multiple fail [#2197](https://github.com/storybookjs/storybook/pull/2197)
- ADD integration artefacts store step to circle.yml [#2182](https://github.com/storybookjs/storybook/pull/2182)
- ADD integration test [#2119](https://github.com/storybookjs/storybook/pull/2119)
- Updating to new favicon [#2113](https://github.com/storybookjs/storybook/pull/2113)
- Bot for closing old issues [#2186](https://github.com/storybookjs/storybook/pull/2186)

#### Dependency Upgrades

<details>
<summary>
12 PRs
</summary>

- 7 packages updated by dependencies.io [#2200](https://github.com/storybookjs/storybook/pull/2200)
- Update jest-image-snapshot to 2.1.0 [#2184](https://github.com/storybookjs/storybook/pull/2184)
- 2 packages updated by dependencies.io [#2175](https://github.com/storybookjs/storybook/pull/2175)
- 3 packages updated by dependencies.io [#2137](https://github.com/storybookjs/storybook/pull/2137)
- 2 packages updated by dependencies.io [#2131](https://github.com/storybookjs/storybook/pull/2131)
- 4 packages updated by dependencies.io [#2124](https://github.com/storybookjs/storybook/pull/2124)
- 2 packages updated by dependencies.io [#2116](https://github.com/storybookjs/storybook/pull/2116)
- 5 packages updated by dependencies.io [#2111](https://github.com/storybookjs/storybook/pull/2111)
- 4 packages updated by dependencies.io [#2109](https://github.com/storybookjs/storybook/pull/2109)
- Add index.js file for RN 0.49 [#2176](https://github.com/storybookjs/storybook/pull/2176)
- Enable issue creation for dependencies.io [#2141](https://github.com/storybookjs/storybook/pull/2141)
- Major updates in devDependencies [#2178](https://github.com/storybookjs/storybook/pull/2178)

</details>

## 3.2.13

2017-October-20

#### Features

- Knobs addon: new knob type `button` [#2004](https://github.com/storybookjs/storybook/pull/2004)
- Vue: Support JSX for Vue Components [#1993](https://github.com/storybookjs/storybook/pull/1993)
- Vue CLI: support Nuxt.js projects [#2056](https://github.com/storybookjs/storybook/pull/2056)

#### Bug Fixes

- UI: ix sidebar header wrapping [#1962](https://github.com/storybookjs/storybook/pull/1962)
- Vue: Make Vue a peer dependency [#2041](https://github.com/storybookjs/storybook/pull/2041)

#### Documentation

- Update empty addons channel bug description [#1977](https://github.com/storybookjs/storybook/pull/1977)
- Fix README.md example for addons/info [#1960](https://github.com/storybookjs/storybook/pull/1960)

#### Maintenance

- Dirty-check repo state on CI to ensure lockfiles being up-to-date [#1980](https://github.com/storybookjs/storybook/pull/1980)
- Enable batch mode for dependencies.io [#2093](https://github.com/storybookjs/storybook/pull/2093)
- Fixed lifecycle twice executing (closes #1742) [#1983](https://github.com/storybookjs/storybook/pull/1983)
- Disable npm publish on all non-master branches [#1963](https://github.com/storybookjs/storybook/pull/1963)
- Fix lerna.json to ignore vue-kitchen-sink correctly [#1944](https://github.com/storybookjs/storybook/pull/1944)

#### Dependency Upgrades

<details>
<summary>
66 PRs
</summary>

- 2 packages updated by dependencies.io [#2097](https://github.com/storybookjs/storybook/pull/2097)
- 2 packages updated by dependencies.io [#2094](https://github.com/storybookjs/storybook/pull/2094)
- Update deps [#2090](https://github.com/storybookjs/storybook/pull/2090)
- Update enzyme-adapter-react-16 from 1.0.1 to 1.0.2 in / [#2068](https://github.com/storybookjs/storybook/pull/2068)
- Update deps [#2077](https://github.com/storybookjs/storybook/pull/2077)
- Update webpack-hot-middleware from 2.19.1 to 2.20.0 in app/react [#2060](https://github.com/storybookjs/storybook/pull/2060)
- Update webpack-hot-middleware from 2.19.1 to 2.20.0 in app/react-native [#2059](https://github.com/storybookjs/storybook/pull/2059)
- Update @types/react from 16.0.10 to 16.0.11 in addons/knobs [#2058](https://github.com/storybookjs/storybook/pull/2058)
- Update vue versions [#2032](https://github.com/storybookjs/storybook/pull/2032)
- Update eslint from 4.8.0 to 4.9.0 in / [#2054](https://github.com/storybookjs/storybook/pull/2054)
- Update webpack-dev-server from 2.9.1 to 2.9.2 in examples/vue-kitchen-sink [#2055](https://github.com/storybookjs/storybook/pull/2055)
- Update postcss-loader from 2.0.7 to 2.0.8 in app/react [#2045](https://github.com/storybookjs/storybook/pull/2045)
- Update codecov from 2.3.0 to 2.3.1 in / [#2042](https://github.com/storybookjs/storybook/pull/2042)
- Update webpack from 3.6.0 to 3.7.1 in app/react-native [#2027](https://github.com/storybookjs/storybook/pull/2027)
- Update moment from 2.19.0 to 2.19.1 in addons/knobs [#2026](https://github.com/storybookjs/storybook/pull/2026)
- Update express from 4.16.1 to 4.16.2 in app/vue [#2018](https://github.com/storybookjs/storybook/pull/2018)
- Update postcss-loader from 2.0.6 to 2.0.7 in app/react [#2017](https://github.com/storybookjs/storybook/pull/2017)
- Update express from 4.16.1 to 4.16.2 in app/react [#2016](https://github.com/storybookjs/storybook/pull/2016)
- Update postcss-loader from 2.0.6 to 2.0.7 in app/react-native [#2015](https://github.com/storybookjs/storybook/pull/2015)
- Update express from 4.16.1 to 4.16.2 in app/react-native [#2014](https://github.com/storybookjs/storybook/pull/2014)
- Update moment from 2.18.1 to 2.19.0 in addons/knobs [#2013](https://github.com/storybookjs/storybook/pull/2013)
- Update autoprefixer from 7.1.4 to 7.1.5 in app/vue [#2003](https://github.com/storybookjs/storybook/pull/2003)
- Update update-notifier from 2.2.0 to 2.3.0 in lib/cli [#1999](https://github.com/storybookjs/storybook/pull/1999)
- Update autoprefixer from 7.1.4 to 7.1.5 in app/react [#2002](https://github.com/storybookjs/storybook/pull/2002)
- Update autoprefixer from 7.1.4 to 7.1.5 in app/react-native [#2000](https://github.com/storybookjs/storybook/pull/2000)
- Update @types/react from 16.0.9 to 16.0.10 in addons/knobs [#1998](https://github.com/storybookjs/storybook/pull/1998)
- Update jest-enzyme from 4.0.0 to 4.0.1 in / [#1997](https://github.com/storybookjs/storybook/pull/1997)
- Update storybook-router description in the addon gallery. [#1991](https://github.com/storybookjs/storybook/pull/1991)
- Update lerna from 2.3.1 to 2.4.0 in / [#1985](https://github.com/storybookjs/storybook/pull/1985)
- Update react-modal from 2.3.3 to 2.4.1 in app/vue [#1989](https://github.com/storybookjs/storybook/pull/1989)
- Update react-modal from 2.3.3 to 2.4.1 in app/react [#1988](https://github.com/storybookjs/storybook/pull/1988)
- Update react-modal from 2.3.3 to 2.4.1 in lib/ui [#1987](https://github.com/storybookjs/storybook/pull/1987)
- Update react-icons from 2.2.5 to 2.2.7 in lib/ui [#1986](https://github.com/storybookjs/storybook/pull/1986)
- Remove markdown autofixing on precommit hook [#1964](https://github.com/storybookjs/storybook/pull/1964)
- Update vue-hot-reload-api from 2.1.0 to 2.1.1 in app/vue [#1976](https://github.com/storybookjs/storybook/pull/1976)
- Update url-loader from 0.5.9 to 0.6.2 in app/vue [#1975](https://github.com/storybookjs/storybook/pull/1975)
- Update react-modal from 2.3.2 to 2.3.3 in app/vue [#1974](https://github.com/storybookjs/storybook/pull/1974)
- Update url-loader from 0.5.9 to 0.6.2 in app/react [#1973](https://github.com/storybookjs/storybook/pull/1973)
- Update react-modal from 2.3.2 to 2.3.3 in app/react [#1972](https://github.com/storybookjs/storybook/pull/1972)
- Update url-loader from 0.5.9 to 0.6.2 in app/react-native [#1970](https://github.com/storybookjs/storybook/pull/1970)
- Update react-modal from 2.3.2 to 2.3.3 in lib/ui [#1969](https://github.com/storybookjs/storybook/pull/1969)
- Update @types/react from 16.0.8 to 16.0.9 in addons/knobs [#1968](https://github.com/storybookjs/storybook/pull/1968)
- Update graphql from 0.11.6 to 0.11.7 in addons/graphql [#1967](https://github.com/storybookjs/storybook/pull/1967)
- Update @storybook/addon-links from 3.2.10 to 3.2.12 [#1949](https://github.com/storybookjs/storybook/pull/1949)
- Update style-loader from 0.18.2 to 0.19.0 in addons/knobs [#1958](https://github.com/storybookjs/storybook/pull/1958)
- Update @types/react from 16.0.7 to 16.0.8 in addons/knobs [#1957](https://github.com/storybookjs/storybook/pull/1957)
- Update prettier from 1.7.3 to 1.7.4 in / [#1955](https://github.com/storybookjs/storybook/pull/1955)
- Update react-motion from 0.5.1 to 0.5.2 [#1953](https://github.com/storybookjs/storybook/pull/1953)
- Update lerna from 2.2.0 to 2.3.1 in / [#1954](https://github.com/storybookjs/storybook/pull/1954)
- Update @storybook/addons from 3.2.10 to 3.2.12 [#1950](https://github.com/storybookjs/storybook/pull/1950)
- Update enzyme from 3.0.0 to 3.1.0 in / [#1948](https://github.com/storybookjs/storybook/pull/1948)
- Update enzyme-adapter-react-16 from 1.0.0 to 1.0.1 in / [#1951](https://github.com/storybookjs/storybook/pull/1951)
- Update @storybook/addon-actions from 3.2.11 to 3.2.12 [#1947](https://github.com/storybookjs/storybook/pull/1947)

</details>

## 3.2.12

2017-October-02

#### Bug Fixes

- addon-info: wrap prop values in braces [#1915](https://github.com/storybookjs/storybook/pull/1915)
- Add polyfills to fix addon-actions in IE11 [#1917](https://github.com/storybookjs/storybook/pull/1917)
- Gracefully handle fatal webpack errors. [#1918](https://github.com/storybookjs/storybook/pull/1918)
- Fix polyfills loading order [#1905](https://github.com/storybookjs/storybook/pull/1905)

#### Documentation

- Improve documentation for react-native : clarify where left pane is [#1901](https://github.com/storybookjs/storybook/pull/1901)

#### Maintenance

- Use yarn workspaces on master [#1916](https://github.com/storybookjs/storybook/pull/1916)
- Run `eslint --fix` on master [#1909](https://github.com/storybookjs/storybook/pull/1909)
- Remove open collective notice from storybook install [#1940](https://github.com/storybookjs/storybook/pull/1940)
- Run bootstrap before linting on CI [#1934](https://github.com/storybookjs/storybook/pull/1934)

#### Dependency Upgrades

<details>
<summary>
14 PRs
</summary>

- Update raf from 3.3.2 to 3.4.0 in / [#1939](https://github.com/storybookjs/storybook/pull/1939)
- Update graphql from 0.7.2 to 0.11.6 in addons/graphql [#1930](https://github.com/storybookjs/storybook/pull/1930)
- Update react-typography from 0.15.10 to 0.16.5 [#1927](https://github.com/storybookjs/storybook/pull/1927)
- Update react-render-html from 0.1.6 to 0.5.2 in addons/comments [#1933](https://github.com/storybookjs/storybook/pull/1933)
- Update react-datetime from 2.10.2 to 2.10.3 in addons/knobs [#1931](https://github.com/storybookjs/storybook/pull/1931)
- Update typography from 0.15.12 to 0.16.6 [#1929](https://github.com/storybookjs/storybook/pull/1929)
- Update graphiql from 0.7.8 to 0.11.5 in addons/graphql [#1928](https://github.com/storybookjs/storybook/pull/1928)
- Update prettier from 1.7.2 to 1.7.3 in / [#1926](https://github.com/storybookjs/storybook/pull/1926)
- Update react-stack-grid from 0.2.2 to 0.5.0 [#1925](https://github.com/storybookjs/storybook/pull/1925)
- Update react-motion from 0.1.0 to 0.5.1 [#1924](https://github.com/storybookjs/storybook/pull/1924)
- Update eslint from 4.7.2 to 4.8.0 in / [#1923](https://github.com/storybookjs/storybook/pull/1923)
- Update chroma-js from 0.7.2 to 0.7.8 [#1922](https://github.com/storybookjs/storybook/pull/1922)
- Use dependencies.io for dependencies management [#1920](https://github.com/storybookjs/storybook/pull/1920)
- UPGRADE react & friends && UPGRADE other dependencies [#1908](https://github.com/storybookjs/storybook/pull/1908)

</details>

## 3.2.11

2017-September-27

#### Features

- Add two new RN packager configuration options [#1865](https://github.com/storybookjs/storybook/pull/1865)

#### Bug Fixes

- Addon-info - Fix immutable props issues with React 16 [#1894](https://github.com/storybookjs/storybook/pull/1894)
- Update react-inspector to fix #1831 [#1888](https://github.com/storybookjs/storybook/pull/1888)

#### Documentation

- Updated release process documentation [#1882](https://github.com/storybookjs/storybook/pull/1882)

## 3.2.10

2017-September-22

#### Features

- Added codemod for deprecated addon-links and addon-actions from app [#1368](https://github.com/storybookjs/storybook/pull/1368)
- React native: Added option for custom packager port [#1837](https://github.com/storybookjs/storybook/pull/1837)
- CLI: add support for Vue projects using Nuxt [#1794](https://github.com/storybookjs/storybook/pull/1794)

#### Bug Fixes

- Avoid error "storyshots is intended only to be used with storybook" [#1441](https://github.com/storybookjs/storybook/pull/1441)
- Log correct url when using --https [#1871](https://github.com/storybookjs/storybook/pull/1871)
- Fix broken links in the deprecation warning for RN and Vue apps [#1827](https://github.com/storybookjs/storybook/pull/1827)
- Height aligned 2 buttons in manager's header [#1769](https://github.com/storybookjs/storybook/pull/1769)
- Add missing regenerator and runtime babel transform pkgs to package.json [#1848](https://github.com/storybookjs/storybook/pull/1848)

#### Documentation

- Update README: mention that addon-links needs to be registered manually [#1835](https://github.com/storybookjs/storybook/pull/1835)
- Improve linkTo documentation [#1793](https://github.com/storybookjs/storybook/pull/1793)
- Minor grammar fixes and clarification to Vue documentation [#1756](https://github.com/storybookjs/storybook/pull/1756)
- Add missing NPM script section to Vue guide [#1824](https://github.com/storybookjs/storybook/pull/1824)
- Add storybook-chrome-screenshot to addon gallery [#1761](https://github.com/storybookjs/storybook/pull/1761)

#### Dependency Upgrades

- Update babel-eslint to the latest version 🚀 [#1836](https://github.com/storybookjs/storybook/pull/1836)
- UPGRADE root dependencies and SYNC with packages [#1802](https://github.com/storybookjs/storybook/pull/1802)
- Update jest to the latest version 🚀 [#1799](https://github.com/storybookjs/storybook/pull/1799)
- Update eslint-plugin-jest to the latest version 🚀 [#1795](https://github.com/storybookjs/storybook/pull/1795)
- Update lerna to the latest version 🚀 [#1768](https://github.com/storybookjs/storybook/pull/1768)

#### Maintenance

- Smoke test master [#1801](https://github.com/storybookjs/storybook/pull/1801)
- Fixed Jest warnings [#1744](https://github.com/storybookjs/storybook/pull/1744)

## 3.2.9

2017-August-26

#### Bug Fixes

- Fix getstorybook CLI for React Native projects [#1741](https://github.com/storybookjs/storybook/pull/1741)

#### Documentation

- Improve `addon-info` README options documentation [#1732](https://github.com/storybookjs/storybook/pull/1732)

#### Maintenance

- ADD a CLI for bootstrapping [#1216](https://github.com/storybookjs/storybook/pull/1216)

#### Dependency Upgrades

- Update lerna to the latest version 🚀 [#1727](https://github.com/storybookjs/storybook/pull/1727)

## 3.2.8

2017-August-23

#### Bug Fixes

- Fix storyshots with new babel config [#1721](https://github.com/storybookjs/storybook/pull/1721)
- Fix CLI generators export [#1722](https://github.com/storybookjs/storybook/pull/1722)

#### Documentation

- Add caveat about knobs date defaultValue [#1719](https://github.com/storybookjs/storybook/pull/1719)

## 3.2.7

2017-August-23

#### Bug Fixes

- Fix storyshots by moving cacheDirectory to webpack config [#1713](https://github.com/storybookjs/storybook/pull/1713)
- Revert "Improved error checking in global addDecorator" [#1716](https://github.com/storybookjs/storybook/pull/1716)
- Stricter linting rules for imports [#1676](https://github.com/storybookjs/storybook/pull/1676)
- Addon Info: Remove broken prop type sort (keep defined order) [#1711](https://github.com/storybookjs/storybook/pull/1711)

#### Maintenance

- Enable eslint for vue-related stuff [#1715](https://github.com/storybookjs/storybook/pull/1715)
- CLI: ensure explicit dependency on `prop-types` for RN [#1714](https://github.com/storybookjs/storybook/pull/1714)

## 3.2.6

2017-August-22

#### Features

- Improve search and highlighting [#1693](https://github.com/storybookjs/storybook/pull/1693)
- Add centered decorator for vue [#1595](https://github.com/storybookjs/storybook/pull/1595)
- Add react-docgen propTypes to info addon [#1562](https://github.com/storybookjs/storybook/pull/1562)

#### Bug Fixes

- Fix stories panel resizing bug [#1689](https://github.com/storybookjs/storybook/pull/1689)
- Check for React presence when detecting `WEBPACK_REACT` type [#1646](https://github.com/storybookjs/storybook/pull/1646)
- Fix Create React App detection [#1645](https://github.com/storybookjs/storybook/pull/1645)
- Add dependencies on plugins used by getstorybook CLI [#1652](https://github.com/storybookjs/storybook/pull/1652)
- Fix preview window loading non js,css files [#1554](https://github.com/storybookjs/storybook/pull/1554)

#### Documentation

- Improve the warning given when using channel before it's defined [#1515](https://github.com/storybookjs/storybook/pull/1515)
- Remove imports from README that are not necessary with latest API [#1700](https://github.com/storybookjs/storybook/pull/1700)
- Add reminders to PR template [#1683](https://github.com/storybookjs/storybook/pull/1683)
- Docgen Flow Type Example [#1684](https://github.com/storybookjs/storybook/pull/1684)

#### Maintenance

- Make lint-staged work properly [#1675](https://github.com/storybookjs/storybook/pull/1675)
- Move baseFonts and RoutedLink to `@storybook/components` [#1659](https://github.com/storybookjs/storybook/pull/1659)

#### Dependency Upgrades

- Switch to babel preset env + async/await/generator support [#1668](https://github.com/storybookjs/storybook/pull/1668)
- Upgrade react-native-compat to avoid PropTypes warnings [#1673](https://github.com/storybookjs/storybook/pull/1673)
- Change React.PropTypes to prop-types [#1674](https://github.com/storybookjs/storybook/pull/1674) [#1710](https://github.com/storybookjs/storybook/pull/1710)

## 3.2.5

2017-August-16

#### Features

- Add codemod for deprecated addon-info API [#1582](https://github.com/storybookjs/storybook/pull/1582)

#### Bug Fixes

- Fixed addon-knobs for RN [#1635](https://github.com/storybookjs/storybook/pull/1635)
- Make links navigate in the parent window [#1650](https://github.com/storybookjs/storybook/pull/1650)
- Don’t render leftpanel stories tree if stories are empty [#1664](https://github.com/storybookjs/storybook/pull/1664)
- Remove double styling for inline stories [#1651](https://github.com/storybookjs/storybook/pull/1651)

#### Dependency Upgrades

- Upgrade react-modal to v2.2.4 [#1666](https://github.com/storybookjs/storybook/pull/1666)

## 3.2.4

2017-August-12

#### Features

- Hierarchy expansion on search [#1598](https://github.com/storybookjs/storybook/pull/1598)
- Add sidebarAnimations config prop [#1601](https://github.com/storybookjs/storybook/pull/1601)
- Add hrefs to left menu links [#1523](https://github.com/storybookjs/storybook/pull/1523)
- Enable many components of same type in addon-info prop tables [#1607](https://github.com/storybookjs/storybook/pull/1607)
- Always collapse an expanded kind in tree view without changing selected story [#1590](https://github.com/storybookjs/storybook/pull/1590)
- Option to select an addon panel [#1641](https://github.com/storybookjs/storybook/pull/1641)

#### Documentation

- Document how to use info addon as decorator [#1592](https://github.com/storybookjs/storybook/pull/1592)
- Add Android simulator instructions for React Native [#1591](https://github.com/storybookjs/storybook/pull/1591)

#### Maintenance

- Tree view visual adjustments [#1599](https://github.com/storybookjs/storybook/pull/1599)
- Add z-index to shortcuts popup overlay [#1617](https://github.com/storybookjs/storybook/pull/1617)
- Use ReactModal for search box [#1548](https://github.com/storybookjs/storybook/pull/1548)
- Limit react versions to >=15 [#1613](https://github.com/storybookjs/storybook/pull/1613)

## 3.2.3

2017-August-01

#### Features

- Use the React Native packager's host by default [#1568](https://github.com/storybookjs/storybook/pull/1568)
- Make onDeviceUI default for RN getstorybook [#1571](https://github.com/storybookjs/storybook/pull/1571)

#### Documentation

- Add short description to addon-options readme [#1566](https://github.com/storybookjs/storybook/pull/1566)

## 3.2.2

2017-July-31

#### Bug Fixes

- Fixed build-storybook for vue [#1564](https://github.com/storybookjs/storybook/pull/1564)

## 3.2.1

2017-July-31

#### Bug Fixes

- Check if hierarchySeparator presents in the options object [#1561](https://github.com/storybookjs/storybook/pull/1561)
- React Native &lt;0.43 support [#1555](https://github.com/storybookjs/storybook/pull/1555)

#### Documentation

- Fix typo with Vue README referring to react [#1556](https://github.com/storybookjs/storybook/pull/1556)
- Add state-setting FAQ [#1559](https://github.com/storybookjs/storybook/pull/1559)

## 3.2.0

2017-July-31

Storybook 3.2 is filled with new features to help make your components shine! Headline features:

- Vue support [#1267](https://github.com/storybookjs/storybook/pull/1267)
- Story Hierarchy [#1329](https://github.com/storybookjs/storybook/pull/1329)
- React Native On Device UI [#1413](https://github.com/storybookjs/storybook/pull/1413)

Plus many more features, documentation improvements, and bugfixes below!

#### Features

- Vue support [#1267](https://github.com/storybookjs/storybook/pull/1267)
- Add support for vue in addon-notes [#1278](https://github.com/storybookjs/storybook/pull/1278)
- CLI support for Vue [#1287](https://github.com/storybookjs/storybook/pull/1287)
- Story Hierarchy [#1329](https://github.com/storybookjs/storybook/pull/1329)
- Story Hierarchy UI improvements [#1387](https://github.com/storybookjs/storybook/pull/1387) [#1356](https://github.com/storybookjs/storybook/pull/1356)
- Story Hierarchy - keyboard accessibility [#1427](https://github.com/storybookjs/storybook/pull/1427)
- React Native - On Device UI [#1413](https://github.com/storybookjs/storybook/pull/1413)
- Show first story on RN OnDeviceUI startup [#1510](https://github.com/storybookjs/storybook/pull/1510)
- Added collapsible RN OnDeviceUI navigation [#1544](https://github.com/storybookjs/storybook/pull/1544)
- Add warning when module is missing in storiesOf [#1525](https://github.com/storybookjs/storybook/pull/1525)
- Provide styling hook for Addon Info story body [#1308](https://github.com/storybookjs/storybook/pull/1308)
- Implement filtering on story-level [#1432](https://github.com/storybookjs/storybook/pull/1432)
- Refactoring of `addon-info` [#1452](https://github.com/storybookjs/storybook/pull/1452)
- ADD storybook logo for inside terminal for future CLI or easteregg [#1499](https://github.com/storybookjs/storybook/pull/1499)
- Improved error checking in global addDecorator [#1481](https://github.com/storybookjs/storybook/pull/1481)

#### Bug Fixes

- Fix react native example and bootstrapping [#1514](https://github.com/storybookjs/storybook/pull/1514)
- Fix a 'funny' hmr issue in cra-kitchen-sink [#1508](https://github.com/storybookjs/storybook/pull/1508)
- When timestamps are enabled, it actually checks them before applying changes [#1405](https://github.com/storybookjs/storybook/pull/1405)
- Fix issue when extending webpack config [#1468](https://github.com/storybookjs/storybook/pull/1468)
- Fix addon notes [#1448](https://github.com/storybookjs/storybook/pull/1448)
- Story Hierarchy - initial state bug fix [#1401](https://github.com/storybookjs/storybook/pull/1401)
- Remove blue outline when node is focused [#1497](https://github.com/storybookjs/storybook/pull/1497)

#### Documentation

- Add hierarchySeparator to README [#1445](https://github.com/storybookjs/storybook/pull/1445)
- Document null addons channel in FAQ [#1507](https://github.com/storybookjs/storybook/pull/1507)

#### Maintenance

- Revert knobs API to previous API. [#1527](https://github.com/storybookjs/storybook/pull/1527)
- FIX hoist-internals: remove existing folder/link before linking [#1516](https://github.com/storybookjs/storybook/pull/1516)
- Update global hook for Vue Devtools [#1376](https://github.com/storybookjs/storybook/pull/1376)
- SWITCH to circleci over travisCI && CHANGE lerna bootstrap procedure: [#1486](https://github.com/storybookjs/storybook/pull/1486)
- Update cra-kitchen-sink package versions for 3.2-alpha [#1434](https://github.com/storybookjs/storybook/pull/1434)
- Updating 3.2 alpha release with patches [#1419](https://github.com/storybookjs/storybook/pull/1419)
- Remove typescript typings for @storybook/addon-notes [#1344](https://github.com/storybookjs/storybook/pull/1344)
- Remove typescript typings for @storybook/addon-options [#1343](https://github.com/storybookjs/storybook/pull/1343)
- Remove typescript typings for @storybook/addon-knobs [#1339](https://github.com/storybookjs/storybook/pull/1339)
- Remove typescript typings for @storybook/addon-links [#1342](https://github.com/storybookjs/storybook/pull/1342)

#### Dependency Upgrades

- Updated babel-plugin-react-docgen version [#1526](https://github.com/storybookjs/storybook/pull/1526)
- UPDATE everything (including eslint 4) [#1517](https://github.com/storybookjs/storybook/pull/1517)
- Update remark-preset-lint-recommended to the latest version 🚀 [#1512](https://github.com/storybookjs/storybook/pull/1512)
- Update remark-cli to the latest version 🚀 [#1498](https://github.com/storybookjs/storybook/pull/1498)
- Remove upper bound on react-native peerDependency [#1424](https://github.com/storybookjs/storybook/pull/1424)
- Bump `react-split-pane` version [#1495](https://github.com/storybookjs/storybook/pull/1495)

## 3.1.9

2017-July-16

#### Features

- React fiber support [#1443](https://github.com/storybookjs/storybook/pull/1443)

#### Documentation

- Refine docs about loading stories dynamically for react-native [#1420](https://github.com/storybookjs/storybook/pull/1420)

#### Bug Fixes

- Verify that name is a string in addons/actions [#1415](https://github.com/storybookjs/storybook/pull/1415)
- Knobs: fix label alignment [#1471](https://github.com/storybookjs/storybook/pull/1471)
- Fix display of large components [#1237](https://github.com/storybookjs/storybook/pull/1237)

#### Dependency Upgrades

- Dependency updates [#1439](https://github.com/storybookjs/storybook/pull/1439)
- chore(package): update husky to version 0.14.3 [#1437](https://github.com/storybookjs/storybook/pull/1437)
- Update danger to the latest version 🚀 [#1393](https://github.com/storybookjs/storybook/pull/1393)
- Update lerna to the latest version 🚀 [#1423](https://github.com/storybookjs/storybook/pull/1423)
- Pin gatsby version and upgrade gh-pages [#1462](https://github.com/storybookjs/storybook/pull/1462)

## 3.1.8

2017-July-06

#### Documentation

- Updated addon knob readme. [#1406](https://github.com/storybookjs/storybook/pull/1406)
- Add a FAQ entry for shared config with next [#1390](https://github.com/storybookjs/storybook/pull/1390)
- Documented webpack customization example for typescript [#1386](https://github.com/storybookjs/storybook/pull/1386)

#### Maintenance

- Removed empty array, since webpack 2 doesn't support them anymore. [#1381](https://github.com/storybookjs/storybook/pull/1381)

#### Dependency Upgrades

- Support webpack 3.0.0 [#1410](https://github.com/storybookjs/storybook/pull/1410)
- Update react inspector to fix #1385 [#1408](https://github.com/storybookjs/storybook/pull/1408)

## 3.1.7

2017-June-28

#### Bug Fixes

- Exit storybook build non-zero on stats errors (e.g. errors in the transpilation pipeline) [#1372](https://github.com/storybookjs/storybook/pull/1372)
- Fixed regression: CSS entries were not picked up for storybook pages (e.g. when using extract-text-webpack-plugin) [#1363](https://github.com/storybookjs/storybook/pull/1363)

#### Documentation

- Document Storybook release process [#1348](https://github.com/storybookjs/storybook/pull/1348)

## 3.1.6

2017-June-26

#### Bug Fixes

- Remove the `cacheDirectory` option from babel config [#1350](https://github.com/storybookjs/storybook/pull/1350)
- websockets (ws) removed `socket.upgradeReq`, so use `req` instead [#1337](https://github.com/storybookjs/storybook/pull/1337)
- Ensure we add the correct version of `react-dom` [#1349](https://github.com/storybookjs/storybook/pull/1349)
- Addon Info: Fix invalid prop `node.type` supplied to 'Props' [#1351](https://github.com/storybookjs/storybook/pull/1351)
- Addon Info: Omit empty inline info header [#1306](https://github.com/storybookjs/storybook/pull/1306)
- Addon Actions: Use uuid for action IDs instead of Math.random (fixes #1109) [#1347](https://github.com/storybookjs/storybook/pull/1347)

#### Documentation

- Fix welcome instructions to reflect current `getstorybook` [#1358](https://github.com/storybookjs/storybook/pull/1358)
- Addon Info: Update README with configuration instructions [#1326](https://github.com/storybookjs/storybook/pull/1326)

#### Dependency Upgrades

- Update lint-staged to the latest version 🚀 [#1315](https://github.com/storybookjs/storybook/pull/1315)

## 3.1.5

2017-June-22

#### Features

- Added flow support to getstorybook upgrade [#1289](https://github.com/storybookjs/storybook/pull/1289)
- Added support for the `haul` react-native packager [#1294](https://github.com/storybookjs/storybook/pull/1294)

#### Bug Fixes

- Fixed addon knobs proptypes deserialization [#1290](https://github.com/storybookjs/storybook/pull/1290)

#### Documentation

- Added search to docs [#1256](https://github.com/storybookjs/storybook/pull/1256)
- snapshot testing inverse regex example documentation [#1317](https://github.com/storybookjs/storybook/pull/1317)

#### Maintenance

- Refactored storybook component library [#1266](https://github.com/storybookjs/storybook/pull/1266)
- Created CRA kitchen sink addons example [#1288](https://github.com/storybookjs/storybook/pull/1288)
- Use a pack -> install technique to recreate local packages [#1332](https://github.com/storybookjs/storybook/pull/1332)
- Import demo components from @storybook/react [#1303](https://github.com/storybookjs/storybook/pull/1303)

## 3.1.4

2017-June-15

#### Features

- IMPROVE design of addon-events [#1249](https://github.com/storybookjs/storybook/pull/1249)
- Add a `shallowSnapshot` option for storyshots `test` functions [#1232](https://github.com/storybookjs/storybook/pull/1232)

#### Bug Fixes

- Fix app entry bug in RN gestorybook [#1280](https://github.com/storybookjs/storybook/pull/1280)
- fix(addons/info): Cannot read property 'props' of undefined [#1258](https://github.com/storybookjs/storybook/pull/1258)

#### Documentation

- Add versions plugin to docs [#1269](https://github.com/storybookjs/storybook/pull/1269)

## 3.1.3

2017-June-10

#### Bug Fixes

- Fix `storybook-build` manager-head.html bug [#1248](https://github.com/storybookjs/storybook/pull/1248)

## 3.1.2

Minor features including a new "events" addon, as well as the usual bugfixes, cleanup, etc.

2017-June-09

#### Features

- Add small design update to addon info package [#1213](https://github.com/storybookjs/storybook/pull/1213)
- Add display configuration options to info addon [#1157](https://github.com/storybookjs/storybook/pull/1157)
- Add support for multiple webpack chunks in iframe [#1083](https://github.com/storybookjs/storybook/pull/1083)
- Add events addon [#1130](https://github.com/storybookjs/storybook/pull/1130)
- Allow including files just before manager.bundle.js [#1134](https://github.com/storybookjs/storybook/pull/1134)

#### Bug Fixes

- Fixed knobs addon editing bug [#1233](https://github.com/storybookjs/storybook/pull/1233)
- Fix bug in addons/graphql in reIndentQuery [#1207](https://github.com/storybookjs/storybook/pull/1207)
- Marksy initialized with mtrcConf instead of marksyConf [#1205](https://github.com/storybookjs/storybook/pull/1205)

#### Documentation

- Document stories not showing up on storybook UI until device connects [#1221](https://github.com/storybookjs/storybook/pull/1221)
- Fixed references to storybook.js.org. [#1211](https://github.com/storybookjs/storybook/pull/1211)
- Updated repository URL to address broken npm images [#1197](https://github.com/storybookjs/storybook/pull/1197)

#### Maintenance

- Added a vanilla React Native example app. [#1202](https://github.com/storybookjs/storybook/pull/1202)
- Move typings for @storybook/react to @types package [#1199](https://github.com/storybookjs/storybook/pull/1199)
- Set ESlint rules more strict 🚑 [#911](https://github.com/storybookjs/storybook/pull/911)

#### Dependency Upgrades

- Update babel docgen plugin to generate docs for React.createClass and createReactClass [#1206](https://github.com/storybookjs/storybook/pull/1206)
- Update `marksy` dependency due broken 1.1.0 version [#1204](https://github.com/storybookjs/storybook/pull/1204)

## 3.0.1

Minor bug fixes and documentation updates post 3.0.0 release.

2017-June-06

#### Bug Fixes

- Added error message for `addon-options` [#1194](https://github.com/storybookjs/storybook/pull/1194)
- Fix(react-native) add missing `ws` dependency [#1174](https://github.com/storybookjs/storybook/pull/1174)
- Fix terminal colors by reset console colors explicitly [#1184](https://github.com/storybookjs/storybook/pull/1184)
- Fix addon panel layout styling [#1170](https://github.com/storybookjs/storybook/pull/1170)
- ADD https import & remove tracking code remains [#1176](https://github.com/storybookjs/storybook/pull/1176)
- Fix incorrect babel config file reading [#1156](https://github.com/storybookjs/storybook/pull/1156)
- Fixed withKnobs definition. [#1164](https://github.com/storybookjs/storybook/pull/1164)

#### Documentation

- Fixed typo in react-native browser instructions [#1189](https://github.com/storybookjs/storybook/pull/1189)
- Add instruction for npm install with -D for development dependency [#1168](https://github.com/storybookjs/storybook/pull/1168)
- Fix broken link for `addons` in README [#1167](https://github.com/storybookjs/storybook/pull/1167)
- Refreshed logo in docs [#1149](https://github.com/storybookjs/storybook/pull/1149)
- fix addon broken links in documentation [#1165](https://github.com/storybookjs/storybook/pull/1165)
- start-storybook cli - expand commands descriptions [#1161](https://github.com/storybookjs/storybook/pull/1161)
- Fix typo in codemod readme [#1158](https://github.com/storybookjs/storybook/pull/1158)

#### Dependency Upgrades

- Replaced deprecated `markdown-to-react-components` with `marksy` [#1188](https://github.com/storybookjs/storybook/pull/1188)

## 3.0.0

Storybook 3.0 is our first fully community-driven release! Notable changes:

- Moved from `@kadira` to `@storybooks` org across [github](https://github.com/storybookjs/storybook/), [npm](https://www.npmjs.com/package/@storybook/react), [docs](https://storybook.js.org/)
- Upgraded to Webpack2! [#637](https://github.com/storybookjs/storybook/pull/637)
- Switched to monorepo and overhauled package structure. [#749](https://github.com/storybookjs/storybook/pull/749) [#1031](https://github.com/storybookjs/storybook/pull/1031)
- Added configuration options to storybooks snapshot testing. [#1090](https://github.com/storybookjs/storybook/pull/1090)
- Added `create-react-native-app` support. [#1117](https://github.com/storybookjs/storybook/pull/1117)
- Added HTTPS support. [#735](https://github.com/storybookjs/storybook/pull/735)

2017-May-31

#### Features

- Added help text to the react-native preview panel [#1142](https://github.com/storybookjs/storybook/pull/1142)
- Added create-react-native-app support [#1117](https://github.com/storybookjs/storybook/pull/1117)
- Fixed knobs-addon performance issues [#1039](https://github.com/storybookjs/storybook/pull/1039)
- Added `snapshotWithOptions` to configure storyshots rendering options [#1090](https://github.com/storybookjs/storybook/pull/1090)
- Added custom `test` function for storyshots [#1035](https://github.com/storybookjs/storybook/pull/1035)
- Added typescript definition to addon notes [#989](https://github.com/storybookjs/storybook/pull/989)
- Added HTTPS option for dev server [#735](https://github.com/storybookjs/storybook/pull/735)

#### Bug Fixes

- Use strict equality in action logger [#1144](https://github.com/storybookjs/storybook/pull/1144)
- FIX addon info and addon storyshots incompatibility [#1129](https://github.com/storybookjs/storybook/pull/1129)
- FIX postcss options missing in default webpack config && UPDATE dependencies [#1087](https://github.com/storybookjs/storybook/pull/1087)
- Fix CLI had a package version from storybook hardcoded - now queries npm registry [#1079](https://github.com/storybookjs/storybook/pull/1079)
- Fix semi broken \_\_docgenInfo integration in addon info [#1030](https://github.com/storybookjs/storybook/pull/1030)
- Fix: build-storybook no longer supports relative paths [#1058](https://github.com/storybookjs/storybook/pull/1058)
- Fix for types `number` for addon knobs [#1001](https://github.com/storybookjs/storybook/pull/1001)
- Fix webpack overriding && Add an example with local file dependencies [#965](https://github.com/storybookjs/storybook/pull/965)

#### Documentation

- Add storybook-addon-intl to addon gallery [#1143](https://github.com/storybookjs/storybook/pull/1143)
- 3.0.0 release notes && release notes automation [#1047](https://github.com/storybookjs/storybook/pull/1047)
- 3.0.0 migration assistance : codemod, update installation and usage instructions [#1093](https://github.com/storybookjs/storybook/pull/1093)
- Add ReactSVGPanZoom to examples list [#1139](https://github.com/storybookjs/storybook/pull/1139)
- Show webpack 2 config example in docs: rules not loaders [#1137](https://github.com/storybookjs/storybook/pull/1137)
- Merge docs repo into this repo: add /docs [#1131](https://github.com/storybookjs/storybook/pull/1131)
- Change brand name from “React Storybook” to “Storybook” [#1044](https://github.com/storybookjs/storybook/pull/1044)
- Updated issue triage guidelines [#1024](https://github.com/storybookjs/storybook/pull/1024)

#### Maintenance

- Add typings for links add-on [#1154](https://github.com/storybookjs/storybook/pull/1154)
- Add react-dom to the devDependency list for React Native projects [#1102](https://github.com/storybookjs/storybook/pull/1102)
- Upgrade React Native to webpack 2 config [#1097](https://github.com/storybookjs/storybook/pull/1097)
- Add unit tests for addon storyshots [#971](https://github.com/storybookjs/storybook/pull/971)
- Deprecate builtin addons (links and actions) - no longer included by default [#1038](https://github.com/storybookjs/storybook/pull/1038)
- change NPM organisation from kadira to storybook in code [#996](https://github.com/storybookjs/storybook/pull/996)
- CHANGE folder structure && CHANGE package-names [#1031](https://github.com/storybookjs/storybook/pull/1031)
- Add deprecation warnings when addons are required via main package [#1025](https://github.com/storybookjs/storybook/pull/1025)
- Remove text transform uppercase for knob labels [#991](https://github.com/storybookjs/storybook/pull/991)

#### Dependency Upgrades

<details>
<summary>
11 PRs
</summary>

- Update lerna to the latest version 🚀 [#1101](https://github.com/storybookjs/storybook/pull/1101)
- CHANGE to prop-types package for notes & test-cra [#1082](https://github.com/storybookjs/storybook/pull/1082)
- update dependencies in cra-storybook [#1080](https://github.com/storybookjs/storybook/pull/1080)
- Switch back to non-fork of react-inspector [#1026](https://github.com/storybookjs/storybook/pull/1026)
- Dependency updates: webpack, babel, react [#1008](https://github.com/storybookjs/storybook/pull/1008)
- Update jest to the latest version 🚀 [#998](https://github.com/storybookjs/storybook/pull/998)
- Update lerna to the latest version 🚀 [#969](https://github.com/storybookjs/storybook/pull/969)
- CHANGE to use react-split-view 0.1.63 over the fork [#956](https://github.com/storybookjs/storybook/pull/956)
- Update lerna to the latest version 🚀 [#915](https://github.com/storybookjs/storybook/pull/915)
- Use jest for unittesting - standardize unit testing epic [#904](https://github.com/storybookjs/storybook/pull/904)
- Update dependencies to enable Greenkeeper 🌴 [#768](https://github.com/storybookjs/storybook/pull/768)

</details>

#### Other

<details>
<summary>
33 PRs
</summary>

- Added an upgrade mode to getstorybook [#1146](https://github.com/storybookjs/storybook/pull/1146)
- Update link to Storyshots addon [#1074](https://github.com/storybookjs/storybook/pull/1074)
- Added error message for missing or invalid storyName [#747](https://github.com/storybookjs/storybook/pull/747)
- Opened an Open Collective Account <https://opencollective.com/storybook> [#1065](https://github.com/storybookjs/storybook/pull/1065)
- Add propTablesExclude option [#924](https://github.com/storybookjs/storybook/pull/924)
- addon-info: make the info overlay be fixed [#914](https://github.com/storybookjs/storybook/pull/914)
- Handle null elements in getData [#926](https://github.com/storybookjs/storybook/pull/926)
- add description field from \_\_docgenInfo for prop table for info plugin [#929](https://github.com/storybookjs/storybook/pull/929)
- \#959 add a max-height and center element with alignItems: center [#961](https://github.com/storybookjs/storybook/pull/961)
- Switch to the only prepublish script [#903](https://github.com/storybookjs/storybook/pull/903)
- PR review policy [#923](https://github.com/storybookjs/storybook/pull/923)
- Add typescript definitions for getStorybook() [#753](https://github.com/storybookjs/storybook/pull/753)
- Restore deep link for addon docs [#919](https://github.com/storybookjs/storybook/pull/919)
- Fix default storybook webpack config [#922](https://github.com/storybookjs/storybook/pull/922)
- Render the first story for a kind if no story selected. [#918](https://github.com/storybookjs/storybook/pull/918)
- Update docs for monorepo [#913](https://github.com/storybookjs/storybook/pull/913)
- Monorepo readme and contributing [#907](https://github.com/storybookjs/storybook/pull/907)
- Add story kind regex [#906](https://github.com/storybookjs/storybook/pull/906)
- Add examples [#897](https://github.com/storybookjs/storybook/pull/897)
- Add missing repos [#882](https://github.com/storybookjs/storybook/pull/882)
- Switch to monorepo [#749](https://github.com/storybookjs/storybook/pull/749)
- extend devMiddlewareOptions with config.devServer [#723](https://github.com/storybookjs/storybook/pull/723)
- Added meta IE=edge [#715](https://github.com/storybookjs/storybook/pull/715)
- Replace String.includes with String.indexOf: cross-browsing support [#712](https://github.com/storybookjs/storybook/pull/712)
- Issue Triage instructions [#748](https://github.com/storybookjs/storybook/pull/748)
- Simple pull request template [#741](https://github.com/storybookjs/storybook/pull/741)
- Make return type of StoryDecorator nullable [#680](https://github.com/storybookjs/storybook/pull/680)
- Warn if story with a given name already exists [#670](https://github.com/storybookjs/storybook/pull/670)
- Fix spelling mistake - "element form the story" to "element from the story" [#702](https://github.com/storybookjs/storybook/pull/702)
- Remove broken react-button example [#699](https://github.com/storybookjs/storybook/pull/699)
- Fixed spelling error. [#720](https://github.com/storybookjs/storybook/pull/720)
- Cleaner error handling for storiesOf [#672](https://github.com/storybookjs/storybook/pull/672)
- Update links to point to new organization [#721](https://github.com/storybookjs/storybook/pull/721)

</details>

## v2.35.3

Allow customConfig to override devtool. [PR668](https://github.com/storybookjs/storybook/pull/668)

## v2.35.2

03-January-2017

Fixes issue [#601](https://github.com/storybookjs/storybook/issues/601) where it throws error when introduce a propType with a hyphen. Add a [fix](https://github.com/kadirahq/babel-plugin-react-docgen/pull/23) to [`babel-plugin-react-docgen`](https://github.com/kadirahq/babel-plugin-react-docgen) to fix this issue.

This release comes with the updated `babel-plugin-react-docgen`.

## v2.35.1

- Revert [PR653](https://github.com/storybookjs/storybook/pull/653) where it's causing HMR to not working properly.

## v2.35.0

18-December-2016

- Using file-loader to load all the extensions [PR653](https://github.com/storybookjs/storybook/pull/653)
- Update css-loader dependency [PR648](https://github.com/storybookjs/storybook/pull/648)
- Check if stories are loaded from Jest [PR644](https://github.com/storybookjs/storybook/pull/644)

## v2.34.0

05-December-2016

Open the express router for developers (middleware.js file). [PR435](https://github.com/storybookjs/storybook/pull/435)

## v2.33.1

01-December-2016

Update Typescript definition file for global addDecorator. [PR634](https://github.com/storybookjs/storybook/pull/634)

## v2.33.0

28-November-2016

Completely avoid re-rendering the preview iframe. [PR631](https://github.com/storybookjs/storybook/pull/631)

## v2.32.2

28-November-2016

Update postmsg channel module version [PR627](https://github.com/storybookjs/storybook/pull/627)

## v2.32.1

22-November-2016

Add support for react_perf comes with React 15.4.0. [PR623](https://github.com/storybookjs/storybook/pull/623)

## v2.32.0

Incorrect publish (error when running `npm publish`)

## v2.31.0

20-November-2016

Add the react-storybook version to the build output. [PR621](https://github.com/storybookjs/storybook/pull/621)

## v2.30.1

17-November-2016

Update the postmsg channel module to fix issue [#555](https://github.com/storybookjs/storybook/issues/555) with [PR611](https://github.com/storybookjs/storybook/pull/611)

## v2.30.0

16-November-2016

Update to the new Storybook UI which doesn't use Redux.

## v2.29.7

11-November-2016

Update @kadira/storybook-ui to the latest.

## v2.29.6

10-November-2016

Fix a typo in the story syntax error messages. [PR610](https://github.com/storybookjs/storybook/pull/610)

## v2.29.5

09-November-2016

Check if regex and regex.test is available before calling it. [PR608](https://github.com/storybookjs/storybook/pull/608)

## v2.29.3

08-November-2016

Update webpack-hot-middleware to version 2.13.2 to fix the issue [#543](https://github.com/storybookjs/storybook/issues/543).

## v2.29.3

03-November-2016

Fix a regression caused by v2.29.2.
There was a text called undefined listed always on the top of the preview.

## v2.29.2

03-November-2016

Add various fixes.

- Use webpack chunkhash to enable long-term caching. [PR597](https://github.com/storybookjs/storybook/pull/597)
- Fixed json loader testing for when test is multiple. [PR598](https://github.com/storybookjs/storybook/pull/598)
- Fix usage of custom favicon [PR592](https://github.com/storybookjs/storybook/pull/592)
- Update postcss-loader to v1.1.0 [PR599](https://github.com/storybookjs/storybook/pull/599)
- fix for `module.hot` is not available in a static build [PR600](https://github.com/storybookjs/storybook/pull/600)

## v2.29.1

03-November-2016

Update babel-plugin-react-docgen to v1.4.1 to fix HOC [issue](https://github.com/kadirahq/babel-plugin-react-docgen/issues/19)

## v2.29.0

01-November-2016

Update babel-plugin-react-docgen to 1.4.0.
This will fix some of the compilation issues such as #580.

## v2.28.1

28-October-2016

Remove preview decorator support. [PR583](https://github.com/storybookjs/storybook/pull/583).

## v2.28.0

28-October-2016

Add preview decorator support. [PR582](https://github.com/storybookjs/storybook/pull/582).
This will help us bring storybook designer with some great power.

## v2.27.0

27-October-2016

Add a few usability improvements to Storybook.

- Display storybook version. [PR559](https://github.com/storybookjs/storybook/pull/559)
- Make the storybooks cacheable. [PR578](https://github.com/storybookjs/storybook/pull/578)
- Change the devtool to eval and remove the use of source maps. [PR577](https://github.com/storybookjs/storybook/pull/577)
- Update `babel-preset-react-app` to the latest. [PR576](https://github.com/storybookjs/storybook/pull/576)
- Ship `json-loader` by default. [PR575](https://github.com/storybookjs/storybook/pull/575)

## v2.26.0

24-October-2016

Get some new features from CRA.

- Add jsx as a resolve extension [PR563](https://github.com/storybookjs/storybook/pull/563)
- Allow to use postcss for CSS @imports [PR564](https://github.com/storybookjs/storybook/pull/564)
- Use process.env as a proper object [PR565](https://github.com/storybookjs/storybook/pull/565)

## v2.25.1

23-October-2016

Add a potential fix to [558](https://github.com/storybookjs/storybook/issues/558) by updating babel-plugin-react-docgen to the latest(v1.3.2).

## v2.25.0

21-October-2016

Add react docgen info into React classes with the react-docgen babel plugin. [PR557](https://github.com/storybookjs/storybook/pull/557).
With this:

- We could get docgen info with any React component class using `ClassName.__docgenInfo`.
- From the global collection: `STORYBOOK_REACT_CLASSES`

Additionally, added `yarn.lock`.

## v2.24.1

19-October-2016

Do not show git command output. [PR554](https://github.com/storybookjs/storybook/pull/554)

## v2.24.0

07-October-2016

- Export git repository info to support custom tool integrations [PR536](https://github.com/storybookjs/storybook/pull/536)

## v2.23.0

06-October-2016

- Remove the experimental database addon from react-storybook [PR535](https://github.com/storybookjs/storybook/pull/535)

## v2.22.0

05-October-2016

Add some nice development experiment based on suggestion from Dan Abramov.

- Set a color to the Storybook URL in the console. [PR533](https://github.com/storybookjs/storybook/pull/533)
- Add better error message when there's no React element in the story. [PR534](https://github.com/storybookjs/storybook/pull/534)

## v2.21.0

05-October-2016

- Get the latest features from CRA including NODE_PATH support, public folder support and some other minor changes. [#468](https://github.com/storybookjs/storybook/issues/468)
- Also bumped `@kadira/storybook-channel-postmsg` to `^1.0.3`

## v2.20.1

28-September-2016

- Fix story kind order bug [PR499](https://github.com/storybookjs/storybook/pull/499)
- Prefix config environment variables [PR503](https://github.com/storybookjs/storybook/pull/503)

## v2.20.0

26-September-2016

- Use postMessage channel [PR498](https://github.com/storybookjs/storybook/pull/498)
- Support dynamic panel titles [PR497](https://github.com/storybookjs/storybook/pull/497)

## v2.19.0

26-September-2016

- Support layout options [PR494](https://github.com/storybookjs/storybook/pull/494)
- Update Typescript definitions [PR491](https://github.com/storybookjs/storybook/pull/491) and [PR493](https://github.com/storybookjs/storybook/pull/493)

## v2.18.1

23-September-2016

- Stop uglifyjs from mangling names [PR483](https://github.com/storybookjs/storybook/pull/483)

## v2.18.0

23-September-2016

- Remove `STORYBOOK_` prefix from config env [PR481](https://github.com/storybookjs/storybook/pull/481)

## v2.17.0

22-September-2016

- Add support for StoryShots. [PR479](https://github.com/storybookjs/storybook/pull/479)
- Fix some typos: [PR477](https://github.com/storybookjs/storybook/pull/477) & [PR478](https://github.com/storybookjs/storybook/pull/478)

## v2.16.1

21-September-2016

- Fix the 404 error for `addon-db.json` file [PR472](https://github.com/storybookjs/storybook/pull/472)
- Serve/Bundle the storybook favicon [PR473](https://github.com/storybookjs/storybook/pull/473)

## v2.16.0

21-September-2016

- Move the babel config loading logic into a separate file. [PR469](https://github.com/storybookjs/storybook/pull/469)
- Update airbnb eslint rules to the latest.

## v2.15.1

19-September-2016

Add a fix to webpack custom resolve.alias not working. [PR465](https://github.com/storybookjs/storybook/pull/465)

## v2.15.0

19-September-2016

- Use @kadira/storybook-addons as a resolve.alias. So, we can support addons for NPM2 too. [PR462](https://github.com/storybookjs/storybook/pull/462)

## v2.14.0

14-September-2016

- Watch missing NPM modules and force webpack rebuild. [PR446](https://github.com/storybookjs/storybook/pull/446)
- Fix issue on error message hanging after even it solved. [PR447](https://github.com/storybookjs/storybook/pull/447)
- Allow to reload if HMR goes crazy. [PR448](https://github.com/storybookjs/storybook/pull/448)
- Add support to get custom env variables. [PR450](https://github.com/storybookjs/storybook/pull/450)

## v2.13.1

14-September-2016

- Fix 404 error when db file does not exist [PR449](https://github.com/storybookjs/storybook/pull/449)

## v2.13.0

9-September-2016

- Fix [#443](https://github.com/storybookjs/storybook/issues/443) where the static version of Storybook doesn't like Safari.
- Update postcss-loader to 0.13.0.

## v2.12.1

8-September-2016

- Parse static directory provided by env as a list. [PR436](https://github.com/storybookjs/storybook/pull/436)

## v2.12.0

8-September-2016

- Do not include addon register file on preview. [PR426](https://github.com/storybookjs/storybook/pull/426)
- Update css-loader to version 0.25.0. [PR427](https://github.com/storybookjs/storybook/pull/427)
- Get the head.html values for every page request. [PR432](https://github.com/storybookjs/storybook/pull/432)

## v2.11.0

4-September-2016

- Remove babel-polyfill since we don't use it.
- Update versions with the help from greenkeeper. [PR421](https://github.com/storybookjs/storybook/pull/421)

## v2.10.0

3-September-2016

- Adding airbnb-js-shims again. [PR419](https://github.com/storybookjs/storybook/pull/419)

## v2.9.1

2-September-2016.

- Use the config directory to store the addon database file [PR418](https://github.com/storybookjs/storybook/pull/418).

## v2.9.0

2-September-2016.

- Copy the addon-db.json file when building static storybooks [PR417](https://github.com/storybookjs/storybook/pull/417).

## v2.8.0

2-September-2016.

- Update @kadira/storybook to get the clean query params feature. See [storybook-ui-PR37](https://github.com/kadirahq/storybook-ui/pull/37)

## v2.7.0

1-September-2016

- Add addon database feature [PR415](https://github.com/storybookjs/storybook/pull/415).

## v2.6.1

31-August-2016

- Bring back HMR dev logs. [PR412](https://github.com/storybookjs/storybook/pull/412).

## v2.6.0

30-August-2016

- Allow start/build params from env variables. [PR413](https://github.com/storybookjs/storybook/pull/413)

## v2.5.2

29-August-2016

- Remove the use of babel-runtime/core-js modules. [PR410](https://github.com/storybookjs/storybook/pull/410)

## v2.5.1

24-August-2016

- Update @kadira/storybook-ui to v3.3.2

## v2.5.0

24-August-2016

- We are no longer shipping extra polyfills anymore. [PR402](https://github.com/storybookjs/storybook/pull/402)

## v2.4.2

24-August-2016

- Allow file-loader URLs to work on subpaths. [PR401](https://github.com/storybookjs/storybook/pull/401)

## v2.4.1

24-August-2016

- Bump @kadira/storybook ui to v3.3.1 to fix some UI related issues.

## v2.4.0

23-August-2016

- Simplify the option to stop tracking. [PR399](https://github.com/storybookjs/storybook/pull/399)
- Use JSON5 instead of CJSON to parse .babelrc. [PR398](https://github.com/storybookjs/storybook/pull/398)
- Add webpack2 support by changing the use of OccurenceOrderPlugin. [PR397](https://github.com/storybookjs/storybook/pull/397)
- Use @kadira/storybook-ui 2.3.0, which has new APIs to set URL for addons.

## v2.3.0

16-August-2016

- Implement anonymous usage tracking. [PR384](https://github.com/storybookjs/storybook/pull/384)

## v2.2.3

15-August-2016

- Add a hash to media file's filename. Otherwise, it'll cause issues when there are multiple images with the same filename but in different directories. [PR380](https://github.com/storybookjs/storybook/pull/380)

## v2.2.2

10-August-2016

- Remove unused extract-text-webpack-plugin. This will add webpack2 support. [PR369](https://github.com/storybookjs/storybook/pull/369).

## v2.2.1

09-August-2016

- Use @kadira/storybook-channel modules. [#PR359](https://github.com/storybookjs/storybook/pull/359).
- Update @kadira/storybook-ui to the latest.

## v2.2.0

05-August-2016

This release bring some webpack config related optimizations and the NPM2 support. Here are the notable changes:

- Use es6-shim directly into webpack config. [PR355](https://github.com/storybookjs/storybook/pull/355)
- Use the default babel-config based on CRA's config. [PR354](https://github.com/storybookjs/storybook/pull/354)
- Add NPM2 support. [PR356](https://github.com/storybookjs/storybook/pull/356)
- Add autofixer defaults. [PR357](https://github.com/storybookjs/storybook/pull/357)

## v2.1.1

03-August-2016

Remove default webpack config for all config types. [PR348](https://github.com/storybookjs/storybook/pull/348)

Now we only use the Create React App based config if there's no custom webpack config.
This will fix issues like [#347](https://github.com/storybookjs/storybook/issues/347).

## v2.1.0

02-August-2016

Add support for the addon API. See [PR346](https://github.com/storybookjs/storybook/pull/346).

Here after we are using most of the features including actions,links as plugins.
So, this introduced a huge area to add customizations to Storybook.

Unfortunately, as of this version, there are no docs for this feature. But, you can have a look at these addons:

- actions addon (powers the action logger): [addon-actions](https://github.com/kadirahq/storybook-addon-actions)
- links addon (powers the linkTo feature): [addon-links](https://github.com/kadirahq/storybook-addon-links)

Have a look at [here](https://github.com/storybookjs/storybook/blob/master/src/server/config.js#L88) to how to configure addons.

## v2.0.0

01-August-2016

This is the starting of the next major version of Storybook. This version is almost compatible with `v1.x.x` but defaults have been changes as discussed below. That's why we are starting out a new version.

- Update defaults to match create-react-app. [PR342](https://github.com/storybookjs/storybook/pull/342). Here are the notable changes:
  - Add postcss based CSS loader.
  - Add file-loader for images and common types.
  - Add url-loader for shorter media files.
  - Do not pre-build manager(storybook UI) bundle.
  - Continue support for babel's stage-0 preset and add es2016 preset.
- Update @kadira/storybook-ui to v2.6.1 to remove some React warnings.

## v1.41.0

- Fix nodejs require errors [#337](https://github.com/storybookjs/storybook/pull/337).
- Add getStorybook method to client API [#332](https://github.com/storybookjs/storybook/pull/332).

## v1.40.0

- Fix duplicate decorator bug [#335](https://github.com/storybookjs/storybook/pull/335).

## v1.39.1

- Update babel packages [#325](https://github.com/storybookjs/storybook/pull/325).
- Hide HMR info logs [#331](https://github.com/storybookjs/storybook/pull/331).

## v1.39.0

- Update @kadira/storybook-ui to get features from [v2.5.0](https://github.com/kadirahq/storybook-ui/blob/master/CHANGELOG.md#v250) and [v2.6.0](https://github.com/kadirahq/storybook-ui/blob/master/CHANGELOG.md#v260).

## v1.38.3

- Add names for action and linkTo functions [#321](https://github.com/storybookjs/storybook/pull/321).

## v1.38.2

- Fix error in prepublish script [#319](https://github.com/storybookjs/storybook/pull/319).

## v1.38.1

- Improve Windows support by writing prepublish script using shelljs [#308](https://github.com/storybookjs/storybook/pull/308).

## v1.38.0

- v1.37.0 was a nightmare since it contains the npm-shrinkwrap.json. Fixed by removing it. See: [#306](https://github.com/storybookjs/storybook/issues/306) and [#305](https://github.com/storybookjs/storybook/pull/305).

## v1.37.0

- Update @kadira/storybook-ui to 2.4.0

## v1.36.0

- Support watchOptions configuration. See: [PR287](https://github.com/storybookjs/storybook/pull/287)

## v1.35.2

- Add missing font-face to the ErrorDisplay's heading.

## v1.35.1

- Fix issue related to bad error handling. See issue [#275](https://github.com/storybookjs/storybook/issues/275):

## v1.35.0

- Add fuzzy search powered search box and Redux DevTools support via [@kadira/storybook-ui@2.3.0](https://github.com/kadirahq/storybook-ui/blob/master/CHANGELOG.md#v230).

## v1.34.1

- Don't always override NODE_ENV in build-storybook. [PR272](https://github.com/storybookjs/storybook/pull/272)

## v1.34.0

- Use storybook-ui v2.2.0 which puts shortcut state into the URL.

## v1.33.0

- Introduce an [extension API](https://github.com/storybookjs/storybook/blob/master/docs/extensions.md) for Storybook. See: [PR258](https://github.com/storybookjs/storybook/pull/258)

## v1.32.1

- Extend @kadira/storybook-ui provider from it's base Provider.

## v1.32.0

- Use @kadira/storybook-ui as the manager UI with the implemented provider for React. See `client/manager` for more info.

## v1.31.0

- Pass a `context` argument to stories [PR250](https://github.com/storybookjs/storybook/pull/250)

## v1.30.0

- Fuzzy search kinds [PR247](https://github.com/storybookjs/storybook/pull/247)

## v1.29.5

- Update dependency version to fix filter crash [PR246](https://github.com/storybookjs/storybook/pull/246)

## v1.29.4

- Protect index.html/iframe.html from being overwritten [PR243](https://github.com/storybookjs/storybook/pull/243)

## v1.29.3

- Update @kadira/storybook-core version [PR241](https://github.com/storybookjs/storybook/pull/241)
- Add es6-shim by default [PR238](https://github.com/storybookjs/storybook/pull/238)

## v1.29.2

- Use url.resolve instead of path.join [PR240](https://github.com/storybookjs/storybook/pull/240)

## v1.29.1

- Copy missed manager.js.map file on static build [PR236](https://github.com/storybookjs/storybook/pull/236)

## v1.29.0

- Multiple static dirs (comma separated) [PR229](https://github.com/storybookjs/storybook/pull/229)

## v1.28.5

- Support ECMAScript stage-0 [PR228](https://github.com/storybookjs/storybook/pull/228) to fix [Issue #227](https://github.com/storybookjs/storybook/issues/227)

## v1.28.4

- Support custom webpack public path for dev-server and static build started by [PR226](https://github.com/storybookjs/storybook/pull/226)

## v1.28.3

- Revert [PR226](https://github.com/storybookjs/storybook/pull/226)

## v1.28.2

- Support custom webpack publicPath [PR226](https://github.com/storybookjs/storybook/pull/226)

## v1.28.1

- Add charset meta tags to HTML heads [PR216](https://github.com/storybookjs/storybook/pull/216)

## v1.28.0

- Moved storybook serving code into a middleware to support more advanced use cases.
- Refactored dev server to use storybook middleware [PR211](https://github.com/storybookjs/storybook/pull/211)

## v1.27.0

- Move modules to storybook-core repo. [PR196](https://github.com/storybookjs/storybook/pull/196)
- Add stack-source-map again only for Chrome to get better error stacks.
- Add ability to control the hostname. See [PR195](https://github.com/storybookjs/storybook/pull/195) and [PR198](https://github.com/storybookjs/storybook/pull/198)

## v1.26.0

12-May-2016

- Ensure asset directory exists in the static-builder.

## v1.25.0

11-May-2016

- Fix several publishing related issues. See: [#188](https://github.com/storybookjs/storybook/pull/188).
- Fix babel extends issue. See: [PR185](https://github.com/storybookjs/storybook/pull/185).
- Fix issue with removing a preset from users babelrc.
  - Fixes: [#183](https://github.com/storybookjs/storybook/issues/183).
  - [PR184](https://github.com/storybookjs/storybook/pull/184)
- Make left panel scrollable with keeping the filterbox always. See: [PR182](https://github.com/storybookjs/storybook/pull/182).
- Add `qs` as a direct dependency as it's used in preview.

## v1.24.0

10-May-2016

- Add a potential fix for the double scrollbar issue. See: [179](https://github.com/storybookjs/storybook/issues/179).
- Add scrolling support to the left panel. Fixes [#177](https://github.com/storybookjs/storybook/issues/177).
- Remove NODE_ENV=production flag. Fixes [#158](https://github.com/storybookjs/storybook/issues/158)

## v1.23.0

09-May-2016

- Add shortcuts to jump to previous and next stories. See [PR176](https://github.com/storybookjs/storybook/pull/176)
- Fix loader concatenation bug specially when custom config doesn't have a loaders section. [PR173](https://github.com/storybookjs/storybook/pull/173)

## v1.22.1

06-May-2016

- Add a potential fix for [#167](https://github.com/storybookjs/storybook/issues/167)
  - basically, this moved back babel-packages required by webpack.

## v1.22.0

06-May-2016

- Improve the static builder time.

## v1.21.0

06-May-2016

- Add configType argument to custom config function. See: [PR169](https://github.com/storybookjs/storybook/pull/169)
- Add the unicode version of the Keyboard Shortcut Icon. See: [PR170](https://github.com/storybookjs/storybook/pull/170)

## v1.20.0

05-May-2016

- Allow to configure webpack as the user wants. See [PR160](https://github.com/storybookjs/storybook/pull/160)
- Add typescript typings support for the core API. See [PR157](https://github.com/storybookjs/storybook/pull/157)
- Implement Mantra architecture and some new features including permalinks, full screen support. See: [PR165](https://github.com/storybookjs/storybook/pull/165)
- Remove some typo in docs. See: [PR154](https://github.com/storybookjs/storybook/pull/154)
- Move UI testing libraries to devDependencies. See: [PR153](https://github.com/storybookjs/storybook/pull/153)

## v1.19.0

27-April-2016

- Add airbnb-js-shims to client-side JS. See: [PR147](https://github.com/storybookjs/storybook/pull/147)
- Remove self-closing div tag, which is invalid HTML. See: [PR148](https://github.com/storybookjs/storybook/pull/148)
- Search for a .babelrc in the storybook config directory first, then the project root. See: [PR149](https://github.com/storybookjs/storybook/pull/149)

## v1.18.0

26-April-2016

- Link Storybook menu to the repo. See: [PR137](https://github.com/storybookjs/storybook/pull/137)
- Implement keyboard shortcuts and fuzzy search. See: [PR141](https://github.com/storybookjs/storybook/pull/141)

## v1.17.2

25-April-2016

- Fix an error which only occurs on Firefox. See: [PR144](https://github.com/storybookjs/storybook/pull/144)

## v1.17.1

21-April-2016

- Fix a regression introduce by `v1.17.0`. See: [PR133](https://github.com/storybookjs/storybook/pull/133)

## v1.17.0

21-April-2016

- Check all the arguments passed to action for events. See: [PR132](https://github.com/storybookjs/storybook/pull/132)

## v1.16.1

21-April-2016

- Fix action logs highlighting issue, which comes as a regression of [PR126](https://github.com/storybookjs/storybook/pull/126).

## v1.16.0

20-April-2016

- Prevent re-rendering the preview iframe when there is an action.
  - Related issue: [#116](https://github.com/storybookjs/storybook/issues/116)
  - Related PR: [PR126](https://github.com/storybookjs/storybook/pull/126)

## v1.15.0

20-April-2016

- Improve action logger UI and increase max log count to 10. See [PR123](https://github.com/storybookjs/storybook/pull/123)

## v1.14.0

19-April-2016

- Add syntax highlights to the logger. See: [PR118](https://github.com/storybookjs/storybook/pull/118)

## v1.13.0

- Add some UI test cases. See [PR103](https://github.com/storybookjs/storybook/pull/103)
- Implement `.addDecorator()` API. See [PR115](https://github.com/storybookjs/storybook/pull/115)
- Add code folding support. See [PR111](https://github.com/storybookjs/storybook/pull/111)

## v1.12.0

14-April-2016

- Add support for webpack module preLoaders. See: [PR107](https://github.com/storybookjs/storybook/pull/107)

## v1.11.0

13-April-2016

- Add support for React DevTools. See: [PR104](https://github.com/storybookjs/storybook/pull/104)

## v1.10.2

12-April-2016

Fix various issues related to static bundling.

- Add custom head generation to static build as well.
- Use relative urls so, static sites can be host with paths (GH Pages)
- Identify SyntheticEvent using feature detection. UglifyJS mangal class names, so we can't use classnames to detect a SyntheticEvent in the static build.

## v1.10.1

- Don't serve index.html in static directory as a site index. See [PR100](https://github.com/storybookjs/storybook/pull/100)
- Use cjson for parsing .babelrc files (support comments). See [PR98](https://github.com/storybookjs/storybook/pull/98)
- Remove the dist directory before running babel to avoid older code. See [PR101](https://github.com/storybookjs/storybook/pull/101)

## v1.10.0

- Add custom head support inside the iframe. See [PR77](https://github.com/storybookjs/storybook/pull/77)
- Unmount components before rendering into DOM node. Fix: [#81](https://github.com/storybookjs/storybook/issues/81)
- Add a static file builder. See [PR88](https://github.com/storybookjs/storybook/pull/88)
- Fix search box's lineHeight to work with all the browsers. See: [PR94](https://github.com/storybookjs/storybook/pull/94)
- Add the search box. See: [PR91](https://github.com/storybookjs/storybook/pull/91).

## v1.9.0

Add some minor improvements.

- Avoid deprecated warning in Chrome Canary. See: [PR85](https://github.com/storybookjs/storybook/pull/85)
- Fix the React Warning about CSS property. See: [PR84](https://github.com/storybookjs/storybook/pull/84)
- Transition on latest logged action. See: [PR80](https://github.com/storybookjs/storybook/pull/80)

## v1.8.0

- Add story linking functionality.
  - [Documentation](https://github.com/storybookjs/storybook/blob/master/docs/api.md#linking-stories).
  - Original feature request: [#50](https://github.com/storybookjs/storybook/issues/50)
  - Implementation: [PR86](https://github.com/storybookjs/storybook/pull/86)

## v1.7.0

- Add support to React v15.0.0.

## v1.6.0

- Make scrollable layout. See: [PR](https://github.com/storybookjs/storybook/pull/70)
- Add npm3 requirement to the `package.json`.
- Add `react` and `react-dom` to devDependencies.

## v1.5.0

- Add support for most of the custom webpack configuration. See [PR64](https://github.com/storybookjs/storybook/pull/64)

## v1.4.0

- Add CLI option to specify the config dir. See [PR52](https://github.com/storybookjs/storybook/pull/52).

## v1.3.0

- Load the `.babelrc` manually. Fixed: [#41](https://github.com/storybookjs/storybook/issues/41)
- Add a better contributing guide. See [CONTRIBUTING.md](https://github.com/storybookjs/storybook/blob/master/CONTRIBUTING.md)
- Add a development utility `npm run dev` which watches "src" directory and run `npm run prepublish`.

## v1.2.0

- Add a button to clear logs in the ActionLogger. This is requested in [PR21](https://github.com/storybookjs/storybook/issues/21).
- Remove navigation list order hijacking. See [commit](https://github.com/storybookjs/storybook/commit/166365fd38f51f79e69e028a1c11e2620eddcb99).
- Fix a typo in .gitignore. See [PR31](https://github.com/storybookjs/storybook/pull/31).
- Add support for JSX. See [PR18](https://github.com/storybookjs/storybook/pull/18).

## v1.1.0

- v1.0.0 was a mistake and it contains very old code. That's why we had to do a 1.1.0 release.

## v1.0.0

- Yeah!
