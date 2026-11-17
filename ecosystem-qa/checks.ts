// The agent-runnable rows of `references/basic-qa.md`, whose Agent column maps each row to one of
// these ids; `checks.test.ts` keeps the two in sync.
// `must` runs on every repo of every sweep; `extended` only when a dispatch asks for it.
export type Tier = 'must' | 'extended';

// The order the agent works in: each phase uses what the one before it left installed, running
// or built.
const PHASES = ['upgrade', 'dev', 'build', 'test'] as const;

interface CheckDefinition {
  readonly id: string;
  readonly label: string;
  readonly phase: (typeof PHASES)[number];
  readonly tier: Tier;
  readonly probe: string;
}

export const CHECKS = [
  {
    id: 'upgrade.command',
    label: 'The upgrade command completes without errors',
    phase: 'upgrade',
    tier: 'must',
    probe:
      'Run the upgrade command. Save its full output to `upgrade.log` in the evidence directory.',
  },
  {
    id: 'upgrade.automigrations',
    label: 'Automigrations are detected, run, and change the right files',
    phase: 'upgrade',
    tier: 'must',
    probe:
      'List the automigrations the upgrade detected and the ones it ran. Read `git diff` of every file they changed. A link containing `undefined` is a failure.',
  },
  {
    id: 'upgrade.installed-version',
    label: 'The installed `storybook` version equals the target version',
    phase: 'upgrade',
    tier: 'must',
    probe:
      'From the Storybook directory run `node -p "require(\'storybook/package.json\').version"`.',
  },
  {
    id: 'upgrade.doctor',
    label: '`storybook doctor` after the upgrade describes the project accurately',
    phase: 'upgrade',
    tier: 'must',
    probe:
      'Run doctor with the target version and save the output to `doctor-post.log`. Compare it with what you saw in the project.',
  },
  {
    id: 'core.dev-server',
    label: "The dev server starts and `index.json` lists this project's entries",
    phase: 'dev',
    tier: 'must',
    probe:
      'Start the dev server on port 6006 with `--ci --exact-port --no-open`. Fetch `/index.json` and compare the entry count with the baseline.',
  },
  {
    id: 'core.story-render',
    label: 'One story renders without page errors',
    phase: 'dev',
    tier: 'must',
    probe:
      'Screenshot the same story you used for the baseline with the shot tool. Its `.errors.json` file must be empty.',
  },
  {
    id: 'core.docs-render',
    label: 'A docs entry renders',
    phase: 'dev',
    tier: 'must',
    probe:
      'Pick a `docs` entry from `index.json`, open its iframe URL with the shot tool, and check for page errors and visible body text.',
  },
  {
    id: 'core.hmr.stories-file',
    label: 'Editing a stories file updates the running Storybook (HMR)',
    phase: 'dev',
    tier: 'must',
    probe:
      'While the dev server runs, add a story export to an existing stories file. Poll `/index.json` until the new id appears or 60 seconds pass. Restore the file afterwards.',
  },
  {
    id: 'build.static',
    label: '`storybook build` succeeds and the static build serves and renders',
    phase: 'build',
    tier: 'must',
    probe:
      'Build into `storybook-static`, serve it on port 6008, check `index.json`, and screenshot one story.',
  },
  {
    id: 'test.vitest-cli',
    label: '`vitest --project storybook` runs the Storybook tests from the CLI',
    phase: 'test',
    tier: 'must',
    probe:
      'Run `npx vitest run --project storybook` from the Storybook directory. Save the output to `vitest.log`. Mark it `n/a` when the project has no `@storybook/addon-vitest`.',
  },
  {
    id: 'upgrade.project-scripts',
    label: "The project's own Storybook scripts still run after the upgrade",
    phase: 'upgrade',
    tier: 'must',
    probe:
      'Run the `storybook` and `build-storybook` scripts exactly as `package.json` declares them (with `--ci` added for the dev one, and a bounded wait). A flag or option the old version accepted and the new one rejects is a failure.',
  },
  {
    id: 'upgrade.community-packages',
    label: 'Non-Storybook packages the upgrade bumped are compatible with the target',
    phase: 'upgrade',
    tier: 'must',
    probe:
      'Diff every changed `package.json`. For each non-Storybook package the upgrade bumped, note the new version and its Storybook peer range from its own `package.json` in `node_modules`. A bump to a version that then fails to install, build or load is a failure.',
  },
  {
    id: 'upgrade.agents-md',
    label: 'The skills automigration writes only its own section into agent instruction files',
    phase: 'upgrade',
    tier: 'must',
    probe:
      'Read `git diff -- AGENTS.md CLAUDE.md .claude/CLAUDE.md CLAUDE.local.md`. A marked Storybook section is added, existing content is kept, and no `CLAUDE.md` is created where none existed. `n/a` when the automigration did not run.',
  },
  {
    id: 'upgrade.skills',
    label:
      'The skills automigration installs the Storybook skills and records them in `skills-lock.json`',
    phase: 'upgrade',
    tier: 'extended',
    probe:
      '`n/a` when the upgrade had no reason to install them: the run was detected as CI, or `skills-lock.json` at the repository root listed no Storybook skills before the upgrade and either the project was already on 11 (a prerelease counts) or its framework after the upgrade is none of React, Svelte, Web Components, Vue 3 Vite and Angular Vite. Otherwise `upgrade.log` must have a line that ends in `skills@latest add storybookjs/skills#v<version> --yes --agent claude-code universal --copy`. What comes before it depends on the package manager (`npx`, `pnpm dlx`, `yarn dlx`, `bunx`) and is not part of the check. After it, `skills-lock.json` at the repository root must list the Storybook skills.',
  },
  {
    id: 'upgrade.index-cli',
    label: '`storybook index` writes the same entries as the dev server without starting one',
    phase: 'dev',
    tier: 'extended',
    probe:
      "Run `storybook index` from the Storybook directory (bounded wait) and compare the entry ids of its `index.json` with the dev server's. Save the output to `index-cli.log`.",
  },
  {
    id: 'core.hmr.preview-file',
    label: 'Editing `.storybook/preview.*` updates every story without a restart',
    phase: 'dev',
    tier: 'extended',
    probe:
      'While the dev server runs, add a decorator that wraps the story in an element with a visible marker (a red 4px border or a data attribute) to `.storybook/preview.*`. Screenshot the baseline story before and after. The marker must appear without restarting the server. Restore the file afterwards.',
  },
  {
    id: 'core.hmr.new-file',
    label: 'A new stories file is picked up while the dev server runs',
    phase: 'dev',
    tier: 'extended',
    probe:
      'While the dev server runs, copy one stories file to a new name in the same directory, so that the `stories` globs in `.storybook/main.*` match it. If the copy sets a `title` or an `id` in its meta, or a story sets `parameters.__id`, change each of them in the copy, or its ids collide with the original and the index reports a duplicate. Poll `/index.json` until an id of the copy appears or 60 seconds pass. Then screenshot one story of the copy with the shot tool: it must render and its `.errors.json` must be empty. Delete the copy afterwards.',
  },
  {
    id: 'core.hmr.delete-file',
    label: 'Deleting a stories file removes its entries without crashing the manager',
    phase: 'dev',
    tier: 'extended',
    probe:
      'Copy one stories file aside, then delete it. Poll `/index.json` until its ids are gone or 60 seconds pass. Then screenshot the manager at `/` with the shot tool: its `.errors.json` must be empty. Restore the file afterwards.',
  },
  {
    id: 'core.hmr.argtypes',
    label:
      'A typed prop added to a component reaches Controls or the docs args table without a restart',
    phase: 'dev',
    tier: 'extended',
    probe:
      "`n/a` unless the `framework` in `.storybook/main.*` is a React, Vue 3, Svelte or Web Components framework or `@storybook/angular-vite`; the others have no docgen that reads the component source while the server runs. Also `n/a` for a Web Components project that takes its props from a Custom Elements Manifest file. While the dev server runs, add a typed prop with a default to the component of the baseline story and save. Then screenshot the story's docs page, or the manager with the Controls panel, again: the new prop must be listed without a restart of the server. Restore the file afterwards.",
  },
  {
    id: 'core.module-mocking',
    label: 'A story that loads a module mocked with `sb.mock()` renders',
    phase: 'dev',
    tier: 'extended',
    probe:
      'Search `.storybook/preview.*` for `sb.mock(`. `n/a` when there is none. Otherwise find a story whose component loads one of the mocked modules, directly or through its imports, and screenshot it with the shot tool. `pass` when it renders and its `.errors.json` is empty. `fail` when it does not render, or when the page errors or the dev server log name the mocked module.',
  },
  {
    id: 'core.static-dirs',
    label: 'A file from `staticDirs` is served in dev and in the build',
    phase: 'build',
    tier: 'extended',
    probe:
      'Read `staticDirs` from `.storybook/main.*`. `n/a` when it is missing or empty. Pick one file under a configured directory and work out its served path: its path relative to that directory, below the `to` of the entry when the entry is an object. Fetch that path from the static build on port 6008 and from the dev server on port 6006; start the dev server again when it no longer runs. Both must answer 200 with the file.',
  },
  {
    id: 'core.components-manifest',
    label: "The components manifest is on by default and lists the project's components",
    phase: 'build',
    tier: 'extended',
    probe:
      '`n/a` unless the `framework` in `.storybook/main.*` uses the React, Vue 3 or Svelte renderer or is `@storybook/angular-vite`. Only those turn the manifest on by default, so the 404 of any other framework (`@storybook/angular`, Web Components, Preact, HTML, Ember, Server) is correct and not a finding. Also `n/a` when the project sets `features.componentsManifest: false`, or `features.docgenServer: false` with `@storybook/angular-vite`. Otherwise, without setting `features.componentsManifest` yourself, fetch `/manifests/components.html` and `/manifests/components.json` from the static build on port 6008, not from the dev server: in dev the JSON answers 404 with "not available in dev when docgenServer is enabled", which is by design and not a finding. The page must list components and the JSON must name at least one component with props. With server-side docgen the JSON holds no props itself: a component there has `docgen.$ref`, a path relative to `/manifests/` followed by `#` and a JSON pointer. Fetch that file and look for the props in the `argTypes` of the component the pointer names. One component with props is enough, so try several before you call it a failure.',
  },
  {
    id: 'test.coverage-cli',
    label: 'Vitest coverage runs from the CLI and writes its report',
    phase: 'test',
    tier: 'extended',
    probe:
      '`n/a` without `@storybook/addon-vitest`, or when no `package.json` of the project lists a coverage provider (`@vitest/coverage-v8` or `@vitest/coverage-istanbul`). `blocked` when `test.vitest-cli` failed: Vitest writes no report after a failed run. Otherwise run `npx vitest run --project storybook --coverage` from the Storybook directory and save the output to `coverage.log`. The report goes where the Vitest config of the project says, so read `coverage.reporter` and `coverage.reportsDirectory` there. With neither set, the run must print a table with a statement percentage and write `coverage/index.html`. With them set, the configured reporters must write their files into the configured directory.',
  },
  {
    id: 'test.setup-annotations',
    label:
      '`setProjectAnnotations` in a setup file of the Storybook Vitest project is migrated or rejected with `SB_ADDON_VITEST_0002`',
    phase: 'test',
    tier: 'extended',
    probe:
      'In the Vitest config, find the `setupFiles` of the project that loads the `storybookTest` plugin, its own and the ones it inherits from the root config, and search those files for `setProjectAnnotations`. A call in a setup file that only a Vitest project without the plugin loads is still needed there, the automigration leaves it alone, and it does not count. `n/a` when no setup file of the Storybook project called it before the upgrade (check the baseline too). `pass` when the upgrade removed the call, or when it is still there and `npx vitest run --project storybook` fails with `SB_ADDON_VITEST_0002`. `fail` when it is still there and that run does not raise the error.',
  },
  {
    id: 'test.test-libraries',
    label: 'Test libraries are no longer installed transitively by `storybook/test`',
    phase: 'test',
    tier: 'extended',
    probe:
      '`n/a` when a `package.json` of the project lists `@testing-library/dom` as a direct dependency. Otherwise ask the package manager which packages depend on it: `npm ls @testing-library/dom`, `pnpm why @testing-library/dom`, `yarn why @testing-library/dom` or `bun why @testing-library/dom`. `pass` when it is not installed, or when only packages other than `storybook` bring it in, for example `@testing-library/svelte`; name them in the note. `fail` when `storybook` is one of the packages that depend on it.',
  },
  {
    id: 'test.test-runner',
    label: '`@storybook/test-runner` still runs and warns that it is no longer supported',
    phase: 'test',
    tier: 'extended',
    probe:
      'Check `package.json` for `@storybook/test-runner`. `n/a` when absent. Otherwise run exactly `npx test-storybook --url http://localhost:6008 --ci` against the static build, with a bounded wait, and save the output to `test-runner.log`. Do not add `--index-json`: it skips the preview config that the runner reads. It must finish and print a warning that says the test runner is no longer supported.',
  },
] as const satisfies readonly CheckDefinition[];

export type CheckId = (typeof CHECKS)[number]['id'];

export const CHECK_IDS = CHECKS.map((check) => check.id) as [CheckId, ...CheckId[]];

export const checksFor = (tier: Tier) =>
  PHASES.flatMap((phase) =>
    CHECKS.filter(
      (check) => check.phase === phase && (tier === 'extended' || check.tier === 'must')
    )
  );

export const renderChecklist = (tier: Tier): string =>
  checksFor(tier)
    .map((check) => `- \`${check.id}\` (${check.phase}): ${check.label}. ${check.probe}`)
    .join('\n');
