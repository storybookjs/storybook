import { describe, expect, it } from 'vitest';

import { renderCodexSkill } from './scripts/codex-skill.ts';

describe('renderCodexSkill', () => {
  it('drops the storybook- name prefix and rewrites inline-code skill references', () => {
    const rendered = renderCodexSkill(`---
name: storybook-setup
---
If not, switch to \`/storybook-init\`, or \`/storybook-upgrade\` when needed.
`);

    expect(rendered).toEqual({
      name: 'setup',
      content: `---
name: setup
---
If not, switch to \`$storybook:init\`, or \`$storybook:upgrade\` when needed.
`,
    });
  });

  it('leaves links, paths and URLs that contain /storybook- untouched', () => {
    const skill = `---
name: stories
---
See [Setup](/storybook-init), \`/storybook-init/SKILL.md\` and https://storybook.js.org/storybook-init.
`;

    expect(renderCodexSkill(skill).content).toBe(skill);
  });
});
