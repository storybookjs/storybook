import { type SkillTextTransport, skillVocabulary } from './skill-vocabulary.ts';

export type TestStoriesSkillInputs = {
  // `mcp` for `skills test-stories --mcp`: tools of the Storybook MCP server instead of commands.
  transport: SkillTextTransport;
  // `@storybook/addon-vitest` is enabled.
  testSupported: boolean;
  // `main.ts` turns the `test` toolset of the MCP server off. Never for the CLI.
  toolsetOff?: boolean;
  a11yEnabled: boolean;
};

// The `AGENTS.md` section names the command itself, so this skill is for an agent that opens it by
// name. It names the same forms of the command, and what the result says.
export function buildTestStoriesSkill(inputs: TestStoriesSkillInputs): string {
  const v = skillVocabulary(inputs.transport);
  if (!inputs.testSupported) {
    return `# Test the stories

This project cannot run story tests: its main config does not list \`@storybook/addon-vitest\`.`;
  }
  // A client can turn the toolset on for itself with a request header, which this text cannot see.
  const toolsetOff = inputs.toolsetOff
    ? `\n\nThe \`main.ts\` of this project turns the \`test\` toolset of the Storybook MCP server off, so the server gives ${v.name('test.run')} only to a client that turns it on.`
    : '';
  // The accessibility rules stay: they guard against changes to the design or to the project's
  // accessibility test level that nobody asked for.
  const a11y = inputs.a11yEnabled
    ? '\n\nThe run lists accessibility violations under `## Accessibility Violations`. Fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design. Never change the accessibility test level (`parameters.a11y.test`) to make violations fail or pass.'
    : '';
  // How to use the command, from its \`--help\` and its output. When to test and what to do about a
  // failure is up to the agent and its harness.
  const usage = v.cli
    ? `\`npx storybook tools test run\` runs the story tests of this Storybook in Vitest. Run it from the package where Storybook is installed (in a monorepo often a leaf package such as \`packages/ui\`); it uses the running dev server when there is one.

\`\`\`sh
npx storybook tools test run                          # every story
npx storybook tools test run src/Button.stories.tsx   # the story files whose path contains this (case-insensitive), or a directory
npx storybook tools test run --changed                # new and modified stories, and the stories that depend on changed files, in the uncommitted changes
npx storybook tools test run --changed main           # the same since the branch forked from main, plus the uncommitted changes
\`\`\`

Only story files match a file argument: a component file matches nothing, and \`--changed\` finds the stories that depend on it. Files and \`--changed\` combine: then only the stories that match both run. \`--a11y false\` leaves out the accessibility checks, \`--json\` prints the result as JSON, and \`--help\` lists every argument.

The output ends with \`## Result\`: what was selected, then \`Passed: …\` or \`Failed: …\`. Each failing story is under \`## Failing Stories\` with its error, and errors outside a story are under \`## Unhandled Errors\`. The command exits with 1 when a story fails or when the files or story ids you pass match nothing, and with 0 when nothing changed under \`--changed\`.`
    : `${v.name('test.run')} runs the story tests of this Storybook in Vitest:

- with neither \`files\` nor \`changed\`: every story
- with \`files: ["src/Button.stories.tsx"]\`: the story files whose path contains an entry (case-insensitive), or a directory
- with \`changed: true\`: new and modified stories, and the stories that depend on changed files, in the uncommitted changes
- with \`changed: "main"\`: the same since the branch forked from main, plus the uncommitted changes

Only story files match \`files\`: a component file matches nothing, and \`changed\` finds the stories that depend on it. \`files\` and \`changed\` combine: then only the stories that match both run. \`a11y: false\` leaves out the accessibility checks.

The result ends with \`## Result\`: what was selected, then \`Passed: …\` or \`Failed: …\`. Each failing story is under \`## Failing Stories\` with its error, and errors outside a story are under \`## Unhandled Errors\`.`;
  return `# Test the stories

${v.notes}${toolsetOff}

${usage}${a11y}`;
}
