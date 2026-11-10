import { describe, expect, it } from 'vitest';

import { buildComponentDocsSkill } from './build-component-docs-skill.ts';

describe('buildComponentDocsSkill', () => {
  it('teaches docs list before docs show, with the source of a composed Storybook', () => {
    const text = buildComponentDocsSkill();

    expect(text).toContain('npx storybook tools docs list');
    expect(text).toContain('npx storybook tools docs show --id <id>');
    expect(text).toContain('npx storybook tools docs show-story --storyId <id>');
    expect(text.indexOf('docs list')).toBeLessThan(text.indexOf('docs show'));
    expect(text).toContain('--storybookId acme');
  });

  it('asks to read each docs show output whole, one id per command', () => {
    expect(buildComponentDocsSkill()).toContain(
      'Run `docs show` once per id, each in its own command, and read its whole output without `head` or `tail`'
    );
  });

  it('names no other skill, so the agent instructions decide the workflow', () => {
    expect(buildComponentDocsSkill()).not.toMatch(/write-stories|test-stories|ui-review/);
  });

  it('names the MCP tools and their inputs instead of commands and flags over MCP', () => {
    const text = buildComponentDocsSkill('mcp');

    expect(text).toContain('The tools named here are tools of the Storybook MCP server.');
    expect(text).toContain('- `docs-show` with an `id`: props and usage examples of one entry');
    expect(text).toContain('Call `docs-show` once per id and read its whole result');
    expect(text).toContain(
      'pass the source of the entry as `storybookId: "acme"` to `docs-show` and `docs-show-story`'
    );
    expect(text).not.toContain('npx storybook');
    expect(text).not.toContain('--help');
  });
});
