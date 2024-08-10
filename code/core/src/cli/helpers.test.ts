import { sep } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from '@storybook/core/common';

import { copy, copySync, pathExists } from '@ndelangen/fs-extra-unified';

import { IS_WINDOWS } from '../../../vitest.helpers';
import {
  coerceSemver,
  copyTemplate,
  copyTemplateFiles,
  getStorybookVersionSpecifier,
  hasStorybookDependencies,
} from './helpers';
import type { SupportedRenderers } from './project_types';
import { SupportedLanguage } from './project_types';

const normalizePath = (path: string) => (IS_WINDOWS ? path.replace(/\//g, sep) : path);

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
}));

const fseMocks = vi.hoisted(() => ({
  copySync: vi.fn(() => ({})),
  copy: vi.fn(() => ({})),
  ensureDir: vi.fn(() => {}),
  existsSync: vi.fn(),
  pathExists: vi.fn(),
  readFile: vi.fn(() => ''),
  writeFile: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    ...fsMocks,
    default: {
      ...actual,
      ...fsMocks,
    },
  };
});
vi.mock('./dirs', () => ({
  getRendererDir: (_: JsPackageManager, renderer: string) =>
    normalizePath(`@storybook/${renderer}`),
}));

vi.mock('@ndelangen/fs-extra-unified', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ndelangen/fs-extra-unified')>();
  return {
    ...actual,
    ...fseMocks,
    default: {
      ...actual,
      ...fseMocks,
    },
  };
});
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ndelangen/fs-extra-unified')>();
  return {
    ...actual,
    ...fseMocks,
    default: {
      ...actual,
      ...fseMocks,
    },
  };
});

vi.mock('find-up', () => ({
  sync: vi.fn(),
}));

vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    // make it return just the second path, for easier testing
    resolve: vi.fn((_, p) => p),
  };
});

const packageManagerMock = {
  retrievePackageJson: async () => ({ dependencies: {}, devDependencies: {} }),
} as JsPackageManager;

describe('Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('copyTemplate', () => {
    it(`should copy template files when directory is present`, () => {
      const csfDirectory = /template-csf$/;
      fsMocks.existsSync.mockReturnValue(true);

      copyTemplate('');

      expect(copySync).toHaveBeenCalledWith(
        expect.stringMatching(csfDirectory),
        expect.anything(),
        expect.anything()
      );
    });

    it(`should throw an error if template directory cannot be found`, () => {
      fsMocks.existsSync.mockReturnValue(false);

      expect(() => {
        copyTemplate('');
      }).toThrowError("Couldn't find template dir");
    });
  });

  it.each`
    language            | exists                        | expected
    ${'javascript'}     | ${['js', 'ts-4-9']}           | ${'/js'}
    ${'typescript-4-9'} | ${['js', 'ts-4-9']}           | ${'/ts-4-9'}
    ${'typescript-4-9'} | ${['js', 'ts-3-8']}           | ${'/ts-3-8'}
    ${'typescript-3-8'} | ${['js', 'ts-3-8', 'ts-4-9']} | ${'/ts-3-8'}
    ${'typescript-3-8'} | ${['js', 'ts-4-9']}           | ${'/js'}
    ${'typescript-4-9'} | ${['js']}                     | ${'/js'}
    ${'javascript'}     | ${[]}                         | ${''}
    ${'typescript-4-9'} | ${[]}                         | ${''}
  `(
    `should copy $expected when folder $exists exists for language $language`,
    async ({ language, exists, expected }) => {
      const componentsDirectory = exists.map((folder: string) =>
        normalizePath(`@storybook/react/template/cli/${folder}`)
      );
      fseMocks.pathExists.mockImplementation(
        (filePath) =>
          componentsDirectory.includes(filePath) ||
          filePath === normalizePath('@storybook/react/template/cli')
      );
      await copyTemplateFiles({
        renderer: 'react',
        language,
        packageManager: packageManagerMock,
        commonAssetsDir: normalizePath('create-storybook/rendererAssets/common'),
      });

      expect(copy).toHaveBeenNthCalledWith(
        1,
        normalizePath('create-storybook/rendererAssets/common'),
        './stories',
        expect.anything()
      );

      const expectedDirectory = normalizePath(`@storybook/react/template/cli${expected}`);
      expect(copy).toHaveBeenNthCalledWith(2, expectedDirectory, './stories', expect.anything());
    }
  );

  it(`should copy to src folder when exists`, async () => {
    vi.mocked(pathExists).mockImplementation((filePath) => {
      return filePath === normalizePath('@storybook/react/template/cli') || filePath === './src';
    });
    await copyTemplateFiles({
      renderer: 'react',
      language: SupportedLanguage.JAVASCRIPT,
      packageManager: packageManagerMock,
    });
    expect(copy).toHaveBeenCalledWith(expect.anything(), './src/stories', expect.anything());
  });

  it(`should copy to root folder when src doesn't exist`, async () => {
    vi.mocked(pathExists).mockImplementation((filePath) => {
      return filePath === normalizePath('@storybook/react/template/cli');
    });
    await copyTemplateFiles({
      renderer: 'react',
      language: SupportedLanguage.JAVASCRIPT,
      packageManager: packageManagerMock,
    });
    expect(copy).toHaveBeenCalledWith(expect.anything(), './stories', expect.anything());
  });

  it(`should throw an error for unsupported renderer`, async () => {
    const renderer = 'unknown renderer' as SupportedRenderers;
    const expectedMessage = `Unsupported renderer: ${renderer}`;
    await expect(
      copyTemplateFiles({
        renderer,
        language: SupportedLanguage.JAVASCRIPT,
        packageManager: packageManagerMock,
      })
    ).rejects.toThrowError(expectedMessage);
  });

  describe('getStorybookVersionSpecifier', () => {
    it(`should return the specifier if storybook lib exists in package.json`, () => {
      expect(
        getStorybookVersionSpecifier({
          dependencies: {},
          devDependencies: {
            '@storybook/react': '^x.x.x',
          },
        })
      ).toEqual('^x.x.x');
    });

    it(`should throw an error if no package is found`, () => {
      expect(() => {
        getStorybookVersionSpecifier({
          dependencies: {},
          devDependencies: {
            'something-else': '^x.x.x',
          },
        });
      }).toThrowError("Couldn't find any official storybook packages in package.json");
    });
  });

  describe('coerceSemver', () => {
    it(`should throw if the version argument is invalid semver string`, () => {
      const invalidSemverString = 'hello, world';
      expect(() => {
        coerceSemver(invalidSemverString);
      }).toThrowError(`Could not coerce ${invalidSemverString} into a semver.`);
    });
  });

  describe('hasStorybookDependencies', () => {
    it(`should return true when any storybook dependency exists`, async () => {
      const result = await hasStorybookDependencies({
        getAllDependencies: async () => ({ storybook: 'x.y.z' }),
      } as unknown as JsPackageManager);
      expect(result).toEqual(true);
    });

    it(`should return false when no storybook dependency exists`, async () => {
      const result = await hasStorybookDependencies({
        getAllDependencies: async () => ({ axios: 'x.y.z' }),
      } as unknown as JsPackageManager);
      expect(result).toEqual(false);
    });
  });
});
