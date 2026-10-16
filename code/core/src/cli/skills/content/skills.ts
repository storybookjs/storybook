/**
 * The Storybook skills: agent-facing instruction documents served by `storybook skills <id>`, and
 * `ui-workflow` and `component-docs` also as tools of addon-mcp. The ids are public CLI vocabulary —
 * plugin stubs (M7) will reference them — so treat renames as breaking.
 */
export const SKILL_IDS = ['ui-workflow', 'component-docs', 'write-story', 'setup'] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export const SKILLS: Record<SkillId, { blurb: string }> = {
  'ui-workflow': {
    blurb:
      'The workflow for UI changes, with every command it needs: look up components, write stories, test, and publish a review.',
  },
  'component-docs': {
    blurb:
      'Look up components, with their props and usage, to reuse them instead of building duplicates or to answer questions about them.',
  },
  'write-story': {
    blurb: 'Earlier name of ui-workflow; prints the same document.',
  },
  setup: {
    blurb: 'Setup instructions to write stories for the real components in this project.',
  },
};

export function isSkillId(value: string): value is SkillId {
  return (SKILL_IDS as readonly string[]).includes(value);
}
