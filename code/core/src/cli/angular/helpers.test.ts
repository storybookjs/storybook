import * as fs from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AngularJSON, editJsonText, isStorybookTarget } from './helpers.ts';

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

describe('editJsonText', () => {
  const removeCompodoc = (text: string) =>
    editJsonText(text, ['targets', 'storybook', 'options', 'compodoc'], undefined);

  it('keeps tab indentation', () => {
    const tabbed =
      '{\n\t"targets": {\n\t\t"storybook": {\n\t\t\t"options": {\n\t\t\t\t"compodoc": true,\n\t\t\t\t"port": 6006\n\t\t\t}\n\t\t}\n\t}\n}\n';

    expect(removeCompodoc(tabbed)).toBe(
      '{\n\t"targets": {\n\t\t"storybook": {\n\t\t\t"options": {\n\t\t\t\t"port": 6006\n\t\t\t}\n\t\t}\n\t}\n}\n'
    );
  });

  it('keeps 4-space indentation', () => {
    const fourSpace =
      '{\n    "targets": {\n        "storybook": {\n            "options": {\n                "compodoc": true,\n                "port": 6006\n            }\n        }\n    }\n}\n';

    expect(removeCompodoc(fourSpace)).toBe(
      '{\n    "targets": {\n        "storybook": {\n            "options": {\n                "port": 6006\n            }\n        }\n    }\n}\n'
    );
  });

  it('keeps 2-space indentation', () => {
    const twoSpace =
      '{\n  "targets": {\n    "storybook": {\n      "options": {\n        "compodoc": true,\n        "port": 6006\n      }\n    }\n  }\n}\n';

    expect(removeCompodoc(twoSpace)).toBe(
      '{\n  "targets": {\n    "storybook": {\n      "options": {\n        "port": 6006\n      }\n    }\n  }\n}\n'
    );
  });
});

describe('isStorybookTarget', () => {
  it('matches any package by suffix when no builder package is given', () => {
    expect(isStorybookTarget({ builder: '@storybook/angular:start-storybook' })).toBe(true);
    expect(isStorybookTarget({ executor: '@analogjs/storybook-angular:build-storybook' })).toBe(
      true
    );
    expect(isStorybookTarget({ builder: '@nx/angular:package' })).toBe(false);
  });

  it('matches only the given builder package', () => {
    expect(
      isStorybookTarget(
        { executor: '@storybook/angular-vite:start-storybook' },
        '@storybook/angular-vite'
      )
    ).toBe(true);
    expect(
      isStorybookTarget(
        { executor: '@storybook/angular:start-storybook' },
        '@storybook/angular-vite'
      )
    ).toBe(false);
    expect(
      isStorybookTarget({ builder: '@storybook/angular:build-storybook' }, '@storybook/angular')
    ).toBe(true);
    expect(
      isStorybookTarget(
        { builder: '@analogjs/storybook-angular:start-storybook' },
        '@storybook/angular'
      )
    ).toBe(false);
  });
});
