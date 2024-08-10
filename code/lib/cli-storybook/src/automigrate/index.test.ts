import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJsonWithDepsAndDevDeps } from 'storybook/internal/common';

import { runFixes } from './index';
import type { Fix } from './types';

const check1 = vi.fn();
const run1 = vi.fn();
const retrievePackageJson = vi.fn();
const getPackageVersion = vi.fn();
const prompt1Message = 'prompt1Message';

vi.spyOn(console, 'error').mockImplementation(console.log);

const fixes: Fix<any>[] = [
  {
    id: 'fix-1',

    versionRange: ['<7', '>=7'],

    async check(config) {
      return check1(config);
    },

    prompt() {
      return prompt1Message;
    },

    async run(result) {
      run1(result);
    },
  },
];

const coreCommonMock = vi.hoisted(() => {
  return {
    loadMainConfig: vi.fn(),
  };
});

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  loadMainConfig: coreCommonMock.loadMainConfig,
}));

const promptMocks = vi.hoisted(() => {
  return {
    default: vi.fn(),
  };
});

vi.mock('prompts', () => {
  return {
    default: promptMocks.default,
  };
});

class PackageManager implements Partial<JsPackageManager> {
  public async retrievePackageJson(): Promise<PackageJsonWithDepsAndDevDeps> {
    return retrievePackageJson();
  }

  getPackageVersion(packageName: string, basePath?: string | undefined): Promise<string | null> {
    return getPackageVersion(packageName, basePath);
  }
}

const packageManager = new PackageManager() as any as JsPackageManager;

const dryRun = false;
const yes = true;
const rendererPackage = 'storybook';
const skipInstall = false;
const configDir = '/path/to/config';
const mainConfigPath = '/path/to/mainConfig';
const beforeVersion = '6.5.15';
const isUpgrade = true;

const runFixWrapper = async ({
  // eslint-disable-next-line @typescript-eslint/no-shadow
  beforeVersion,
  storybookVersion,
}: {
  beforeVersion: string;
  storybookVersion: string;
}) => {
  return runFixes({
    fixes,
    dryRun,
    yes,
    rendererPackage,
    skipInstall,
    configDir,
    packageManager: packageManager,
    mainConfigPath,
    storybookVersion,
    beforeVersion,
    isUpgrade,
  });
};

describe('runFixes', () => {
  beforeEach(() => {
    retrievePackageJson.mockResolvedValue({
      dependencies: [],
      devDependencies: [],
    });
    getPackageVersion.mockImplementation((packageName) => {
      return beforeVersion;
    });
    check1.mockResolvedValue({ some: 'result' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be unnecessary to run fix-1 from SB 6.5.15 to 6.5.16', async () => {
    const { fixResults } = await runFixWrapper({ beforeVersion, storybookVersion: '6.5.16' });

    // Assertions
    expect(fixResults).toEqual({
      'fix-1': 'unnecessary',
    });
    expect(run1).not.toHaveBeenCalled();
  });

  it('should be necessary to run fix-1 from SB 6.5.15 to 7.0.0', async () => {
    promptMocks.default.mockResolvedValue({ shouldContinue: true });

    const { fixResults } = await runFixWrapper({ beforeVersion, storybookVersion: '7.0.0' });

    expect(fixResults).toEqual({
      'fix-1': 'succeeded',
    });
    expect(run1).toHaveBeenCalledWith({
      dryRun,
      mainConfigPath,
      packageManager,
      result: {
        some: 'result',
      },
      skipInstall,
    });
  });

  it('should fail if an error is thrown', async () => {
    check1.mockRejectedValue(new Error('check1 error'));

    const { fixResults } = await runFixWrapper({ beforeVersion, storybookVersion: '7.0.0' });

    expect(fixResults).toEqual({
      'fix-1': 'check_failed',
    });
    expect(run1).not.toHaveBeenCalled();
  });
});
