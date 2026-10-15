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
          const options = { transport: 'mcp' as const, devEnabled, testSupported, docsEnabled };
          const length = buildServerInstructions(options).length;
          expect
            .soft(length, `instructions exceed the limit for ${JSON.stringify(options)}`)
            .toBeLessThanOrEqual(MCP_CLIENT_INSTRUCTIONS_CHAR_LIMIT);
        }
  });

  it('names the workflow tool for UI tasks and the docs tools for lookups when all toolsets are enabled', () => {
    const instructions = buildServerInstructions({
      transport: 'mcp',
      devEnabled: true,
      testSupported: true,
      docsEnabled: true,
    });

    expect(instructions).toMatchInlineSnapshot(`
      "## Storybook

      For each of these tasks, call its Storybook tool first, before you edit any file, and follow its result:

      - **get-storybook-story-instructions**: you create, change, or delete a component, story, style, theme, or design token, or otherwise change how the UI looks; you run or fix story tests; or the user asks to see components or stories. It returns the mandatory, ordered workflow, with the tools each step calls: it looks up the components to reuse, updates your stories, runs the tests, and publishes a review of the results. Read it in its entirety.
      - **docs-list**, then **docs-show** with an id from its result: you look for an existing component to reuse instead of building a new one, or the user asks about a component's props, API, or usage. Answer from these tools, not from source or type definitions, and use only the props they document.

      When you publish a review with **review-create**, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it."
    `);
  });

  it('leaves out the steps of toolsets that are off', () => {
    const instructions = buildServerInstructions({
      transport: 'mcp',
      devEnabled: true,
      testSupported: false,
      docsEnabled: false,
    });

    expect(instructions).toContain(
      'It returns the mandatory, ordered workflow, with the tools each step calls: it updates your stories, and publishes a review'
    );
    expect(instructions).not.toContain('story tests');
    expect(instructions).not.toContain('docs-list');
  });

  it('names test-run itself when the workflow tool is off', () => {
    const instructions = buildServerInstructions({
      transport: 'mcp',
      devEnabled: false,
      testSupported: true,
      docsEnabled: false,
    });

    expect(instructions).toContain('- **test-run**: you run or fix story tests.');
    expect(instructions).not.toContain('get-storybook-story-instructions');
    expect(instructions).not.toContain('review-create');
  });

  it('names only the docs tools for docs only', () => {
    const instructions = buildServerInstructions({
      transport: 'mcp',
      devEnabled: false,
      testSupported: false,
      docsEnabled: true,
    });

    expect(instructions).toContain('- **docs-list**, then **docs-show**');
    expect(instructions).not.toContain('get-storybook-story-instructions');
    expect(instructions).not.toContain('review-create');
  });

  it('returns empty instructions when all toolsets are disabled', () => {
    const instructions = buildServerInstructions({
      transport: 'mcp',
      devEnabled: false,
      testSupported: false,
      docsEnabled: false,
    });

    expect(instructions).toBe('');
  });

  it('renders tool and skill references as CLI commands on the CLI transport', () => {
    const instructions = buildServerInstructions({
      transport: 'cli',
      devEnabled: true,
      testSupported: true,
      docsEnabled: true,
    });

    expect(instructions).toContain('**npx storybook skills ui-workflow**');
    expect(instructions).toContain('**npx storybook tools docs list**');
    expect(instructions).toContain('**npx storybook tools review create**');
    expect(instructions).not.toContain('get-storybook-story-instructions');
    expect(instructions).not.toContain('docs-list');
    expect(instructions).not.toContain('review-create');
  });
});
