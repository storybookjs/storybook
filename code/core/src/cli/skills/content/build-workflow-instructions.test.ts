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
  it('is the workflow: one step per skill, in order', () => {
    expect(buildAgentInstructions()).toMatchInlineSnapshot(`
      "## Storybook

      For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow these steps in order. Each step has a Storybook skill: invoke it when you reach the step, and follow it.

      1. \`component-docs\`, before you edit any file: look up the components to reuse, with their props and usage examples. Also when the user asks about a component's props, API, or usage.
      2. \`write-stories\`, before you write the code: every component you create or change gets stories.
      3. \`test-stories\`, after every change: run the story tests the way this skill says, never with a \`package.json\` test script, and fix what fails. Also when the user asks to run or fix story tests.
      4. \`ui-review\`, as your last step: publish a review that shows the user what changed. Also when the user asks to see components or stories."
    `);
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

  it('runs the skills with --mcp, in the words of the AGENTS.md section, when all toolsets are enabled', () => {
    expect(buildServerInstructions(everything)).toMatchInlineSnapshot(`
      "## Storybook

      For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow these steps in order. Each step has a Storybook skill: run it when you reach the step, and follow it. Run a skill in a command of its own, from the package where Storybook is installed, and read its whole output, without \`head\` or \`tail\`.

      1. \`npx storybook skills component-docs --mcp\`, before you edit any file: look up the components to reuse, with their props and usage examples. Also when the user asks about a component's props, API, or usage.
      2. \`npx storybook skills write-stories --mcp\`, before you write the code: every component you create or change gets stories.
      3. \`npx storybook skills test-stories --mcp\`, after every change: run the story tests the way this skill says, never with a \`package.json\` test script, and fix what fails. Also when the user asks to run or fix story tests.
      4. \`npx storybook skills ui-review --mcp\`, as your last step: publish a review that shows the user what changed. Also when the user asks to see components or stories.

      When you publish a review with \`review-create\`, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it."
    `);
  });

  it('states the steps of the AGENTS.md section word for word', () => {
    const stepText = (line: string) => line.slice(line.indexOf(', '));
    const steps = (text: string) => text.split('\n').filter((line) => /^\d\. /.test(line));

    expect(steps(buildServerInstructions(everything)).map(stepText)).toEqual(
      steps(buildAgentInstructions()).map(stepText)
    );
  });

  it('leaves out the steps of toolsets that are off, and numbers the rest', () => {
    const instructions = buildServerInstructions({
      devEnabled: true,
      testSupported: false,
      docsEnabled: false,
    });

    expect(instructions).toContain('1. `npx storybook skills write-stories --mcp`');
    expect(instructions).toContain('2. `npx storybook skills ui-review --mcp`');
    expect(instructions).not.toContain('test-stories');
    expect(instructions).not.toContain('component-docs');
  });

  it('leaves out writing stories and the review without the dev toolset', () => {
    const instructions = buildServerInstructions({ ...everything, devEnabled: false });

    expect(instructions).toContain('1. `npx storybook skills component-docs --mcp`');
    expect(instructions).toContain('2. `npx storybook skills test-stories --mcp`');
    expect(instructions).not.toContain('write-stories');
    expect(instructions).not.toContain('ui-review');
    expect(instructions).not.toContain('review-create');
  });

  it('names one step for one toolset', () => {
    expect(buildServerInstructions({ devEnabled: false, testSupported: false, docsEnabled: true }))
      .toMatchInlineSnapshot(`
      "## Storybook

      For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow this step. It has a Storybook skill: run it when you reach the step, and follow it. Run a skill in a command of its own, from the package where Storybook is installed, and read its whole output, without \`head\` or \`tail\`.

      1. \`npx storybook skills component-docs --mcp\`, before you edit any file: look up the components to reuse, with their props and usage examples. Also when the user asks about a component's props, API, or usage."
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
