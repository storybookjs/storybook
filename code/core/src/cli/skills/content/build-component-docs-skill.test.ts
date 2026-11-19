import { describe, expect, it } from 'vitest';

import { buildComponentDocsSkill } from './build-component-docs-skill.ts';

const cli = { transport: 'cli', docsSupported: true } as const;
const mcp = { transport: 'mcp', docsSupported: true } as const;

describe('buildComponentDocsSkill', () => {
  it('teaches docs list before docs show, with the source of a composed Storybook', () => {
    const text = buildComponentDocsSkill(cli);

    expect(text).toContain('npx storybook tools docs list');
    expect(text).toContain('npx storybook tools docs show --id <id>');
    expect(text).toContain('npx storybook tools docs show-story --storyId <id>');
    expect(text.indexOf('docs list')).toBeLessThan(text.indexOf('docs show'));
    expect(text).toContain('--storybookId acme');
  });

  it('asks to read each docs show output whole, one id per command', () => {
    expect(buildComponentDocsSkill(cli)).toContain(
      'Run `docs show` once per id, each in its own command, and read its whole output without `head` or `tail`'
    );
  });

  it('names no other skill, so the agent instructions decide the workflow', () => {
    expect(buildComponentDocsSkill(cli)).not.toMatch(/write-stories|test-stories|ui-review/);
  });

  it('names the MCP tools and their inputs instead of commands and flags over MCP', () => {
    const text = buildComponentDocsSkill(mcp);

    expect(text).toContain('The tools named here are tools of the Storybook MCP server.');
    expect(text).toContain('- `docs-show` with an `id`: props and usage examples of one entry');
    expect(text).toContain('Call `docs-show` once per id and read its whole result');
    expect(text).toContain(
      'pass the source of the entry as `storybookId: "acme"` to `docs-show` and `docs-show-story`'
    );
    expect(text).not.toContain('npx storybook');
    expect(text).not.toContain('--help');
  });

  it('tells the agent to skip the step when the project has no component docs', () => {
    expect(buildComponentDocsSkill({ ...cli, docsSupported: false })).toMatchInlineSnapshot(`
      "# Storybook component docs

      This Storybook has no component docs to look up. Skip this step, and read the source files of the components you use instead."
    `);
  });

  it('says when to skip the step, and keeps its tools, when main.ts turns the docs toolset off', () => {
    const text = buildComponentDocsSkill({ ...mcp, toolsetOff: true });

    expect(text).toContain(
      'The `main.ts` of this project turns the `docs` toolset of the Storybook MCP server off. When the server does not give you `docs-list`, skip this step.'
    );
    expect(text).toContain('- `docs-show` with an `id`');
    expect(buildComponentDocsSkill(mcp)).not.toContain('skip this step');
  });
});
