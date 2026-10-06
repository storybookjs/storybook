import { describe, expect, it } from 'vitest';

import { DOCS_TOOLSET_INSTRUCTIONS } from './instructions.ts';

describe('DOCS_TOOLSET_INSTRUCTIONS', () => {
  it('names the docs tools the way an MCP client calls them', () => {
    expect(DOCS_TOOLSET_INSTRUCTIONS).toContain('**docs-list**');
    expect(DOCS_TOOLSET_INSTRUCTIONS).toContain('**docs-show**');
    expect(DOCS_TOOLSET_INSTRUCTIONS).toContain('**docs-show-story**');
  });
});
