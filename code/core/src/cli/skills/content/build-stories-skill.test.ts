import { describe, expect, it } from 'vitest';

import { buildStoriesSkill, type StoriesSkillInputs } from './build-stories-skill.ts';

const everything: StoriesSkillInputs = {
  framework: '@storybook/react-vite',
  renderer: '@storybook/react',
  csfFactories: false,
  previewFile: '.storybook/preview.ts',
  typescript: true,
  docsEnabled: true,
  testSupported: true,
  a11yEnabled: true,
  changeDetectionEnabled: true,
  moduleGraphSupported: true,
  reviewEnabled: true,
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

  it('ends with story links and never mentions a review when review is off', () => {
    const text = buildStoriesSkill({
      ...everything,
      changeDetectionEnabled: false,
      reviewEnabled: false,
    });

    expect(text).toContain('## Finish with links');
    expect(text).not.toMatch(/\breview/i);
  });

  it("points at the project's own runner when Storybook has no test command", () => {
    const text = buildStoriesSkill({ ...everything, testSupported: false, a11yEnabled: false });

    expect(text).toContain('Storybook has no test command in this project');
    expect(text).not.toContain('test run');
    expect(text).not.toContain('accessibility violations');
  });

  it('teaches CSF Factories when the preview file uses definePreview', () => {
    const text = buildStoriesSkill({
      ...everything,
      csfFactories: true,
      previewFile: '.storybook/preview.tsx',
    });

    expect(text).toContain('preview.meta({');
    expect(text).toContain('meta.story({');
    expect(text).not.toContain('satisfies Meta');
    expect(text).toContain('register it once in `.storybook/preview.tsx`');
  });

  it('teaches CSF 3 with the framework types otherwise', () => {
    const text = buildStoriesSkill({ ...everything, framework: '@storybook/vue3-vite' });

    expect(text).toContain("import type { Meta, StoryObj } from '@storybook/vue3-vite';");
    expect(text).not.toContain('preview.meta({');
  });

  it('leaves the types out in a JavaScript project', () => {
    const text = buildStoriesSkill({
      ...everything,
      typescript: false,
      previewFile: '.storybook/preview.js',
    });

    expect(text).toContain('export default { component: Button');
    expect(text).not.toContain('StoryObj');
  });

  it('points a Svelte project at its Svelte CSF files', () => {
    const text = buildStoriesSkill({
      ...everything,
      framework: '@storybook/sveltekit',
      renderer: '@storybook/svelte',
    });

    expect(text).toContain('*.stories.svelte');
  });

  it('selects stories by file and export when no command lists story ids', () => {
    const text = buildStoriesSkill({
      ...everything,
      docsEnabled: false,
      changeDetectionEnabled: false,
      moduleGraphSupported: false,
      reviewEnabled: false,
    });

    expect(text).toContain('"absoluteStoryPath"');
    expect(text).not.toContain('find-by-component');
    expect(text).not.toContain('docs list');
  });
});
