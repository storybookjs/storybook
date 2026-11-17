# Manual QA for Storybook 11.0 at 11.0.0-beta.3

Each item is a change in Storybook 11.0.0-beta.3 that the ecosystem QA sweep cannot test on real projects, with the check a person does by hand instead, under the reason why the sweep cannot test it.
Tick an item when the check shows what it describes, and when it shows something else, open a bug report with what you did and what you saw, and link it in a comment here.

## No repo of the catalog has the state it acts on

- [ ] In a project on Storybook 11, add a story whose component has a CSS keyframe animation next to an element moved by `animation-timeline: scroll()`, and open it in Chrome: the keyframe animation shows its end state, and scrolling inside the story moves the scroll-driven element. Give the story an `afterEach` that throws and run its file with the Storybook Vitest addon: the test fails with the thrown error, and a later story of the file whose `play` function waits for a CSS transition to end still passes.
  - [#31900](https://github.com/storybookjs/storybook/pull/31900) `Preview: Only pause DocumentTimeline animations in preview-web`
  - [#36107](https://github.com/storybookjs/storybook/pull/36107) `Core: Clean Up Paused Animations After AfterEach Failure`
- [ ] In a project on Storybook 11 with the Storybook Docs addon whose story meta sets `parameters.docs.subtitle`, as the `component-subtitle` automigration writes it, open the docs page of that meta: the subtitle shows under the title.
  - [#36129](https://github.com/storybookjs/storybook/pull/36129) `CLI: Remove deprecated componentSubtitle`
- [ ] In a project with the Storybook Docs addon and the Storybook Vitest addon, make the `play` function of a story in the middle of a story file fail, and run the file with Vitest: the failure points at the line of that `play` function in the story file.
  - [#36463](https://github.com/storybookjs/storybook/pull/36463) `Addon Docs: Map CSF plugin sourcemaps to the transform input`
- [ ] In a TypeScript project on Storybook 11, give a story a `play` function and a loader that read `argTypes` from their context, import `mockChannel` from `storybook/preview-api`, and import the types `StoryKind`, `AnyFramework`, `StoryContextForLoaders`, `PlayFunctionContext`, and `StoriesHash`: the type check names each of them, `argTypes` is undefined in the `play` function and the loader, and a decorator of the story still receives `argTypes`.
  - [#36484](https://github.com/storybookjs/storybook/pull/36484) `Core: Remove argTypes from the story context of loaders, beforeEach, play and afterEach`
  - [#36667](https://github.com/storybookjs/storybook/pull/36667) `Core: Remove deprecated mockChannel export from preview-api and manager-api [SB-2038]`
  - [#36706](https://github.com/storybookjs/storybook/pull/36706) `Core: Remove deprecated CSF and manager type aliases [SB-2017]`
- [ ] In a project on Storybook 11, set `tags: { internal: { hideFromFilterPanel: true } }` in the main file and tag a story `internal`: the tag filter panel of the sidebar has no `internal` checkbox, and the story stays in the sidebar. With `hideFromAutodocs: true` instead, the story is left out of the docs page of its component.
  - [#36520](https://github.com/storybookjs/storybook/pull/36520) `Core: Stabilize the tag filtering API`
- [ ] In a React project on Storybook 11 with CSF factories, make one story with `meta.type` given a type argument whose `args` add an `icon` string, followed by `.story({ args: { icon: 'star' } })`: the type check accepts `icon` on that story and refuses it on a story made with `meta.story`, and the story renders.
  - [#36533](https://github.com/storybookjs/storybook/pull/36533) `CSF: Add meta.type to type a single story in CSF Next`
- [ ] In a SvelteKit project on Storybook 11, make `.storybook/preview.ts` export `definePreview({ addons: [addonDocs()] })` from the Storybook SvelteKit framework, and write a `.stories.ts` file whose meta is `preview.meta({ component: Button })` with one story and one `.extend` of it: both stories render, and `npx vitest --project storybook --run` passes them.
  - [#36669](https://github.com/storybookjs/storybook/pull/36669) `Svelte: Add CSF factories with definePreview`
- [ ] In a project on Storybook 11, add `refs: { qaMissing: { title: 'QA missing', url: 'http://localhost:9009' } }` to the main file, with nothing listening on that port, and run `npx storybook dev`: the sidebar lists the project's stories and shows `QA missing` as a Storybook that failed to load, with no error in the browser console.
  - [#36703](https://github.com/storybookjs/storybook/pull/36703) `Core: Fix composition refs with camelCase keys crashing the sidebar`
- [ ] In a TanStack Router project on Storybook 11, add a story whose component throws while it renders: Storybook shows its error display with the thrown message, and the story's test with the Storybook Vitest addon fails. A route with its own `errorComponent` still renders that component.
  - [#36715](https://github.com/storybookjs/storybook/pull/36715) `TanStack React: Surface story render errors to Storybook`
- [ ] In a React Vite project with the Storybook Vitest addon, set `framework.options.strictMode` to `true` in the main file and add a story whose component logs its mount in a `useEffect`, then run it with Vitest: the log shows the mount twice, as it does in the browser.
  - [#36716](https://github.com/storybookjs/storybook/pull/36716) `Addon Vitest: Apply framework options such as strictMode`
- [ ] In a Next.js 16.4 project with the Storybook Next.js Vite framework, open a story with `parameters.nextjs.appDirectory` set to `true` whose component calls `useRouter()` from `next/navigation`: it renders without a `bfcacheId` TypeError.
  - [#36732](https://github.com/storybookjs/storybook/pull/36732) `Nextjs-Vite: Provide parentRenderTree.bfcacheId in app router mock`
- [ ] In a React project, export one story as an alias of a local function, such as `export const Example = ParagraphStory`, and one story with only `args` whose meta names a component defined in the same file, then run `npx storybook build` and open both stories: each renders, and its Code panel shows a snippet without an error.
  - [#36746](https://github.com/storybookjs/storybook/pull/36746) `CSF: Resolve local function story references`
- [ ] In a folder with a `package.json` and no Storybook config, run `npx storybook@11.0.0-beta.3 add` with the scoped name of the Storybook accessibility addon and `--yes`, then `echo $?`: it prints that it cannot find the main config file, and the exit status is 1.
  - [#36784](https://github.com/storybookjs/storybook/pull/36784) `CLI: Exit 1 when the add command's setup fails`
- [ ] In a Vite project on Storybook 11, move `.storybook` to `configuration/storybook` and run `npx storybook dev -c configuration/storybook`: the log warns that no user Vite config was loaded, and names the vite.config file at the project root and the `viteConfigPath` option.
  - [#36788](https://github.com/storybookjs/storybook/pull/36788) `Builder Vite: Report silent vite config discovery misses with a named warning`
- [ ] In a Yarn 1 project with a Storybook 9 addon that depends on `ts-dedent` 2.0, upgrade to Storybook 11 and run `npx storybook dev`: every story renders, and the browser console has no error that `ts-dedent` does not provide an export named `dedent`.
  - [#36792](https://github.com/storybookjs/storybook/pull/36792) `Core: Floor ts-dedent to ^2.2.0 so a CJS-only hoist cannot break the Vite preview graph`
- [ ] In a project with the Storybook Vitest addon whose Vitest config sets `setupFiles` to one string, put a `console.log` into that setup file and run the Storybook tests with `--silent=false`: the line prints once for each test file, not twice.
  - [#36807](https://github.com/storybookjs/storybook/pull/36807) `Vitest: Don't duplicate setupFiles configured as a string`
- [ ] In a Next.js project, render `next/link` in a story with an `href` object of `pathname: '/blog'`, `query: { page: '2' }`, and `hash: 'list'`, once with the Storybook Next.js framework and once with the Storybook Next.js Vite framework: in both the link's `href` in the preview reads `/blog?page=2#list`.
  - [#36967](https://github.com/storybookjs/storybook/pull/36967) `Next.js: Prefix the hash of an object href with # in the next/link mocks`
- [ ] In a project with a component whose prop type is long, such as a union of many string literals, open its docs page and click that type in the args table: the popover fits in the window, and its content scrolls.
  - [#36974](https://github.com/storybookjs/storybook/pull/36974) `Components: Make tall popover content scroll within the viewport`
- [ ] In a Next.js project that loads a font with `next/font/local` and `display: 'swap'`, start Storybook with the Storybook Next.js Vite framework and then with the Storybook Next.js framework: in each, the font-face rule of that font in the preview holds `font-display: swap`.
  - [#37002](https://github.com/storybookjs/storybook/pull/37002) `Next.js: Preserve display option for local fonts`
- [ ] In a new Vite React TypeScript project with TypeScript 7.1 installed, run `npx create-storybook@11.0.0-beta.3`, start Storybook, and open the docs of Example/Button: it starts without a TypeScript warning, and the args table lists `primary`, `backgroundColor`, `size`, `label`, and `onClick` with their descriptions. Do the same in a new Angular CLI project.
  - [#37004](https://github.com/storybookjs/storybook/pull/37004) `Docgen: Run React and Angular docgen on the TypeScript 7.1 native API`
- [ ] In an Angular workspace on Storybook 11, set `loglevel` of the `build-storybook` target in `angular.json` to `xerror` and run that target with `ng run`: schema validation rejects the value before it builds, and with `error` it builds.
  - [#37044](https://github.com/storybookjs/storybook/pull/37044) `Angular: Reject partial loglevel matches`
- [ ] In a React project on the webpack builder, add `sb.mock('../src/Header.tsx')` from `storybook/test` to the preview file, with a `__mocks__/Header.tsx` next to the component that renders `Mocked header`, and open a story that renders the header: it shows `Mocked header`.
  - [#37099](https://github.com/storybookjs/storybook/pull/37099) `Builder-Webpack5: Match mocks against webpack's resolved resource`
- [ ] In a project on Storybook 11 with a local manager addon whose `manager.tsx` imports `fn` from `storybook/test`, run `npx storybook dev`: it starts and the manager loads, and in the developer tools console `__STORYBOOK_TEST__` is `undefined`.
  - [#37144](https://github.com/storybookjs/storybook/pull/37144) `Manager: Remove storybook/test from the manager globals`
- [ ] In a project on Storybook 11, give a component's stories the title `Constructor` and open its docs page: the args table lists the component's props, and the Code panel of its first story shows a snippet.
  - [#37157](https://github.com/storybookjs/storybook/pull/37157) `Core: Fix docgen and story docs for reserved ids, renamed files and selected stories`
- [ ] In a project on Storybook 10 whose `.storybook/main.ts` sets `legacyDecoratorFileOrder: true`, `argTypeTargetsV7: false`, and `disallowImplicitActionsInRenderV8: false` under `features`, run `npx storybook@11.0.0-beta.3 upgrade`: the `remove-legacy-feature-flags` automigration deletes `argTypeTargetsV7` and `disallowImplicitActionsInRenderV8`, a decorator of the preview file now runs inside the decorators of addons and the framework, and a story that calls an action inferred from `argTypesRegex` while it renders fails with `ImplicitActionsDuringRendering`.
  - [#36394](https://github.com/storybookjs/storybook/pull/36394) `Core: Remove features.legacyDecoratorFileOrder`
  - [#37064](https://github.com/storybookjs/storybook/pull/37064) `Core: Remove temporary migration flags argTypeTargetsV7 and disallowImplicitActionsInRenderV8`
- [ ] In a local manager addon of a project on Storybook 11, import `experimental_UniversalStore` from `storybook/manager-api`, `satisfies` from `storybook/internal/common`, and `ExternalDocs` from the blocks of the Storybook Docs addon, register an addon with `type: types.TAB`, and emit `HIGHLIGHT` with `{ elements, color }` from a story: the type check names each of the three imports as missing, no tab shows beside the canvas, and the story highlights nothing.
  - [#36402](https://github.com/storybookjs/storybook/pull/36402) `Core: Make UniversalStore internal`
  - [#36424](https://github.com/storybookjs/storybook/pull/36424) `Core: Replace obsolete satisfies compatibility helper`
  - [#36480](https://github.com/storybookjs/storybook/pull/36480) `Core: Remove deprecated tab addon registration`
  - [#36662](https://github.com/storybookjs/storybook/pull/36662) `Core: Remove legacy highlight object format`
  - [#36757](https://github.com/storybookjs/storybook/pull/36757) `[SB-2007] Remove ExternalDocs and ExternalDocsContainer`
- [ ] In a project on Storybook 11.0.0-beta.1 with the Storybook skills installed, where `.claude/skills/ui-workflow` exists, remove the `## Storybook` section from `AGENTS.md` and run `npx storybook@11.0.0-beta.3 upgrade`: `.claude/skills/ui-workflow` and `.agents/skills/ui-workflow` are gone, the four new skills are there, and `AGENTS.md` has no `## Storybook` section again.
  - [#37346](https://github.com/storybookjs/storybook/pull/37346) `Skills: Remove the ui-workflow skill of an 11.0 prerelease on upgrade`
- [ ] In a project on Storybook 11 with `npx storybook dev` running, open a docs page, put a syntax error into the story file of that component, and save: the terminal shows the indexing error and no unhandled rejection, and after the fix is saved the docs page refreshes. Then edit and save a component file, undo the edit and save, create a review with `npx storybook tools review create`, and after ten seconds run `npx storybook tools stories changed`: the review page shows no banner that the review may be stale.
  - [#36586](https://github.com/storybookjs/storybook/pull/36586) `Core: Subscribe services to module-graph changes only in the dev server`
  - [#36993](https://github.com/storybookjs/storybook/pull/36993) `Core: Skip extraction refresh when the story index fails to build`
- [ ] In a Node script in a project on Storybook 11, read a story file whose story `A` is written as `meta.story()` with `loadCsf` from `storybook/internal/csf-tools` and parse it, call `set(['args', 'a'], 1)` on `csf.storyObject('A').object`, and print it with `printCsf`: the printed story reads `meta.story({ args: { a: 1 } })`.
  - [#36947](https://github.com/storybookjs/storybook/pull/36947) `CSF Tools: Complete the public API from the ten ecosystem ports`
- [ ] In a Next.js 16.4 app with the Storybook Next.js framework and `nextjs: { appDirectory: true }` in the parameters of its preview, open the story of a component that calls `useRouter()` from `next/navigation`: it renders, and the console has no TypeError that names `bfcacheId`. In a Next.js 16.4 app with the Storybook Next.js Vite framework, open a story whose component awaits `io()`, `navigation()`, and `prefetch()` from `next/cache`: it renders without an error.
  - [#36588](https://github.com/storybookjs/storybook/pull/36588) `Next.js: Fix app-router mock crash on Next.js 16.4`
  - [#37017](https://github.com/storybookjs/storybook/pull/37017) `Nextjs-Vite: Preserve Async Cache Mock Implementations`
- [ ] In a Next.js project with the Storybook Next.js Vite framework on Vite 8.1 or later whose `tsconfig.json` leaves the story files out of `include`, write a story that imports an image through a path alias of that tsconfig, and start `npx storybook dev`: the log names the image import it could not resolve, instead of an error about a virtual module, and the dev server keeps running.
  - [#36296](https://github.com/storybookjs/storybook/pull/36296) `Nextjs-Vite: Skip unresolved image imports`
- [ ] In an Angular project with the Storybook Angular Vite framework whose `angular.json` Storybook target sets `browserTarget` to a build target that lists `styles`, Sass `includePaths` under `stylePreprocessorOptions`, and `assets`, start Storybook and build it through those targets: the stories show the global styles, a component stylesheet that imports a Sass partial through those include paths compiles, and the assets load.
  - [#36375](https://github.com/storybookjs/storybook/pull/36375) `Angular Vite: Honor angular.json browserTarget options in build/start builders`
- [ ] In a project with `eslint-plugin-storybook` in its ESLint flat config, write a story whose `play` function calls `userEvent.click` imported from `storybook/test` without `await`, and run `npx eslint` on that file: the rule `storybook/await-interactions` reports the call. In a project whose `eslint.config.cjs` holds `module.exports = [...]` without the Storybook plugin, run `npx storybook@11.0.0-beta.3 automigrate eslintPlugin`: the file gains `require('eslint-plugin-storybook')` and the recommended Storybook config at the end of its array, and no `import` line.
  - [#35460](https://github.com/storybookjs/storybook/pull/35460) `ESLint: Recognize storybook/test imports in await-interactions`
  - [#36391](https://github.com/storybookjs/storybook/pull/36391) `CLI: Support CommonJS ESLint flat config automigration`
- [ ] In a React project with the Storybook Links addon on Storybook 11, render an anchor whose `href` is `hrefToSync('Example/Button', 'Primary')` in a story, then open it with a middle click: the story `Primary` of `Example/Button` opens in a new tab.
  - [#36189](https://github.com/storybookjs/storybook/pull/36189) ``Addon Links: Add `hrefToSync` function for synchronous url generation``
- [ ] In a project with the Storybook Themes addon whose tsconfig sets `module` and `moduleResolution` to `nodenext`, write `.storybook/preview.ts` with `definePreview` and `addons: [addonThemes()]` from the default import of the Storybook Themes addon, and run `npx tsc --noEmit`: it reports no `TS2349` error.
  - [#36721](https://github.com/storybookjs/storybook/pull/36721) `Addon Themes: Declare the package as an ES module`
- [ ] In a Vite project on Storybook 11 without the Storybook Vitest addon whose `vitest.config.ts` sets `test.projects` to a variable that holds an array of projects, run `npx storybook add` with the scoped name of the Storybook Vitest addon: `test.projects` still lists the existing projects, and the `storybook` project is a new item of that same list.
  - [#36822](https://github.com/storybookjs/storybook/pull/36822) `Addon Vitest: Keep non-array test.projects applying when appending storybook project`
- [ ] In a project whose preview sets `initialGlobals` to `{ viewport: { value: 'tablet', isRotated: false } }`, open a story, click the rotate button of the viewport toolbar, and reload the page at the URL it shows: the canvas is still the rotated tablet viewport.
  - [#36976](https://github.com/storybookjs/storybook/pull/36976) `Preview API: Keep nested globals when restoring them from the URL`

## Needs a tool the sandbox does not have

- [ ] In VS Code, in a React Vite project on Storybook 11 with CSF factories, declare the custom tags `alpha` and `beta` in `.storybook/preview.ts` by calling `.type` on `definePreview(...)` with a type argument whose `tags` is an array of `'alpha'`, `'beta'`, or any other string, then type `tags: ['` in a story: the editor suggests `alpha` and `beta`.
  - [#35812](https://github.com/storybookjs/storybook/pull/35812) `Core: Adjust type to fix custom tags autocompletion`
- [ ] Open a project's Storybook 11 dev server in the latest Chrome, Edge, and Firefox, and in Safari 26.5 or later: in each browser the sidebar lists the stories and the first story renders.
  - [#36051](https://github.com/storybookjs/storybook/pull/36051) `Core: Raise browser support floors`
- [ ] In a project with the Storybook accessibility addon and the Storybook Vitest addon whose preview sets `parameters.a11y.test` to `'error'`, click Run tests in the testing widget, then open a story with a violation: its Accessibility panel lists the violation with the elements it found, and a story without violations lists its passing rules.
  - [#36202](https://github.com/storybookjs/storybook/pull/36202) `Addons: Reduce a11y report size and retention in Vitest`
- [ ] In a project on Storybook 11 with the Storybook MCP addon, start `npx storybook dev` and connect an MCP client to `http://localhost:6006/mcp`: its tool list loads, and the tool for story instructions answers with the steps for writing stories.
  - [#36820](https://github.com/storybookjs/storybook/pull/36820) `Skills: Fix what agents get wrong in the evals`
- [ ] Open a Storybook 11 project in StackBlitz and start `storybook dev` there: the preview pane shows the manager with its stories, not a broken-page icon.
  - [#37176](https://github.com/storybookjs/storybook/pull/37176) `Core: Let StackBlitz embed the dev server again`
- [ ] Build a Storybook 11 project with the Storybook MCP addon whose main file composes another Storybook in `refs`, serve the build, and connect an MCP client to its MCP endpoint: the docs tools list a `storybookId` argument, and a docs lookup scoped to the composed Storybook answers.
  - [#37290](https://github.com/storybookjs/storybook/pull/37290) `MCP: Publish the composition schema a hosted Storybook actually serves`
- [ ] Open a large project's Storybook 11 in Chrome with the Performance panel recording, hover quickly over many sidebar items, then click from one story to the next: the main thread goes quiet soon after the hovering stops, and a story click shows no long task of manager re-renders.
  - [#37389](https://github.com/storybookjs/storybook/pull/37389) `Manager: Improve performance of story preloading`
  - [#37390](https://github.com/storybookjs/storybook/pull/37390) `Manager: Cut re-renders and store writes on story change`
- [ ] In a browser window narrower than 600 pixels, or on a phone, open a project's Storybook 11, open the menu, and open About from its cog button: Tab moves only through the overlay with a visible focus ring on each stop and comes back to Back, the first link reads GitHub, Storybook Community opens in a new tab, and the About, Guide, and Keyboard shortcuts pages scroll to their end. Close the menu while About shows and open it again: it shows the menu.
  - [#36224](https://github.com/storybookjs/storybook/pull/36224) `UI: Fix focus trap, indicators and tab order in the mobile about overlay`
  - [#36225](https://github.com/storybookjs/storybook/pull/36225) `UI: Reset the mobile about overlay when the menu drawer closes`
  - [#36226](https://github.com/storybookjs/storybook/pull/36226) `UI: Make settings pages scrollable in mobile layout`
  - [#36494](https://github.com/storybookjs/storybook/pull/36494) `Manager: Capitalize GitHub and open the contributors link in a new tab on mobile`
- [ ] In a React Native app on Storybook 11 with the Storybook React Native package, start the on-device Storybook in a simulator: it starts and shows the stories without `globalWindow.addEventListener is not a function`. In a pnpm project with the Storybook React Native Web Vite framework and TypeScript 6, run `pnpm install --strict-peer-dependencies`: it reports no TypeScript peer conflict.
  - [#36304](https://github.com/storybookjs/storybook/pull/36304) `React Native Web: Fix compatibility with typescript>5`
  - [#36445](https://github.com/storybookjs/storybook/pull/36445) `React Native Web: Fix TypeScript 6 peer conflict`
  - [#37183](https://github.com/storybookjs/storybook/pull/37183) `Preview API: Skip the landmark navigation listener in RN`
- [ ] With Node.js 22.11, run `npx storybook@11.0.0-beta.3 dev` in a project on Storybook 11 and `npx storybook@11.0.0-beta.3 upgrade` in a project on Storybook 10: each exits before it changes a file and says that Storybook needs Node.js 22.12 or newer. With Node.js 22.12, with a Node.js 26 release candidate such as 26.1.0-rc.0, and with Node.js 26, `npx storybook dev` starts, and on Node.js 26 its log has no `DEP0205` warning.
  - [#35337](https://github.com/storybookjs/storybook/pull/35337) `Core: Fix DEP0205 deprecation warning for module.register() on Node.js 26`
  - [#36279](https://github.com/storybookjs/storybook/pull/36279) `Node.js: Require 22.12+ for Storybook 11`
  - [#36320](https://github.com/storybookjs/storybook/pull/36320) `CLI: Accept Node.js prerelease builds in the version gate`
- [ ] In an Angular project with the Storybook Angular Vite framework and the Storybook Vitest addon with 50 or more story files, run the Storybook tests in Vitest browser mode with `--browser.isolate=false`: every story test passes, and the memory of the browser process stays near one size from the first story file to the last.
  - [#37133](https://github.com/storybookjs/storybook/pull/37133) `Angular-Vite: Evaluate @angular/compiler once per page under Vitest`
- [ ] With VoiceOver or NVDA, move the focus to an icon button with a tooltip in the toolbar of a project's Storybook 11, such as a zoom button: the reader announces the button's name and its tooltip once, and after Escape it no longer announces the tooltip.
  - [#36508](https://github.com/storybookjs/storybook/pull/36508) `UI: Restore accessible descriptions for generic tooltips`

## Needs a package manager or a setup that no run of the sweep has

- [ ] Copy a React Vite project with the Storybook Vitest addon into a folder whose name holds an accented Latin letter and Korean letters, install it, and run `npx vitest --project storybook --run`: the stories run as tests, and the count of tests is not 0.
  - [#36054](https://github.com/storybookjs/storybook/pull/36054) `Vitest: Decode non-ASCII characters in file paths for test execution guard`
- [ ] In a pnpm workspace with `auto-install-peers=false` in `.npmrc`, install `storybook@11.0.0-beta.3` at the root and give one app `storybook` and the Storybook React Vite framework at 10.6, then run `npx storybook build` in that app and open the build: every story renders. Do the same with the Storybook React webpack5 framework at 10.6.
  - [#36318](https://github.com/storybookjs/storybook/pull/36318) `Webpack5: Resolve csf import from builder context`
  - [#36321](https://github.com/storybookjs/storybook/pull/36321) `Builder-Vite: Resolve preview runtime import from builder context`
- [ ] In a new React Vite project on pnpm 12 whose `pnpm-workspace.yaml` sets `minimumReleaseAge` longer than the age of 11.0.0-beta.3, run `npx create-storybook@11.0.0-beta.3`: before it changes a file it asks about the release age, and choosing to stop prints a command for an older release that the setting allows.
  - [#36352](https://github.com/storybookjs/storybook/pull/36352) `CLI: Restore pnpm minimumReleaseAge prechecks`
- [ ] In a Yarn 1 project on Storybook 10 with the Chromatic addon, run `npx storybook@11.0.0-beta.3 upgrade`: it finishes and leaves no addon on a `next` range such as `^next` in `package.json`.
  - [#36388](https://github.com/storybookjs/storybook/pull/36388) `Fix Yarn 1 next tag lookups`
- [ ] In a React Native app whose Storybook config is in `.rnstorybook`, run `npx storybook@11.0.0-beta.3 automigrate csf-factories --config-dir .rnstorybook --yes`: the converted stories import `preview` from `#.storybook/preview`, and `imports` in `package.json` maps `#.storybook/preview` to the preview file in `.rnstorybook`.
  - [#36623](https://github.com/storybookjs/storybook/pull/36623) `CLI: Keep React Native stories on #.storybook/preview`
- [ ] In a browser that has opened a project on Storybook 10.3 with tag filters selected in its sidebar, upgrade the project to Storybook 11 and open it in the same browser: the sidebar applies none of the old tag filters, the local storage entry of the manager store holds neither `includedTagFilters` nor `excludedTagFilters`, and filters selected again apply and survive a reload.
  - [#36678](https://github.com/storybookjs/storybook/pull/36678) `Manager: Remove persisted tag-filter state migration [SB-2022]`
  - [#36909](https://github.com/storybookjs/storybook/pull/36909) `Manager: Delete v10.3 tag filters from local storage`
- [ ] In a React Vite project on pnpm with `enableGlobalVirtualStore: true` in `pnpm-workspace.yaml` and without the Storybook Docs addon, wrap the stories in `ThemeProvider` from `storybook/theming` in the preview file and run `npx storybook build`: the build succeeds and the stories render.
  - [#36841](https://github.com/storybookjs/storybook/pull/36841) `React: Alias preview React from the renderer preset`
- [ ] In a project on Yarn 6 with `npmMinimalAgeGate: 7d` in `.yarnrc.yml`, run `npx storybook@11.0.0-beta.3 add` with the scoped name of the Storybook accessibility addon: it resolves a version and installs it, and prints no warning about the age gate.
  - [#36882](https://github.com/storybookjs/storybook/pull/36882) `CLI: Tolerate Yarn 6 in version lookups and sandbox config`
- [ ] In a pnpm project whose `node_modules` pnpm wants to rebuild, for example after a switch to a pnpm version with another store layout, run `npx storybook@11.0.0-beta.3 upgrade` in a terminal: pnpm asks whether to remove the modules directories, an answer of `y` lets the install finish, and the upgrade completes.
  - [#36928](https://github.com/storybookjs/storybook/pull/36928) `CLI: Preserve pnpm terminal for install confirmation`
- [ ] In a project on Storybook 11 whose main file composes a ref at a URL that answers a plain request but not a request for JSON, such as a host behind a login, run `npx storybook build`: the build finishes, and the built sidebar shows the ref.
  - [#36181](https://github.com/storybookjs/storybook/pull/36181) `Core: Fix build crash when ref reachability check fails mid-request`
- [ ] In a Yarn 4 project with `npmMinimalAgeGate: 7d` in `.yarnrc.yml`, on a day when the newest `chromatic` release is younger than seven days, run `npx storybook@11.0.0-beta.3 upgrade`: the install succeeds, and `npmPreapprovedPackages` in `.yarnrc.yml` lists `chromatic` next to the Chromatic addon.
  - [#36910](https://github.com/storybookjs/storybook/pull/36910) `Core: Exempt chromatic from release-age gates alongside the Chromatic addon`
- [ ] Start a project's Storybook 11 with `npx storybook dev --host 0.0.0.0` and open it over plain HTTP at the machine's LAN address: a story whose `play` function types or clicks with the `userEvent` of its context passes in the Interactions panel.
  - [#37334](https://github.com/storybookjs/storybook/pull/37334) `Test: Fix the context userEvent in insecure contexts`

## Needs a new project made with `storybook init`

- [ ] In a new Vite React TypeScript app, run `npx create-storybook@11.0.0-beta.3` and answer Yes to the AI question: `.claude/skills` and `.agents/skills` hold the Storybook skills, `skills-lock.json` exists, the Storybook MCP addon is in neither `package.json` nor `.storybook/main.ts`, the main file exports `defineMain(...)`, the preview exports `definePreview(...)`, the example stories call `preview.meta`, and `npx storybook dev` renders Example/Button and Example/Page with a passing `play` function. In a second new app answer No: no `skills-lock.json` is written.
  - [#36431](https://github.com/storybookjs/storybook/pull/36431) `CLI: Install the official Storybook skills on init and upgrade`
  - [#36561](https://github.com/storybookjs/storybook/pull/36561) `CLI: Install skills with the AI feature instead of addon-mcp`
  - [#37125](https://github.com/storybookjs/storybook/pull/37125) `CLI: Scaffold CSF4 from storybook init`
- [ ] In a React Native app without Storybook, run `npx storybook@11.0.0-beta.3 init` and choose React Native: it installs the on-device packages from their `next` tag, or it stops before the install and names the on-device package whose `storybook` peer does not allow 11.0.0-beta.3, and in neither case does npm print `ERESOLVE`.
  - [#36880](https://github.com/storybookjs/storybook/pull/36880) `CLI: Check React Native on-device peers before install`
- [ ] In a Remix 3 app, run `npx storybook@11.0.0-beta.3 init` without `--type`: it picks the HTML renderer with Vite, installs the Storybook HTML Vite framework, and says that Remix 3 uses the HTML renderer. In a Remix 2 app with React it still picks React.
  - [#36892](https://github.com/storybookjs/storybook/pull/36892) `CLI: Detect Remix 3 as the HTML renderer`
- [ ] In a new Astro project, run `npx storybook@11.0.0-beta.3 init`: it detects Astro, installs the Astro framework package from its `next` tag when that tag exists, writes a Button component with stories, and `npx storybook dev` renders them.
  - [#37122](https://github.com/storybookjs/storybook/pull/37122) `Astro: Add init support, doc mention and ecosystem CI sandbox`
  - [#37203](https://github.com/storybookjs/storybook/pull/37203) `Community: Support prerelease community frameworks in init`
- [ ] In an empty folder, run `npx storybook@11.0.0-beta.3 sandbox` and pick a template: after the download it sets up Storybook in the template. Run it again with `--no-init`: it only downloads the template.
  - [#37348](https://github.com/storybookjs/storybook/pull/37348) `CLI: Default sandbox command to initializing Storybook`
- [ ] In a new React Vite JavaScript app, run `npx create-storybook@11.0.0-beta.3` and open the docs of the example Button and Header: the args tables show the types and descriptions from their JSDoc, the Controls panel prints no warning about a color control, and `package.json` has no `prop-types`.
  - [#37082](https://github.com/storybookjs/storybook/pull/37082) `CLI: Use JSDoc types instead of propTypes in React JS init templates`
- [ ] In a new Next.js app made with `npx create-next-app@latest` and npm, run `npx create-storybook@11.0.0-beta.3` and answer Yes to the test features: the install succeeds and `npx storybook dev` starts. In another new app, run `npx create-storybook@11.0.0-beta.3` with its standard input read from `/dev/null`: it stops at the first question and exits with status 1.
  - [#36310](https://github.com/storybookjs/storybook/pull/36310) `CLI: Fix vitest ERESOLVE on fresh Next.js apps.`
  - [#36823](https://github.com/storybookjs/storybook/pull/36823) `Core: Exit 1 when a prompt aborts or stdin ends mid-run`

## Needs a timing or a race that no run can arrange

- [ ] In a React project with the Storybook Vitest addon, write a story that renders a `React.lazy` component whose import takes a second, followed by a second story, and run both with Vitest: the second test logs no error that the environment is not configured to support `act(...)`.
  - [#36608](https://github.com/storybookjs/storybook/pull/36608) `React: Keep the act environment set while a story tears down`
- [ ] Build a project that has an addon panel which hides itself for some stories with `npx storybook build`, serve `storybook-static`, and reload a story on which that panel is hidden: while the page loads, the addon panel never shows the tab of that panel.
  - [#36774](https://github.com/storybookjs/storybook/pull/36774) `Manager: Keep addon panel filter active before a story is prepared`
- [ ] In a project whose stories take a moment to tear down, such as stories with an async cleanup in `beforeEach`, click three stories in the sidebar in quick succession: the preview ends on the last story clicked, and the browser console has no `cannot render when not prepared` error.
  - [#36778](https://github.com/storybookjs/storybook/pull/36778) `Preview-API: prevent rendering superseded selections`
- [ ] In a project with a CommonJS manager addon that calls `require('storybook/manager-api')`, run `npx storybook build` ten times in a row: every build succeeds, and none fails with `ERR_INTERNAL_ASSERTION: Cannot require() ES Module`.
  - [#36791](https://github.com/storybookjs/storybook/pull/36791) `Core: Load presets sequentially to prevent ESM require() race in CJS presets`
- [ ] Open a project's Storybook 11 in Chrome right after `npx storybook dev` says it is ready, with the network throttled to Slow 4G in the developer tools: the manager loads, the sidebar and the testing widget work, and the console has no timeout error of a UniversalStore.
  - [#36994](https://github.com/storybookjs/storybook/pull/36994) `Core: Let UniversalStore followers wait for their leader without a timeout`

## Needs a framework no repo of the catalog has

- [ ] In a Vue 3.6 project with a component whose script setup block has the `vapor` attribute, in `.storybook/preview.ts`, add a `setup` function that passes `vaporInteropPlugin` from `vue` to `app.use`, and open the component's story: it renders, its events show in the Actions panel, and a change of a control updates it.
  - [#36636](https://github.com/storybookjs/storybook/pull/36636) `Vue3: Support Vapor components through Vue's interop plugin`
- [ ] In a Vue 3 project with the community framework `storybook-vue3-rsbuild` on Storybook 11, start `npx storybook dev`: the presets load without `CriticalPresetLoadError`, and the first story renders.
  - [#36479](https://github.com/storybookjs/storybook/pull/36479) `Vue: Restore DOCGEN_WORKER_SPECIFIER export from preset`

## Only a person can judge what it shows

- [ ] On a docs page whose story preview has a Show code button, press Tab until that button is focused, press Enter, and Tab back to Hide code: the whole focus ring is visible, and the button lines up with the left edge of the preview.
  - [#37001](https://github.com/storybookjs/storybook/pull/37001) `Addon Docs: Keep the code toggle focus ring visible`
- [ ] In a React Vite, a Vue Vite, and an Angular Vite project on Storybook 11, each without the Storybook Vitest addon, run `npx storybook skills setup`: each prints instructions for its own framework, the Vue and Angular ones without JSX or React providers, with a step that adds the Storybook Vitest addon. In an Angular project on webpack it exits with an error that names the Vite builder.
  - [#36385](https://github.com/storybookjs/storybook/pull/36385) `CLI: Scope AI instructions to the project framework`
  - [#36680](https://github.com/storybookjs/storybook/pull/36680) `CLI: Fix wrong advice in the skills setup instructions`
- [ ] In a pnpm project on Storybook 11 with `node-linker=hoisted` in `.npmrc` and `chromatic` installed, run `STORYBOOK_TELEMETRY_DEBUG=1 npx storybook build`: the printed `build` event has `nodeLinker` set to `hoisted` under `packageManager`, a `storyDocs` object with its counts, and `chromatic` under `vrtPackages`. Then run `STORYBOOK_TELEMETRY_DEBUG=1 npx storybook tools stories changed`: it prints one `tools-command` event with `toolset` set to `stories` and `tool` set to `changed`.
  - [#36158](https://github.com/storybookjs/storybook/pull/36158) `Telemetry: Read the package manager node linker from its config file`
  - [#36210](https://github.com/storybookjs/storybook/pull/36210) `Telemetry: One tools-command record per invocation with CLI toolset and tool names`
  - [#37087](https://github.com/storybookjs/storybook/pull/37087) `Telemetry: Count story snippet outcomes in the build event`
  - [#37124](https://github.com/storybookjs/storybook/pull/37124) `Telemetry: Add VRT packages`
- [ ] With the operating system in dark mode, open a project's Storybook 11 with a light Storybook theme and the Controls panel of a story with a boolean or a radio control: the checkbox and the radio buttons are light. Then watch the onboarding checklist widget in the sidebar: its rainbow outline runs for about ten seconds and stops, and with reduced motion turned on in the operating system it does not run.
  - [#36264](https://github.com/storybookjs/storybook/pull/36264) `Core: Limit onboarding checklist rainbow animation`
  - [#36877](https://github.com/storybookjs/storybook/pull/36877) `Manager: Align native control colors with selected theme`

## Shows on Windows only

- [ ] On Windows 11, in a React project on the webpack builder, such as one made with `npx create-storybook@11.0.0-beta.3 --type react --builder webpack5`, run `npx storybook dev`: every story renders and none shows `Cannot find module`. In a Next.js project with the Storybook Next.js Vite framework whose stories render a statically imported image, the image shows.
  - [#37344](https://github.com/storybookjs/storybook/pull/37344) `Core: Fix stories failing to load on Windows with the webpack builder`
  - [#37387](https://github.com/storybookjs/storybook/pull/37387) `Nextjs-Vite: Fix Windows paths in static image imports`
- [ ] On Windows 11, in a Vite project whose main file sets `staticDirs`, run `npx storybook build`: every file of the static directories is in `storybook-static`, and the log line that names the Vite config it found uses forward slashes. When an upgrade writes a report of failed automigrations, its File and Reason columns name files with forward slashes, such as `src/B.stories.ts`. With `npx storybook dev` running, create a new component file with a story: its docs page shows the args table, and the Code panel snippets of React stories hold no carriage returns. Reprint a main file with `npx storybook automigrate` or run the `csf-factories` codemod: the changed files keep LF line endings and the quote style of the file. In a Svelte Vite project with `.stories.svelte` files, start `npx storybook dev`: the first story renders once, without a reload of the preview.
  - [#36307](https://github.com/storybookjs/storybook/pull/36307) `Builder Vite: Static assets copy to handle Windows paths`
  - [#36346](https://github.com/storybookjs/storybook/pull/36346) `Core: Make csf-tools printing and CLI dispatcher output Windows-stable`
  - [#36360](https://github.com/storybookjs/storybook/pull/36360) `Core: Stabilize csf-tools quote inference and webpack5 test on Windows`
  - [#36582](https://github.com/storybookjs/storybook/pull/36582) `CLI: Fix Windows paths in automigration failure reports`
  - [#36864](https://github.com/storybookjs/storybook/pull/36864) `Windows: Fix various FS-related test failures`
  - [#36917](https://github.com/storybookjs/storybook/pull/36917) `Builder Vite: Print the found Vite config path with forward slashes on Windows`
  - [#37048](https://github.com/storybookjs/storybook/pull/37048) `Svelte CSF: Normalize the runtime stories path resolved by the Vite plugin`
