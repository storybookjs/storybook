import { describe, expect, it } from 'vitest';

import { buildTestStoriesSkill, type TestStoriesSkillInputs } from './build-test-stories-skill.ts';

const everything: TestStoriesSkillInputs = {
  transport: 'cli',
  testSupported: true,
  a11yEnabled: true,
};

describe('buildTestStoriesSkill', () => {
  it('runs the files that changed, and never a package.json test script', () => {
    const text = buildTestStoriesSkill(everything);

    expect(text).toContain('npx storybook tools test run src/Button.stories.tsx');
    expect(text).toContain('npx storybook tools test run --changed');
    expect(text).toContain('with `--changed`');
    expect(text).toContain('never a `package.json` test script');
  });

  it('takes files or --changed, not story ids, and asks for no full run before finishing', () => {
    const text = buildTestStoriesSkill(everything);

    expect(text).not.toMatch(/storyId|Find the stories|stories changed|docs list/);
    expect(text).not.toMatch(/before you finish|full run|every story once/);
  });

  it('keeps the accessibility test level of the project', () => {
    expect(buildTestStoriesSkill(everything)).toContain(
      'Never change the accessibility test level (`parameters.a11y.test`)'
    );
    expect(buildTestStoriesSkill({ ...everything, a11yEnabled: false })).not.toContain(
      'accessibility test level'
    );
  });

  it('tells the agent to skip the step when the project cannot run story tests', () => {
    expect(buildTestStoriesSkill({ ...everything, testSupported: false })).toMatchInlineSnapshot(`
      "# Test the stories

      This project cannot run story tests: it has no \`@storybook/addon-vitest\`. Skip this step."
    `);
    expect(buildTestStoriesSkill({ ...everything, transport: 'mcp', testSupported: false })).toBe(
      buildTestStoriesSkill({ ...everything, testSupported: false })
    );
  });

  it('says when to skip the step, and keeps its tool, when main.ts turns the test toolset off', () => {
    const text = buildTestStoriesSkill({ ...everything, transport: 'mcp', toolsetOff: true });

    expect(text).toContain(
      'The `main.ts` of this project turns the `test` toolset of the Storybook MCP server off. When the server does not give you `test-run`, skip this step.'
    );
    expect(text).toContain('Call it after every change');
    expect(buildTestStoriesSkill({ ...everything, transport: 'mcp' })).not.toContain(
      'skip this step'
    );
  });

  it('names no review and no other skill', () => {
    expect(buildTestStoriesSkill(everything)).not.toMatch(
      /review|component-docs|write-stories|ui-review/
    );
  });

  it('asks for no shell habits that MCP tools do not have', () => {
    const mcp = buildTestStoriesSkill({ ...everything, transport: 'mcp' });

    expect(mcp).toContain('`test-run` with `files: ["src/Button.stories.tsx"]`');
    expect(mcp).not.toContain('npx storybook tools');
    expect(mcp).not.toContain('--');
  });

  it('full text on the CLI', () => {
    expect(buildTestStoriesSkill(everything)).toMatchInlineSnapshot(`
      "# Test the stories

      Some commands print what to do next; follow that too. Add \`--help\` to a command only when a call fails.

      \`\`\`sh
      npx storybook tools test run --changed                # the stories your uncommitted changes reach
      npx storybook tools test run src/Button.stories.tsx   # the stories in these story files
      npx storybook tools test run                          # every story
      \`\`\`

      Run it after every change, with \`--changed\`. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass."
    `);
  });

  it('full text over MCP', () => {
    expect(buildTestStoriesSkill({ ...everything, transport: 'mcp' })).toMatchInlineSnapshot(`
      "# Test the stories

      The tools named here are tools of the Storybook MCP server. Some tools return what to do next; follow that too.

      - \`test-run\` with \`changed: true\`: the stories your uncommitted changes reach
      - \`test-run\` with \`files: ["src/Button.stories.tsx"]\`: the stories in these story files
      - \`test-run\` with neither: every story

      Call it after every change, with \`changed: true\`. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass."
    `);
  });
});
