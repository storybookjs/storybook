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

  it('builds a coherent instruction set when all toolsets are enabled', () => {
    const instructions = buildServerInstructions({
      transport: 'mcp',
      devEnabled: true,
      testSupported: true,
      docsEnabled: true,
    });

    expect(instructions).toMatchInlineSnapshot(`
      "Follow these workflows when working with UI and/or Storybook. Answer questions about component props, API, or usage with the documentation tools — never from source or type definitions.

      ## UI Building and Story Writing Workflow

      - Before creating or editing components or stories, call **get-storybook-story-instructions**; its output is the source of truth for imports, story patterns, and testing conventions.
      - After editing anything that changes how the UI looks — components, stories, styles, themes, tokens — call **stories-changed** to discover the affected stories.
      - End your final response with the review section from **review-create**'s result — never substitute preview URLs. **stories-preview** is only for mid-loop iteration or a requested direct link. If nothing visually changed, say so.
      - After a visually observable UI change, or when the user asks to see or browse stories/components, call **review-create** (again on each iteration) and follow its description and result. Visual work is not done until the review is published; any newly created story MUST be included.
      - Only use story IDs returned by tools — never derive them from file names or memory. **stories-find-by-component** maps any input to stories; its description covers the workflow. No matches means no stories exist yet — say so.

      ## Validation Workflow

      - After editing anything that changes how the UI looks, run **test-run** — never a package.json test script.
      - Never report completion while story tests are failing.

      ## Documentation Workflow

      **CRITICAL: Never hallucinate component properties!** Undocumented props do not exist — never assume them from naming or other libraries; verify every prop via these tools, not source or types in node_modules.

      1. Call **docs-list** once at task start for component and docs IDs.
      2. Call **docs-show** with an \`id\` from that list for props and usage examples.

      Only reference IDs returned by these tools — never guess; scope multi-source requests with \`storybookId\`."
    `);
  });

  it('builds a coherent instruction set for dev only', () => {
    const instructions = buildServerInstructions({
      transport: 'mcp',
      devEnabled: true,
      testSupported: false,
      docsEnabled: false,
    });

    expect(instructions).toMatchInlineSnapshot(`
      "Follow these workflows when working with UI and/or Storybook.

      ## UI Building and Story Writing Workflow

      - Before creating or editing components or stories, call **get-storybook-story-instructions**; its output is the source of truth for imports, story patterns, and testing conventions.
      - After editing anything that changes how the UI looks — components, stories, styles, themes, tokens — call **stories-changed** to discover the affected stories.
      - End your final response with the review section from **review-create**'s result — never substitute preview URLs. **stories-preview** is only for mid-loop iteration or a requested direct link. If nothing visually changed, say so.
      - After a visually observable UI change, or when the user asks to see or browse stories/components, call **review-create** (again on each iteration) and follow its description and result. Visual work is not done until the review is published; any newly created story MUST be included.
      - Only use story IDs returned by tools — never derive them from file names or memory. **stories-find-by-component** maps any input to stories; its description covers the workflow. No matches means no stories exist yet — say so."
    `);
  });

  it('builds a coherent instruction set for docs only', () => {
    const instructions = buildServerInstructions({
      transport: 'mcp',
      devEnabled: false,
      testSupported: false,
      docsEnabled: true,
    });

    expect(instructions).toMatchInlineSnapshot(`
      "Follow these workflows when working with UI and/or Storybook. Answer questions about component props, API, or usage with the documentation tools — never from source or type definitions.

      ## Documentation Workflow

      **CRITICAL: Never hallucinate component properties!** Undocumented props do not exist — never assume them from naming or other libraries; verify every prop via these tools, not source or types in node_modules.

      1. Call **docs-list** once at task start for component and docs IDs.
      2. Call **docs-show** with an \`id\` from that list for props and usage examples.

      Only reference IDs returned by these tools — never guess; scope multi-source requests with \`storybookId\`."
    `);
  });

  it('builds a coherent instruction set for test only', () => {
    const instructions = buildServerInstructions({
      transport: 'mcp',
      devEnabled: false,
      testSupported: true,
      docsEnabled: false,
    });

    expect(instructions).toMatchInlineSnapshot(`
      "Follow these workflows when working with UI and/or Storybook.

      ## Validation Workflow

      - After editing anything that changes how the UI looks, run **test-run** — never a package.json test script.
      - Never report completion while story tests are failing."
    `);
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

  describe('transport: cli', () => {
    it('renders sibling-tool references as `storybook tools` commands instead of MCP tool names', () => {
      const instructions = buildServerInstructions({
        transport: 'cli',
        devEnabled: true,
        testSupported: false,
        docsEnabled: false,
      });

      expect(instructions).toContain('**npx storybook tools stories changed**');
      expect(instructions).not.toContain('stories-changed');
    });

    it('renders the write-story skill cross-reference as a `storybook skills` command', () => {
      const instructions = buildServerInstructions({
        transport: 'cli',
        devEnabled: true,
        testSupported: false,
        docsEnabled: false,
      });

      expect(instructions).toContain('npx storybook skills write-story');
      expect(instructions).not.toContain('get-storybook-story-instructions');
    });

    it('points at the story instructions in the same document when they are inline', () => {
      const instructions = buildServerInstructions({
        transport: 'cli',
        devEnabled: true,
        testSupported: false,
        docsEnabled: false,
        storyInstructionsInline: true,
      });

      expect(instructions).toContain(
        '- Before creating or editing components or stories, read **Writing User Interfaces** below; it is the source of truth for imports, story patterns, and testing conventions.'
      );
      expect(instructions).not.toContain('npx storybook skills write-story');
    });

    it('renders review, preview, and discovery references as CLI commands', () => {
      const instructions = buildServerInstructions({
        transport: 'cli',
        devEnabled: true,
        testSupported: false,
        docsEnabled: false,
      });

      expect(instructions).toContain('**npx storybook tools stories find-by-component**');
      expect(instructions).toContain('**npx storybook tools review create**');
      expect(instructions).toContain('**npx storybook tools stories preview**');
      expect(instructions).not.toContain('review-create');
      expect(instructions).not.toContain('stories-preview');
      expect(instructions).not.toContain('stories-find-by-component');
    });

    it('renders docs tool references as CLI commands', () => {
      const instructions = buildServerInstructions({
        transport: 'cli',
        devEnabled: false,
        testSupported: false,
        docsEnabled: true,
      });

      expect(instructions).toContain('npx storybook tools docs list');
      expect(instructions).toContain('npx storybook tools docs show');
      expect(instructions).not.toContain('docs-list');
      expect(instructions).not.toContain('docs-show');
    });
  });
});
