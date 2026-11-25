import { toCliPath } from '../../../shared/open-service/toolset-names.ts';
import { type SkillTextTransport, skillVocabulary } from './skill-vocabulary.ts';

export type TestStoriesSkillInputs = {
  // `mcp` for `skills test-stories --mcp`: tools of the Storybook MCP server instead of commands.
  transport: SkillTextTransport;
  // `@storybook/addon-vitest` is enabled.
  testSupported: boolean;
  a11yEnabled: boolean;
};

// Said before the first run, so an agent in a sandbox does not spend a run on finding out. The
// command says the same when the port is refused.
const SANDBOX =
  'In a sandbox, only `test run` needs escalated permissions: it opens a local port for the browser that runs the tests.';

// The `AGENTS.md` section names the command itself, so this skill is for an agent that opens it by
// name. It names the same forms of the command, and what the result says.
export function buildTestStoriesSkill(inputs: TestStoriesSkillInputs): string {
  const v = skillVocabulary(inputs.transport);
  if (!inputs.testSupported) {
    return `# Test the stories

This project cannot run story tests: its main config does not list \`@storybook/addon-vitest\`.`;
  }
  // The accessibility rules stay: they guard against changes to the design or to the project's
  // accessibility test level that nobody asked for.
  const a11y = inputs.a11yEnabled
    ? '\n\nThe run lists accessibility violations under `## Accessibility Violations`. Fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design. Never change the accessibility test level (`parameters.a11y.test`) to make violations fail or pass.'
    : '';
  const run = v.ref('test.run');
  // How to use the command, from its \`--help\` and its output. When to test and what to do about a
  // failure is up to the agent and its harness.
  const usage = v.cli
    ? `\`${run}\` runs the story tests of this Storybook in Vitest. Run it from the package where Storybook is installed (in a monorepo often a leaf package such as \`packages/ui\`); it uses the running dev server when there is one.

\`\`\`sh
${run}                          # every story
${run} src/Button.stories.tsx   # the story files whose path contains this (case-insensitive), or a directory
${run} --changed                # new and modified stories, and the stories that depend on changed files, in the uncommitted changes
${run} --changed main           # the same since the branch forked from main, plus the uncommitted changes
\`\`\`

Only story files match a file argument: a component file matches nothing, and \`--changed\` finds the stories that depend on it. Files and \`--changed\` combine, with the files first (the argument after \`--changed\` is its ref): \`${toCliPath('test.run')} src/Button.stories.tsx --changed\` runs the changed stories in those files. \`--a11y false\` leaves out the accessibility checks, \`--json\` prints the result as JSON, and \`--help\` lists every argument.

${SANDBOX}`
    : `${v.name('test.run')} runs the story tests of this Storybook in Vitest:

- with neither \`files\` nor \`changed\`: every story
- with \`files: ["src/Button.stories.tsx"]\`: the story files whose path contains an entry (case-insensitive), or a directory
- with \`changed: true\`: new and modified stories, and the stories that depend on changed files, in the uncommitted changes
- with \`changed: "main"\`: the same since the branch forked from main, plus the uncommitted changes

Only story files match \`files\`: a component file matches nothing, and \`changed\` finds the stories that depend on it. \`files\` and \`changed\` combine: then only the changed stories in those files run. \`a11y: false\` leaves out the accessibility checks.`;
  const exitCode = v.cli
    ? ' The command exits with 1 when a story fails, an error occurs outside a story, or a file argument matches no story file; with `--changed`, nothing to run exits with 0.'
    : '';
  const result = `A run ends with \`## Result\`: what was selected, then \`Passed: …\` or \`Failed: …\`. Each failing story is under \`## Failing Stories\` with its error, and errors outside a story are under \`## Unhandled Errors\`. When nothing is selected, the ${v.output} is one line that says so.${exitCode}`;
  return `# Test the stories

${v.notes}

${usage}

${result}${a11y}`;
}
