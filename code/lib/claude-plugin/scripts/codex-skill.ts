export function renderCodexSkill(claudeSkill: string) {
  const content = claudeSkill
    .replace(/^name: storybook-(.+)$/m, 'name: $1')
    .replace(/`\/storybook-([a-z][a-z0-9-]*)`/g, '`$$storybook:$1`');

  const name = content.match(/^name: (.+)$/m)?.[1];
  if (name === undefined) {
    throw new Error('Skill has no name frontmatter');
  }

  return { name, content };
}
