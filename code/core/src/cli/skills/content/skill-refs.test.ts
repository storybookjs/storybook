import { describe, expect, it } from 'vitest';

import { getSkillRef } from './skill-refs.ts';
import { SKILL_IDS, SKILLS } from './skills.ts';

describe('getSkillRef', () => {
  it('renders the frozen MCP tool name for ui-workflow on the MCP transport', () => {
    expect(getSkillRef('mcp')('ui-workflow')).toBe('get-storybook-story-instructions');
  });

  it('renders the skills CLI command on the CLI transport', () => {
    expect(getSkillRef('cli')('ui-workflow')).toBe('npx storybook skills ui-workflow');
    expect(getSkillRef('cli')('setup')).toBe('npx storybook skills setup');
  });

  it('falls back to the CLI command for skills with no MCP tool equivalent', () => {
    expect(getSkillRef('mcp')('setup')).toBe('npx storybook skills setup');
  });
});

describe('SKILLS', () => {
  it('has a blurb for every id', () => {
    for (const id of SKILL_IDS) {
      expect(SKILLS[id].blurb.length).toBeGreaterThan(10);
    }
  });
});
