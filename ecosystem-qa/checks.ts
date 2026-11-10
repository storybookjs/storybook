// The cycle-0 subset of `references/basic-qa.md`, whose Agent column maps rows to these ids and
// names the rows the registry should gain next.
interface CheckDefinition {
  readonly id: string;
  readonly label: string;
  readonly phase: 'upgrade' | 'dev' | 'build' | 'test';
  readonly probe: string;
}

export const CHECKS = [
  {
    id: 'upgrade.command',
    label: 'The upgrade command completes without errors',
    phase: 'upgrade',
    probe:
      'Run the upgrade command. Save its full output to `upgrade.log` in the evidence directory.',
  },
  {
    id: 'upgrade.automigrations',
    label: 'Automigrations are detected, run, and change the right files',
    phase: 'upgrade',
    probe:
      'List the automigrations the upgrade detected and the ones it ran. Read `git diff` of every file they changed. A link containing `undefined` is a failure.',
  },
  {
    id: 'upgrade.installed-version',
    label: 'The installed `storybook` version equals the target version',
    phase: 'upgrade',
    probe:
      'From the Storybook directory run `node -p "require(\'storybook/package.json\').version"`.',
  },
  {
    id: 'upgrade.doctor',
    label: '`storybook doctor` after the upgrade describes the project accurately',
    phase: 'upgrade',
    probe:
      'Run doctor with the target version and save the output to `doctor-post.log`. Compare it with what you saw in the project.',
  },
  {
    id: 'core.dev-server',
    label: "The dev server starts and `index.json` lists this project's entries",
    phase: 'dev',
    probe:
      'Start the dev server on port 6006 with `--ci --exact-port --no-open`. Fetch `/index.json` and compare the entry count with the baseline.',
  },
  {
    id: 'core.story-render',
    label: 'One story renders without page errors',
    phase: 'dev',
    probe:
      'Screenshot the same story you used for the baseline with the shot tool. Its `.errors.json` file must be empty.',
  },
  {
    id: 'core.docs-render',
    label: 'A docs entry renders',
    phase: 'dev',
    probe:
      'Pick a `docs` entry from `index.json`, open its iframe URL with the shot tool, and check for page errors and visible body text.',
  },
  {
    id: 'core.controls',
    label: 'Changing a control rerenders the story',
    phase: 'dev',
    probe:
      'Open a story with Controls, change one value through the URL `args` parameter or the Controls panel, and take a screenshot before and after.',
  },
  {
    id: 'core.hmr.stories-file',
    label: 'Editing a stories file updates the running Storybook (HMR)',
    phase: 'dev',
    probe:
      'While the dev server runs, add a story export to an existing stories file. Poll `/index.json` until the new id appears or 60 seconds pass. Restore the file afterwards.',
  },
  {
    id: 'build.static',
    label: '`storybook build` succeeds and the static build serves and renders',
    phase: 'build',
    probe:
      'Build into `storybook-static`, serve it on port 6008, check `index.json`, and screenshot one story.',
  },
  {
    id: 'test.vitest-cli',
    label: '`vitest --project storybook` runs the Storybook tests from the CLI',
    phase: 'test',
    probe:
      'Run `npx vitest run --project storybook` from the Storybook directory. Save the output to `vitest.log`. Mark it `n/a` when the project has no `@storybook/addon-vitest`.',
  },
] as const satisfies readonly CheckDefinition[];

export type CheckId = (typeof CHECKS)[number]['id'];

export const CHECK_IDS = CHECKS.map((check) => check.id) as [CheckId, ...CheckId[]];

export const renderChecklist = (): string =>
  CHECKS.map((check) => `- \`${check.id}\` (${check.phase}): ${check.label}. ${check.probe}`).join(
    '\n'
  );
