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
- **E2E** names the Playwright spec that automates all or part of the row, relative to `code/` (or to `test-storybooks/portable-stories-kitchen-sink/react/` for `e2e-tests/`).
  `e2e-sandbox/` specs run against generated sandboxes; `e2e-internal/` specs run only against the monorepo's own Storybook, so they do not prove the behaviour in a user project.
- **Agent** is the check id when the QA agent runs the row today, `planned: <id>` when it is queued for the registry, or `manual: <reason>` when a person has to judge it, because the pass condition is motion, wording, layout or a click the agent cannot drive.
  `none` means only a person covers the row; spend your time there first.

## CLI

### Create

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| CLI-1  | Create in an empty directory | In an empty directory run `npm create storybook@<version>` and answer the prompts. | It asks for a framework, installs, writes `.storybook/` and example stories, and `npm run storybook` starts. | pre-9 ; `docs/get-started/install.mdx` | none | manual: interactive prompts and tours |
| CLI-2  | Create in an existing project | Run `npm create storybook@<version>` in a framework scaffold (for example `npm create vite@latest`). | It detects the framework without asking, installs, and the example stories render. | pre-9 ; `docs/get-started/install.mdx` | none | manual: interactive prompts and tours |
| CLI-3  | Recommended and minimal setups | Run create twice, once choosing **Recommended** and once **Minimal**; then once with `--features docs test a11y`. | Recommended and `--features docs test a11y` install `@storybook/addon-docs`, `@storybook/addon-vitest` and `@storybook/addon-a11y`; Minimal installs none of them. | 9.0 ; CL: 9.0.0 ; `docs/get-started/install.mdx` | none | manual: interactive prompts and tours |
| CLI-4  | JavaScript init uses JSDoc types | Create in a React JavaScript project; open the generated `Button.jsx` and its Docs args table. | The component uses JSDoc types, `prop-types` is not installed, and the args table shows the prop types and descriptions. | 11.0 ; M: JavaScript init templates use JSDoc types instead of `propTypes` | none | manual: bug bash or feature session |
| CLI-5  | Create React App goes to Vite | Run create in a Create React App project. | It sets up `@storybook/react-vite`, or asks you to choose Vite, Webpack 5 or Rsbuild when it cannot detect a builder. | 11.0 ; M: Create React App support removed | none | manual: bug bash or feature session |
| CLI-6  | Yarn PnP points at the linker setting | Run create in a Yarn Berry project with the PnP linker. | PnP is unsupported in 11, so the run either works after you set `nodeLinker: node-modules`, or fails with an error that points at PnP. An error that does not lead to the linker setting is a missing pointer. | 11.0 ; M: Yarn PnP support removed | none | manual: wording and whether a message helps |
| CLI-7  | No browser opens after create | Finish create and let it start Storybook. | Storybook prints its URL and does not open a browser tab. | 11.0 ; M: `storybook dev` no longer opens a browser by default | none | manual: interactive prompts and tours |

### Upgrade

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| CLI-8  | The upgrade command completes | From the Storybook directory run `npx storybook@<version> upgrade` and save the output. In a monorepo, wait for the dedupe step after "Dependencies installed". | It exits 0 and prints a summary of upgraded packages and automigrations. | pre-9 ; `docs/releases/upgrading.mdx` | none | upgrade.command |
| CLI-9  | The installed version is the target | `node -p "require('storybook/package.json').version"` | It prints `<version>`. Every `@storybook/*` package in every `package.json` is on the same version. | pre-9 ; `docs/releases/upgrading.mdx` | none | upgrade.installed-version |
| CLI-10 | Community packages are bumped where compatible | Diff every changed `package.json`. | Non-Storybook packages the upgrade bumped (for example `@chromatic-com/storybook`, `msw-storybook-addon`) are on a release that supports 11; no package is left on a Storybook 10 peer. | 11.0 ; M: `@storybook/react-dom-shim` removed | none | planned: upgrade.community-packages |
| CLI-11 | Old major is blocked with a pointer | Run the upgrade on a Storybook 9 project. | It stops with "Major Version Gap Detected", suggests `npx storybook@10 upgrade`, and links the 10 migration guide. | 11.0 ; M: Automigrations for Storybook 10 and earlier removed | none | manual: wording and whether a message helps |
| CLI-12 | Node version gate | Run the upgrade on Node 22.11 or 20. | It stops with "Node.js 22.12 or higher required", names the detected version, and links the migration section. | 11.0 ; M: Node.js 22.12 or higher | none | manual: wording and whether a message helps |
| CLI-13 | React 16/17 and `legacyRootApi` are blocked | Run the upgrade with `react@17`, then with `framework.options.legacyRootApi` set in main. | Both block the upgrade with a link to the migration section. | 11.0 ; M: React: Require v18 and up | none | manual: wording and whether a message helps |
| CLI-14 | Create React App preset is blocked | Run the upgrade with `@storybook/preset-create-react-app` installed. | The upgrade stops and says why. | 11.0 ; M: Create React App support removed | none | manual: wording and whether a message helps |
| CLI-15 | TypeScript is added where missing | Upgrade a React, Vue 3, Svelte or Web Components project that has no `typescript` dependency. | The `typescript-dependency` automigration offers `typescript@^6` and adds it to `devDependencies`. | 11.0 ; M: TypeScript 5.9 or newer | none | planned: upgrade.typescript |
| CLI-16 | Deprecated frameworks are announced | Upgrade a `@storybook/nextjs` project. | The upgrade lists `@storybook/nextjs` as deprecated and offers `nextjs-to-nextjs-vite`; every later `storybook dev` logs a deprecation warning. | 11.0 ; M: Next.js: `@storybook/nextjs` is deprecated | none | manual: wording and whether a message helps |
| CLI-17 | Migration notes cover the rest | Read the "From version 10.x to 11.0.0" section of `MIGRATION.md`, apply each step that applies to the project, and start Storybook. | Storybook starts; every manual step you needed is in the guide. A needed step the guide does not mention is a failure. | 11.0 ; M: From version 10.x to 11.0.0 | none | upgrade.automigrations |

### Automigrations

