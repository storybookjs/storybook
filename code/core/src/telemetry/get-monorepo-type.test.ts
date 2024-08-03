/* eslint-disable no-underscore-dangle */
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';

import { getMonorepoType, monorepoConfigs } from './get-monorepo-type';

const fse = vi.hoisted(async () => import('../../../__mocks__/fs-extra'));

vi.mock('@ndelangen/fs-extra-unified', async () => import('../../../__mocks__/fs-extra'));
vi.mock('node:fs/promises', async (importActual) => {
  const actual = await importActual<typeof import('node:fs/promises')>();
  return {
    ...actual,
    ...(await import('../../../__mocks__/fs-extra')),
  };
});
vi.mock('node:fs', async (importActual) => {
  const actual = await importActual<typeof import('node:fs')>();
  return {
    ...actual,
    ...(await import('../../../__mocks__/fs-extra')),
  };
});

vi.mock('@storybook/core/common', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('@storybook/core/common')>()),
    getProjectRoot: () => 'root',
  };
});

const checkMonorepoType = async ({ monorepoConfigFile, isYarnWorkspace = false }: any) => {
  const mockFiles = {
    [path.join('root', 'package.json')]: isYarnWorkspace ? '{ "workspaces": [] }' : '{}',
  };

  if (monorepoConfigFile) {
    mockFiles[path.join('root', monorepoConfigFile)] = '{}';
  }

  (await fse).__setMockFiles(mockFiles);

  return getMonorepoType();
};

describe('getMonorepoType', () => {
  describe('Monorepos from json files', () => {
    it.each(Object.entries(monorepoConfigs))(
      'should detect %p from %s file',
      async (monorepoName, monorepoConfigFile) => {
        expect(await checkMonorepoType({ monorepoConfigFile })).toEqual(monorepoName);
      }
    );
  });

  describe('Yarn|NPM workspaces', () => {
    it('should detect Workspaces from package.json', async () => {
      expect(
        await checkMonorepoType({ monorepoConfigFile: undefined, isYarnWorkspace: true })
      ).toEqual('Workspaces');
    });
  });

  describe('Non-monorepos', () => {
    it('should return undefined', async () => {
      expect(
        await checkMonorepoType({ monorepoConfigFile: undefined, isYarnWorkspace: false })
      ).toEqual(undefined);
    });
  });
});
