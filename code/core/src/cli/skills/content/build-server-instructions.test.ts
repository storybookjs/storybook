import { describe, expect, it } from 'vitest';
import { buildServerInstructions } from './build-server-instructions.ts';

// Claude Code hard-truncates MCP server instructions at 2,048 characters:
// anything past the limit silently never reaches the model. Between
// addon-mcp 0.6.0 and 0.7.x the instructions grew to ~8.7k chars, which cut
// off the Validation and Documentation workflows entirely — agents stopped
// using the docs tools. Details must live in tool descriptions and tool
// results, which are never truncated; the server instructions only carry the
// workflow triggers.
const MCP_CLIENT_INSTRUCTIONS_CHAR_LIMIT = 2048;

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
    const instructions = buildServerInstructions({
      devEnabled: true,
      testSupported: true,
      docsEnabled: true,
    });

    expect(instructions).toMatchInlineSnapshot(`
      "## Storybook

      For each of these tasks, run its Storybook skill first, before you edit any file, and follow it. Run a skill in a command of its own, from the package where Storybook is installed, and read its whole output, without \`head\` or \`tail\`.

      - \`npx storybook skills ui-workflow --mcp\`: you create, change, or delete a component, story, style, theme, or design token, or otherwise change how the UI looks; you run or fix story tests; or the user asks to see components or stories. It looks up the components to reuse, updates your stories, runs the tests, and publishes a review of the results.
      - \`npx storybook skills component-docs --mcp\`: you look for an existing component to reuse instead of building a new one, or the user asks about a component's props, API, or usage. It lists the project's components with their props and usage examples.

      When you publish a review with **review-create**, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it."
    `);
  });

  it('leaves out the steps of toolsets that are off', () => {
    const instructions = buildServerInstructions({
      devEnabled: true,
      testSupported: false,
      docsEnabled: false,
    });

    expect(instructions).toContain(
      'It updates your stories and publishes a review of the results.'
    );
    expect(instructions).not.toContain('story tests');
    expect(instructions).not.toContain('component-docs');
  });

  it('names test-run itself when the workflow tool is off', () => {
    const instructions = buildServerInstructions({
      devEnabled: false,
      testSupported: true,
      docsEnabled: false,
    });

    expect(instructions).toContain('For this task, call its Storybook tool first');
    expect(instructions).toContain('- **test-run**: you run or fix story tests.');
    expect(instructions).not.toContain('npx storybook skills');
    expect(instructions).not.toContain('review-create');
  });

  it('names only the docs tools for docs only', () => {
    const instructions = buildServerInstructions({
      devEnabled: false,
      testSupported: false,
      docsEnabled: true,
    });

    expect(instructions).toContain('- `npx storybook skills component-docs --mcp`');
    expect(instructions).not.toContain('ui-workflow');
    expect(instructions).not.toContain('review-create');
  });

  it('asks to run a skill or call a tool when both are named', () => {
    const instructions = buildServerInstructions({
      devEnabled: false,
      testSupported: true,
      docsEnabled: true,
    });

    expect(instructions).toContain(
      'For each of these tasks, run its Storybook skill or call its Storybook tool first'
    );
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
