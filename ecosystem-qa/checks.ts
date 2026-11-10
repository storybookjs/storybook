// The cycle-0 subset of `references/basic-qa.md`, whose Agent column maps rows to these ids and
// names the rows the registry should gain next.
// `must` runs on every repo of every sweep; `extended` only when a dispatch asks for it.
export type Tier = 'must' | 'extended';

interface CheckDefinition {
  readonly id: string;
  readonly label: string;
  readonly phase: 'upgrade' | 'dev' | 'build' | 'test';
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
    id: 'core.controls',
    label: 'Changing a control rerenders the story',
    phase: 'dev',
    tier: 'must',
    probe:
      'Open a story with Controls, change one value through the URL `args` parameter or the Controls panel, and take a screenshot before and after.',
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
] as const satisfies readonly CheckDefinition[];

export type CheckId = (typeof CHECKS)[number]['id'];

export const CHECK_IDS = CHECKS.map((check) => check.id) as [CheckId, ...CheckId[]];

export const checksFor = (tier: Tier) =>
  tier === 'extended' ? CHECKS : CHECKS.filter((check) => check.tier === 'must');

export const renderChecklist = (tier: Tier): string =>
  checksFor(tier)
    .map((check) => `- \`${check.id}\` (${check.phase}): ${check.label}. ${check.probe}`)
    .join('\n');
