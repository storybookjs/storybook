import { describe, expect, it } from 'vitest';

import {
  REVIEW_HINT_LINE,
  buildAgentInstructions,
  buildServerInstructions,
} from './build-workflow-instructions.ts';

// Claude Code hard-truncates MCP server instructions at 2,048 characters:
// anything past the limit silently never reaches the model. Between
// addon-mcp 0.6.0 and 0.7.x the instructions grew to ~8.7k chars, which cut
// off the Validation and Documentation workflows entirely — agents stopped
// using the docs tools. Details must live in the skills, tool descriptions and
// tool results, which are never truncated; the server instructions only carry
// the workflow.
const MCP_CLIENT_INSTRUCTIONS_CHAR_LIMIT = 2048;

const everything = { testSupported: true, docsEnabled: true };

describe('buildAgentInstructions', () => {
  it('is the workflow: two skills, then the test command itself', () => {
    expect(buildAgentInstructions({ testSupported: true })).toMatchInlineSnapshot(`
      "## Storybook

      For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow these steps in order. First invoke the Storybook skills of steps 1 and 2, before you edit any file. Then follow each skill at its step.

      1. \`/component-docs\`: look up the components to reuse, with their props and usage examples, before you edit any file.
      2. \`/write-stories\`: every component you create or change gets stories, written with the current best practices for this Storybook version and this project.
      3. To test stories in the CLI run:
         \`\`\`sh
         npx storybook tools test run [files...]   # every story, or these story files
         npx storybook tools test run --changed    # the stories your changes affect
         \`\`\`
      4. ALWAYS inform the user about the \`/ui-review\` skill after a change the user can see: "Use the /ui-review skill to see the changed components in Storybook""
    `);
  });

  it('leaves out the test step without addon-vitest', () => {
    const instructions = buildAgentInstructions({ testSupported: false });

    expect(instructions).toContain('2. `/write-stories`');
    expect(instructions).toContain('3. ALWAYS inform the user about the `/ui-review` skill');
    expect(instructions).not.toContain('test run');
  });

  it('tells the user about the review as its last step, without creating one', () => {
    const instructions = buildAgentInstructions({ testSupported: true });

    expect(instructions.split('\n').at(-1)).toBe(
      `4. ALWAYS inform the user about the \`/ui-review\` skill after a change the user can see: "${REVIEW_HINT_LINE}"`
    );
    // When to create a review is in the description of the `ui-review` skill.
    expect(instructions).not.toContain('asks for a review');
  });
});

describe('buildServerInstructions', () => {
  it('stays under the MCP client truncation limit in every configuration', () => {
    const bools = [true, false] as const;
    for (const testSupported of bools)
      for (const docsEnabled of bools) {
        const options = { testSupported, docsEnabled };
        const length = buildServerInstructions(options).length;
        expect
          .soft(length, `instructions exceed the limit for ${JSON.stringify(options)}`)
          .toBeLessThanOrEqual(MCP_CLIENT_INSTRUCTIONS_CHAR_LIMIT);
      }
  });

  it('runs the skills with --mcp and the tests with test-run, when all features are enabled', () => {
    expect(buildServerInstructions(everything)).toMatchInlineSnapshot(`
      "## Storybook

      For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow these steps in order. First run the Storybook skills of steps 1 and 2, before you edit any file: each in a command of its own, from the package where Storybook is installed, and read its whole output, without \`head\` or \`tail\`. Then follow each skill at its step.

      1. \`npx storybook skills component-docs --mcp\`: look up the components to reuse, with their props and usage examples, before you edit any file.
      2. \`npx storybook skills write-stories --mcp\`: every component you create or change gets stories, written with the current best practices for this Storybook version and this project.
      3. To test stories, call \`test-run\`: with neither for every story, with \`files\` for these story files, with \`changed: true\` for the stories your changes affect.
      4. ALWAYS inform the user about the \`/ui-review\` skill after a change the user can see: "Use the /ui-review skill to see the changed components in Storybook"

      Run the skill of a step before you call a tool of that step, also when the request is only that step.

      Also run \`npx storybook skills ui-review --mcp\` when the user asks for a review, or to see or be shown components, stories, or their states in Storybook, and \`npx storybook skills component-docs --mcp\` when the user asks about a component's props, API, or usage.

      When you create a review with \`review-create\`, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it."
    `);
  });

  it('states the skill steps of the AGENTS.md section word for word', () => {
    const stepText = (line: string) => line.slice(line.indexOf('`: '));
    const skillSteps = (text: string) => text.split('\n').filter((line) => /^\d\. `/.test(line));

    expect(skillSteps(buildServerInstructions(everything)).map(stepText)).toEqual(
      skillSteps(buildAgentInstructions({ testSupported: true })).map(stepText)
    );
  });

  it('states the test step and the review step of the AGENTS.md section', () => {
    const step = (text: string, n: number) =>
      text.split('\n').find((line) => line.startsWith(`${n}. `));
    const cli = buildAgentInstructions({ testSupported: true });
    const mcp = buildServerInstructions(everything);

    expect(step(cli, 3)).toBe('3. To test stories in the CLI run:');
    expect(step(mcp, 3)).toContain('3. To test stories, call `test-run`');
    expect(step(mcp, 4)).toBe(step(cli, 4));
  });

  it('leaves out unavailable steps, and numbers the rest', () => {
    const instructions = buildServerInstructions({
      testSupported: false,
      docsEnabled: false,
    });

    expect(instructions).toContain('1. `npx storybook skills write-stories --mcp`');
    expect(instructions).toContain('2. ALWAYS inform the user about the `/ui-review` skill');
    expect(instructions).toContain(
      'First run the Storybook skill of step 1, before you edit any file'
    );
    expect(instructions).toContain('Run the skill before you call a tool of its step');
    expect(instructions).not.toContain('3.');
    expect(instructions).not.toContain('test-run');
    expect(instructions).not.toContain('component-docs');
  });

  // Over MCP there is no skill description, so the instructions say when to run these skills.
  it('says when to run ui-review, and component-docs when the project has it', () => {
    expect(buildServerInstructions(everything)).toContain(
      "Also run `npx storybook skills ui-review --mcp` when the user asks for a review, or to see or be shown components, stories, or their states in Storybook, and `npx storybook skills component-docs --mcp` when the user asks about a component's props, API, or usage."
    );
    expect(buildServerInstructions({ ...everything, docsEnabled: false })).toContain(
      'Also run `npx storybook skills ui-review --mcp` when the user asks for a review, or to see or be shown components, stories, or their states in Storybook.'
    );
    // The AGENTS.md section leaves both to the skill descriptions.
    expect(buildAgentInstructions({ testSupported: true })).not.toMatch(
      /asks for a review|asks about a component/
    );
  });
});