Run `npx storybook automigrate --list` to see the ids, and `npx storybook automigrate <id>` to rerun one.
For every automigration the upgrade ran, read the `git diff` of each file it changed, and check that its message names a link that resolves (a link that prints `undefined` is a failure).
The rows below are the 11.0 automigrations a typical project triggers; mark the others `n/a` with the reason the CLI printed.

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| AM-1   | Detection matches the project | Compare the automigrations the upgrade listed as detected with the project's config. | Each one that ran applies to the project, and none that applies was skipped without a reason. | pre-9 ; `ecosystem-qa/prompts/upgrade.md` | none | upgrade.automigrations |
| AM-2   | `docgen-server` | Upgrade a project with `features.experimentalDocgenServer` in main. | The key is renamed to `features.docgenServer`. | 11.0 ; M: `docgenServer` is stable and enabled by default | none | manual: bug bash or feature session |
| AM-3   | `story-sort-to-main` | Upgrade a project with `parameters.options.storySort` in `.storybook/preview.*`. | A static `storySort` moves to `storySorts` in main and the sidebar order is unchanged; a comparator function gets manual instructions. | 11.0 ; M: `storySort` in the preview replaced by `storySorts` in main | none | manual: generated code that needs reading |
| AM-4   | `set-config-layout` | Upgrade a project with `addons.setConfig({ showNav, panelPosition, enableShortcuts })` in `.storybook/manager.*`. | The options move under `layout` and `ui`, and the layout looks the same as before. | 11.0 ; M: Top-level `setConfig` layout and UI options removed | none | manual: generated code that needs reading |
| AM-5   | `tag-filter-api` and `sidebar-filters` | Upgrade a project that uses `experimental_setFilter`, `excludeFromSidebar` or `sidebar.filters`. | Tag options are renamed to `hideFromSidebar` and `hideFromAutodocs`, `experimental_setFilter` to `setFilter`; `sidebar.filters` gets a notice and is not rewritten. | 11.0 ; M: Tag filtering API | none | manual: bug bash or feature session |
| AM-6   | `component-subtitle` and `argtypes-default-value` | Upgrade a project with `parameters.componentSubtitle` or `argTypes.<name>.defaultValue`. | `componentSubtitle` becomes `parameters.docs.subtitle`; `argTypes` `defaultValue` is deleted; files it could not edit are listed in `automigrations-summary.md`. | 11.0 ; M: `parameters.componentSubtitle` removed ; M: `argTypes` `defaultValue` removed | none | manual: bug bash or feature session |
| AM-7   | Feature flag removals | Upgrade a project with `features.experimentalReview`, `features.changeDetection`, `features.argTypeTargetsV7` or `features.disallowImplicitActionsInRenderV8`. | `remove-experimental-review`, `remove-change-detection-flag` and `remove-legacy-feature-flags` delete each flag whether it was `true` or `false`. | 11.0 ; M: `experimentalReview` feature flag removed ; M: `changeDetection` feature flag removed ; M: `argTypeTargetsV7` feature flag removed | none | manual: bug bash or feature session |
| AM-8   | `vitest-setup-file` | Upgrade a project whose Vitest setup file calls `setProjectAnnotations`. | The call is removed, an empty setup file and its `setupFiles` entry are deleted, and custom annotations get per-file instructions. | 11.0 ; M: Vitest Addon: `setProjectAnnotations` must not be called in setup files | none | planned: test.setup-annotations |
| AM-9   | `csf-next-mocked-args` | Upgrade a CSF Next project that calls `args.<fn>.mockResolvedValue(...)`. | The call becomes `mocked(args.<fn>).mockResolvedValue(...)` with `mocked` imported from `storybook/test`, and `tsc` passes. | 11.0 ; M: CSF Next: use `mocked()` for the mock API on args | none | manual: bug bash or feature session |
| AM-10  | Framework switches | Upgrade a `@storybook/nextjs`, `@storybook/angular` or TanStack Router `@storybook/react-vite` project and accept the offer. | `nextjs-to-nextjs-vite`, `angular-to-angular-vite` or `react-vite-to-tanstack-react` swaps the package, the `framework` field and the imports, and Storybook starts. | 11.0 ; M: Test runner support ended ; M: TanStack Router projects: migrate from `@storybook/react-vite` to `@storybook/tanstack-react` | none | manual: bug bash or feature session |
| AM-11  | Framework-specific clean-ups | Upgrade an Angular Vite project with Compodoc, a Svelte project with `@storybook/addon-svelte-csf`, or a Web Components project calling `setCustomElementsManifest`. | `angular-vite-remove-compodoc`, `addon-svelte-csf-to-core` or `web-components-runtime-manifest` removes the old setup, and Controls still show the component's props. | 10.6 ; M: Angular Vite defaults to server-side docgen ; M: Svelte CSF is built into the Svelte frameworks ; M: Web Components: the runtime Custom Elements Manifest API is deprecated | none | manual: bug bash or feature session |
| AM-12  | `skills` | Upgrade a supported project (React, Svelte, Web Components, Vue 3 Vite or Angular Vite) outside CI. | It installs the Storybook skills and adds the marked Storybook section to `AGENTS.md`; see [Skills and AGENTS.md](#skills-and-agentsmd). | 11.0 ; M: `stories` skill renamed to `ui-workflow` | none | planned: upgrade.skills |

### doctor and info

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| CLI-18 | doctor describes the project | Run `npx storybook@<version> doctor` after the upgrade. | Its findings match the project. "Looks good" on a project where a Storybook package is still on 10, is duplicated, or cannot load is a failure. | pre-9 ; `docs/api/cli-options.mdx` | none | upgrade.doctor |
| CLI-19 | doctor catches a broken setup | Pin one `@storybook/*` package to a 10.x version and run doctor. | doctor reports the mismatched version and how to fix it. | pre-9 ; `docs/api/cli-options.mdx` | none | manual: bug bash or feature session |
| CLI-20 | index without a server | `npx storybook index` | It writes an `index.json` with the same entries as the dev server's, without starting one. | 9.0 ; CL: 9.0.0 | none | planned: upgrade.index-cli |
| CLI-21 | info prints the environment | Run `npx storybook@<version> info`. | It prints OS, Node, the package manager and the installed Storybook packages with their versions. | pre-9 ; `docs/api/cli-options.mdx` | none | manual: bug bash or feature session |

### add and remove

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| CLI-22 | add registers an addon | `npx storybook add @storybook/addon-a11y` | The package is installed, `addons` in main lists it, its postinstall runs, and its panel shows after a restart. | pre-9 ; `docs/api/cli-options.mdx` | none | manual: bug bash or feature session |
| CLI-23 | remove unregisters an addon | `npx storybook remove @storybook/addon-a11y` | The package is uninstalled, `addons` in main no longer lists it, and Storybook starts. | pre-9 ; `docs/api/cli-options.mdx` | none | manual: bug bash or feature session |
| CLI-24 | add and remove refuse an unsafe edit | Make `addons` in main come from a spread (`{ addons: [...], ...shared }`) and run `add`, then `remove`. | `add` installs and stops with a message instead of editing main; `remove` uninstalls and warns that the addon is still listed. | 11.0 ; M: `storybook add` and `storybook remove` leave an `addons` they cannot edit safely | none | manual: wording and whether a message helps |

### Removed commands and flags

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| CLI-25 | `storybook ai` points at its replacement | `npx storybook ai setup` | It exits 1 and says to run `npx storybook skills setup` and `npx storybook tools` instead. | 11.0 ; M: `storybook ai` command removed | none | planned: upgrade.removed-commands |
| CLI-26 | Removed dev flags fail clearly | `npx storybook dev --preview-url http://localhost:1234` and `--force-build-preview` | Neither points Storybook at an external preview: the command is rejected, or it starts and loads its own `iframe.html`. | 11.0 ; M: `--preview-url` and `--force-build-preview` removed | none | planned: upgrade.removed-commands |
| CLI-27 | Removed automigrate options fail clearly | `npx storybook automigrate --renderer react` and `npx storybook automigrate remove-essentials` | `--renderer` fails as an unknown option, and the removed id is not found. | 11.0 ; M: Automigrations for Storybook 10 and earlier removed | none | planned: upgrade.removed-commands |

## Dev server and manager

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| MGR-1  | The dev server starts and indexes | `npm run storybook -- --ci --exact-port -p 6006`, then `curl -m 5 http://localhost:6006/index.json`. | It starts without errors and `index.json` lists this project's entries; the count matches the baseline. | pre-9 ; `docs/api/cli-options.mdx` | `e2e-sandbox/json-files.spec.ts` | core.dev-server |
| MGR-2  | No browser opens by default | `npx storybook dev`, then `npx storybook dev --open`. For Angular, start through the `start-storybook` builder with and without `"open": true`. | The first prints the URL and opens nothing; `--open` and `"open": true` open a tab. | 11.0 ; M: `storybook dev` no longer opens a browser by default | none | manual: bug bash or feature session |
| MGR-3  | A story renders | Open the first story. | It renders without page errors in the browser console. | pre-9 ; `docs/get-started/browse-stories.mdx` | `e2e-internal/internal-storybook.smoke.spec.ts` | core.story-render |
| MGR-4  | Sidebar navigation | Expand and collapse groups and components, select stories and docs entries, use the browser back button. | The selection, the URL and the canvas stay in sync; no entry is missing compared with the baseline. | pre-9 ; `docs/get-started/browse-stories.mdx` | `e2e-internal/navigation.spec.ts` | manual: bug bash or feature session |
| MGR-5  | Sidebar keyboard navigation | Focus the tree and use the arrow keys, Left and Right to collapse and expand, Home, End and Enter. Scroll a long tree. | Focus moves row by row with a visible focus ring, a focused row stays visible below the sticky parent rows, and Enter selects it. | 11.0 ; CL: 11.0.0-alpha.7 ; M: Sidebar rewrite: manager API changes | `e2e-internal/sidebar-scrolling.spec.ts` | manual: motion, focus and keyboard feel |
| MGR-6  | Expand and collapse all | Open the context menu of a top-level group. | It offers expand all and collapse all, and both act on that subtree only. | 11.0 ; CL: 11.0.0-beta.0 | none | manual: motion, focus and keyboard feel |
| MGR-7  | Focus regions | Press <kbd>F6</kbd> repeatedly, then <kbd>shift+F6</kbd>. | Focus cycles through the sidebar, toolbar, preview and addon panel, and back. | 11.0 ; CL: 11.0.0-alpha.5 | none | manual: motion, focus and keyboard feel |
| MGR-8  | Row context menu | Hover a story row, open its context menu with the button, then focus a row and press <kbd>ctrl/⌘+shift+U</kbd>. | Both open the actions menu with "Open in editor" and "Copy story name". | 11.0 ; M: Sidebar rewrite: manager API changes | `e2e-sandbox/manager.spec.ts` | manual: clicks in the manager or the test widget |
| MGR-9  | Standalone docs pages | With an MDX file that has `<Meta title="Introduction" />` and no stories, look at the sidebar and search for "Introduction". | The page is one entry named "Introduction", not a component with a "Docs" child; search lists it by its own name. | 11.0 ; M: Sidebar: standalone docs pages are no longer wrapped in a component | `e2e-internal/navigation.spec.ts` | manual: bug bash or feature session |
| MGR-10 | Sidebar search | Type part of a component name, then a docs heading, into the search field. | Matching entries are listed; a docs subheading result navigates to that anchor. | pre-9 ; `docs/get-started/browse-stories.mdx` | `e2e-internal/navigation.spec.ts` | manual: bug bash or feature session |
| MGR-11 | Tag filter include and exclude | Open the filter menu next to search, include one tag, then exclude another. | Only stories with the included tag and without the excluded tag remain; search results respect the filter; clearing the filter restores the list. | 10.0 ; CL: 10.0.0-beta.1 ; `docs/writing-stories/tags.mdx` | `e2e-sandbox/tags.spec.ts` | manual: clicks in the manager or the test widget |
| MGR-12 | Tag filter survives reload and URL | Set a filter, reload, then paste the URL into a new tab. | The filter is still set in both, and the first story selected is one the filter shows. | 10.4 ; CL: 10.3.0 ; CL: 10.4.0 | none | manual: clicks in the manager or the test widget |
| MGR-13 | Tag options in main | Set `tags: { internal: { hideFromSidebar: true } }` in main, then `hideFromFilterPanel: true` on another tag. | Stories tagged `internal` are gone and clearing filters does not bring them back; the second tag is missing from the menu but its stories stay visible. | 11.0 ; M: Tag filtering API | none | manual: bug bash or feature session |
| MGR-14 | Built-in tags | Tag one story `!dev` and one `!autodocs`. | The first is missing from the sidebar, the second from the docs page. | 9.0 ; CL: 9.0.0 ; `docs/writing-stories/tags.mdx` | `e2e-sandbox/tags.spec.ts` | manual: bug bash or feature session |
| MGR-15 | Story order from main | Set `storySorts: [{ order: ['Introduction', 'Components'] }]` in main and restart. | The sidebar follows that order; `parameters.options.storySort` in preview no longer has an effect. | 11.0 ; M: `storySort` in the preview replaced by `storySorts` in main | none | manual: bug bash or feature session |
| MGR-16 | Layout shortcuts | Press <kbd>alt+S</kbd>, <kbd>alt+T</kbd>, <kbd>alt+A</kbd> and <kbd>alt+F</kbd>, then open the shortcuts page from the settings menu. | They toggle the sidebar, toolbar, panel and fullscreen; the shortcuts page lists them and has no Escape entry. | 11.0 ; M: Escape is no longer a configurable shortcut | `e2e-sandbox/manager.spec.ts` | manual: motion, focus and keyboard feel |
| MGR-17 | Escape in fullscreen | Enter fullscreen, open a toolbar menu, press Escape, then press Escape again. | The first Escape closes only the menu; the second leaves fullscreen. | 11.0 ; M: Escape is no longer a configurable shortcut | none | manual: motion, focus and keyboard feel |
| MGR-18 | Previous and next component | Use the menu entries **Previous component or page** and **Next component or page** and their shortcuts. | Selection jumps between components and standalone docs pages. | 11.0 ; M: Sidebar: standalone docs pages are no longer wrapped in a component | none | manual: motion, focus and keyboard feel |
| MGR-19 | Panel position and toggles | Move the addon panel to the right and back, resize it, reload. | The panel follows, keeps its size after reload, and is hidden in docs view. | pre-9 ; `docs/configure/user-interface/features-and-behavior.mdx` | `e2e-sandbox/manager.spec.ts` | manual: visual layout and formatting |
| MGR-20 | Mobile layout | Open the manager at 375 px wide; navigate to a story and open the addon panel. | The bottom bar shows the current entry, navigation works, the panel opens and closes. | pre-9 ; `docs/configure/user-interface/features-and-behavior.mdx` | `e2e-sandbox/manager.spec.ts` | manual: visual layout and formatting |
| MGR-21 | No create-story button | Look next to the sidebar search field in a React project. | There is no "Create new story" button; saving from Controls still works ([CTL-4](#controls)). | 11.0 ; M: 'Create new story' UI feature removed | none | manual: bug bash or feature session |
| MGR-22 | Change detection statuses | In a git repo, add an untracked story file and edit a tracked one while dev runs, without the `changeDetection` flag. | The new story shows the "new" status, the edited one "modified", and a **Review** button above the tree filters to both. | 11.0 ; CL: 10.4.0-alpha.8 ; M: `changeDetection` feature flag removed ; `docs/configure/user-interface/change-detection.mdx` | `e2e-sandbox/change-detection.spec.ts` | manual: clicks in the manager or the test widget |
| MGR-23 | Open in editor | From a story row's context menu choose **Open in editor**. | The story file opens in your editor. | 10.0 ; CL: 10.0.0 | `e2e-sandbox/manager.spec.ts` | manual: clicks in the manager or the test widget |
| MGR-24 | Open in isolation | Select a story and press <kbd>alt+shift+I</kbd>. | The story opens in a new tab at its `iframe.html` URL. | 10.2 ; CL: 10.2.0-alpha.12 | none | manual: clicks in the manager or the test widget |
| MGR-25 | Zoom | Use the zoom tool, the <kbd>+</kbd> and <kbd>-</kbd> keys and a typed value. | The canvas scales to the value, and the reset button shows only when the zoom is not 100%. | 10.2 ; CL: 10.2.0-alpha.15 | none | manual: motion, focus and keyboard feel |
| MGR-26 | Share tool | With `@chromatic-com/storybook` installed, click **Share** in the toolbar. | The menu offers "Publish a build to share" and, once published, a link to copy. | 10.4 ; CL: 10.4.0-alpha.18 ; `docs/sharing/index.mdx` | none | manual: clicks in the manager or the test widget |
| MGR-27 | Onboarding checklist | In a fresh-init project, open the checklist from the sidebar widget and the Storybook menu; then set `features.sidebarOnboardingChecklist: false`. | Items complete when you do the action they describe; the flag hides the widget. | 10.1 ; CL: 10.1.0 ; `docs/api/main-config/main-config-features.mdx` | none | manual: interactive prompts and tours |
| MGR-28 | Smoke test | `npx storybook dev --smoke-test --ci` | It starts, then exits 0. | pre-9 ; `docs/api/cli-options.mdx` | none | planned: core.smoke-test |
| MGR-29 | Composition | Add a `refs` entry pointing at a published Storybook and restart. | The ref's stories appear in the sidebar under its title, render, and filter with search. | pre-9 ; `docs/sharing/storybook-composition.mdx` | `e2e-tests/composition.spec.ts` | manual: bug bash or feature session |
| MGR-30 | Remote embedding is blocked by default | `curl -sI http://localhost:6006/ \| grep -i content-security-policy`, then embed the dev URL in an `<iframe>` on a page served from a LAN IP. | The header contains `frame-ancestors`; the LAN page shows an empty frame with a `frame-ancestors` console error; a `localhost` page embeds fine; `security.insecureRemoteIframeEmbed: true` lifts it. | 11.0 ; M: `storybook dev` now blocks remote iframe embedding | `e2e-internal/internal-storybook.smoke.spec.ts` | planned: core.frame-ancestors |
| MGR-31 | Iframe messaging is restricted | Compose a live dev Storybook from a non-localhost origin, then a built one. | The live dev ref does not load without `security.insecureIframeMessaging` and `security.insecureRemoteIframeEmbed`; the built ref loads. | 11.0 ; M: Storybook now restricts iframe messaging | `e2e-internal/iframe-messaging.spec.ts` | manual: bug bash or feature session |
| MGR-32 | Old browsers | Open the manager in a browser below Chrome 147, Edge 150, Firefox 152 or Safari 26.5; then build with `--preview-only` and open `/iframe.html?navigator=true`. | The supported floors work; the preview-only build renders stories in the older browser. | 11.0 ; M: Raised browser support floors | none | manual: visual layout and formatting |
| MGR-33 | Settings and About pages | Open the settings menu, then the About and keyboard shortcuts pages. | Both open, the About page shows the installed version, and the close button returns to the story. | pre-9 ; `docs/configure/user-interface/features-and-behavior.mdx` | `e2e-sandbox/manager.spec.ts` | manual: visual layout and formatting |

## HMR

Run these while the dev server runs, one at a time, and restore the file from the upgrade commit after each.
Poll `index.json` for sidebar changes so a slow rebuild is not mistaken for a failure; give up after 60 seconds.

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| HMR-1  | Edit a story | Change an arg value in a stories file and save. | The canvas updates without a full page reload, and the Controls panel shows the new value. | pre-9 ; source: team practice | none | manual: bug bash or feature session |
| HMR-2  | Edit the preview file | Add a decorator or a global parameter in `.storybook/preview.*` and save. | Every story picks it up without restarting the server. | pre-9 ; source: team practice | `e2e-sandbox/storybook-hooks.spec.ts` | planned: core.hmr.preview-file |
| HMR-3  | Add a story to a file | Add a new named export to an existing stories file. | The new story appears in the sidebar and renders. | pre-9 ; source: team practice | none | core.hmr.stories-file |
| HMR-4  | Rename a story | Rename an export, or its `name`, in an existing stories file. | The sidebar shows the new name, the old entry is gone, and the selected story still renders. | pre-9 ; source: team practice | none | planned: core.hmr.rename-story |
| HMR-5  | Add a stories file | Create a new `*.stories.*` file matched by `stories` in main. | Its component appears in the sidebar and renders, with no error overlay. | pre-9 ; source: team practice | none | planned: core.hmr.new-file |
| HMR-6  | Delete a stories file | Delete a stories file while one of its stories is selected. | Its entries leave the sidebar and the manager shows no crash; a running test watcher does not try to load it. | pre-9 ; source: team practice | none | planned: core.hmr.delete-file |
| HMR-7  | Edit a component | Change a component's markup or styles. | The story rerenders with the change; a running `play` function is aborted and restarts. | 9.1 ; CL: 9.1.0 | none | manual: bug bash or feature session |
| HMR-8  | Change a component's props | Add a prop with a type to a component. | Controls and the Docs args table show the new prop without navigating away. | 11.0 ; M: `docgenServer` is stable and enabled by default | `e2e-sandbox/docgen-hot-update.spec.ts` | planned: core.hmr.argtypes |
| HMR-9  | Edit main | Change `stories` globs or add an addon in `.storybook/main.*` and save. | The CLI says a restart is needed, or restarts; after a restart the change applies. | pre-9 ; source: team practice | none | manual: bug bash or feature session |

## Controls

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| CTL-1  | Changing a control rerenders | Open a story with args and change a text, boolean, select and object control. | The story rerenders with each value. | pre-9 ; `docs/essentials/controls.mdx` | `e2e-sandbox/addon-controls.spec.ts` | core.controls |
| CTL-2  | Reset | Change several controls, then click **Reset controls**. | Every value and the story return to the story's args. | pre-9 ; `docs/essentials/controls.mdx` | `e2e-sandbox/addon-controls.spec.ts` | manual: clicks in the manager or the test widget |
| CTL-3  | Args from the URL | Open `?path=/story/<id>&args=<name>:<value>`. | The control shows the value and the story renders with it. | pre-9 ; `docs/essentials/controls.mdx` | `e2e-sandbox/addon-controls.spec.ts` | core.controls |
| CTL-4  | Save bar appears | Change a control in dev. | A bar at the bottom of the panel offers **Update story** and **Create new story**. | pre-9 ; `docs/essentials/controls.mdx` | `e2e-tests/save-from-controls.spec.ts` | manual: clicks in the manager or the test widget |
| CTL-5  | Update story | Click **Update story**. | The stories file changes only that story's args, the URL `args` are cleared (unless they equal the saved value), and the story renders. Run its `play` if it has one. | pre-9 ; `docs/essentials/controls.mdx` | `e2e-tests/save-from-controls.spec.ts` | manual: generated code that needs reading |
| CTL-6  | Create new story | Click **Create new story**, give it a name, confirm. | A new export with that name and the args is added to the same file, appears in the sidebar and renders; a copied `play` that reads `args` still destructures them. | pre-9 ; `docs/essentials/controls.mdx` | `e2e-tests/save-from-controls.spec.ts` | manual: generated code that needs reading |
| CTL-7  | CSF2 stories are refused clearly | Change a control on a CSF2 (function) story and try to save it as a new story. | The UI reports "Creating a new story based on a CSF2 story is not supported" and the file is unchanged. | pre-9 ; `code/core/src/core-server/utils/save-story/duplicate-story-with-new-name.ts` | none | manual: bug bash or feature session |
| CTL-8  | Saving can be turned off | Set `parameters.controls.disableSaveFromUI: true` in preview. | The save bar does not appear. | pre-9 ; `docs/essentials/controls.mdx` | none | manual: clicks in the manager or the test widget |
| CTL-9  | Toolbar globals start from `initialGlobals` | Define a toolbar with `globalTypes.locale` and `initialGlobals: { locale: 'en' }`. | The toolbar starts on `en`; a story that overrides the global disables the toolbar item. `globalTypes.<name>.defaultValue` has no effect. | 11.0 ; M: Toolbar `globalTypes` entries: index signature and `defaultValue` removed | `e2e-sandbox/addon-toolbars.spec.ts` | manual: bug bash or feature session |
| CTL-10 | Args grouped by target | Give an argType a `target` and read `args` in `render`. | `render` receives only untargeted args; the context has `allArgs` and `argsByTarget`. | 11.0 ; M: `argTypeTargetsV7` feature flag removed | none | manual: bug bash or feature session |

## Docs

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| DOC-1  | Autodocs page renders | Open the Docs entry of a component tagged `autodocs`. | It renders the title, description, primary story, args table and the other stories, with no page errors. | 9.0 ; M: Documentation Generation Changes | `e2e-sandbox/addon-docs.spec.ts` | core.docs-render |
| DOC-2  | MDX page renders | Open an `.mdx` docs entry that imports blocks from `@storybook/addon-docs/blocks`. | It renders; `@storybook/blocks` is not installed. | 9.0 ; M: Consolidate `@storybook/blocks` into addon docs | `e2e-sandbox/addon-docs.spec.ts` | core.docs-render |
| DOC-3  | Code panel is on by default | With `@storybook/addon-docs` installed and no `codePanel` setting, open a story's addon panel. | A **Code** panel shows the story's source; `parameters.docs.codePanel: false` in preview hides it and `true` on one story shows it again. | 11.0 ; M: Docs Code panel enabled by default | `e2e-internal/story-docs.spec.ts` | manual: bug bash or feature session |
| DOC-4  | Show code | On a docs page click **Show code** under a story. | The snippet is valid code for the story as authored. | pre-9 ; `docs/writing-docs/autodocs.mdx` | `e2e-sandbox/addon-docs.spec.ts` | manual: generated code that needs reading |
| DOC-5  | Snippets and args | Change an arg in the docs args table, then look at **Show code** and the Code panel. | The story rerenders. In 11.0 a server-side snippet does not follow the arg change; this is a documented regression, not a failure. With `features.docgenServer: false` it follows. | 11.0 ; M: Temporary regressions on source snippet generation | `e2e-sandbox/addon-docs.spec.ts` | manual: generated code that needs reading |
| DOC-6  | Args table types | Open the args table of a component with union, function and documented props. | Types, defaults and descriptions match the component source. | 11.0 ; M: `docgenServer` is stable and enabled by default | `e2e-sandbox/framework-web-components.spec.ts` | manual: generated code that needs reading |
| DOC-7  | Args table updates on HMR | Change a prop type in the component while the docs page is open. | The args table updates without navigation. | 11.0 ; M: `docgenServer` is stable and enabled by default | `e2e-sandbox/docgen-hot-update.spec.ts` | planned: core.hmr.argtypes |
| DOC-8  | Docgen needs TypeScript | Start Storybook in a React project without `typescript` installed, then with it. | Without it the CLI warns and falls back to builder docgen; with TypeScript 5.9 or 6 there is no warning and Controls show the props. | 11.0 ; M: `docgenServer` is stable and enabled by default | none | manual: wording and whether a message helps |
| DOC-9  | Builder docgen is deprecated | Set `features.docgenServer: false` in main and start. | A deprecation warning prints; in React without `react-docgen` installed, the start fails with the install command for your package manager. | 11.0 ; M: Builder docgen is deprecated ; M: React: `react-docgen` and `react-docgen-typescript` are optional peer dependencies | none | manual: wording and whether a message helps |
| DOC-10 | Docs-only mode | `npx storybook dev --docs --ci --exact-port -p 6007` | Only docs entries show, without the toolbar, and they render. | pre-9 ; `docs/writing-docs/build-documentation.mdx` | none | manual: bug bash or feature session |
| DOC-11 | Subtitle and description | Set `parameters.docs.subtitle` on a meta and a JSDoc comment above a story. | The docs page shows the subtitle and the story description. | 11.0 ; M: `parameters.componentSubtitle` removed | `e2e-sandbox/addon-docs.spec.ts` | manual: bug bash or feature session |
| DOC-12 | Toolbars in docs mode | On a docs page, switch background, grid and outline from the toolbar. | Each story block on the page follows the toolbar. | pre-9 ; `docs/essentials/backgrounds.mdx` | `e2e-sandbox/addon-backgrounds.spec.ts` | manual: visual layout and formatting |

## Test widget

These rows need `@storybook/addon-vitest` registered in main and a Vitest project for Storybook.
Mark them `n/a` with the evidence when the project does not use the addon, and do not install it to fill the section.
If the addon is registered but cannot find its project, TW-1 fails and the rest are `blocked`.
Break one story on purpose when the suite is green, and restore it after.

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| TW-1   | The widget shows in dev only | Open the dev server, then the static build. | The testing widget is at the bottom of the sidebar in dev and absent in the static build. | 9.0 ; M: Experimental Test Addon: Stabilized and renamed | `e2e-tests/component-testing.spec.ts` | manual: clicks in the manager or the test widget |
| TW-2   | Run all tests | Click **Run tests** in the widget. | It runs, the counts of passed, failed and errored tests are right, and stories get status icons. | 9.0 ; M: Experimental Test Addon: Stabilized and renamed | `e2e-tests/component-testing.spec.ts` | manual: clicks in the manager or the test widget |
| TW-3   | Stop a run | Start a run and click the stop button. | The run stops and the widget leaves the running state. | 9.0 ; source: team practice | none | manual: clicks in the manager or the test widget |
| TW-4   | Failures and the error filter | With one broken story, run all, then click the failure count. | The sidebar filters to failing stories; clicking a status opens that story's Interactions panel at the failure. | 9.0 ; CL: 9.0.0 | none | manual: clicks in the manager or the test widget |
| TW-5   | Focused runs | From a row's context menu run tests for one story, one component and one group. | Only those tests run, their statuses update, and coverage is not collected for the focused run. | 9.0 ; CL: 9.0.0 | `e2e-tests/component-testing.spec.ts` | manual: clicks in the manager or the test widget |
| TW-6   | Run from the root menu | Open the context menu of a top-level group and run its tests. | Only that group's tests run. | 11.0 ; CL: 11.0.0-beta.0 | none | manual: clicks in the manager or the test widget |
| TW-7   | Watch mode | Turn on watch (the eye icon), then save a stories file, a component, the preview file and a file the component imports. | Each save reruns the affected tests; turning watch off stops it. | 9.0 ; CL: 9.0.0 | `e2e-tests/component-testing.spec.ts` | manual: clicks in the manager or the test widget |
| TW-8   | Coverage | Enable coverage, run all, then open `/coverage/index.html`. | The widget shows the statement percentage, the report is served, and enabling watch disables coverage. Configured thresholds apply. Toggling coverage does not restart Vitest. | 9.0 ; CL: 9.0.0 ; CL: 11.0.0-alpha.7 ; `docs/writing-tests/test-coverage.mdx` | `e2e-tests/component-testing.spec.ts` | planned: test.coverage-cli |
| TW-9   | Global error modal | Make the Vitest setup throw, run all, click the error message. | A modal shows the error; **Rerun** starts a new run and **Troubleshoot** opens the docs for this Storybook version. | 9.0 ; CL: 9.0.0 | `e2e-tests/component-testing.spec.ts` | manual: wording and whether a message helps |
| TW-10  | Clear statuses | After a run, click the clear button. | Test statuses go; change detection statuses stay. | 9.0 ; source: team practice | none | manual: clicks in the manager or the test widget |
| TW-11  | Accessibility as a test type | With `@storybook/addon-a11y` registered, enable Accessibility in the widget and run. | Violations show as statuses and open the Accessibility panel. | 9.0 ; CL: 9.0.0 ; `docs/writing-tests/accessibility-testing.mdx` | none | manual: clicks in the manager or the test widget |
| TW-12  | Visual tests next to component tests | With `@chromatic-com/storybook` installed, expand the widget. | A Visual tests entry shows and runs. The Visual Tests addon is 5.5.0 or newer. | 9.0 ; `docs/writing-tests/integrations/vitest-addon/index.mdx` ; source: team practice | none | manual: clicks in the manager or the test widget |
| TW-13  | CLI run | `npx vitest run --project storybook` | It runs the story tests, reports failures with a link to the story, and exits non-zero on a failure. | 9.0 ; `docs/writing-tests/integrations/vitest-addon/index.mdx` | none | test.vitest-cli |
| TW-14  | Vitest 4 and setup | `npx storybook add @storybook/addon-vitest` in a project on Vitest 4 with `test.workspace`. | Setup installs `@vitest/browser-playwright`, writes `test.projects`, writes no setup file and no `vitest.workspace.*`. On Vitest 3 the upgrade blocks with a named reason. | 11.0 ; CL: 10.3.0 ; M: Vitest Addon: requires Vitest 4.0 or higher | none | manual: bug bash or feature session |
| TW-15  | Setup file guard | Leave `setProjectAnnotations(...)` in the Vitest setup file and run the tests. | They fail with `SB_ADDON_VITEST_0002` and the message names the setup file. | 11.0 ; M: Vitest Addon: `setProjectAnnotations` must not be called in setup files | none | planned: test.setup-annotations |
| TW-16  | Favicon shows the run status | Run all tests with one failing. | The browser tab favicon reflects the result. | 9.1 ; CL: 9.1.0 | none | manual: clicks in the manager or the test widget |
| TW-17  | Globals per Vitest project | Give two Vitest projects `storybookTest({ initialGlobals: { theme: 'light' } })` and `'dark'`, and run both. | Each project renders every story with its own theme. | 10.5 ; CL: 10.5.0-alpha.11 ; `docs/writing-tests/integrations/vitest-addon/index.mdx` | none | manual: bug bash or feature session |

## Addons

Storybook 11 ships these addons from `code/addons/`: `@storybook/addon-a11y`, `@storybook/addon-docs`, `@storybook/addon-links`, `@storybook/addon-mcp`, `@storybook/addon-onboarding`, `@storybook/addon-themes`, `@storybook/addon-vitest` and `storybook-addon-pseudo-states`.
Actions, backgrounds, controls, highlight, interactions, measure, outline, toolbars and viewport are part of `storybook` itself since 9.0 and need no install.
`@storybook/addon-essentials`, `@storybook/addon-storysource`, `@storybook/addon-mdx-gfm`, `@storybook/blocks` and `@storybook/experimental-addon-test` are gone since 9.0; a project that still lists them is a migration gap, not an addon to test.

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| ADD-1  | Actions | Click a button whose handler is `fn()`. | The Actions panel logs the call with its arguments. | 9.0 ; M: Essentials Addon: Viewport, Controls, Interactions and Actions moved to core | `e2e-sandbox/addon-actions.spec.ts` | manual: bug bash or feature session |
| ADD-2  | Implicit actions in render throw | Call a handler inferred from `actions.argTypesRegex` inside `render` or `play`. | It throws `ImplicitActionsDuringRendering`; `fn()` handlers work. | 11.0 ; M: `disallowImplicitActionsInRenderV8` feature flag removed | none | manual: bug bash or feature session |
| ADD-3  | Interactions | Open a story with a `play` function and use the step controls in the Interactions panel. | Steps are listed, you can step back and forward, and an unhandled error is shown. | 9.0 ; M: Essentials Addon: Viewport, Controls, Interactions and Actions moved to core | `e2e-sandbox/component-tests.spec.ts` | manual: clicks in the manager or the test widget |
| ADD-4  | Viewport | Pick a mobile viewport in the toolbar, rotate it, cycle with <kbd>alt+V</kbd> and reset with <kbd>alt+ctrl+V</kbd>; then set `initialGlobals: { viewport: { value: 'mobile1' } }` in preview. | The canvas resizes and rotates, the shortcuts work, the global sets the starting viewport, and `parameters.viewport.defaultViewport` has no effect. | 11.0 ; M: `viewport.defaultViewport` parameter and `responsiveViewport` removed | `e2e-sandbox/addon-viewport.spec.ts` | manual: visual layout and formatting |
| ADD-5  | Backgrounds and grid | Pick a background and toggle the grid in story view. | The canvas background changes and the grid shows. | 9.0 ; M: Viewport/Backgrounds Addon synchronized configuration and `globals` usage | `e2e-sandbox/addon-backgrounds.spec.ts` | manual: visual layout and formatting |
| ADD-6  | Measure | Turn on Measure and hover elements in the canvas. | Margins, padding and size are drawn around the hovered element. | 9.0 ; `docs/essentials/measure-and-outline.mdx` | none | manual: motion, focus and keyboard feel |
| ADD-7  | Outline | Turn on Outline in story view and on a docs page. | Every element gets an outline in both views. | 9.0 ; `docs/essentials/measure-and-outline.mdx` | none | manual: motion, focus and keyboard feel |
| ADD-8  | Accessibility panel | Open the Accessibility panel on a story with a violation; click a violation, rerun, copy its link. | Violations are listed and highlighted in the canvas; rerun refreshes them; the copied link opens that violation. | 9.0 ; CL: 9.0.0 ; `docs/writing-tests/accessibility-testing.mdx` | `e2e-sandbox/addon-a11y.spec.ts` | manual: clicks in the manager or the test widget |
| ADD-9  | Accessibility parameters | Set `parameters.a11y.context: '#root'` and `globals.a11y.manual: true` on a story. | The check is limited to the context, and manual mode waits for a click. | 9.0 ; M: A11y Addon: Replace `element` parameter with `context` parameter ; M: A11y Addon: Removed deprecated manual parameter | none | manual: bug bash or feature session |
| ADD-10 | Themes | With `@storybook/addon-themes` and `withThemeByClassName`, switch themes from the toolbar in dev and in the static build. | The story's theme class changes in both. A decorator that used `useThemeParameters` must read `context.parameters.themes` instead. | 11.0 ; M: `useThemeParameters` removed | none | manual: bug bash or feature session |
| ADD-11 | Links | Click a `linkTo('Example/Button', 'Primary')` element. | Storybook navigates to that story. | pre-9 ; `code/addons/links/README.md` | none | manual: bug bash or feature session |
| ADD-12 | Pseudo-states | Toggle `:hover` in the pseudo-states toolbar, navigate to another story and back. | The hover style applies and the selection persists across navigation. | 9.0 ; CL: 9.0.0 ; `code/addons/pseudo-states/README.md` | `e2e-internal/addon-pseudo-states.spec.ts` | manual: clicks in the manager or the test widget |
| ADD-13 | Onboarding | In a fresh-init project, open `http://localhost:6006/?path=/onboarding`. | The guided tour starts and finishes without errors. | pre-9 ; `code/addons/onboarding/README.md` | `e2e-sandbox/addon-onboarding.spec.ts` | manual: interactive prompts and tours |
| ADD-14 | Highlight API | From an addon or `play`, emit `HIGHLIGHT` with `{ id: 'x', selectors: ['button'] }`, then without `id`. | The first outlines the buttons; the second is ignored with a console warning. | 11.0 ; M: Highlight: menu items emit a fixed `HIGHLIGHT_MENU_CLICK` event with a mandatory `id` | none | manual: bug bash or feature session |
| ADD-15 | Third-party addons load | Start a project with its community addons after the upgrade. | Each loads, or `MIGRATION.md` lists it as needing a release. | 11.0 ; M: Community packages that need a release | none | manual: bug bash or feature session |

## Frameworks and renderers

Run the rows for the frameworks the project uses and mark the rest `n/a`.

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| FW-1   | Version floors | `npm ls react vite webpack next @angular/core svelte preact` | The project meets the floors: React 18, Vite 6.3, webpack 5.101, Next.js 15, Angular 21, Preact 10.9, Node 22.12, TypeScript 5.9. A lower version is a migration step, not a failure, when the guide says so. | 11.0 ; M: React: Require v18 and up ; M: Vite: requires Vite 6.3 or higher ; M: Webpack: requires webpack 5.101 or higher ; M: Next.js: Require v15 and up ; M: Angular: requires Angular 21 or higher ; M: Preact: Require v10.9.0 and up | none | manual: bug bash or feature session |
| FW-2   | Next.js Vite | Run a `@storybook/nextjs-vite` project and open stories using `next/image`, `next/link` and `next/navigation`. | Images load, link clicks and router calls are logged as actions. | 9.0 ; M: Next.js: Vite builder stabilized | `e2e-sandbox/framework-nextjs.spec.ts` | manual: bug bash or feature session |
| FW-3   | Next.js webpack polyfills | In a `@storybook/nextjs` project, import `path` in a component and build. | The build fails with `Module not found` for `path`; adding `resolve.fallback` in `webpackFinal` fixes it. | 11.0 ; M: Next.js: most Node.js built-in polyfills removed from `@storybook/nextjs` | none | manual: bug bash or feature session |
| FW-4   | React 19 | Run a React 19 project and use Controls on a story. | Stories render and rerender on a control change, with no React warnings in the console. | 11.0 ; M: React: Require v18 and up | none | manual: bug bash or feature session |
| FW-5   | Angular through the builder | Start with `ng run <project>:storybook` from `angular.json`. | It starts, honours `"open"` and the builder options, and stories render. | 11.0 ; M: Angular: requires Angular 21 or higher | none | manual: bug bash or feature session |
| FW-6   | Angular Vite docgen | In `@storybook/angular-vite`, open Controls for a component with a `private` member, an `@internal` member and `model()` inputs. | Inputs and outputs show; private and `@internal` members do not (`propsTable: 'api'`). | 10.6 ; M: Angular Vite: a new `propsTable` framework option ; M: Angular Vite defaults to server-side docgen | none | manual: bug bash or feature session |
| FW-7   | Angular Vite animations | Put `BrowserAnimationsModule` in a story's `moduleMetadata.imports`. | A deprecation warning is logged; `provideAnimations()` in `applicationConfig` works. | 11.0 ; M: `@storybook/angular-vite`: legacy animation modules are no longer auto-converted | none | manual: bug bash or feature session |
| FW-8   | Vue 3 | Open a Vue 3 story using a decorator that calls `updateArgs` and reads a global. | The decorator updates args and reacts to the global; the args table shows `defineModel` models and events. | 10.6 ; M: Vue 3: `vue-docgen-api` is deprecated | `e2e-sandbox/framework-vue3.spec.ts` | manual: bug bash or feature session |
| FW-9   | Svelte CSF without the addon | Run a Svelte project whose stories use `defineMeta`, with `@storybook/addon-svelte-csf` removed from `addons`. | Stories index and render; a file using `<Meta>`, `<Template>` or `let:args` is reported, not silently dropped. | 11.0 ; M: Svelte CSF is built into the Svelte frameworks ; M: Svelte CSF: legacy story syntax removed | `e2e-sandbox/framework-svelte.spec.ts` | manual: bug bash or feature session |
| FW-10  | Svelte Controls and snippets | Open Controls and the Code panel for a Svelte 5 component with `Snippet`, callback and union props. | Snippets and callbacks have no control, unions get a select, and the Code panel starts with a `<script>` block. | 11.0 ; M: Svelte | none | manual: visual layout and formatting |
| FW-11  | SvelteKit 3 | Run a SvelteKit 3 project and open a story using `$app/state` and a file in `static/`. | Stories render, `goto` and links are logged as actions, and the static file is served at the root. | 11.0 ; M: SvelteKit: Require v3 and up | `e2e-sandbox/framework-svelte.spec.ts` | manual: bug bash or feature session |
| FW-12  | Web Components args | Open a Web Components story without `render` that sets a property, an attribute, `--css-var`, `<name>-event: fn()` and `default-slot`. | Each binds as documented, events log to Actions, and Controls group args by manifest category. | 11.0 ; M: Web Components: the default render binds args by key ; M: Web Components: server-side docgen suffixes event, slot and part argType keys | `e2e-sandbox/framework-web-components.spec.ts` | manual: bug bash or feature session |
| FW-13  | Web Components manifest from config | Remove `setCustomElementsManifest` from preview and set `framework.options.customElementsManifest`. | Controls and the args table still show the elements' API. | 11.0 ; M: Web Components: the runtime Custom Elements Manifest API is deprecated | `e2e-sandbox/framework-web-components.spec.ts` | manual: bug bash or feature session |
| FW-14  | React Native Web | Run a `@storybook/react-native-web-vite` project, then `npx vitest --project storybook`. | Stories render in the browser and the story tests pass. | 9.1 ; CL: 9.1.0 ; `docs/get-started/frameworks/react-native-web-vite.mdx` | none | manual: bug bash or feature session |
| FW-15  | React Native on device | In a project with `.rnstorybook/main.ts`, run the upgrade. | `addons` becomes `deviceAddons` and `storybook extract` succeeds. | 10.4 ; M: React Native: on-device addons moved to `deviceAddons` | none | manual: bug bash or feature session |
| FW-16  | TanStack React | Run a `@storybook/tanstack-react` project with `parameters.tanstack.router`. | Stories render inside the router without a hand-written decorator. | 10.4 ; M: TanStack Router projects: migrate from `@storybook/react-vite` to `@storybook/tanstack-react` | none | manual: bug bash or feature session |
| FW-17  | Module mocking | Register `sb.mock('../lib/session.ts')` in preview and open a story that uses it. | The story gets the mock; `mocked()` spies are reset between stories. | 9.1 ; CL: 9.1.0 ; `docs/writing-stories/mocking-data-and-modules/mocking-modules.mdx` | `e2e-sandbox/sb-module-mocking.spec.ts` | planned: core.module-mocking |
| FW-18  | Vite `publicDir` | Put `public/robots.txt` in a Vite project and build. | The file is served at the root of the build; `index.json` is Storybook's own. | 11.0 ; M: Vite: `publicDir` is handled by Storybook's `staticDirs` | `e2e-sandbox/static-dirs.spec.ts` | manual: bug bash or feature session |

## CSF Next

CSF Next (CSF factories) stories are written as `preview.meta({...})` and `meta.story({...})`; convert a project with `npx storybook automigrate csf-factories`.

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| CSF-1  | The codemod converts a project | Run `npx storybook automigrate csf-factories` on a CSF 3 project in React, Vue, Angular or Web Components, then `tsc --noEmit` and start Storybook. | Stories are rewritten to `preview.meta` and `meta.story`, type-check, and render as before. | 10.0 ; CL: 10.0.0 ; CL: 10.2.0 | none | manual: generated code that needs reading |
| CSF-2  | Svelte factories | In a Svelte project, write stories with `definePreview` and `preview.meta()`. | They index, render and type-check. | 11.0 ; CL: 11.0.0-alpha.8 | none | manual: bug bash or feature session |
| CSF-3  | Test syntax | Set `features.experimentalTestSyntax: true` and add `Story.test('submits', async ({ canvas }) => {...})`. | The test shows under its story in the sidebar and runs in the test widget. | 10.0 ; CL: 10.0.0-beta.7 ; `docs/api/main-config/main-config-features.mdx` | none | manual: bug bash or feature session |
| CSF-4  | Meta args keep literal types | `preview.meta({ component: Button, args: { variant: 'primary' } })` without `as const`, then `meta.story({ args: { label: 'Hi' } })`. | `tsc` passes and the story does not ask for `variant` again. | 11.0 ; M: CSF Next: meta args no longer need `as const` | none | manual: bug bash or feature session |
| CSF-5  | Unknown meta args are type errors | Add a key to `preview.meta({ args })` that is not a prop. | `tsc` reports it; declaring it with `preview.type<{ args: {...} }>()` fixes it. | 11.0 ; M: CSF Next: every key in meta args must be an arg | none | manual: bug bash or feature session |
| CSF-6  | `mocked()` on args | Call `mocked(args.onSubmit).mockResolvedValue(...)` in `beforeEach`. | It type-checks; `args.onSubmit.mockResolvedValue` without `mocked()` is a type error. | 11.0 ; M: CSF Next: use `mocked()` for the mock API on args | none | manual: bug bash or feature session |
| CSF-7  | `argTypes` gone from `play` | Read `argTypes` from the `play` context. | It throws an error that links to the migration guide. | 11.0 ; M: `argTypes` removed from loaders, `beforeEach`, `play` and `afterEach` | none | manual: bug bash or feature session |
| CSF-8  | ESTree indexing | Index a story file with `export default { 'title': 'X' }` and one with a Flow-only annotation. | The quoted key sets the title to `X`; the Flow file fails with a parse error that names Flow. | 11.0 ; M: Behavior that changes for every project | none | manual: bug bash or feature session |
| CSF-9  | `.story` annotations are ignored | Keep `Basic.story = { name: 'foo' }` in a CSF2 file, then run `npx storybook migrate csf-2-to-3`. | The annotation has no effect; the codemod lifts it into a CSF 3 story. | 11.0 ; M: CSF `.story` annotations removed | none | manual: bug bash or feature session |
| CSF-10 | ESLint rule | Enable `plugin:storybook/recommended` and lint a story with a dynamic `title`. | `storybook/static-csf-properties` reports it; a config naming `meta-inline-properties` fails to load. | 11.0 ; M: ESLint plugin: `meta-inline-properties` replaced by `static-csf-properties` | none | manual: bug bash or feature session |

## Skills and AGENTS.md

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| AI-1   | Skills are installed on upgrade | Upgrade a supported project outside CI and read the output. | It prints and runs `npx skills@latest add storybookjs/skills#v<version> --yes --agent claude-code universal --copy`, and `skills-lock.json` lists the Storybook skills. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | none | planned: upgrade.skills |
| AI-2   | AGENTS.md section | Read `AGENTS.md` after the upgrade, with and without an existing `AGENTS.md`. | A section between `<!-- BEGIN:storybook-skills -->` and `<!-- END:storybook-skills -->` names `ui-workflow` and `component-docs`; an existing file keeps its content. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | none | planned: upgrade.agents-md |
| AI-3   | CLAUDE.md is extended, never created | Upgrade once with a `CLAUDE.md` that does not import `AGENTS.md`, once without any. | The first gets the section; no `CLAUDE.md` is created in the second. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | none | planned: upgrade.agents-md |
| AI-4   | Opting out sticks | Delete the section's markers or the whole section and upgrade again. | The section is not added back. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | none | manual: bug bash or feature session |
| AI-5   | Install failure does not stop the upgrade | Upgrade offline. | A warning says the skills could not be installed and how to install them later; the upgrade finishes. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | none | manual: wording and whether a message helps |
| AI-6   | Skills CLI | `npx storybook skills ui-workflow`, `npx storybook skills component-docs`, `npx storybook skills stories`, `npx storybook skills setup` | The first two and `setup` print instructions; `stories` exits 1. | 11.0 ; M: `stories` skill renamed to `ui-workflow` | none | manual: bug bash or feature session |
| AI-7   | Tools CLI | `npx storybook tools --help`, then `npx storybook tools stories changed` with dev running. | It lists the tools, and the second attaches to the running Storybook. | 11.0 ; M: `storybook ai` command removed | `e2e-internal/tools-attach.spec.ts` | manual: bug bash or feature session |

## MCP addon

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| MCP-1  | Info page | `npx storybook add @storybook/addon-mcp`, start dev, open `http://localhost:6006/mcp` in a browser. | The page lists the enabled toolsets and links to the manifest debugger. | 10.3 ; CL: 10.3.0 ; `docs/ai/mcp/overview.mdx` | `e2e-sandbox/addon-mcp.spec.ts` | planned: core.mcp-info |
| MCP-2  | Tool names | Connect an MCP client and list tools. | The tools are named `stories-preview`, `stories-changed`, `stories-find-by-component`, `review-create`, `test-run`, `docs-list`, `docs-show`, `docs-show-story` and `get-storybook-story-instructions`. | 10.6 ; M: MCP tool names follow toolset.method | `e2e-sandbox/addon-mcp.spec.ts` | manual: bug bash or feature session |
| MCP-3  | Docs toolset without config | In a React, Vue 3 Vite or Angular Vite project, without setting `features.componentsManifest`, call `docs-list` and `docs-show` for one component. | The manifest is on by default, so it lists the components and returns props and example stories. | 11.0 ; CL: 11.0.0-alpha.2 ; `docs/api/main-config/main-config-features.mdx` | `e2e-sandbox/addon-mcp.spec.ts` | planned: core.components-manifest |
| MCP-4  | Manifest debugger | Open `http://localhost:6006/manifests/components.html`. | It lists the components and docs pages, and the error and warning filters work. | 10.1 ; CL: 10.1.0-alpha.2 ; `docs/ai/manifests.mdx` | none | planned: core.components-manifest |
| MCP-5  | Review | Ask an agent to call `review-create`, then open the review from the sidebar widget. | The review page shows the summary and its story collections. | 11.0 ; M: `experimentalReview` feature flag removed ; `docs/ai/agentic-review.mdx` | none | manual: bug bash or feature session |
| MCP-6  | Static build serves MCP data | Build, serve the output, and query the hosted manifests as the sharing page describes. | The manifests in the build match the dev server's. | 10.x ; `docs/ai/mcp/sharing.mdx` | `e2e-sandbox/addon-mcp.spec.ts` | manual: bug bash or feature session |

## Telemetry

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| TEL-1  | See what is sent | `STORYBOOK_TELEMETRY_DEBUG=1 npx storybook dev` | Each event (`boot`, `dev`, and in-app events) is printed as JSON, with no environment variables, paths or other sensitive data. | pre-9 ; `docs/configure/telemetry.mdx` | none | manual: sensitive data in telemetry |
| TEL-2  | Opt out | Start with `--disable-telemetry`, then with `core.disableTelemetry: true`, then with `STORYBOOK_DISABLE_TELEMETRY=1`. | With `STORYBOOK_TELEMETRY_DEBUG=1`, only `boot` prints for the flag and the config option, and nothing prints with the environment variable. | pre-9 ; `docs/configure/telemetry.mdx` | none | manual: bug bash or feature session |
| TEL-3  | Commands report | With debug on, run `upgrade`, `automigrate`, `add`, `doctor` and `build`. | Each prints its event. | pre-9 ; `docs/configure/telemetry.mdx` | none | manual: bug bash or feature session |
| TEL-4  | New UI features report | With debug on, save a story from Controls, open in editor, run tests from the widget, filter the sidebar. | `save-story`, `open-in-editor`, `test-run` and `sidebar-filter` events print. A new 11.0 feature that has no event is worth a question to its owner. | pre-9 ; `code/core/src/telemetry/types.ts` | none | manual: sensitive data in telemetry |

## Build and static serve

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| BLD-1  | Build succeeds | `npx storybook build -o storybook-static` | It exits 0 and the output has `index.html`, `iframe.html` and `index.json`. | pre-9 ; `docs/sharing/publish-storybook.mdx` | `e2e-sandbox/json-files.spec.ts` | build.static |
| BLD-2  | Static build serves and renders | `npx http-server ./storybook-static --port 6008`, then open a story and a docs page. | `index.json` ids match dev, stories and docs render, and there is no testing widget or save bar. | pre-9 ; source: team practice | none | build.static |
| BLD-3  | Static dirs | Add a `staticDirs` entry and reference a file from a story. | The file is served at its configured path in dev and in the build. | pre-9 ; `docs/api/main-config/main-config-static-dirs.mdx` | `e2e-sandbox/static-dirs.spec.ts` | planned: core.static-dirs |
| BLD-4  | Docs build | `npx storybook build --docs` and serve it. | Only docs pages are in the build, and they render. | pre-9 ; `docs/writing-docs/build-documentation.mdx` | none | planned: build.docs-mode |
| BLD-5  | Test build | `npx storybook build --test` | It succeeds and stories render. | pre-9 ; `docs/api/main-config/main-config-build.mdx` | none | planned: build.test-mode |
| BLD-6  | Stats output | `npx storybook build --stats-json` in a Vite project. | `preview-stats.json` contains virtual and proxy modules. | 11.0 ; M: Vite: `preview-stats.json` contains the full bundler graph | none | manual: bug bash or feature session |
| BLD-7  | Embedding a build | Embed a story from the served build in an `<iframe>` on another origin. | It renders; only the dev server restricts embedding. | 11.0 ; M: `storybook dev` now blocks remote iframe embedding | none | manual: bug bash or feature session |

## Portable stories and the test runner

| Row    | Check | Probe | Pass when | Since | E2E | Agent |
| ------ | ----- | ----- | --------- | ----- | --- | ----- |
| PS-1   | Portable stories in Vitest | In a plain Vitest test, `composeStories` a stories file and render one story. | The story renders with its args and project annotations. | pre-9 ; `docs/api/portable-stories/portable-stories-vitest.mdx` | none | manual: bug bash or feature session |
| PS-2   | `storybook/test` APIs | Use `fn()`, `expect` and `userEvent` from `storybook/test` in a `play` function. | They work; a mock called with `new` needs a `function` or `class` implementation. | 11.0 ; M: `storybook/test` is based on Vitest 5 and no longer installs its test libraries | `e2e-sandbox/component-tests.spec.ts` | manual: bug bash or feature session |
| PS-3   | Test libraries are not installed for you | Import `@testing-library/dom` directly in a story without adding it to `package.json`. | It fails to resolve; adding it to `devDependencies` fixes it. | 11.0 ; M: `storybook/test` is based on Vitest 5 and no longer installs its test libraries | none | planned: test.test-libraries |
| PS-4   | Test runner end of support | Run `@storybook/test-runner` against the upgraded Storybook. | It still runs, and prints a warning on every run that it is no longer supported. | 11.0 ; M: Test runner support ended | none | planned: test.test-runner |

## Sources

Every version claim above traces to one of these files.

- `MIGRATION.md`: "From version 10.x to 11.0.0", "From version 10.6.1 to 10.6.2", "From version 10.5.x to 10.6.0", "From version 10.4.0 to 10.5.0", "From version 10.3.0 to 10.4.0", "From version 9.x to 10.0.0" and "From version 8.x to 9.0.0".
- `CHANGELOG.md`: the headings `9.0.0`, `9.1.0`, `10.0.0` to `10.6.0`.
- `CHANGELOG.prerelease.md`: the 11.0 prerelease headings up to `11.0.0-beta.0`, and the 10.x prerelease headings cited where a feature has no line in its minor release.
- `docs/`: the pages named in the Since column.
- `code/addons/*/README.md` and `code/addons/*/package.json` for the addon list.
- `code/lib/cli-storybook/src/automigrate/fixes/` for the automigration ids and messages, and `code/lib/cli-storybook/src/bin/run.ts` for the CLI commands and options.
- `code/core/src/telemetry/types.ts` for the telemetry event names.
- `code/e2e-sandbox/`, `code/e2e-internal/` and `test-storybooks/portable-stories-kitchen-sink/react/e2e-tests/` for the E2E column.
