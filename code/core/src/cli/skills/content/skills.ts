/**
 * The Storybook skills: agent-facing instruction documents served by `storybook skills <id>`,
 * which addon-mcp's server instructions run with `--mcp`. The ids are public CLI vocabulary —
 * the plugin skills and the `AGENTS.md` section reference them — so treat renames as breaking.
 */
export const SKILL_IDS = [
  'component-docs',
  'write-stories',
  'test-stories',
  'ui-review',
  'setup',
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export const SKILLS: Record<SkillId, { blurb: string }> = {
  'component-docs': {
    blurb:
      'Look up components, with their props and usage, to answer questions about them or to reuse them instead of building duplicates.',
  },
  'write-stories': {
    blurb:
      'How to write the stories of a component in this project: imports, play functions and mocks.',
  },
  'test-stories': {
    blurb: 'Run the story tests, with their accessibility checks, and fix what fails.',
  },
  'ui-review': {
    blurb: 'Find the stories a change affects and publish a review that shows them to the user.',
  },
  setup: {
    blurb: 'Setup instructions to write stories for the real components in this project.',
  },
};

export function isSkillId(value: string): value is SkillId {
  return (SKILL_IDS as readonly string[]).includes(value);
}
