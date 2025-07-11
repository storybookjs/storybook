import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJson } from 'storybook/internal/common';

import * as mainConfigFile from './helpers/mainConfigFile';
import { doAutomigrate, runFixes } from './index';
import type { Fix } from './types';

const check1 = vi.fn();
const run1 = vi.fn();
const getModulePackageJSON = vi.fn();
const getStorybookData = vi.fn();
const prompt1Message = 'prompt1Message';

vi.spyOn(console, 'error').mockImplementation(console.log);
vi.spyOn(mainConfigFile, 'getStorybookData').mockImplementation(getStorybookData);

const fixes: Fix<any>[] = [
  {
    id: 'fix-1',

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
  getModulePackageJSON(packageName: string, basePath?: string | undefined): PackageJson | null {
    return getModulePackageJSON(packageName, basePath);
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

const common = {
  fixes,
  dryRun,
  yes,
  mainConfig: { stories: [] },
  rendererPackage,
  skipInstall,
  configDir,
  packageManager: packageManager,
  mainConfigPath,
  isUpgrade,
  storiesPaths: [],
};

const runFixWrapper = async ({
  beforeVersion,
  storybookVersion,
}: {
  beforeVersion: string;
  storybookVersion: string;
}) => {
  return runFixes({
    ...common,
    storybookVersion,
    beforeVersion,
  });
};

const runAutomigrateWrapper = async ({
  beforeVersion,
  storybookVersion,
}: {
  beforeVersion: string;
  storybookVersion: string;
}) => {
  getStorybookData.mockImplementation(() => {
    return {
      ...common,
      beforeVersion,
      storybookVersion,
      isLatest: true,
    };
  });
  return doAutomigrate({ configDir });
};

describe('runFixes', () => {
  beforeEach(() => {
    getModulePackageJSON.mockImplementation(() => {
      return {
        version: beforeVersion,
      };
    });
    check1.mockResolvedValue({ some: 'result' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be necessary to run fix-1 from SB 6.5.15 to 7.0.0', async () => {
    promptMocks.default.mockResolvedValue({ shouldContinue: true });

    const { fixResults } = await runFixWrapper({ beforeVersion, storybookVersion: '7.0.0' });

    expect(fixResults).toEqual({
      'fix-1': 'succeeded',
    });
    expect(run1).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun,
        mainConfigPath,
        packageManager,
        result: {
          some: 'result',
        },
        skipInstall,
      })
    );
  });

  it('should fail if an error is thrown by migration', async () => {
    check1.mockRejectedValue(new Error('check1 error'));

    const { fixResults } = await runFixWrapper({ beforeVersion, storybookVersion: '7.0.0' });

    expect(fixResults).toEqual({
      'fix-1': 'check_failed',
    });
    expect(run1).not.toHaveBeenCalled();
  });

  it('should throw error if an error is thrown my migration', async () => {
    check1.mockRejectedValue(new Error('check1 error'));

    const result = runAutomigrateWrapper({ beforeVersion, storybookVersion: '7.0.0' });

    await expect(result).rejects.toThrow('Some migrations failed');
    expect(run1).not.toHaveBeenCalled();
  });
});
