import { describe, expect, it } from 'vitest';

import { buildAgentInstructions, buildServerInstructions } from './build-workflow-instructions.ts';

// Claude Code hard-truncates MCP server instructions at 2,048 characters:
// anything past the limit silently never reaches the model. Between
// addon-mcp 0.6.0 and 0.7.x the instructions grew to ~8.7k chars, which cut
// off the Validation and Documentation workflows entirely — agents stopped
// using the docs tools. Details must live in the skills, tool descriptions and
// tool results, which are never truncated; the server instructions only carry
// the workflow.
const MCP_CLIENT_INSTRUCTIONS_CHAR_LIMIT = 2048;

const everything = { devEnabled: true, testSupported: true, docsEnabled: true };

describe('buildAgentInstructions', () => {
  it('is the workflow: two skills, then the test command itself', () => {
    expect(buildAgentInstructions()).toMatchInlineSnapshot(`
      "## Storybook

      For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow these steps in order. First invoke the Storybook skills of steps 1 and 2, before you edit any file. Then follow each skill at its step.

      1. \`component-docs\`: look up the components to reuse, with their props and usage examples, before you edit any file. Also when the user asks about a component's props, API, or usage.
      2. \`write-stories\`: every component you create or change gets stories.
      3. Run the story tests after every change, and fix what fails. Also when the user asks to run or fix story tests. Run them from the package where Storybook is installed, never with a \`package.json\` test script or \`vitest\`:
         - \`npx storybook tools test run --changed\`: the stories your uncommitted changes reach. Run this after a change.
         - \`npx storybook tools test run src/Button.stories.tsx\`: the stories in these story files.
         - \`npx storybook tools test run\`: every story.

      When the user asks for a review or to see stories, use the \`ui-review\` skill. Otherwise, after a change the user can see, end your answer with the line "Use the /ui-review skill to see the changed components in Storybook" for the user, without running the review yourself."
    `);
  });

  it('leaves out the test step without addon-vitest', () => {
    const instructions = buildAgentInstructions({ testSupported: false });

    expect(instructions).toContain('2. `write-stories`');
    expect(instructions).not.toContain('3.');
    expect(instructions).not.toContain('test run');
  });

  it('leaves the review to the user, and ends a visible change with a line that offers it', () => {
    const instructions = buildAgentInstructions();

    expect(instructions).not.toMatch(/^\d\. .*ui-review/m);
    expect(instructions.split('\n').at(-1)).toBe(
      'When the user asks for a review or to see stories, use the `ui-review` skill. Otherwise, after a change the user can see, end your answer with the line "Use the /ui-review skill to see the changed components in Storybook" for the user, without running the review yourself.'
    );
  });
});

