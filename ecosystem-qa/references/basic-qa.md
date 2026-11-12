# Storybook 11 manual QA checklist

This is the checklist for manual QA of a Storybook 11 prerelease, by a person in a bug bash or by the QA agent.
It covers what a user meets in Storybook 9, 10 and 11, and it is derived from the files listed under [Sources](#sources).
The agent registry in `ecosystem-qa/checks.ts` runs a subset of these rows; the Agent column says which.

## How to use this list

### Pick a session type

An **upgrade session** starts from a real project on Storybook 10 and runs `npx storybook@<version> upgrade` (`pnpm dlx`, `yarn dlx` or `bunx` for the other package managers).
It runs the [Upgrade](#upgrade), [Automigrations](#automigrations) and [doctor and info](#doctor-and-info) rows, then every other section that applies to the project.

A **fresh-init session** starts from an empty directory or a framework scaffold without Storybook and runs `npm create storybook@<version>` (`yarn create`, `pnpm create` or `bun create` for the other package managers).
It runs the [Create](#create) rows, then every other section that applies.

A project on Storybook 9 or earlier upgrades in two steps, `npx storybook@^10 upgrade` and then `npx storybook@<version> upgrade`, because Storybook 11 removed the automigrations for 10 and earlier.
Record which step a failure happened in.

Use port 6006 for the dev server, 6007 for a second dev server such as docs-only mode, and 6008 for the static build.
Start the dev server with `--ci --exact-port` so it fails instead of moving to another port.

### Capture a baseline first

Before an upgrade, start the project on its current version and run every probe you can run cheaply there.
A failure is a regression only when the same probe passed on the old version.
A failure without a baseline is a finding of unknown origin, and the issue says so.

Commit the upgrade on its own (`git add -A && git commit -m "qa: upgrade storybook to <version>"`) before any probe edits files.
The HMR and Controls rows change story files; restore them from that commit after each row.

### Record one state per row

| State     | Use it when                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------ |
| `pass`    | You ran the probe and saw the pass condition.                                                    |
| `fail`    | You ran the probe, applied the migration notes that apply, and still did not see it.            |
| `n/a`     | The feature is not in this project. Name the file or search that proves it.                     |
| `blocked` | An earlier failure stopped you. Name that row.                                                   |
| `skip`    | You did not try it. Give a concrete reason, such as a time limit or a missing tool.              |

A breaking change that the migration guide documents and that the project's own code hits is not a failure when the automigration or the error message points at the guide.
The missing pointer is the failure when it does not.

### File what you find

File each failure as a GitHub issue in `storybookjs/storybook` with the bug template (`.github/ISSUE_TEMPLATE/bug_report.yml`).

- Title: `[SB 11 QA]: <symptom> when <condition>`.
- Labels: `bug`, `internal-qa`, `upgrade:11.0`.
- Milestone: `11`.
- No severity label at filing; triage sets it.
- Body: the row id from this list, the exact version, the package manager, the OS, copy-paste repro steps that start from `git clone`, the error text verbatim, and the baseline result.

Search open issues with the `upgrade:11.0` label first, and comment on a match instead of filing a duplicate.

### Read the columns

- **Probe** is the command, file edit or click path to run.
- **Pass when** is what correct behaviour looks like.
- **Since** is the version that introduced or changed the behaviour and its source.
  `M:` is a heading in `MIGRATION.md`, `CL:` is a heading in `CHANGELOG.md` or `CHANGELOG.prerelease.md`, and a `docs/` or `code/` path is the file that documents the behaviour.
  `pre-9` marks a behaviour older than 9.0 that still holds in 11.
  `source: team practice` marks a check the team has always run that no repo file describes.
- **Agent** says who covers the row:
  - The check id when the QA agent runs the row: the `must` tier on every sweep, the rest with `--tier extended`.
  - `planned: <id>` when it is queued for the registry.
  - `monorepo: <test>` when the monorepo's own unit or E2E tests prove the row and its outcome does not depend on the project, so the agent never spends a run on it.
    The cell names the test file, and that file exists.
  - `manual: <reason>` when a person has to check it: the pass condition is motion, wording, layout or a click the agent cannot drive, or the row does not depend on the project and no monorepo test covers it yet.
    A manual row that a spec partly automates says so after the reason (`; e2e: <spec>`), so a bug bash can spend its time on the rows nothing automates.

  Paths are relative to `code/`, except `e2e-tests/` paths, which are relative to `test-storybooks/portable-stories-kitchen-sink/react/`, and `scripts/` paths, which are relative to the repository root.
  `none` means only a person covers the row; spend your time there first.

## CLI

### Create

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| CLI-1 | In an empty directory run `npm create storybook@<version>` and answer the prompts. | It asks for a framework, installs, writes `.storybook/` and example stories, and `npm run storybook` starts. | pre-9 ; `docs/get-started/install.mdx` | manual: interactive prompts and tours | Create in an empty directory |
| CLI-2 | Run `npm create storybook@<version>` in a framework scaffold (for example `npm create vite@latest`). | It detects the framework without asking, installs, and the example stories render. | pre-9 ; `docs/get-started/install.mdx` | manual: interactive prompts and tours | Create in an existing project |
| CLI-3 | Run create twice, once choosing **Recommended** and once **Minimal**; then once with `--features docs test a11y`. | Recommended and `--features docs test a11y` install `@storybook/addon-docs`, `@storybook/addon-vitest` and `@storybook/addon-a11y`; Minimal installs none of them. | 9.0 ; CL: 9.0.0 ; `docs/get-started/install.mdx` | manual: interactive prompts and tours | Recommended and minimal setups |
| CLI-4 | Create in a React JavaScript project; open the generated `Button.jsx` and its Docs args table. | The component uses JSDoc types, `prop-types` is not installed, and the args table shows the prop types and descriptions. | 11.0 ; M: JavaScript init templates use JSDoc types instead of `propTypes` | manual: bug bash or feature session | JavaScript init uses JSDoc types |
| CLI-5 | Run create in a Create React App project. | It sets up `@storybook/react-vite`, or asks you to choose Vite, Webpack 5 or Rsbuild when it cannot detect a builder. | 11.0 ; M: Create React App support removed | manual: bug bash or feature session | Create React App goes to Vite |
| CLI-6 | Run create in a Yarn Berry project with the PnP linker. | PnP is unsupported in 11, so the run either works after you set `nodeLinker: node-modules`, or fails with an error that points at PnP. An error that does not lead to the linker setting is a missing pointer. | 11.0 ; M: Yarn PnP support removed | manual: wording and whether a message helps | Yarn PnP points at the linker setting |
| CLI-7 | Finish create and let it start Storybook. | Storybook prints its URL and does not open a browser tab. | 11.0 ; M: `storybook dev` no longer opens a browser by default | manual: interactive prompts and tours | No browser opens after create |

### Upgrade

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| CLI-8 | From the Storybook directory run `npx storybook@<version> upgrade` and save the output. In a monorepo, wait for the dedupe step after "Dependencies installed". | It exits 0 and prints a summary of upgraded packages and automigrations. | pre-9 ; `docs/releases/upgrading.mdx` | upgrade.command | The upgrade command completes |
| CLI-9 | `node -p "require('storybook/package.json').version"` | It prints `<version>`. Every `@storybook/*` package in every `package.json` is on the same version. | pre-9 ; `docs/releases/upgrading.mdx` | upgrade.installed-version | The installed version is the target |
| CLI-10 | Diff every changed `package.json`. | Non-Storybook packages the upgrade bumped (for example `@chromatic-com/storybook`, `msw-storybook-addon`) are on a release that supports 11; no package is left on a Storybook 10 peer. | 11.0 ; M: `@storybook/react-dom-shim` removed | upgrade.community-packages | Community packages are bumped where compatible |
| CLI-11 | Run the upgrade on a Storybook 9 project. | It stops with "Major Version Gap Detected", suggests `npx storybook@10 upgrade`, and links the 10 migration guide. | 11.0 ; M: Automigrations for Storybook 10 and earlier removed | manual: wording and whether a message helps | Old major is blocked with a pointer |
| CLI-12 | Run the upgrade on Node 22.11 or 20. | It stops with "Node.js 22.12 or higher required", names the detected version, and links the migration section. | 11.0 ; M: Node.js 22.12 or higher | manual: wording and whether a message helps | Node version gate |
| CLI-13 | Run the upgrade with `react@17`, then with `framework.options.legacyRootApi` set in main. | Both block the upgrade with a link to the migration section. | 11.0 ; M: React: Require v18 and up | manual: wording and whether a message helps | React 16/17 and `legacyRootApi` are blocked |
| CLI-14 | Run the upgrade with `@storybook/preset-create-react-app` installed. | The upgrade stops and says why. | 11.0 ; M: Create React App support removed | manual: wording and whether a message helps | Create React App preset is blocked |
| CLI-15 | Upgrade a React, Vue 3, Svelte or Web Components project that has no `typescript` dependency. | The `typescript-dependency` automigration offers `typescript@^6` and adds it to `devDependencies`. | 11.0 ; M: TypeScript 5.9 or newer | monorepo: `lib/cli-storybook/src/automigrate/fixes/typescript-dependency.test.ts` | TypeScript is added where missing |
| CLI-16 | Upgrade a `@storybook/nextjs` project. | The upgrade lists `@storybook/nextjs` as deprecated and offers `nextjs-to-nextjs-vite`; every later `storybook dev` logs a deprecation warning. | 11.0 ; M: Next.js: `@storybook/nextjs` is deprecated | manual: wording and whether a message helps | Deprecated frameworks are announced |
| CLI-17 | Read the "From version 10.x to 11.0.0" section of `MIGRATION.md`, apply each step that applies to the project, and start Storybook. | Storybook starts; every manual step you needed is in the guide. A needed step the guide does not mention is a failure. | 11.0 ; M: From version 10.x to 11.0.0 | upgrade.automigrations | Migration notes cover the rest |
| CLI-28 | Run the `storybook` and `build-storybook` scripts exactly as `package.json` declares them, with `--ci` added for the dev one. | Both run on the new version; a flag the old version accepted and the new one rejects is a failure. | 11.0 ; source: team practice | upgrade.project-scripts | The project's own scripts still run |

### Automigrations

Run `npx storybook automigrate --list` to see the ids, and `npx storybook automigrate <id>` to rerun one.
For every automigration the upgrade ran, read the `git diff` of each file it changed, and check that its message names a link that resolves (a link that prints `undefined` is a failure).
The rows below are the 11.0 automigrations a typical project triggers; mark the others `n/a` with the reason the CLI printed.

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| AM-1 | Compare the automigrations the upgrade listed as detected with the project's config. | Each one that ran applies to the project, and none that applies was skipped without a reason. | pre-9 ; `ecosystem-qa/prompts/upgrade.md` | upgrade.automigrations | Detection matches the project |
| AM-2 | Upgrade a project with `features.experimentalDocgenServer` in main. | The key is renamed to `features.docgenServer`. | 11.0 ; M: `docgenServer` is stable and enabled by default | manual: bug bash or feature session | `docgen-server` |
| AM-3 | Upgrade a project with `parameters.options.storySort` in `.storybook/preview.*`. | A static `storySort` moves to `storySorts` in main and the sidebar order is unchanged; a comparator function gets manual instructions. | 11.0 ; M: `storySort` in the preview replaced by `storySorts` in main | manual: generated code that needs reading | `story-sort-to-main` |
| AM-4 | Upgrade a project with `addons.setConfig({ showNav, panelPosition, enableShortcuts })` in `.storybook/manager.*`. | The options move under `layout` and `ui`, and the layout looks the same as before. | 11.0 ; M: Top-level `setConfig` layout and UI options removed | manual: generated code that needs reading | `set-config-layout` |
| AM-5 | Upgrade a project that uses `experimental_setFilter`, `excludeFromSidebar` or `sidebar.filters`. | Tag options are renamed to `hideFromSidebar` and `hideFromAutodocs`, `experimental_setFilter` to `setFilter`; `sidebar.filters` gets a notice and is not rewritten. | 11.0 ; M: Tag filtering API | manual: bug bash or feature session | `tag-filter-api` and `sidebar-filters` |
| AM-6 | Upgrade a project with `parameters.componentSubtitle` or `argTypes.<name>.defaultValue`. | `componentSubtitle` becomes `parameters.docs.subtitle`; `argTypes` `defaultValue` is deleted; files it could not edit are listed in `automigrations-summary.md`. | 11.0 ; M: `parameters.componentSubtitle` removed ; M: `argTypes` `defaultValue` removed | manual: bug bash or feature session | `component-subtitle` and `argtypes-default-value` |
| AM-7 | Upgrade a project with `features.experimentalReview`, `features.changeDetection`, `features.argTypeTargetsV7` or `features.disallowImplicitActionsInRenderV8`. | `remove-experimental-review`, `remove-change-detection-flag` and `remove-legacy-feature-flags` delete each flag whether it was `true` or `false`. | 11.0 ; M: `experimentalReview` feature flag removed ; M: `changeDetection` feature flag removed ; M: `argTypeTargetsV7` feature flag removed | manual: bug bash or feature session | Feature flag removals |
| AM-8 | Upgrade a project whose Vitest setup file calls `setProjectAnnotations`. | The call is removed, an empty setup file and its `setupFiles` entry are deleted, and custom annotations get per-file instructions. | 11.0 ; M: Vitest Addon: `setProjectAnnotations` must not be called in setup files | test.setup-annotations | `vitest-setup-file` |
| AM-9 | Upgrade a CSF Next project that calls `args.<fn>.mockResolvedValue(...)`. | The call becomes `mocked(args.<fn>).mockResolvedValue(...)` with `mocked` imported from `storybook/test`, and `tsc` passes. | 11.0 ; M: CSF Next: use `mocked()` for the mock API on args | manual: bug bash or feature session | `csf-next-mocked-args` |
| AM-10 | Upgrade a `@storybook/nextjs`, `@storybook/angular` or TanStack Router `@storybook/react-vite` project and accept the offer. | `nextjs-to-nextjs-vite`, `angular-to-angular-vite` or `react-vite-to-tanstack-react` swaps the package, the `framework` field and the imports, and Storybook starts. | 11.0 ; M: Test runner support ended ; M: TanStack Router projects: migrate from `@storybook/react-vite` to `@storybook/tanstack-react` | manual: bug bash or feature session | Framework switches |
| AM-11 | Upgrade an Angular Vite project with Compodoc, a Svelte project with `@storybook/addon-svelte-csf`, or a Web Components project calling `setCustomElementsManifest`. | `angular-vite-remove-compodoc`, `addon-svelte-csf-to-core` or `web-components-runtime-manifest` removes the old setup, and Controls still show the component's props. | 10.6 ; M: Angular Vite defaults to server-side docgen ; M: Svelte CSF is built into the Svelte frameworks ; M: Web Components: the runtime Custom Elements Manifest API is deprecated | manual: bug bash or feature session | Framework-specific clean-ups |
| AM-12 | Upgrade a supported project (React, Svelte, Web Components, Vue 3 Vite or Angular Vite) outside CI. | It installs the Storybook skills and adds the marked Storybook section to `AGENTS.md`; see [Skills and AGENTS.md](#skills-and-agentsmd). | 11.0 ; M: `stories` skill renamed to `ui-workflow` | upgrade.skills | `skills` |

### doctor and info

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| CLI-18 | Run `npx storybook@<version> doctor` after the upgrade. | Its findings match the project. "Looks good" on a project where a Storybook package is still on 10, is duplicated, or cannot load is a failure. | pre-9 ; `docs/api/cli-options.mdx` | upgrade.doctor | doctor describes the project |
| CLI-19 | Pin one `@storybook/*` package to a 10.x version and run doctor. | doctor reports the mismatched version and how to fix it. | pre-9 ; `docs/api/cli-options.mdx` | manual: bug bash or feature session | doctor catches a broken setup |
| CLI-20 | `npx storybook index` | It writes an `index.json` with the same entries as the dev server's, without starting one. | 9.0 ; CL: 9.0.0 | upgrade.index-cli | index without a server |
| CLI-21 | Run `npx storybook@<version> info`. | It prints OS, Node, the package manager and the installed Storybook packages with their versions. | pre-9 ; `docs/api/cli-options.mdx` | manual: bug bash or feature session | info prints the environment |

### add and remove

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| CLI-22 | `npx storybook add @storybook/addon-a11y` | The package is installed, `addons` in main lists it, its postinstall runs, and its panel shows after a restart. | pre-9 ; `docs/api/cli-options.mdx` | manual: bug bash or feature session | add registers an addon |
| CLI-23 | `npx storybook remove @storybook/addon-a11y` | The package is uninstalled, `addons` in main no longer lists it, and Storybook starts. | pre-9 ; `docs/api/cli-options.mdx` | manual: bug bash or feature session | remove unregisters an addon |
| CLI-24 | Make `addons` in main come from a spread (`{ addons: [...], ...shared }`) and run `add`, then `remove`. | `add` installs and stops with a message instead of editing main; `remove` uninstalls and warns that the addon is still listed. | 11.0 ; M: `storybook add` and `storybook remove` leave an `addons` they cannot edit safely | manual: wording and whether a message helps | add and remove refuse an unsafe edit |

### Removed commands and flags

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| CLI-25 | `npx storybook ai setup` | It exits 1 and says to run `npx storybook skills setup` and `npx storybook tools` instead. | 11.0 ; M: `storybook ai` command removed | manual: no monorepo test yet | `storybook ai` points at its replacement |
| CLI-26 | `npx storybook dev --preview-url http://localhost:1234` and `--force-build-preview` | Neither points Storybook at an external preview: the command is rejected, or it starts and loads its own `iframe.html`. | 11.0 ; M: `--preview-url` and `--force-build-preview` removed | manual: no monorepo test yet | Removed dev flags fail clearly |
| CLI-27 | `npx storybook automigrate --renderer react` and `npx storybook automigrate remove-essentials` | `--renderer` fails as an unknown option, and the removed id is not found. | 11.0 ; M: Automigrations for Storybook 10 and earlier removed | manual: no monorepo test yet | Removed automigrate options fail clearly |

## Dev server and manager

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| MGR-1 | `npm run storybook -- --ci --exact-port -p 6006`, then `curl -m 5 http://localhost:6006/index.json`. | It starts without errors and `index.json` lists this project's entries; the count matches the baseline. | pre-9 ; `docs/api/cli-options.mdx` | core.dev-server | The dev server starts and indexes |
| MGR-2 | `npx storybook dev`, then `npx storybook dev --open`. For Angular, start through the `start-storybook` builder with and without `"open": true`. | The first prints the URL and opens nothing; `--open` and `"open": true` open a tab. | 11.0 ; M: `storybook dev` no longer opens a browser by default | manual: bug bash or feature session | No browser opens by default |
| MGR-3 | Open the first story. | It renders without page errors in the browser console. | pre-9 ; `docs/get-started/browse-stories.mdx` | core.story-render | A story renders |
| MGR-4 | Expand and collapse groups and components, select stories and docs entries, use the browser back button. | The selection, the URL and the canvas stay in sync; no entry is missing compared with the baseline. | pre-9 ; `docs/get-started/browse-stories.mdx` | manual: bug bash or feature session; e2e: `e2e-internal/navigation.spec.ts` | Sidebar navigation |
| MGR-5 | Focus the tree and use the arrow keys, Left and Right to collapse and expand, Home, End and Enter. Scroll a long tree. | Focus moves row by row with a visible focus ring, a focused row stays visible below the sticky parent rows, and Enter selects it. | 11.0 ; CL: 11.0.0-alpha.7 ; M: Sidebar rewrite: manager API changes | manual: motion, focus and keyboard feel; e2e: `e2e-internal/sidebar-scrolling.spec.ts` | Sidebar keyboard navigation |
| MGR-6 | Open the context menu of a top-level group. | It offers expand all and collapse all, and both act on that subtree only. | 11.0 ; CL: 11.0.0-beta.0 | manual: motion, focus and keyboard feel | Expand and collapse all |
| MGR-7 | Press <kbd>F6</kbd> repeatedly, then <kbd>shift+F6</kbd>. | Focus cycles through the sidebar, toolbar, preview and addon panel, and back. | 11.0 ; CL: 11.0.0-alpha.5 | manual: motion, focus and keyboard feel | Focus regions |
| MGR-8 | Hover a story row, open its context menu with the button, then focus a row and press <kbd>ctrl/⌘+shift+U</kbd>. | Both open the actions menu with "Open in editor" and "Copy story name". | 11.0 ; M: Sidebar rewrite: manager API changes | manual: clicks in the manager or the test widget; e2e: `e2e-sandbox/manager.spec.ts` | Row context menu |
| MGR-9 | With an MDX file that has `<Meta title="Introduction" />` and no stories, look at the sidebar and search for "Introduction". | The page is one entry named "Introduction", not a component with a "Docs" child; search lists it by its own name. | 11.0 ; M: Sidebar: standalone docs pages are no longer wrapped in a component | manual: bug bash or feature session; e2e: `e2e-internal/navigation.spec.ts` | Standalone docs pages |
| MGR-10 | Type part of a component name, then a docs heading, into the search field. | Matching entries are listed; a docs subheading result navigates to that anchor. | pre-9 ; `docs/get-started/browse-stories.mdx` | manual: bug bash or feature session; e2e: `e2e-internal/navigation.spec.ts` | Sidebar search |
| MGR-11 | Open the filter menu next to search, include one tag, then exclude another. | Only stories with the included tag and without the excluded tag remain; search results respect the filter; clearing the filter restores the list. | 10.0 ; CL: 10.0.0-beta.1 ; `docs/writing-stories/tags.mdx` | manual: clicks in the manager or the test widget; e2e: `e2e-sandbox/tags.spec.ts` | Tag filter include and exclude |
| MGR-12 | Set a filter, reload, then paste the URL into a new tab. | The filter is still set in both, and the first story selected is one the filter shows. | 10.4 ; CL: 10.3.0 ; CL: 10.4.0 | manual: clicks in the manager or the test widget | Tag filter survives reload and URL |
| MGR-13 | Set `tags: { internal: { hideFromSidebar: true } }` in main, then `hideFromFilterPanel: true` on another tag. | Stories tagged `internal` are gone and clearing filters does not bring them back; the second tag is missing from the menu but its stories stay visible. | 11.0 ; M: Tag filtering API | manual: bug bash or feature session | Tag options in main |
| MGR-14 | Tag one story `!dev` and one `!autodocs`. | The first is missing from the sidebar, the second from the docs page. | 9.0 ; CL: 9.0.0 ; `docs/writing-stories/tags.mdx` | manual: bug bash or feature session; e2e: `e2e-sandbox/tags.spec.ts` | Built-in tags |
| MGR-15 | Set `storySorts: [{ order: ['Introduction', 'Components'] }]` in main and restart. | The sidebar follows that order; `parameters.options.storySort` in preview no longer has an effect. | 11.0 ; M: `storySort` in the preview replaced by `storySorts` in main | manual: bug bash or feature session | Story order from main |
| MGR-16 | Press <kbd>alt+S</kbd>, <kbd>alt+T</kbd>, <kbd>alt+A</kbd> and <kbd>alt+F</kbd>, then open the shortcuts page from the settings menu. | They toggle the sidebar, toolbar, panel and fullscreen; the shortcuts page lists them and has no Escape entry. | 11.0 ; M: Escape is no longer a configurable shortcut | manual: motion, focus and keyboard feel; e2e: `e2e-sandbox/manager.spec.ts` | Layout shortcuts |
| MGR-17 | Enter fullscreen, open a toolbar menu, press Escape, then press Escape again. | The first Escape closes only the menu; the second leaves fullscreen. | 11.0 ; M: Escape is no longer a configurable shortcut | manual: motion, focus and keyboard feel | Escape in fullscreen |
| MGR-18 | Use the menu entries **Previous component or page** and **Next component or page** and their shortcuts. | Selection jumps between components and standalone docs pages. | 11.0 ; M: Sidebar: standalone docs pages are no longer wrapped in a component | manual: motion, focus and keyboard feel | Previous and next component |
| MGR-19 | Move the addon panel to the right and back, resize it, reload. | The panel follows, keeps its size after reload, and is hidden in docs view. | pre-9 ; `docs/configure/user-interface/features-and-behavior.mdx` | manual: visual layout and formatting; e2e: `e2e-sandbox/manager.spec.ts` | Panel position and toggles |
| MGR-20 | Open the manager at 375 px wide; navigate to a story and open the addon panel. | The bottom bar shows the current entry, navigation works, the panel opens and closes. | pre-9 ; `docs/configure/user-interface/features-and-behavior.mdx` | manual: visual layout and formatting; e2e: `e2e-sandbox/manager.spec.ts` | Mobile layout |
| MGR-21 | Look next to the sidebar search field in a React project. | There is no "Create new story" button; saving from Controls still works ([CTL-4](#controls)). | 11.0 ; M: 'Create new story' UI feature removed | manual: bug bash or feature session | No create-story button |
| MGR-22 | In a git repo, add an untracked story file and edit a tracked one while dev runs, without the `changeDetection` flag. | The new story shows the "new" status, the edited one "modified", and a **Review** button above the tree filters to both. | 11.0 ; CL: 10.4.0-alpha.8 ; M: `changeDetection` feature flag removed ; `docs/configure/user-interface/change-detection.mdx` | manual: clicks in the manager or the test widget; e2e: `e2e-sandbox/change-detection.spec.ts` | Change detection statuses |
| MGR-23 | From a story row's context menu choose **Open in editor**. | The story file opens in your editor. | 10.0 ; CL: 10.0.0 | manual: clicks in the manager or the test widget; e2e: `e2e-sandbox/manager.spec.ts` | Open in editor |
| MGR-24 | Select a story and press <kbd>alt+shift+I</kbd>. | The story opens in a new tab at its `iframe.html` URL. | 10.2 ; CL: 10.2.0-alpha.12 | manual: clicks in the manager or the test widget | Open in isolation |
| MGR-25 | Use the zoom tool, the <kbd>+</kbd> and <kbd>-</kbd> keys and a typed value. | The canvas scales to the value, and the reset button shows only when the zoom is not 100%. | 10.2 ; CL: 10.2.0-alpha.15 | manual: motion, focus and keyboard feel | Zoom |
| MGR-26 | With `@chromatic-com/storybook` installed, click **Share** in the toolbar. | The menu offers "Publish a build to share" and, once published, a link to copy. | 10.4 ; CL: 10.4.0-alpha.18 ; `docs/sharing/index.mdx` | manual: clicks in the manager or the test widget | Share tool |
| MGR-27 | In a fresh-init project, open the checklist from the sidebar widget and the Storybook menu; then set `features.sidebarOnboardingChecklist: false`. | Items complete when you do the action they describe; the flag hides the widget. | 10.1 ; CL: 10.1.0 ; `docs/api/main-config/main-config-features.mdx` | manual: interactive prompts and tours | Onboarding checklist |
| MGR-28 | `npx storybook dev --smoke-test --ci` | It starts, then exits 0. | pre-9 ; `docs/api/cli-options.mdx` | monorepo: `scripts/tasks/smoke-test.ts` in every sandbox dev job | Smoke test |
| MGR-29 | Add a `refs` entry pointing at a published Storybook and restart. | The ref's stories appear in the sidebar under its title, render, and filter with search. | pre-9 ; `docs/sharing/storybook-composition.mdx` | manual: bug bash or feature session; e2e: `e2e-tests/composition.spec.ts` | Composition |
| MGR-30 | `curl -sI http://localhost:6006/ \| grep -i content-security-policy`, then embed the dev URL in an `<iframe>` on a page served from a LAN IP. | The header contains `frame-ancestors`; the LAN page shows an empty frame with a `frame-ancestors` console error; a `localhost` page embeds fine; `security.insecureRemoteIframeEmbed: true` lifts it. | 11.0 ; M: `storybook dev` now blocks remote iframe embedding | monorepo: `e2e-internal/internal-storybook.smoke.spec.ts` | Remote embedding is blocked by default |
| MGR-31 | Compose a live dev Storybook from a non-localhost origin, then a built one. | The live dev ref does not load without `security.insecureIframeMessaging` and `security.insecureRemoteIframeEmbed`; the built ref loads. | 11.0 ; M: Storybook now restricts iframe messaging | manual: bug bash or feature session; e2e: `e2e-internal/iframe-messaging.spec.ts` | Iframe messaging is restricted |
| MGR-32 | Open the manager in a browser below Chrome 147, Edge 150, Firefox 152 or Safari 26.5; then build with `--preview-only` and open `/iframe.html?navigator=true`. | The supported floors work; the preview-only build renders stories in the older browser. | 11.0 ; M: Raised browser support floors | manual: visual layout and formatting | Old browsers |
| MGR-33 | Open the settings menu, then the About and keyboard shortcuts pages. | Both open, the About page shows the installed version, and the close button returns to the story. | pre-9 ; `docs/configure/user-interface/features-and-behavior.mdx` | manual: visual layout and formatting; e2e: `e2e-sandbox/manager.spec.ts` | Settings and About pages |

## HMR

Run these while the dev server runs, one at a time, and restore the file from the upgrade commit after each.
Poll `index.json` for sidebar changes so a slow rebuild is not mistaken for a failure; give up after 60 seconds.

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| HMR-1 | Change an arg value in a stories file and save. | The canvas updates without a full page reload, and the Controls panel shows the new value. | pre-9 ; source: team practice | manual: bug bash or feature session | Edit a story |
| HMR-2 | Add a decorator or a global parameter in `.storybook/preview.*` and save. | Every story picks it up without restarting the server. | pre-9 ; source: team practice | core.hmr.preview-file | Edit the preview file |
| HMR-3 | Add a new named export to an existing stories file. | The new story appears in the sidebar and renders. | pre-9 ; source: team practice | core.hmr.stories-file | Add a story to a file |
| HMR-4 | Rename an export, or its `name`, in an existing stories file. | The sidebar shows the new name, the old entry is gone, and the selected story still renders. | pre-9 ; source: team practice | monorepo: `core/src/core-server/utils/StoryIndexGenerator.test.ts` | Rename a story |
| HMR-5 | Create a new `*.stories.*` file matched by `stories` in main. | Its component appears in the sidebar and renders, with no error overlay. | pre-9 ; source: team practice | monorepo: `e2e-sandbox/change-detection.spec.ts` | Add a stories file |
| HMR-6 | Delete a stories file while one of its stories is selected. | Its entries leave the sidebar and the manager shows no crash; a running test watcher does not try to load it. | pre-9 ; source: team practice | core.hmr.delete-file | Delete a stories file |
| HMR-7 | Change a component's markup or styles. | The story rerenders with the change; a running `play` function is aborted and restarts. | 9.1 ; CL: 9.1.0 | manual: bug bash or feature session | Edit a component |
| HMR-8 | Add a prop with a type to a component. | Controls and the Docs args table show the new prop without navigating away. | 11.0 ; M: `docgenServer` is stable and enabled by default | core.hmr.argtypes | Change a component's props |
| HMR-9 | Change `stories` globs or add an addon in `.storybook/main.*` and save. | The CLI says a restart is needed, or restarts; after a restart the change applies. | pre-9 ; source: team practice | manual: bug bash or feature session | Edit main |

## Controls

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| CTL-1 | Open a story with args and change a text, boolean, select and object control. | The story rerenders with each value. | pre-9 ; `docs/essentials/controls.mdx` | monorepo: `e2e-sandbox/addon-controls.spec.ts` | Changing a control rerenders |
| CTL-2 | Change several controls, then click **Reset controls**. | Every value and the story return to the story's args. | pre-9 ; `docs/essentials/controls.mdx` | manual: clicks in the manager or the test widget; e2e: `e2e-sandbox/addon-controls.spec.ts` | Reset |
| CTL-3 | Open `?path=/story/<id>&args=<name>:<value>`. | The control shows the value and the story renders with it. | pre-9 ; `docs/essentials/controls.mdx` | monorepo: `e2e-sandbox/addon-controls.spec.ts` | Args from the URL |
| CTL-4 | Change a control in dev. | A bar at the bottom of the panel offers **Update story** and **Create new story**. | pre-9 ; `docs/essentials/controls.mdx` | manual: clicks in the manager or the test widget; e2e: `e2e-tests/save-from-controls.spec.ts` | Save bar appears |
| CTL-5 | Click **Update story**. | The stories file changes only that story's args, the URL `args` are cleared (unless they equal the saved value), and the story renders. Run its `play` if it has one. | pre-9 ; `docs/essentials/controls.mdx` | manual: generated code that needs reading; e2e: `e2e-tests/save-from-controls.spec.ts` | Update story |
| CTL-6 | Click **Create new story**, give it a name, confirm. | A new export with that name and the args is added to the same file, appears in the sidebar and renders; a copied `play` that reads `args` still destructures them. | pre-9 ; `docs/essentials/controls.mdx` | manual: generated code that needs reading; e2e: `e2e-tests/save-from-controls.spec.ts` | Create new story |
| CTL-7 | Change a control on a CSF2 (function) story and try to save it as a new story. | The UI reports "Creating a new story based on a CSF2 story is not supported" and the file is unchanged. | pre-9 ; `code/core/src/core-server/utils/save-story/duplicate-story-with-new-name.ts` | manual: bug bash or feature session | CSF2 stories are refused clearly |
| CTL-8 | Set `parameters.controls.disableSaveFromUI: true` in preview. | The save bar does not appear. | pre-9 ; `docs/essentials/controls.mdx` | manual: clicks in the manager or the test widget | Saving can be turned off |
| CTL-9 | Define a toolbar with `globalTypes.locale` and `initialGlobals: { locale: 'en' }`. | The toolbar starts on `en`; a story that overrides the global disables the toolbar item. `globalTypes.<name>.defaultValue` has no effect. | 11.0 ; M: Toolbar `globalTypes` entries: index signature and `defaultValue` removed | manual: bug bash or feature session; e2e: `e2e-sandbox/addon-toolbars.spec.ts` | Toolbar globals start from `initialGlobals` |
| CTL-10 | Give an argType a `target` and read `args` in `render`. | `render` receives only untargeted args; the context has `allArgs` and `argsByTarget`. | 11.0 ; M: `argTypeTargetsV7` feature flag removed | manual: bug bash or feature session | Args grouped by target |

## Docs

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| DOC-1 | Open the Docs entry of a component tagged `autodocs`. | It renders the title, description, primary story, args table and the other stories, with no page errors. | 9.0 ; M: Documentation Generation Changes | core.docs-render | Autodocs page renders |
| DOC-2 | Open an `.mdx` docs entry that imports blocks from `@storybook/addon-docs/blocks`. | It renders; `@storybook/blocks` is not installed. | 9.0 ; M: Consolidate `@storybook/blocks` into addon docs | core.docs-render | MDX page renders |
| DOC-3 | With `@storybook/addon-docs` installed and no `codePanel` setting, open a story's addon panel. | A **Code** panel shows the story's source; `parameters.docs.codePanel: false` in preview hides it and `true` on one story shows it again. | 11.0 ; M: Docs Code panel enabled by default | manual: bug bash or feature session; e2e: `e2e-internal/story-docs.spec.ts` | Code panel is on by default |
| DOC-4 | On a docs page click **Show code** under a story. | The snippet is valid code for the story as authored. | pre-9 ; `docs/writing-docs/autodocs.mdx` | manual: generated code that needs reading; e2e: `e2e-sandbox/addon-docs.spec.ts` | Show code |
| DOC-5 | Change an arg in the docs args table, then look at **Show code** and the Code panel. | The story rerenders. In 11.0 a server-side snippet does not follow the arg change; this is a documented regression, not a failure. With `features.docgenServer: false` it follows. | 11.0 ; M: Temporary regressions on source snippet generation | manual: generated code that needs reading; e2e: `e2e-sandbox/addon-docs.spec.ts` | Snippets and args |
| DOC-6 | Open the args table of a component with union, function and documented props. | Types, defaults and descriptions match the component source. | 11.0 ; M: `docgenServer` is stable and enabled by default | manual: generated code that needs reading; e2e: `e2e-sandbox/framework-web-components.spec.ts` | Args table types |
| DOC-7 | Change a prop type in the component while the docs page is open. | The args table updates without navigation. | 11.0 ; M: `docgenServer` is stable and enabled by default | core.hmr.argtypes | Args table updates on HMR |
| DOC-8 | Start Storybook in a React project without `typescript` installed, then with it. | Without it the CLI warns and falls back to builder docgen; with TypeScript 5.9 or 6 there is no warning and Controls show the props. | 11.0 ; M: `docgenServer` is stable and enabled by default | manual: wording and whether a message helps | Docgen needs TypeScript |
| DOC-9 | Set `features.docgenServer: false` in main and start. | A deprecation warning prints; in React without `react-docgen` installed, the start fails with the install command for your package manager. | 11.0 ; M: Builder docgen is deprecated ; M: React: `react-docgen` and `react-docgen-typescript` are optional peer dependencies | manual: wording and whether a message helps | Builder docgen is deprecated |
| DOC-10 | `npx storybook dev --docs --ci --exact-port -p 6007` | Only docs entries show, without the toolbar, and they render. | pre-9 ; `docs/writing-docs/build-documentation.mdx` | manual: bug bash or feature session | Docs-only mode |
| DOC-11 | Set `parameters.docs.subtitle` on a meta and a JSDoc comment above a story. | The docs page shows the subtitle and the story description. | 11.0 ; M: `parameters.componentSubtitle` removed | manual: bug bash or feature session; e2e: `e2e-sandbox/addon-docs.spec.ts` | Subtitle and description |
| DOC-12 | On a docs page, switch background, grid and outline from the toolbar. | Each story block on the page follows the toolbar. | pre-9 ; `docs/essentials/backgrounds.mdx` | manual: visual layout and formatting; e2e: `e2e-sandbox/addon-backgrounds.spec.ts` | Toolbars in docs mode |

## Test widget

These rows need `@storybook/addon-vitest` registered in main and a Vitest project for Storybook.
Mark them `n/a` with the evidence when the project does not use the addon, and do not install it to fill the section.
If the addon is registered but cannot find its project, TW-1 fails and the rest are `blocked`.
Break one story on purpose when the suite is green, and restore it after.

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| TW-1 | Open the dev server, then the static build. | The testing widget is at the bottom of the sidebar in dev and absent in the static build. | 9.0 ; M: Experimental Test Addon: Stabilized and renamed | manual: clicks in the manager or the test widget; e2e: `e2e-tests/component-testing.spec.ts` | The widget shows in dev only |
| TW-2 | Click **Run tests** in the widget. | It runs, the counts of passed, failed and errored tests are right, and stories get status icons. | 9.0 ; M: Experimental Test Addon: Stabilized and renamed | manual: clicks in the manager or the test widget; e2e: `e2e-tests/component-testing.spec.ts` | Run all tests |
| TW-3 | Start a run and click the stop button. | The run stops and the widget leaves the running state. | 9.0 ; source: team practice | manual: clicks in the manager or the test widget | Stop a run |
| TW-4 | With one broken story, run all, then click the failure count. | The sidebar filters to failing stories; clicking a status opens that story's Interactions panel at the failure. | 9.0 ; CL: 9.0.0 | manual: clicks in the manager or the test widget | Failures and the error filter |
| TW-5 | From a row's context menu run tests for one story, one component and one group. | Only those tests run, their statuses update, and coverage is not collected for the focused run. | 9.0 ; CL: 9.0.0 | manual: clicks in the manager or the test widget; e2e: `e2e-tests/component-testing.spec.ts` | Focused runs |
| TW-6 | Open the context menu of a top-level group and run its tests. | Only that group's tests run. | 11.0 ; CL: 11.0.0-beta.0 | manual: clicks in the manager or the test widget | Run from the root menu |
| TW-7 | Turn on watch (the eye icon), then save a stories file, a component, the preview file and a file the component imports. | Each save reruns the affected tests; turning watch off stops it. | 9.0 ; CL: 9.0.0 | manual: clicks in the manager or the test widget; e2e: `e2e-tests/component-testing.spec.ts` | Watch mode |
| TW-8 | Enable coverage, run all, then open `/coverage/index.html`. | The widget shows the statement percentage, the report is served, and enabling watch disables coverage. Configured thresholds apply. Toggling coverage does not restart Vitest. | 9.0 ; CL: 9.0.0 ; CL: 11.0.0-alpha.7 ; `docs/writing-tests/test-coverage.mdx` | test.coverage-cli | Coverage |
| TW-9 | Make the Vitest setup throw, run all, click the error message. | A modal shows the error; **Rerun** starts a new run and **Troubleshoot** opens the docs for this Storybook version. | 9.0 ; CL: 9.0.0 | manual: wording and whether a message helps; e2e: `e2e-tests/component-testing.spec.ts` | Global error modal |
| TW-10 | After a run, click the clear button. | Test statuses go; change detection statuses stay. | 9.0 ; source: team practice | manual: clicks in the manager or the test widget | Clear statuses |
| TW-11 | With `@storybook/addon-a11y` registered, enable Accessibility in the widget and run. | Violations show as statuses and open the Accessibility panel. | 9.0 ; CL: 9.0.0 ; `docs/writing-tests/accessibility-testing.mdx` | manual: clicks in the manager or the test widget | Accessibility as a test type |
| TW-12 | With `@chromatic-com/storybook` installed, expand the widget. | A Visual tests entry shows and runs. The Visual Tests addon is 5.5.0 or newer. | 9.0 ; `docs/writing-tests/integrations/vitest-addon/index.mdx` ; source: team practice | manual: clicks in the manager or the test widget | Visual tests next to component tests |
| TW-13 | `npx vitest run --project storybook` | It runs the story tests, reports failures with a link to the story, and exits non-zero on a failure. | 9.0 ; `docs/writing-tests/integrations/vitest-addon/index.mdx` | test.vitest-cli | CLI run |
| TW-14 | `npx storybook add @storybook/addon-vitest` in a project on Vitest 4 with `test.workspace`. | Setup installs `@vitest/browser-playwright`, writes `test.projects`, writes no setup file and no `vitest.workspace.*`. On Vitest 3 the upgrade blocks with a named reason. | 11.0 ; CL: 10.3.0 ; M: Vitest Addon: requires Vitest 4.0 or higher | manual: bug bash or feature session | Vitest 4 and setup |
| TW-15 | Leave `setProjectAnnotations(...)` in the Vitest setup file and run the tests. | They fail with `SB_ADDON_VITEST_0002` and the message names the setup file. | 11.0 ; M: Vitest Addon: `setProjectAnnotations` must not be called in setup files | test.setup-annotations | Setup file guard |
| TW-16 | Run all tests with one failing. | The browser tab favicon reflects the result. | 9.1 ; CL: 9.1.0 | manual: clicks in the manager or the test widget | Favicon shows the run status |
| TW-17 | Give two Vitest projects `storybookTest({ initialGlobals: { theme: 'light' } })` and `'dark'`, and run both. | Each project renders every story with its own theme. | 10.5 ; CL: 10.5.0-alpha.11 ; `docs/writing-tests/integrations/vitest-addon/index.mdx` | manual: bug bash or feature session | Globals per Vitest project |

## Addons

Storybook 11 ships these addons from `code/addons/`: `@storybook/addon-a11y`, `@storybook/addon-docs`, `@storybook/addon-links`, `@storybook/addon-mcp`, `@storybook/addon-onboarding`, `@storybook/addon-themes`, `@storybook/addon-vitest` and `storybook-addon-pseudo-states`.
Actions, backgrounds, controls, highlight, interactions, measure, outline, toolbars and viewport are part of `storybook` itself since 9.0 and need no install.
`@storybook/addon-essentials`, `@storybook/addon-storysource`, `@storybook/addon-mdx-gfm`, `@storybook/blocks` and `@storybook/experimental-addon-test` are gone since 9.0; a project that still lists them is a migration gap, not an addon to test.

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| ADD-1 | Click a button whose handler is `fn()`. | The Actions panel logs the call with its arguments. | 9.0 ; M: Essentials Addon: Viewport, Controls, Interactions and Actions moved to core | manual: bug bash or feature session; e2e: `e2e-sandbox/addon-actions.spec.ts` | Actions |
| ADD-2 | Call a handler inferred from `actions.argTypesRegex` inside `render` or `play`. | It throws `ImplicitActionsDuringRendering`; `fn()` handlers work. | 11.0 ; M: `disallowImplicitActionsInRenderV8` feature flag removed | manual: bug bash or feature session | Implicit actions in render throw |
| ADD-3 | Open a story with a `play` function and use the step controls in the Interactions panel. | Steps are listed, you can step back and forward, and an unhandled error is shown. | 9.0 ; M: Essentials Addon: Viewport, Controls, Interactions and Actions moved to core | manual: clicks in the manager or the test widget; e2e: `e2e-sandbox/component-tests.spec.ts` | Interactions |
| ADD-4 | Pick a mobile viewport in the toolbar, rotate it, cycle with <kbd>alt+V</kbd> and reset with <kbd>alt+ctrl+V</kbd>; then set `initialGlobals: { viewport: { value: 'mobile1' } }` in preview. | The canvas resizes and rotates, the shortcuts work, the global sets the starting viewport, and `parameters.viewport.defaultViewport` has no effect. | 11.0 ; M: `viewport.defaultViewport` parameter and `responsiveViewport` removed | manual: visual layout and formatting; e2e: `e2e-sandbox/addon-viewport.spec.ts` | Viewport |
| ADD-5 | Pick a background and toggle the grid in story view. | The canvas background changes and the grid shows. | 9.0 ; M: Viewport/Backgrounds Addon synchronized configuration and `globals` usage | manual: visual layout and formatting; e2e: `e2e-sandbox/addon-backgrounds.spec.ts` | Backgrounds and grid |
| ADD-6 | Turn on Measure and hover elements in the canvas. | Margins, padding and size are drawn around the hovered element. | 9.0 ; `docs/essentials/measure-and-outline.mdx` | manual: motion, focus and keyboard feel | Measure |
| ADD-7 | Turn on Outline in story view and on a docs page. | Every element gets an outline in both views. | 9.0 ; `docs/essentials/measure-and-outline.mdx` | manual: motion, focus and keyboard feel | Outline |
| ADD-8 | Open the Accessibility panel on a story with a violation; click a violation, rerun, copy its link. | Violations are listed and highlighted in the canvas; rerun refreshes them; the copied link opens that violation. | 9.0 ; CL: 9.0.0 ; `docs/writing-tests/accessibility-testing.mdx` | manual: clicks in the manager or the test widget; e2e: `e2e-sandbox/addon-a11y.spec.ts` | Accessibility panel |
| ADD-9 | Set `parameters.a11y.context: '#root'` and `globals.a11y.manual: true` on a story. | The check is limited to the context, and manual mode waits for a click. | 9.0 ; M: A11y Addon: Replace `element` parameter with `context` parameter ; M: A11y Addon: Removed deprecated manual parameter | manual: bug bash or feature session | Accessibility parameters |
| ADD-10 | With `@storybook/addon-themes` and `withThemeByClassName`, switch themes from the toolbar in dev and in the static build. | The story's theme class changes in both. A decorator that used `useThemeParameters` must read `context.parameters.themes` instead. | 11.0 ; M: `useThemeParameters` removed | manual: bug bash or feature session | Themes |
| ADD-11 | Click a `linkTo('Example/Button', 'Primary')` element. | Storybook navigates to that story. | pre-9 ; `code/addons/links/README.md` | manual: bug bash or feature session | Links |
| ADD-12 | Toggle `:hover` in the pseudo-states toolbar, navigate to another story and back. | The hover style applies and the selection persists across navigation. | 9.0 ; CL: 9.0.0 ; `code/addons/pseudo-states/README.md` | manual: clicks in the manager or the test widget; e2e: `e2e-internal/addon-pseudo-states.spec.ts` | Pseudo-states |
| ADD-13 | In a fresh-init project, open `http://localhost:6006/?path=/onboarding`. | The guided tour starts and finishes without errors. | pre-9 ; `code/addons/onboarding/README.md` | manual: interactive prompts and tours; e2e: `e2e-sandbox/addon-onboarding.spec.ts` | Onboarding |
| ADD-14 | From an addon or `play`, emit `HIGHLIGHT` with `{ id: 'x', selectors: ['button'] }`, then without `id`. | The first outlines the buttons; the second is ignored with a console warning. | 11.0 ; M: Highlight: menu items emit a fixed `HIGHLIGHT_MENU_CLICK` event with a mandatory `id` | manual: bug bash or feature session | Highlight API |
| ADD-15 | Start a project with its community addons after the upgrade. | Each loads, or `MIGRATION.md` lists it as needing a release. | 11.0 ; M: Community packages that need a release | manual: bug bash or feature session | Third-party addons load |

## Frameworks and renderers

Run the rows for the frameworks the project uses and mark the rest `n/a`.

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| FW-1 | `npm ls react vite webpack next @angular/core svelte preact` | The project meets the floors: React 18, Vite 6.3, webpack 5.101, Next.js 15, Angular 21, Preact 10.9, Node 22.12, TypeScript 5.9. A lower version is a migration step, not a failure, when the guide says so. | 11.0 ; M: React: Require v18 and up ; M: Vite: requires Vite 6.3 or higher ; M: Webpack: requires webpack 5.101 or higher ; M: Next.js: Require v15 and up ; M: Angular: requires Angular 21 or higher ; M: Preact: Require v10.9.0 and up | manual: bug bash or feature session | Version floors |
| FW-2 | Run a `@storybook/nextjs-vite` project and open stories using `next/image`, `next/link` and `next/navigation`. | Images load, link clicks and router calls are logged as actions. | 9.0 ; M: Next.js: Vite builder stabilized | manual: bug bash or feature session; e2e: `e2e-sandbox/framework-nextjs.spec.ts` | Next.js Vite |
| FW-3 | In a `@storybook/nextjs` project, import `path` in a component and build. | The build fails with `Module not found` for `path`; adding `resolve.fallback` in `webpackFinal` fixes it. | 11.0 ; M: Next.js: most Node.js built-in polyfills removed from `@storybook/nextjs` | manual: bug bash or feature session | Next.js webpack polyfills |
| FW-4 | Run a React 19 project and use Controls on a story. | Stories render and rerender on a control change, with no React warnings in the console. | 11.0 ; M: React: Require v18 and up | manual: bug bash or feature session | React 19 |
| FW-5 | Start with `ng run <project>:storybook` from `angular.json`. | It starts, honours `"open"` and the builder options, and stories render. | 11.0 ; M: Angular: requires Angular 21 or higher | manual: bug bash or feature session | Angular through the builder |
| FW-6 | In `@storybook/angular-vite`, open Controls for a component with a `private` member, an `@internal` member and `model()` inputs. | Inputs and outputs show; private and `@internal` members do not (`propsTable: 'api'`). | 10.6 ; M: Angular Vite: a new `propsTable` framework option ; M: Angular Vite defaults to server-side docgen | manual: bug bash or feature session | Angular Vite docgen |
| FW-7 | Put `BrowserAnimationsModule` in a story's `moduleMetadata.imports`. | A deprecation warning is logged; `provideAnimations()` in `applicationConfig` works. | 11.0 ; M: `@storybook/angular-vite`: legacy animation modules are no longer auto-converted | manual: bug bash or feature session | Angular Vite animations |
| FW-8 | Open a Vue 3 story using a decorator that calls `updateArgs` and reads a global. | The decorator updates args and reacts to the global; the args table shows `defineModel` models and events. | 10.6 ; M: Vue 3: `vue-docgen-api` is deprecated | manual: bug bash or feature session; e2e: `e2e-sandbox/framework-vue3.spec.ts` | Vue 3 |
| FW-9 | Run a Svelte project whose stories use `defineMeta`, with `@storybook/addon-svelte-csf` removed from `addons`. | Stories index and render; a file using `<Meta>`, `<Template>` or `let:args` is reported, not silently dropped. | 11.0 ; M: Svelte CSF is built into the Svelte frameworks ; M: Svelte CSF: legacy story syntax removed | manual: bug bash or feature session; e2e: `e2e-sandbox/framework-svelte.spec.ts` | Svelte CSF without the addon |
| FW-10 | Open Controls and the Code panel for a Svelte 5 component with `Snippet`, callback and union props. | Snippets and callbacks have no control, unions get a select, and the Code panel starts with a `<script>` block. | 11.0 ; M: Svelte | manual: visual layout and formatting | Svelte Controls and snippets |
| FW-11 | Run a SvelteKit 3 project and open a story using `$app/state` and a file in `static/`. | Stories render, `goto` and links are logged as actions, and the static file is served at the root. | 11.0 ; M: SvelteKit: Require v3 and up | manual: bug bash or feature session; e2e: `e2e-sandbox/framework-svelte.spec.ts` | SvelteKit 3 |
| FW-12 | Open a Web Components story without `render` that sets a property, an attribute, `--css-var`, `<name>-event: fn()` and `default-slot`. | Each binds as documented, events log to Actions, and Controls group args by manifest category. | 11.0 ; M: Web Components: the default render binds args by key ; M: Web Components: server-side docgen suffixes event, slot and part argType keys | manual: bug bash or feature session; e2e: `e2e-sandbox/framework-web-components.spec.ts` | Web Components args |
| FW-13 | Remove `setCustomElementsManifest` from preview and set `framework.options.customElementsManifest`. | Controls and the args table still show the elements' API. | 11.0 ; M: Web Components: the runtime Custom Elements Manifest API is deprecated | manual: bug bash or feature session; e2e: `e2e-sandbox/framework-web-components.spec.ts` | Web Components manifest from config |
| FW-14 | Run a `@storybook/react-native-web-vite` project, then `npx vitest --project storybook`. | Stories render in the browser and the story tests pass. | 9.1 ; CL: 9.1.0 ; `docs/get-started/frameworks/react-native-web-vite.mdx` | manual: bug bash or feature session | React Native Web |
| FW-15 | In a project with `.rnstorybook/main.ts`, run the upgrade. | `addons` becomes `deviceAddons` and `storybook extract` succeeds. | 10.4 ; M: React Native: on-device addons moved to `deviceAddons` | manual: bug bash or feature session | React Native on device |
| FW-16 | Run a `@storybook/tanstack-react` project with `parameters.tanstack.router`. | Stories render inside the router without a hand-written decorator. | 10.4 ; M: TanStack Router projects: migrate from `@storybook/react-vite` to `@storybook/tanstack-react` | manual: bug bash or feature session | TanStack React |
| FW-17 | Register `sb.mock('../lib/session.ts')` in preview and open a story that uses it. | The story gets the mock; `mocked()` spies are reset between stories. | 9.1 ; CL: 9.1.0 ; `docs/writing-stories/mocking-data-and-modules/mocking-modules.mdx` | monorepo: `e2e-sandbox/sb-module-mocking.spec.ts` | Module mocking |
| FW-18 | Put `public/robots.txt` in a Vite project and build. | The file is served at the root of the build; `index.json` is Storybook's own. | 11.0 ; M: Vite: `publicDir` is handled by Storybook's `staticDirs` | manual: bug bash or feature session; e2e: `e2e-sandbox/static-dirs.spec.ts` | Vite `publicDir` |

## CSF Next

CSF Next (CSF factories) stories are written as `preview.meta({...})` and `meta.story({...})`; convert a project with `npx storybook automigrate csf-factories`.

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| CSF-1 | Run `npx storybook automigrate csf-factories` on a CSF 3 project in React, Vue, Angular or Web Components, then `tsc --noEmit` and start Storybook. | Stories are rewritten to `preview.meta` and `meta.story`, type-check, and render as before. | 10.0 ; CL: 10.0.0 ; CL: 10.2.0 | manual: generated code that needs reading | The codemod converts a project |
| CSF-2 | In a Svelte project, write stories with `definePreview` and `preview.meta()`. | They index, render and type-check. | 11.0 ; CL: 11.0.0-alpha.8 | manual: bug bash or feature session | Svelte factories |
| CSF-3 | Set `features.experimentalTestSyntax: true` and add `Story.test('submits', async ({ canvas }) => {...})`. | The test shows under its story in the sidebar and runs in the test widget. | 10.0 ; CL: 10.0.0-beta.7 ; `docs/api/main-config/main-config-features.mdx` | manual: bug bash or feature session | Test syntax |
| CSF-4 | `preview.meta({ component: Button, args: { variant: 'primary' } })` without `as const`, then `meta.story({ args: { label: 'Hi' } })`. | `tsc` passes and the story does not ask for `variant` again. | 11.0 ; M: CSF Next: meta args no longer need `as const` | manual: bug bash or feature session | Meta args keep literal types |
| CSF-5 | Add a key to `preview.meta({ args })` that is not a prop. | `tsc` reports it; declaring it with `preview.type<{ args: {...} }>()` fixes it. | 11.0 ; M: CSF Next: every key in meta args must be an arg | manual: bug bash or feature session | Unknown meta args are type errors |
| CSF-6 | Call `mocked(args.onSubmit).mockResolvedValue(...)` in `beforeEach`. | It type-checks; `args.onSubmit.mockResolvedValue` without `mocked()` is a type error. | 11.0 ; M: CSF Next: use `mocked()` for the mock API on args | manual: bug bash or feature session | `mocked()` on args |
| CSF-7 | Read `argTypes` from the `play` context. | It throws an error that links to the migration guide. | 11.0 ; M: `argTypes` removed from loaders, `beforeEach`, `play` and `afterEach` | manual: bug bash or feature session | `argTypes` gone from `play` |
| CSF-8 | Index a story file with `export default { 'title': 'X' }` and one with a Flow-only annotation. | The quoted key sets the title to `X`; the Flow file fails with a parse error that names Flow. | 11.0 ; M: Behavior that changes for every project | manual: bug bash or feature session | ESTree indexing |
| CSF-9 | Keep `Basic.story = { name: 'foo' }` in a CSF2 file, then run `npx storybook migrate csf-2-to-3`. | The annotation has no effect; the codemod lifts it into a CSF 3 story. | 11.0 ; M: CSF `.story` annotations removed | manual: bug bash or feature session | `.story` annotations are ignored |
| CSF-10 | Enable `plugin:storybook/recommended` and lint a story with a dynamic `title`. | `storybook/static-csf-properties` reports it; a config naming `meta-inline-properties` fails to load. | 11.0 ; M: ESLint plugin: `meta-inline-properties` replaced by `static-csf-properties` | manual: bug bash or feature session | ESLint rule |

## Skills and AGENTS.md

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| AI-1 | Upgrade a supported project outside CI and read the output. | It prints and runs `npx skills@latest add storybookjs/skills#v<version> --yes --agent claude-code universal --copy`, and `skills-lock.json` lists the Storybook skills. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | upgrade.skills | Skills are installed on upgrade |
| AI-2 | Read `AGENTS.md` after the upgrade, with and without an existing `AGENTS.md`. | A section between `<!-- BEGIN:storybook-skills -->` and `<!-- END:storybook-skills -->` names `ui-workflow` and `component-docs`; an existing file keeps its content. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | upgrade.agents-md | AGENTS.md section |
| AI-3 | Upgrade once with a `CLAUDE.md` that does not import `AGENTS.md`, once without any. | The first gets the section; no `CLAUDE.md` is created in the second. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | upgrade.agents-md | CLAUDE.md is extended, never created |
| AI-4 | Delete the section's markers or the whole section and upgrade again. | The section is not added back. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | manual: bug bash or feature session | Opting out sticks |
| AI-5 | Upgrade offline. | A warning says the skills could not be installed and how to install them later; the upgrade finishes. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | manual: wording and whether a message helps | Install failure does not stop the upgrade |
| AI-6 | `npx storybook skills ui-workflow`, `npx storybook skills component-docs`, `npx storybook skills stories`, `npx storybook skills setup` | The first two and `setup` print instructions; `stories` exits 1. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | manual: bug bash or feature session | Skills CLI |
| AI-7 | `npx storybook tools --help`, then `npx storybook tools stories changed` with dev running. | It lists the tools, and the second attaches to the running Storybook. | 11.0 ; M: `storybook ai` command removed | manual: bug bash or feature session; e2e: `e2e-internal/tools-attach.spec.ts` | Tools CLI |

## MCP addon

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| MCP-1 | `npx storybook add @storybook/addon-mcp`, start dev, open `http://localhost:6006/mcp` in a browser. | The page lists the enabled toolsets and links to the manifest debugger. | 10.3 ; CL: 10.3.0 ; `docs/ai/mcp/overview.mdx` | monorepo: `e2e-sandbox/addon-mcp.spec.ts` | Info page |
| MCP-2 | Connect an MCP client and list tools. | The tools are named `stories-preview`, `stories-changed`, `stories-find-by-component`, `review-create`, `test-run`, `docs-list`, `docs-show`, `docs-show-story` and `get-storybook-story-instructions`. | 10.6 ; M: MCP tool names follow toolset.method | manual: bug bash or feature session; e2e: `e2e-sandbox/addon-mcp.spec.ts` | Tool names |
| MCP-3 | In a React, Vue 3 Vite or Angular Vite project, without setting `features.componentsManifest`, call `docs-list` and `docs-show` for one component. | The manifest is on by default, so it lists the components and returns props and example stories. | 11.0 ; CL: 11.0.0-alpha.2 ; `docs/api/main-config/main-config-features.mdx` | core.components-manifest | Docs toolset without config |
| MCP-4 | Open `http://localhost:6006/manifests/components.html`. | It lists the components and docs pages, and the error and warning filters work. | 10.1 ; CL: 10.1.0-alpha.2 ; `docs/ai/manifests.mdx` | core.components-manifest | Manifest debugger |
| MCP-5 | Ask an agent to call `review-create`, then open the review from the sidebar widget. | The review page shows the summary and its story collections. | 11.0 ; M: `experimentalReview` feature flag removed ; `docs/ai/agentic-review.mdx` | manual: bug bash or feature session | Review |
| MCP-6 | Build, serve the output, and query the hosted manifests as the sharing page describes. | The manifests in the build match the dev server's. | 10.x ; `docs/ai/mcp/sharing.mdx` | manual: bug bash or feature session; e2e: `e2e-sandbox/addon-mcp.spec.ts` | Static build serves MCP data |

## Telemetry

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| TEL-1 | `STORYBOOK_TELEMETRY_DEBUG=1 npx storybook dev` | Each event (`boot`, `dev`, and in-app events) is printed as JSON, with no environment variables, paths or other sensitive data. | pre-9 ; `docs/configure/telemetry.mdx` | manual: sensitive data in telemetry | See what is sent |
| TEL-2 | Start with `--disable-telemetry`, then with `core.disableTelemetry: true`, then with `STORYBOOK_DISABLE_TELEMETRY=1`. | With `STORYBOOK_TELEMETRY_DEBUG=1`, only `boot` prints for the flag and the config option, and nothing prints with the environment variable. | pre-9 ; `docs/configure/telemetry.mdx` | manual: bug bash or feature session | Opt out |
| TEL-3 | With debug on, run `upgrade`, `automigrate`, `add`, `doctor` and `build`. | Each prints its event. | pre-9 ; `docs/configure/telemetry.mdx` | manual: bug bash or feature session | Commands report |
| TEL-4 | With debug on, save a story from Controls, open in editor, run tests from the widget, filter the sidebar. | `save-story`, `open-in-editor`, `test-run` and `sidebar-filter` events print. A new 11.0 feature that has no event is worth a question to its owner. | pre-9 ; `code/core/src/telemetry/types.ts` | manual: sensitive data in telemetry | New UI features report |

## Build and static serve

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| BLD-1 | `npx storybook build -o storybook-static` | It exits 0 and the output has `index.html`, `iframe.html` and `index.json`. | pre-9 ; `docs/sharing/publish-storybook.mdx` | build.static | Build succeeds |
| BLD-2 | `npx http-server ./storybook-static --port 6008`, then open a story and a docs page. | `index.json` ids match dev, stories and docs render, and there is no testing widget or save bar. | pre-9 ; source: team practice | build.static | Static build serves and renders |
| BLD-3 | Add a `staticDirs` entry and reference a file from a story. | The file is served at its configured path in dev and in the build. | pre-9 ; `docs/api/main-config/main-config-static-dirs.mdx` | monorepo: `e2e-sandbox/static-dirs.spec.ts` | Static dirs |
| BLD-4 | `npx storybook build --docs` and serve it. | Only docs pages are in the build, and they render. | pre-9 ; `docs/writing-docs/build-documentation.mdx` | manual: no monorepo test yet | Docs build |
| BLD-5 | `npx storybook build --test` | It succeeds and stories render. | pre-9 ; `docs/api/main-config/main-config-build.mdx` | monorepo: `lib/cli-storybook/src/sandbox-templates.ts`, the bench test-build sandboxes | Test build |
| BLD-6 | `npx storybook build --stats-json` in a Vite project. | `preview-stats.json` contains virtual and proxy modules. | 11.0 ; M: Vite: `preview-stats.json` contains the full bundler graph | manual: bug bash or feature session | Stats output |
| BLD-7 | Embed a story from the served build in an `<iframe>` on another origin. | It renders; only the dev server restricts embedding. | 11.0 ; M: `storybook dev` now blocks remote iframe embedding | manual: bug bash or feature session | Embedding a build |

## Portable stories and the test runner

| Row | Probe | Pass when | Since | Agent | Check |
| ------ | ----- | --------- | ----- | ----- | ----- |
| PS-1 | In a plain Vitest test, `composeStories` a stories file and render one story. | The story renders with its args and project annotations. | pre-9 ; `docs/api/portable-stories/portable-stories-vitest.mdx` | manual: bug bash or feature session | Portable stories in Vitest |
| PS-2 | Use `fn()`, `expect` and `userEvent` from `storybook/test` in a `play` function. | They work; a mock called with `new` needs a `function` or `class` implementation. | 11.0 ; M: `storybook/test` is based on Vitest 5 and no longer installs its test libraries | manual: bug bash or feature session; e2e: `e2e-sandbox/component-tests.spec.ts` | `storybook/test` APIs |
| PS-3 | Import `@testing-library/dom` directly in a story without adding it to `package.json`. | It fails to resolve; adding it to `devDependencies` fixes it. | 11.0 ; M: `storybook/test` is based on Vitest 5 and no longer installs its test libraries | test.test-libraries | Test libraries are not installed for you |
| PS-4 | Run `@storybook/test-runner` against the upgraded Storybook. | It still runs, and prints a warning on every run that it is no longer supported. | 11.0 ; M: Test runner support ended | test.test-runner | Test runner end of support |

## Sources

Every version claim above traces to one of these files.

- `MIGRATION.md`: "From version 10.x to 11.0.0", "From version 10.6.1 to 10.6.2", "From version 10.5.x to 10.6.0", "From version 10.4.0 to 10.5.0", "From version 10.3.0 to 10.4.0", "From version 9.x to 10.0.0" and "From version 8.x to 9.0.0".
- `CHANGELOG.md`: the headings `9.0.0`, `9.1.0`, `10.0.0` to `10.6.0`.
- `CHANGELOG.prerelease.md`: the 11.0 prerelease headings up to `11.0.0-beta.0`, and the 10.x prerelease headings cited where a feature has no line in its minor release.
- `docs/`: the pages named in the Since column.
- `code/addons/*/README.md` and `code/addons/*/package.json` for the addon list.
- `code/lib/cli-storybook/src/automigrate/fixes/` for the automigration ids and messages, and `code/lib/cli-storybook/src/bin/run.ts` for the CLI commands and options.
- `code/core/src/telemetry/types.ts` for the telemetry event names.
- `code/e2e-sandbox/`, `code/e2e-internal/` and `test-storybooks/portable-stories-kitchen-sink/react/e2e-tests/` for the `monorepo:` and `e2e:` notes in the Agent column.
