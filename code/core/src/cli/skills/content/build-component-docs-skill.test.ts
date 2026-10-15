import { describe, expect, it } from 'vitest';

import { buildComponentDocsSkill } from './build-component-docs-skill.ts';

describe('buildComponentDocsSkill', () => {
  it('teaches docs list before docs show, with the source of a composed Storybook', () => {
    const text = buildComponentDocsSkill();

    expect(text).toContain('npx storybook tools docs list');
    expect(text).toContain('npx storybook tools docs show --id <id>');
    expect(text).toContain('npx storybook tools docs show-story --storyId <id>');
    expect(text.indexOf('docs list')).toBeLessThan(text.indexOf('docs show'));
    expect(text).toContain('--storybookId acme');
  });

  it('asks to read each docs show output whole, one id per command', () => {
    expect(buildComponentDocsSkill()).toContain(
      'Run `docs show` once per id, each in its own command, and read its whole output without `head` or `tail`'
    );
  });

  it('sends a UI change to ui-workflow when the agent instructions name it', () => {
    expect(buildComponentDocsSkill()).toContain(
      "For a change to the UI, use the `ui-workflow` skill when the project's agent instructions"
    );
  });
});
