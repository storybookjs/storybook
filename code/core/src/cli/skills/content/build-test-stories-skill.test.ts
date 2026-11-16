import { describe, expect, it } from 'vitest';

import { buildTestStoriesSkill, type TestStoriesSkillInputs } from './build-test-stories-skill.ts';

const everything: TestStoriesSkillInputs = {
  transport: 'cli',
  docsEnabled: true,
  moduleGraphSupported: true,
  testSupported: true,
  a11yEnabled: true,
};

describe('buildTestStoriesSkill', () => {
  it('runs focused while iterating and every story before finishing', () => {
    const text = buildTestStoriesSkill(everything);

    expect(text).toContain(`npx storybook tools test run --stories '[{"storyId":"<id>"}]'`);
    expect(text).toContain('then one full run without `--stories` before you finish');
    expect(text).toContain('never a `package.json` test script');
  });

  it('keeps the accessibility test level of the project', () => {
    const text = buildTestStoriesSkill(everything);

    expect(text).toContain('Never change the accessibility test level (`parameters.a11y.test`)');
    expect(buildTestStoriesSkill({ ...everything, a11yEnabled: false })).not.toContain(
      'accessibility test level'
    );
  });

  it('lists the commands that give story ids, without the rules that only a review needs', () => {
    const text = buildTestStoriesSkill(everything);

    expect(text).toContain('npx storybook tools stories changed');
    expect(text).toContain('so wait for it before you use an id');
    expect(text).not.toContain('before every review');
    expect(text).not.toContain('maxDistance');
  });

  it('takes story ids from the story list when the builder has no module graph', () => {
    const text = buildTestStoriesSkill({ ...everything, moduleGraphSupported: false });

    expect(text).toContain('docs list --withStoryIds true');
    expect(text).toContain('Story ids come only from the output of this command');
    expect(text).not.toContain('stories changed');
  });

  it('selects stories by file and export when no command lists story ids', () => {
    const text = buildTestStoriesSkill({
      ...everything,
      docsEnabled: false,
      moduleGraphSupported: false,
    });

    expect(text).toContain('"absoluteStoryPath"');
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
    expect(text).toContain('Call `test-run` after every change');
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

    expect(mcp).toContain('`test-run` with `stories: [{ "storyId": "<id>" }]`');
    expect(mcp).not.toContain('npx storybook tools');
    expect(mcp).not.toContain('--');
  });

  // The CLI text is the one the plugin evals validated, and the MCP text shares its sentences, so
  // a wording change for one transport must show up here for both.
  it('full text on the CLI', () => {
    expect(buildTestStoriesSkill(everything)).toMatchInlineSnapshot(`
      "# Test the stories

      Some commands print what to do next; follow that too. Add \`--help\` to a command only when a call fails.

      \`\`\`sh
      npx storybook tools test run --stories '[{"storyId":"<id>"}]'   # ids from "Find the stories"; leave out --stories to run every story
      \`\`\`

      Run this after every change: focused runs with \`--stories\` while you iterate, then one full run without \`--stories\` before you finish. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass.

      ## Find the stories

      \`\`\`sh
      npx storybook tools stories changed   # stories affected by your uncommitted changes
      npx storybook tools stories find-by-component --componentPaths '["/abs/path/Button.tsx"]'   # only for files stories changed leaves out
      npx storybook tools docs list --withStoryIds true   # every story id
      \`\`\`

      Story ids come only from the output of these commands, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory. When none of them finds a story for a component, it has no stories yet: say so, or write them."
    `);
  });

  it('full text over MCP', () => {
    expect(buildTestStoriesSkill({ ...everything, transport: 'mcp' })).toMatchInlineSnapshot(`
      "# Test the stories

      The tools named here are tools of the Storybook MCP server. Some tools return what to do next; follow that too.

      - \`test-run\` with \`stories: [{ "storyId": "<id>" }]\`: ids from "Find the stories"; leave out \`stories\` to run every story

      Call \`test-run\` after every change: focused runs with \`stories\` while you iterate, then one full run without \`stories\` before you finish. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass.

      ## Find the stories

      - \`stories-changed\`: stories affected by your uncommitted changes
      - \`stories-find-by-component\` with \`componentPaths: ["/abs/path/Button.tsx"]\`: only for files \`stories-changed\` leaves out
      - \`docs-list\` with \`withStoryIds: true\`: every story id

      Story ids come only from the result of these tools, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory. When none of them finds a story for a component, it has no stories yet: say so, or write them."
    `);
  });
});
