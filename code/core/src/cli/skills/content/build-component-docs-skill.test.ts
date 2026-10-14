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
    'sends a UI change to ui-workflow when the agent instructions name it (docs enabled: %s)',
    (docsEnabled) => {
      expect(buildComponentDocsSkill({ docsEnabled })).toContain(
        "For a change to the UI, use the `ui-workflow` skill when the project's agent instructions"
      );
    }
  );

  it('sends the agent to the source files when the project has no components manifest', () => {
    const text = buildComponentDocsSkill({ docsEnabled: false });

    expect(text).toContain('`storybook tools docs` is unavailable');
    expect(text).not.toContain('npx storybook tools docs list');
  });
});
