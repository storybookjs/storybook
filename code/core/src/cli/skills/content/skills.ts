/**
 * The Storybook skills: agent-facing instruction documents served by `storybook skills <id>`
 * and, on the MCP side, by addon-mcp (server instructions and the story-instructions tool). The
 * ids are public CLI vocabulary — plugin stubs (M7) will reference them — so treat renames as
 * breaking.
 */
export const SKILL_IDS = ['stories', 'write-story', 'setup'] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export const SKILLS: Record<SkillId, { blurb: string }> = {
  stories: {
    blurb:
      'The workflow for UI changes, with every command it needs: look up components, write stories, test, and publish a review.',
  },
  'write-story': {
    blurb:
      'How to write, update, and test Storybook stories for this project: imports, patterns, and conventions.',
  },
  setup: {
    blurb: 'Setup instructions to write stories for the real components in this project.',
  },
};

export function isSkillId(value: string): value is SkillId {
  return (SKILL_IDS as readonly string[]).includes(value);
}
