import { beforeEach, describe, expect, test, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { PackageManagerName } from '../../../core/src/common';
import { add, getVersionSpecifier } from './add';

const MockedConfig = vi.hoisted(() => {
  return {
    appendValueToArray: vi.fn(),
    getFieldNode: vi.fn(),
    valueToNode: vi.fn(),
    appendNodeToArray: vi.fn(),
  };
});
const MockedPackageManager = vi.hoisted(() => {
  return {
    getPrimaryPackageJson: vi.fn(() => ({
      packageJson: {
        devDependencies: {},
        dependencies: {},
      },
      packageJsonPath: 'some/path',
      operationDir: 'some/path',
    })),
    getDependencyVersion: vi.fn(() => '^8.0.0'),
    latestVersion: vi.fn(() => '1.0.0'),
    addDependencies: vi.fn(() => {}),
    type: 'npm',
  };
});
const MockedPostInstall = vi.hoisted(() => {
  return {
    postinstallAddon: vi.fn(),
  };
});
const MockWrapGetAbsolutePathUtils = vi.hoisted(() => {
  return {
    getAbsolutePathWrapperName: vi.fn(),
    wrapValueWithGetAbsolutePathWrapper: vi.fn(),
  };
});
const MockedConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any as Console;

const MockedMainConfigFileHelper = vi.hoisted(() => {
  return {
    getStorybookData: vi.fn(() => ({
      mainConfig: {},
      mainConfigPath: '.storybook/main.ts',
      configDir: '.storybook',
      previewConfigPath: '.storybook/preview.ts',
      storybookVersion: '8.0.0',
      storybookVersionSpecifier: '^8.0.0',
      packageManager: MockedPackageManager,
    })),
  };
});

vi.mock('storybook/internal/csf-tools', () => {
  return {
    readConfig: vi.fn(() => MockedConfig),
    writeConfig: vi.fn(),
  };
});
vi.mock('./postinstallAddon', () => {
  return MockedPostInstall;
});
vi.mock('./automigrate/helpers/mainConfigFile', () => {
  return MockedMainConfigFileHelper;
});
vi.mock('./codemod/helpers/csf-factories-utils');
vi.mock('storybook/internal/common', () => {
  return {
    getStorybookInfo: vi.fn(() => ({ mainConfig: {}, configDir: '' })),
    serverRequire: vi.fn(() => ({})),
    loadMainConfig: vi.fn(() => ({})),
    JsPackageManagerFactory: {
      getPackageManager: vi.fn(() => MockedPackageManager),
    },
    setupAddonInConfig: vi.fn(),
    getAbsolutePathWrapperName: MockWrapGetAbsolutePathUtils.getAbsolutePathWrapperName,
    wrapValueWithGetAbsolutePathWrapper:
      MockWrapGetAbsolutePathUtils.wrapValueWithGetAbsolutePathWrapper,
    getCoercedStorybookVersion: vi.fn(() => '8.0.0'),
    versions: {
      storybook: '8.0.0',
      '@storybook/addon-docs': '8.0.0',
    },
    frameworkToRenderer: vi.fn(),
  };
});

describe('getVersionSpecifier', (it) => {
  test.each([
    ['@storybook/addon-docs', ['@storybook/addon-docs', undefined]],
    ['@storybook/addon-docs@7.0.1', ['@storybook/addon-docs', '7.0.1']],
    ['@storybook/addon-docs@7.0.1-beta.1', ['@storybook/addon-docs', '7.0.1-beta.1']],
    ['@storybook/addon-docs@~7.0.1-beta.1', ['@storybook/addon-docs', '~7.0.1-beta.1']],
    ['@storybook/addon-docs@^7.0.1-beta.1', ['@storybook/addon-docs', '^7.0.1-beta.1']],
    ['@storybook/addon-docs@next', ['@storybook/addon-docs', 'next']],
  ])('%s => %s', (input, expected) => {
    const result = getVersionSpecifier(input);
    expect(result[0]).toEqual(expected[0]);
    expect(result[1]).toEqual(expected[1]);
  });
});

describe('add', () => {
  const testData = [
    { input: 'aa', expected: 'aa@^1.0.0' }, // resolves to the latest version
    { input: 'aa@4', expected: 'aa@^4' },
    { input: 'aa@4.1.0', expected: 'aa@^4.1.0' },
    { input: 'aa@^4', expected: 'aa@^4' },
    { input: 'aa@~4', expected: 'aa@~4' },
    { input: 'aa@4.1.0-alpha.1', expected: 'aa@^4.1.0-alpha.1' },
    { input: 'aa@next', expected: 'aa@next' },

    { input: '@org/aa', expected: '@org/aa@^1.0.0' },
    { input: '@org/aa@4', expected: '@org/aa@^4' },
    { input: '@org/aa@4.1.0', expected: '@org/aa@^4.1.0' },
    { input: '@org/aa@4.1.0-alpha.1', expected: '@org/aa@^4.1.0-alpha.1' },
    { input: '@org/aa@next', expected: '@org/aa@next' },

    { input: '@storybook/addon-docs@~4', expected: '@storybook/addon-docs@~4' },
    { input: '@storybook/addon-docs@next', expected: '@storybook/addon-docs@next' },
    { input: '@storybook/addon-docs', expected: '@storybook/addon-docs@^8.0.0' }, // takes it from the versions file
  ];

  test.each(testData)('$input', async ({ input, expected }) => {
    await add(input, { packageManager: PackageManagerName.NPM, skipPostinstall: true });

    expect(MockedPackageManager.addDependencies).toHaveBeenCalledWith(
      { type: 'devDependencies', writeOutputToFile: false },
      [expected]
    );
  });
});

describe('add (extra)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test('not warning when installing the correct version of storybook', async () => {
    await add('@storybook/addon-docs', {
      packageManager: PackageManagerName.NPM,
      skipPostinstall: true,
    });

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(`is not the same as the version of Storybook you are using.`)
    );
  });
  test('not warning when installing unrelated package', async () => {
    await add('aa', { packageManager: PackageManagerName.NPM, skipPostinstall: true });

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(`is not the same as the version of Storybook you are using.`)
    );
  });
  test('warning when installing a core addon mismatching version of storybook', async () => {
    await add('@storybook/addon-docs@2.0.0', {
      packageManager: PackageManagerName.NPM,
      skipPostinstall: true,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `The version of @storybook/addon-docs (2.0.0) you are installing is not the same as the version of Storybook you are using (8.0.0). This may lead to unexpected behavior.`
      )
    );
  });

  test('postInstall', async () => {
    await add('@storybook/addon-docs', {
      packageManager: PackageManagerName.NPM,
      skipPostinstall: false,
    });

    expect(MockedPostInstall.postinstallAddon).toHaveBeenCalledWith('@storybook/addon-docs', {
      packageManager: 'npm',
      configDir: '.storybook',
      logger: expect.any(Object),
      prompt: expect.any(Object),
    });
  });
});
