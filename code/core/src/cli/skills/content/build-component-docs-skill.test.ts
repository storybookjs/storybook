import { describe, expect, it } from 'vitest';

import { buildComponentDocsSkill } from './build-component-docs-skill.ts';

describe('buildComponentDocsSkill', () => {
  it('teaches docs list before docs show, with the source of a composed Storybook', () => {
    const text = buildComponentDocsSkill({ docsEnabled: true });

    expect(text).toContain('npx storybook tools docs list');
    expect(text).toContain('npx storybook tools docs show --id <id>');
    expect(text).toContain('npx storybook tools docs show-story --storyId <id>');
    expect(text.indexOf('docs list')).toBeLessThan(text.indexOf('docs show'));
    expect(text).toContain('--storybookId acme');
  });

  it.each([true, false])(
    'continues with ui-workflow for UI changes (docs enabled: %s)',
    (docsEnabled) => {
      expect(buildComponentDocsSkill({ docsEnabled })).toContain(
        'When you change the UI, continue with the `ui-workflow` skill (`npx storybook skills ui-workflow`)'
      );
    }
  );

  it('sends the agent to the source files when the project has no components manifest', () => {
    const text = buildComponentDocsSkill({ docsEnabled: false });

    expect(text).toContain('`storybook tools docs` is unavailable');
    expect(text).not.toContain('npx storybook tools docs list');
  });
});
