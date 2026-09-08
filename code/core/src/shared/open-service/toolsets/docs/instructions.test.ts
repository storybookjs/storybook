import { describe, expect, it } from 'vitest';

import { DOCS_TOOLSET_INSTRUCTIONS, getDocsToolsetInstructions } from './instructions.ts';

describe('getDocsToolsetInstructions', () => {
  it('the MCP rendering is DOCS_TOOLSET_INSTRUCTIONS, byte for byte', () => {
    expect(getDocsToolsetInstructions('mcp')).toBe(DOCS_TOOLSET_INSTRUCTIONS);
    expect(DOCS_TOOLSET_INSTRUCTIONS).toContain('**docs-list**');
    expect(DOCS_TOOLSET_INSTRUCTIONS).toContain('**docs-show**');
  });

  it('the CLI rendering names the tools CLI commands', () => {
    const cli = getDocsToolsetInstructions('cli');
    expect(cli).toContain('**npx storybook tools docs list**');
    expect(cli).toContain('**npx storybook tools docs show**');
    expect(cli).toContain('**npx storybook tools docs show-story**');
    expect(cli).not.toContain('docs-list');
  });
});
