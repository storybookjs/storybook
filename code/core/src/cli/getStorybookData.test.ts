import { dirname, resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PackageManagerName } from 'storybook/internal/common';
import { once, logger } from 'storybook/internal/node-logger';

import { getStorybookData, getWorkingDir } from './getStorybookData.ts';

describe('getWorkingDir', () => {
  it.each([
    ['.', process.cwd()],
    ['.storybook', process.cwd()],
    ['./.storybook', process.cwd()],
    ['packages/foo/.storybook', resolve(process.cwd(), 'packages/foo')],
    ['./apps/web/.storybook', resolve(process.cwd(), 'apps/web')],
  ])('resolves relative configDir %j to %j', (configDir, expected) => {
    expect(getWorkingDir(configDir)).toBe(expected);
  });

  it('uses the parent directory for absolute config dirs', () => {
    const configDir = resolve('/projects/foo/.storybook');
    expect(getWorkingDir(configDir)).toBe(dirname(configDir));
  });
});

const mocks = vi.hoisted(() => ({
  getStorybookInfoMock: vi.fn(),
  getPackageManagerMock: vi.fn(),
}));

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    getStorybookInfo: mocks.getStorybookInfoMock,
    JsPackageManagerFactory: {
      ...actual.JsPackageManagerFactory,
      getPackageManager: mocks.getPackageManagerMock,
    },
  };
});
vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('storybook/internal/csf-tools', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const storybookInfo = {
  mainConfig: { stories: [] },
  mainConfigPath: '/fake/project/.storybook/main.ts',
  configDir: '.storybook',
  previewConfigPath: undefined,
  versionSpecifier: '9.0.0',
  frameworkPackage: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  renderer: 'react',
  builderPackage: '@storybook/builder-vite',
  addons: [],
};

const createPackageManager = (type: PackageManagerName) => ({
  type,
  getModulePackageJSON: vi.fn().mockResolvedValue({ version: '9.0.0' }),
});

describe('getStorybookData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStorybookInfoMock.mockResolvedValue({ ...storybookInfo });
    mocks.getPackageManagerMock.mockReturnValue(createPackageManager(PackageManagerName.NPM));
    once.clear();
  });

  it('warns once for Yarn 1 across repeated project-data collections in one process', async () => {
    mocks.getPackageManagerMock.mockReturnValue(createPackageManager(PackageManagerName.YARN1));

    await getStorybookData({ configDir: '.storybook' });
    await getStorybookData({ configDir: '.storybook' });

    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('Yarn Classic (v1) is supported on a best-effort basis')
    );
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('https://storybook.js.org/docs/get-started/install')
    );
  });

  it.each([
    PackageManagerName.NPM,
    PackageManagerName.YARN2,
    PackageManagerName.PNPM,
    PackageManagerName.BUN,
  ])('does not emit the Yarn 1 warning for %s', async (packageManagerType) => {
    mocks.getPackageManagerMock.mockReturnValue(createPackageManager(packageManagerType));

    await getStorybookData({ configDir: '.storybook' });

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });

  it('suppresses the Yarn 1 warning when warnOnYarn1 is explicitly false', async () => {
    mocks.getPackageManagerMock.mockReturnValue(createPackageManager(PackageManagerName.YARN1));

    await getStorybookData({ configDir: '.storybook', warnOnYarn1: false });

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });
});