describe('buildServerInstructions', () => {
  it('stays under the MCP client truncation limit in every configuration', () => {
    const bools = [true, false] as const;
    for (const devEnabled of bools)
      for (const testSupported of bools)
        for (const docsEnabled of bools) {
          const options = { devEnabled, testSupported, docsEnabled };
          const length = buildServerInstructions(options).length;
          expect
            .soft(length, `instructions exceed the limit for ${JSON.stringify(options)}`)
            .toBeLessThanOrEqual(MCP_CLIENT_INSTRUCTIONS_CHAR_LIMIT);
        }
  });

  it('runs the skills with --mcp and the tests with test-run, when all toolsets are enabled', () => {
    expect(buildServerInstructions(everything)).toMatchInlineSnapshot(`
      "## Storybook

      For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow these steps in order. First run the Storybook skills of steps 1 and 2, before you edit any file: each in a command of its own, from the package where Storybook is installed, and read its whole output, without \`head\` or \`tail\`. Then follow each skill at its step.

      1. \`npx storybook skills component-docs --mcp\`: look up the components to reuse, with their props and usage examples, before you edit any file. Also when the user asks about a component's props, API, or usage.
      2. \`npx storybook skills write-stories --mcp\`: every component you create or change gets stories.
      3. Run the story tests after every change, and fix what fails. Also when the user asks to run or fix story tests. Call \`test-run\` (never a \`package.json\` test script or \`vitest\`): with \`changed: true\` after a change, for the stories your uncommitted changes reach; with \`files: ["src/Button.stories.tsx"]\` for the stories in those story files; with neither for every story.

      When the user asks for a review or to see stories, run \`npx storybook skills ui-review --mcp\` first. Otherwise, after a change the user can see, end your answer with the line "Use the /ui-review skill to see the changed components in Storybook" for the user, without running the review yourself.

      Run the skill of a step before you call a tool of that step, also when the request is only that step.

      When you create a review with \`review-create\`, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it."
    `);
  });

  it('states the skill steps of the AGENTS.md section word for word', () => {
    const stepText = (line: string) => line.slice(line.indexOf('`: '));
    const skillSteps = (text: string) => text.split('\n').filter((line) => /^\d\. `/.test(line));

    expect(skillSteps(buildServerInstructions(everything)).map(stepText)).toEqual(
      skillSteps(buildAgentInstructions()).map(stepText)
    );
  });

  it('states the rules of the test step of the AGENTS.md section', () => {
    const testStep = (text: string) => text.split('\n').find((line) => line.startsWith('3. '));
    const rules =
      'Run the story tests after every change, and fix what fails. Also when the user asks to run or fix story tests.';

    expect(testStep(buildAgentInstructions())).toContain(rules);
    expect(testStep(buildServerInstructions(everything))).toContain(rules);
    expect(testStep(buildServerInstructions(everything))).toContain(
      'never a `package.json` test script or `vitest`'
    );
  });

  it('leaves out the steps of toolsets that are off, and numbers the rest', () => {
    const instructions = buildServerInstructions({
      devEnabled: true,
      testSupported: false,
      docsEnabled: false,
    });

    expect(instructions).toContain('1. `npx storybook skills write-stories --mcp`');
    expect(instructions).not.toContain('2.');
    expect(instructions).not.toContain('test-run');
    expect(instructions).not.toContain('component-docs');
  });

  it('leaves out writing stories and the review without the dev toolset', () => {
    const instructions = buildServerInstructions({ ...everything, devEnabled: false });

    expect(instructions).toContain('1. `npx storybook skills component-docs --mcp`');
    expect(instructions).toContain('2. Run the story tests');
    expect(instructions).toContain(
      'First run the Storybook skill of step 1, before you edit any file'
    );
    expect(instructions).not.toContain('write-stories');
    expect(instructions).not.toContain('review-create');
    expect(instructions).not.toContain('ui-review');
  });

  it('names one step for one toolset', () => {
    expect(buildServerInstructions({ devEnabled: false, testSupported: false, docsEnabled: true }))
      .toMatchInlineSnapshot(`
      "## Storybook

      For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow this step. It has a Storybook skill. Run it before you edit any file, in a command of its own, from the package where Storybook is installed, and read its whole output, without \`head\` or \`tail\`, and follow it.

      1. \`npx storybook skills component-docs --mcp\`: look up the components to reuse, with their props and usage examples, before you edit any file. Also when the user asks about a component's props, API, or usage.

      Run the skill before you call a tool of its step, also when the request is only that step."
    `);
  });

  it('names no skill when only the test toolset is on', () => {
    expect(buildServerInstructions({ devEnabled: false, testSupported: true, docsEnabled: false }))
      .toMatchInlineSnapshot(`
        "## Storybook

        For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow this step.

        1. Run the story tests after every change, and fix what fails. Also when the user asks to run or fix story tests. Call \`test-run\` (never a \`package.json\` test script or \`vitest\`): with \`changed: true\` after a change, for the stories your uncommitted changes reach; with \`files: ["src/Button.stories.tsx"]\` for the stories in those story files; with neither for every story."
      `);
  });

  it('returns empty instructions when all toolsets are disabled', () => {
    const instructions = buildServerInstructions({
      devEnabled: false,
      testSupported: false,
      docsEnabled: false,
    });

    expect(instructions).toBe('');
  });
});
