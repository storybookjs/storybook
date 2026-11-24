import { describe, expect, it } from 'vitest';

import { buildTestStoriesSkill, type TestStoriesSkillInputs } from './build-test-stories-skill.ts';

const everything: TestStoriesSkillInputs = {
  transport: 'cli',
  testSupported: true,
  a11yEnabled: true,
};

describe('buildTestStoriesSkill', () => {
  it('names the forms of the command and what each selects', () => {
    const text = buildTestStoriesSkill(everything);

    expect(text).toContain('npx storybook tools test run --changed');
    expect(text).toContain('npx storybook tools test run src/Button.stories.tsx');
    expect(text).toMatch(/npx storybook tools test run +# every story/);
    expect(text).toContain('`## Failing Stories`');
  });

  // When to test, what to do about a failure and which runner to avoid is the agent's and its
  // harness's. Only the accessibility rules stay.
  it('tells the agent nothing about how to work, apart from the accessibility rules', () => {
    for (const transport of ['cli', 'mcp'] as const) {
      expect(buildTestStoriesSkill({ ...everything, transport, a11yEnabled: false })).not.toMatch(
        /after every change|rerun|fix|never|before you finish|full run|skip this step|only way|package\.json/i
      );
    }
  });

  it('takes files or --changed, not story ids', () => {
    expect(buildTestStoriesSkill(everything)).not.toMatch(
      /storyId|Find the stories|stories changed|docs list/
    );
  });

  it('keeps the accessibility test level of the project', () => {
    expect(buildTestStoriesSkill(everything)).toContain(
      'Never change the accessibility test level (`parameters.a11y.test`) to make violations fail or pass.'
    );
    expect(buildTestStoriesSkill({ ...everything, a11yEnabled: false })).not.toContain(
      'Accessibility Violations'
    );
  });

  it('says that the project cannot run story tests', () => {
    expect(buildTestStoriesSkill({ ...everything, testSupported: false })).toMatchInlineSnapshot(`
      "# Test the stories

      This project cannot run story tests: its main config does not list \`@storybook/addon-vitest\`."
    `);
    expect(buildTestStoriesSkill({ ...everything, transport: 'mcp', testSupported: false })).toBe(
      buildTestStoriesSkill({ ...everything, testSupported: false })
    );
  });

  it('names no review and no other skill', () => {
    expect(buildTestStoriesSkill(everything)).not.toMatch(
      /review|component-docs|write-stories|ui-review/
    );
  });

  it('asks for no shell habits that MCP tools do not have', () => {
    const mcp = buildTestStoriesSkill({ ...everything, transport: 'mcp' });

    expect(mcp).toContain('with `files: ["src/Button.stories.tsx"]`');
    expect(mcp).not.toContain('npx storybook tools');
    expect(mcp).not.toContain('--');
  });

  it('full text on the CLI', () => {
    expect(buildTestStoriesSkill(everything)).toMatchInlineSnapshot(`
      "# Test the stories

      Some commands print what to do next; follow that too. Add \`--help\` to a command only when a call fails.

      \`npx storybook tools test run\` runs the story tests of this Storybook in Vitest. Run it from the package where Storybook is installed (in a monorepo often a leaf package such as \`packages/ui\`); it uses the running dev server when there is one.

      \`\`\`sh
      npx storybook tools test run                          # every story
      npx storybook tools test run src/Button.stories.tsx   # the story files whose path contains this (case-insensitive), or a directory
      npx storybook tools test run --changed                # new and modified stories, and the stories that depend on changed files, in the uncommitted changes
      npx storybook tools test run --changed main           # the same since the branch forked from main, plus the uncommitted changes
      \`\`\`

      Only story files match a file argument: a component file matches nothing, and \`--changed\` finds the stories that depend on it. Files and \`--changed\` combine, with the files first (the argument after \`--changed\` is its ref): \`test run src/Button.stories.tsx --changed\` runs the changed stories in those files. \`--a11y false\` leaves out the accessibility checks, \`--json\` prints the result as JSON, and \`--help\` lists every argument.

      In a sandbox, only \`test run\` needs escalated permissions: it opens a local port for the browser that runs the tests.

      A run ends with \`## Result\`: what was selected, then \`Passed: …\` or \`Failed: …\`. Each failing story is under \`## Failing Stories\` with its error, and errors outside a story are under \`## Unhandled Errors\`. When nothing is selected, the output is one line that says so. The command exits with 1 when a story fails, an error occurs outside a story, or a file argument matches no story file; with \`--changed\`, nothing to run exits with 0.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass."
    `);
  });

  it('full text over MCP', () => {
    expect(buildTestStoriesSkill({ ...everything, transport: 'mcp' })).toMatchInlineSnapshot(`
      "# Test the stories

      The tools named here are tools of the Storybook MCP server. Some tools return what to do next; follow that too.

      \`test-run\` runs the story tests of this Storybook in Vitest:

      - with neither \`files\` nor \`changed\`: every story
      - with \`files: ["src/Button.stories.tsx"]\`: the story files whose path contains an entry (case-insensitive), or a directory
      - with \`changed: true\`: new and modified stories, and the stories that depend on changed files, in the uncommitted changes
      - with \`changed: "main"\`: the same since the branch forked from main, plus the uncommitted changes

      Only story files match \`files\`: a component file matches nothing, and \`changed\` finds the stories that depend on it. \`files\` and \`changed\` combine: then only the changed stories in those files run. \`a11y: false\` leaves out the accessibility checks.

      A run ends with \`## Result\`: what was selected, then \`Passed: …\` or \`Failed: …\`. Each failing story is under \`## Failing Stories\` with its error, and errors outside a story are under \`## Unhandled Errors\`. When nothing is selected, the result is one line that says so.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass."
    `);
  });
});
