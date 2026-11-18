# Manual QA for Storybook 11.0 at 11.0.0-beta.3

Each item is a change in Storybook 11.0.0-beta.3 that the ecosystem QA sweep cannot test on real projects, with the check a person does by hand instead, under the reason why the sweep cannot test it.
Tick an item when the check shows what it describes, and when it shows something else, open a bug report with what you did and what you saw, and link it in a comment here.

## Needs a tool the sandbox does not have

- [ ] In VS Code, in a React Vite project on Storybook 11 with CSF factories, declare the custom tags `alpha` and `beta` in `.storybook/preview.ts` by calling `.type` on `definePreview(...)` with a type argument whose `tags` is an array of `'alpha'`, `'beta'`, or any other string, then type `tags: ['` in a story: the editor suggests `alpha` and `beta`.
  - [#35812](https://github.com/storybookjs/storybook/pull/35812) `Core: Adjust type to fix custom tags autocompletion`
- [ ] Open a project's Storybook 11 dev server in the latest Chrome, Edge, and Firefox, and in Safari 26.5 or later: in each browser the sidebar lists the stories and the first story renders.
  - [#36051](https://github.com/storybookjs/storybook/pull/36051) `Core: Raise browser support floors`
- [ ] Open a Storybook 11 project in StackBlitz and start `storybook dev` there: the preview pane shows the manager with its stories, not a broken-page icon.
  - [#37176](https://github.com/storybookjs/storybook/pull/37176) `Core: Let StackBlitz embed the dev server again`
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
- [ ] In an Angular project with the Storybook Angular Vite framework and the Storybook Vitest addon with 50 or more story files, run the Storybook tests in Vitest browser mode with `--browser.isolate=false`: every story test passes, and the memory of the browser process stays near one size from the first story file to the last.
  - [#37133](https://github.com/storybookjs/storybook/pull/37133) `Angular-Vite: Evaluate @angular/compiler once per page under Vitest`
- [ ] With VoiceOver or NVDA, move the focus to an icon button with a tooltip in the toolbar of a project's Storybook 11, such as a zoom button: the reader announces the button's name and its tooltip once, and after Escape it no longer announces the tooltip.
  - [#36508](https://github.com/storybookjs/storybook/pull/36508) `UI: Restore accessible descriptions for generic tooltips`

## Needs a package manager or a setup that no run of the sweep has

- [ ] In a new React Vite project on pnpm 12 whose `pnpm-workspace.yaml` sets `minimumReleaseAge` longer than the age of 11.0.0-beta.3, run `npx create-storybook@11.0.0-beta.3`: before it changes a file it asks about the release age, and choosing to stop prints a command for an older release that the setting allows.
  - [#36352](https://github.com/storybookjs/storybook/pull/36352) `CLI: Restore pnpm minimumReleaseAge prechecks`
- [ ] In a React Native app whose Storybook config is only in `.rnstorybook`, with no web `.storybook`, run `npx storybook@11.0.0-beta.3 automigrate csf-factories --config-dir .rnstorybook --yes`: the converted stories import `preview` from `#.storybook/preview`, and `imports` in `package.json` maps `#.storybook/preview` to the preview file in `.rnstorybook`.
  - [#36623](https://github.com/storybookjs/storybook/pull/36623) `CLI: Keep React Native stories on #.storybook/preview`, the part that the plan entry `rn-csf-factories-preview-import` does not test
- [ ] In a browser that has opened a project on Storybook 10.3 with tag filters selected in its sidebar, upgrade the project to Storybook 11 and open it in the same browser: the sidebar applies none of the old tag filters, the local storage entry of the manager store holds neither `includedTagFilters` nor `excludedTagFilters`, and filters selected again apply and survive a reload.
  - [#36678](https://github.com/storybookjs/storybook/pull/36678) `Manager: Remove persisted tag-filter state migration [SB-2022]`
  - [#36909](https://github.com/storybookjs/storybook/pull/36909) `Manager: Delete v10.3 tag filters from local storage`
- [ ] In a React project on Storybook 11 and on pnpm with `enableGlobalVirtualStore: true` in `pnpm-workspace.yaml` whose preview file imports `storybook/theming`, run `npx storybook build --test`, which leaves the Docs addon out, and open the built Storybook: the build succeeds and the stories render.
  - [#36841](https://github.com/storybookjs/storybook/pull/36841) `React: Alias preview React from the renderer preset`
- [ ] In a pnpm project whose `node_modules` pnpm wants to rebuild, for example after a switch to a pnpm version with another store layout, run `npx storybook@11.0.0-beta.3 upgrade` in a terminal: pnpm asks whether to remove the modules directories, an answer of `y` lets the install finish, and the upgrade completes.
  - [#36928](https://github.com/storybookjs/storybook/pull/36928) `CLI: Preserve pnpm terminal for install confirmation`
- [ ] Before 2026-11-20 15:44 UTC, while Storybook 11.0.0-beta.3 is younger than seven days, in a Yarn 4 project with `npmMinimalAgeGate: 7d` in `.yarnrc.yml` and the Chromatic addon, run `npx storybook@11.0.0-beta.3 upgrade` and, when it asks how to proceed, choose `Update yarn config to preapprove Storybook packages`: the install succeeds, and `npmPreapprovedPackages` in `.yarnrc.yml` lists `chromatic` next to the Chromatic addon. From that time on the prerelease is older than the gate, the upgrade leaves `npmPreapprovedPackages` alone, and the check cannot be done.
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

## No repo of the catalog has the state it acts on

- [ ] In a SvelteKit 3 project on Storybook 11, make `.storybook/preview.ts` export `definePreview` of the Storybook SvelteKit framework with the docs addon in `addons`, and write a `.stories.ts` file whose meta is `preview.meta` of a Svelte component with one story and one `.extend` of it: both stories render, and `npx vitest --project storybook --run` passes them.
  - [#36669](https://github.com/storybookjs/storybook/pull/36669) `Svelte: Add CSF factories with definePreview`, the part that the plan entry `svelte-csf-factories` does not test
- [ ] In a TanStack Router project on Storybook 11 with the Storybook Vitest addon, add a story whose component throws while it renders and a story whose route has its own `errorComponent`: the test of the first story fails with the thrown error, and the second renders its `errorComponent` and passes.
  - [#36715](https://github.com/storybookjs/storybook/pull/36715) `TanStack React: Surface story render errors to Storybook`, the part that the plan entry `tanstack-render-error` does not test
- [ ] In a folder with a `package.json` and no Storybook config, run `npx storybook@11.0.0-beta.3 add` with the scoped name of the Storybook accessibility addon and `--yes`, then `echo $?`: it prints that it cannot find the main config file, and the exit status is 1.
  - [#36784](https://github.com/storybookjs/storybook/pull/36784) `CLI: Exit 1 when the add command's setup fails`
- [ ] In a Yarn 1 project with a Storybook 9 addon that depends on `ts-dedent` 2.0, upgrade to Storybook 11 and run `npx storybook dev`: every story renders, and the browser console has no error that `ts-dedent` does not provide an export named `dedent`.
  - [#36792](https://github.com/storybookjs/storybook/pull/36792) `Core: Floor ts-dedent to ^2.2.0 so a CJS-only hoist cannot break the Vite preview graph`
- [ ] In a new Vite React TypeScript project with TypeScript 7.1 installed, run `npx create-storybook@11.0.0-beta.3`, start Storybook, and open the docs of Example/Button: it starts without a TypeScript warning, and the args table lists `primary`, `backgroundColor`, `size`, `label`, and `onClick` with their descriptions. Do the same in a new Angular CLI project.
  - [#37004](https://github.com/storybookjs/storybook/pull/37004) `Docgen: Run React and Angular docgen on the TypeScript 7.1 native API`
- [ ] In a project on Storybook 11, register a local manager addon with `type: types.TAB`, and emit `HIGHLIGHT` with `{ elements, color }` and no `id` from a story: no tab shows beside the canvas, and the browser console warns `Ignoring highlight without an id` and the story highlights nothing.
  - [#36480](https://github.com/storybookjs/storybook/pull/36480) `Core: Remove deprecated tab addon registration`, the part that the plan entry `removed-manager-apis` does not test
  - [#36662](https://github.com/storybookjs/storybook/pull/36662) `Core: Remove legacy highlight object format`
- [ ] In a project on Storybook 11.0.0-beta.1 with the Storybook skills installed, where `.claude/skills/ui-workflow` exists, remove the `## Storybook` section from `AGENTS.md` and run `npx storybook@11.0.0-beta.3 upgrade`: `.claude/skills/ui-workflow` and `.agents/skills/ui-workflow` are gone, the four new skills are there, and `AGENTS.md` has no `## Storybook` section again.
  - [#37346](https://github.com/storybookjs/storybook/pull/37346) `Skills: Remove the ui-workflow skill of an 11.0 prerelease on upgrade`
- [ ] In a Vite project on Storybook 11 without the Storybook Vitest addon whose `vitest.config.ts` sets `test.projects` to a variable that holds an array of projects, run `npx storybook add` with the scoped name of the Storybook Vitest addon: `test.projects` still lists the existing projects, and the `storybook` project is a new item of that same list.
  - [#36822](https://github.com/storybookjs/storybook/pull/36822) `Addon Vitest: Keep non-array test.projects applying when appending storybook project`

## Needs a timing or a race that no run can arrange

- [ ] Build a project that has an addon panel which hides itself for some stories with `npx storybook build`, serve `storybook-static`, and reload a story on which that panel is hidden: while the page loads, the addon panel never shows the tab of that panel.
  - [#36774](https://github.com/storybookjs/storybook/pull/36774) `Manager: Keep addon panel filter active before a story is prepared`
- [ ] In a project whose stories take a moment to tear down, such as stories with an async cleanup in `beforeEach`, click three stories in the sidebar in quick succession: the preview ends on the last story clicked, and the browser console has no `cannot render when not prepared` error.
  - [#36778](https://github.com/storybookjs/storybook/pull/36778) `Preview-API: prevent rendering superseded selections`
- [ ] In a project with a CommonJS manager addon that calls `require('storybook/manager-api')`, run `npx storybook build` ten times in a row: every build succeeds, and none fails with `ERR_INTERNAL_ASSERTION: Cannot require() ES Module`.
  - [#36791](https://github.com/storybookjs/storybook/pull/36791) `Core: Load presets sequentially to prevent ESM require() race in CJS presets`
- [ ] Open a project's Storybook 11 in Chrome right after `npx storybook dev` says it is ready, with the network throttled to Slow 4G in the developer tools: the manager loads, the sidebar and the testing widget work, and the console has no timeout error of a UniversalStore.
  - [#36994](https://github.com/storybookjs/storybook/pull/36994) `Core: Let UniversalStore followers wait for their leader without a timeout`

## Only a person can judge what it shows

- [ ] In a project on Storybook 11 whose docs page shows a type popover taller than the window, open that popover and turn the mouse wheel over it: its content scrolls to the last line, and the page behind it does not move.
  - [#36974](https://github.com/storybookjs/storybook/pull/36974) `Components: Make tall popover content scroll within the viewport`, the part that the plan entry `docs-type-popover-fits-viewport` does not test
- [ ] On a docs page whose story preview has a Show code button, press Tab until that button is focused, press Enter, and Tab back to Hide code: the whole focus ring is visible, and the button lines up with the left edge of the preview.
  - [#37001](https://github.com/storybookjs/storybook/pull/37001) `Addon Docs: Keep the code toggle focus ring visible`
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
