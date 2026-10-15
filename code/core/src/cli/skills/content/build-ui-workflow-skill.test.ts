import { describe, expect, it } from 'vitest';

import { componentLookup } from './build-component-docs-skill.ts';
import { buildUiWorkflowSkill, type UiWorkflowSkillInputs } from './build-ui-workflow-skill.ts';

const everything: UiWorkflowSkillInputs = {
  framework: '@storybook/react-vite',
  csfFactories: false,
  previewFile: '.storybook/preview.ts',
  typescript: true,
  docsEnabled: true,
  testSupported: true,
  a11yEnabled: true,
  moduleGraphSupported: true,
};

describe('buildUiWorkflowSkill', () => {
  it('shows every command with its arguments when every feature is on', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain('npx storybook tools docs show --id <id>');
    expect(text).toContain(`npx storybook tools test run --stories '[{"storyId":"<id>"}]'`);
    expect(text).toContain('npx storybook tools stories changed');
    expect(text).toContain(`npx storybook tools stories find-by-component --componentPaths '["`);
    expect(text).toContain(`npx storybook tools review create --input '{`);
    expect(text).toContain('accessibility violations');
  });

  it('includes the lookup of component-docs, so the agent cannot skip it', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain(`## Look up components first\n\n${componentLookup()}`);
    expect(text).not.toContain('npx storybook skills component-docs');
  });

  it('looks up components before it writes any', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text.indexOf('## Look up components first')).toBeLessThan(
      text.indexOf('## Write the component and its stories')
    );
  });

  it('never lets the agent instructions skip the component lookup', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain('but always look up the components first');
  });

  it('looks up components only when the project has component docs', () => {
    const text = buildUiWorkflowSkill({ ...everything, docsEnabled: false });

    expect(text).not.toContain('Look up components first');
    expect(text).not.toContain('npx storybook tools docs show');
  });

  it('leaves out testing when the project cannot run story tests', () => {
    const text = buildUiWorkflowSkill({ ...everything, testSupported: false, a11yEnabled: false });

    expect(text).not.toContain('test run');
    expect(text).not.toContain('accessibility');
  });

  it('requires the commands that find affected stories before a review, not the full story list', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain(
      'Run `stories changed` or `find-by-component` before every review, also when you already know the ids'
    );
    expect(text).not.toContain('Run one of these');
  });

  it('takes story ids from the story list when the builder has no module graph', () => {
    const text = buildUiWorkflowSkill({ ...everything, moduleGraphSupported: false });

    expect(text).toContain('docs list --withStoryIds true');
    expect(text).toContain('Story ids come only from the output of this command');
    expect(text).toContain('When it does not find a story');
    expect(text).not.toContain('stories changed');
    expect(text).not.toContain('find-by-component');
  });

  it('finds the stories before it tests them, and runs every story before the review', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text.indexOf('## Find the stories')).toBeLessThan(text.indexOf('## Test'));
    expect(text).toContain('then one full run without `--stories` before the review');
    expect(text).toContain('so wait for it before you use an id');
  });

  it('keeps the accessibility test level of the project', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain('Never change the accessibility test level (`parameters.a11y.test`)');
  });

  it('selects stories by file and export when no command lists story ids', () => {
    const text = buildUiWorkflowSkill({
      ...everything,
      docsEnabled: false,
      moduleGraphSupported: false,
    });

    expect(text).toContain('"absoluteStoryPath"');
    expect(text).not.toContain('stories changed');
  });

  it('teaches CSF Factories instead of Meta and StoryObj when the preview uses definePreview', () => {
    const text = buildUiWorkflowSkill({
      ...everything,
      csfFactories: true,
      previewFile: '.storybook/preview.tsx',
    });

    expect(text).toContain('preview.meta({');
    expect(text).toContain('Do not import `Meta` or `StoryObj`');
    expect(text).not.toContain('Import `Meta` and `StoryObj`');
  });

  it('teaches Meta and StoryObj from the framework package otherwise', () => {
    const text = buildUiWorkflowSkill({ ...everything, framework: '@storybook/vue3-vite' });

    expect(text).toContain('Import `Meta` and `StoryObj` from `@storybook/vue3-vite`');
    expect(text).not.toContain('preview.meta({');
  });

  it('leaves out the Meta and StoryObj types in a JavaScript project', () => {
    const text = buildUiWorkflowSkill({
      ...everything,
      previewFile: '.storybook/preview.js',
      typescript: false,
    });

    expect(text).not.toContain('StoryObj');
    expect(text).toContain('- Import `fn`, `expect`, `mocked` and `sb` from `storybook/test`.');
    expect(text).toContain("sb.mock(import('../src/api.js')");
  });

  it('puts MSW before module mocks and names the preview file of the project', () => {
    const text = buildUiWorkflowSkill({ ...everything, previewFile: 'config/preview.tsx' });

    expect(text.indexOf('msw.use(')).toBeLessThan(text.indexOf('sb.mock('));
    expect(text).toContain('register it in `config/preview.tsx`');
  });

  it('tells how to set up MSW in the format of the project', () => {
    const csf3 = buildUiWorkflowSkill({ ...everything, previewFile: 'config/preview.tsx' });
    expect(csf3).toContain('never with a module mock or a replaced `fetch`');
    expect(csf3).toContain(
      "`loaders: [mswLoader()]` (`import { mswLoader } from 'msw-storybook-addon/csf3'`"
    );
    expect(csf3).toContain('to `config/preview.tsx`');

    const factories = buildUiWorkflowSkill({ ...everything, csfFactories: true });
    expect(factories).toContain(
      "`addons: [addonMsw()]` (`import addonMsw from 'msw-storybook-addon'`"
    );
    expect(factories).not.toContain('mswLoader');
  });
});
