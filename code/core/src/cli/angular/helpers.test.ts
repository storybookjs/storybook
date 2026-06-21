import * as fs from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AngularJSON } from './helpers.ts';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const makeAngularJson = () =>
  JSON.stringify({
    projects: {
      app: { root: '', projectType: 'application', architect: {} },
    },
  });

describe('AngularJSON.addStorybookEntries', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(makeAngularJson());
  });

  it('omits compodoc from the Vite builder options (it lives in framework.options)', () => {
    const angularJSON = new AngularJSON();

    angularJSON.addStorybookEntries({
      angularProjectName: 'app',
      storybookFolder: '.storybook',
      useCompodoc: true,
      root: '',
      useVite: true,
    });

    const { storybook, 'build-storybook': buildStorybook } = angularJSON.projects.app.architect;
    expect(storybook.builder).toBe('@storybook/angular-vite:start-storybook');
    expect(storybook.options).not.toHaveProperty('compodoc');
    expect(storybook.options).not.toHaveProperty('compodocArgs');
    expect(buildStorybook.options).not.toHaveProperty('compodoc');
    expect(buildStorybook.options).not.toHaveProperty('compodocArgs');
  });

  it('keeps compodoc in the Webpack builder options', () => {
    const angularJSON = new AngularJSON();

    angularJSON.addStorybookEntries({
      angularProjectName: 'app',
      storybookFolder: '.storybook',
      useCompodoc: true,
      root: '',
      useVite: false,
    });

    const { storybook } = angularJSON.projects.app.architect;
    expect(storybook.builder).toBe('@storybook/angular:start-storybook');
    expect(storybook.options.compodoc).toBe(true);
    expect(storybook.options.compodocArgs).toEqual(['-e', 'json', '-d', '.']);
  });
});
