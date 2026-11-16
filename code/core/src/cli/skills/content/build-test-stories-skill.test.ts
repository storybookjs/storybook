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
      expect(
        buildTestStoriesSkill({ ...everything, transport, toolsetOff: true, a11yEnabled: false })
      ).not.toMatch(
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

  it('says that main.ts turns the test toolset off', () => {
    expect(buildTestStoriesSkill({ ...everything, transport: 'mcp', toolsetOff: true })).toContain(
      'The `main.ts` of this project turns the `test` toolset of the Storybook MCP server off, so the server gives `test-run` only to a client that turns it on.'
    );
    expect(buildTestStoriesSkill({ ...everything, transport: 'mcp' })).not.toContain('main.ts');
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

      Only story files match a file argument: a component file matches nothing, and \`--changed\` finds the stories that depend on it. Files and \`--changed\` combine: then only the stories that match both run. \`--a11y false\` leaves out the accessibility checks, \`--json\` prints the result as JSON, and \`--help\` lists every argument.

      The output ends with \`## Result\`: what was selected, then \`Passed: …\` or \`Failed: …\`. Each failing story is under \`## Failing Stories\` with its error, and errors outside a story are under \`## Unhandled Errors\`. The command exits with 1 when a story fails or when the files or story ids you pass match nothing, and with 0 when nothing changed under \`--changed\`.

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

      Only story files match \`files\`: a component file matches nothing, and \`changed\` finds the stories that depend on it. \`files\` and \`changed\` combine: then only the stories that match both run. \`a11y: false\` leaves out the accessibility checks.

      The result ends with \`## Result\`: what was selected, then \`Passed: …\` or \`Failed: …\`. Each failing story is under \`## Failing Stories\` with its error, and errors outside a story are under \`## Unhandled Errors\`.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass."
    `);
  });
});
