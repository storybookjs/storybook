import { describe, expect, it } from 'vitest';

import { buildStoriesSkill, type StoriesSkillInputs } from './build-stories-skill.ts';

const everything: StoriesSkillInputs = {
  framework: '@storybook/react-vite',
  csfFactories: false,
  previewFile: '.storybook/preview.ts',
  typescript: true,
  docsEnabled: true,
  testSupported: true,
  a11yEnabled: true,
  moduleGraphSupported: true,
};

describe('buildStoriesSkill', () => {
  it('shows every command with its arguments when every feature is on', () => {
    const text = buildStoriesSkill(everything);

    expect(text).toContain('npx storybook tools docs show --id <id>');
    expect(text).toContain(`npx storybook tools test run --stories '[{"storyId":"<id>"}]'`);
    expect(text).toContain('npx storybook tools stories changed');
    expect(text).toContain(`npx storybook tools stories find-by-component --componentPaths '["`);
    expect(text).toContain(`npx storybook tools review create --input '{`);
    expect(text).toContain('accessibility violations');
  });

  it('leaves out testing when the project cannot run story tests', () => {
    const text = buildStoriesSkill({ ...everything, testSupported: false, a11yEnabled: false });

    expect(text).not.toContain('test run');
    expect(text).not.toContain('accessibility');
  });

  it('requires the commands that find affected stories before a review, not the full story list', () => {
    const text = buildStoriesSkill(everything);

    expect(text).toContain(
      'Run `stories changed` or `find-by-component` before every review, also when you already know the ids'
    );
    expect(text).not.toContain('Run one of these');
  });

  it('takes story ids from the story list when the builder has no module graph', () => {
    const text = buildStoriesSkill({ ...everything, moduleGraphSupported: false });

    expect(text).toContain('docs list --withStoryIds true');
    expect(text).toContain('Story ids come only from this command.');
    expect(text).toContain('When it does not find a story');
    expect(text).not.toContain('stories changed');
    expect(text).not.toContain('find-by-component');
  });

  it('selects stories by file and export when no command lists story ids', () => {
    const text = buildStoriesSkill({
      ...everything,
      docsEnabled: false,
      moduleGraphSupported: false,
    });

    expect(text).toContain('"absoluteStoryPath"');
    expect(text).not.toContain('stories changed');
  });

  it('teaches CSF Factories instead of Meta and StoryObj when the preview uses definePreview', () => {
    const text = buildStoriesSkill({
      ...everything,
      csfFactories: true,
      previewFile: '.storybook/preview.tsx',
    });

    expect(text).toContain('preview.meta({');
    expect(text).toContain('Do not import `Meta` or `StoryObj`');
    expect(text).not.toContain('Import `Meta` and `StoryObj`');
  });

  it('teaches Meta and StoryObj from the framework package otherwise', () => {
    const text = buildStoriesSkill({ ...everything, framework: '@storybook/vue3-vite' });

    expect(text).toContain('Import `Meta` and `StoryObj` from `@storybook/vue3-vite`');
    expect(text).not.toContain('preview.meta({');
  });

  it('leaves out the Meta and StoryObj types in a JavaScript project', () => {
    const text = buildStoriesSkill({
      ...everything,
      previewFile: '.storybook/preview.js',
      typescript: false,
    });

    expect(text).not.toContain('StoryObj');
    expect(text).toContain('- Import `fn`, `expect`, `mocked` and `sb` from `storybook/test`.');
    expect(text).toContain("sb.mock(import('../src/api.js')");
  });

  it('puts MSW before module mocks and names the preview file of the project', () => {
    const text = buildStoriesSkill({ ...everything, previewFile: 'config/preview.tsx' });

    expect(text.indexOf('msw.use(')).toBeLessThan(text.indexOf('sb.mock('));
    expect(text).toContain('register it in `config/preview.tsx`');
  });
});
