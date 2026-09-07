import { describe, expect, it } from 'vitest';

import { getSkillRef } from './skill-refs.ts';
import { SKILL_IDS, SKILLS } from './skills.ts';

describe('getSkillRef', () => {
  it('renders the frozen MCP tool name for write-story on the MCP transport', () => {
    expect(getSkillRef('mcp')('write-story')).toBe('get-storybook-story-instructions');
  });

  it('renders the skills CLI command on the CLI transport', () => {
    expect(getSkillRef('cli')('write-story')).toBe('npx storybook skills write-story');
    expect(getSkillRef('cli')('stories')).toBe('npx storybook skills stories');
    expect(getSkillRef('cli')('setup')).toBe('npx storybook skills setup');
  });

  it('falls back to the CLI command for skills with no MCP tool equivalent', () => {
    // `stories` is delivered via MCP server instructions, not a callable tool,
    // so even the MCP transport names the CLI command as the reachable channel.
    expect(getSkillRef('mcp')('stories')).toBe('npx storybook skills stories');
  });
});

describe('SKILLS', () => {
  it('has a blurb for every id', () => {
    for (const id of SKILL_IDS) {
      expect(SKILLS[id].blurb.length).toBeGreaterThan(10);
    }
  });
});
