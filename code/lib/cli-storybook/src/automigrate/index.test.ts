import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJson } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as mainConfigFile from './helpers/mainConfigFile.ts';
import { automigrate, doAutomigrate, runFixes } from './index.ts';
import type { Fix } from './types.ts';

const check1 = vi.fn();
const run1 = vi.fn();
const getModulePackageJSON = vi.fn();
const getStorybookData = vi.fn();
const prompt1Message = 'prompt1Message';

vi.spyOn(console, 'error').mockImplementation(console.log);
vi.spyOn(mainConfigFile, 'getStorybookData').mockImplementation(getStorybookData);

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    logBox: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    step: vi.fn(),
    SYMBOLS: { success: '✔', error: '✕' },
  },
  prompt: {
    confirm: vi.fn(),
    taskLog: vi.fn(() => ({
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
    })),
  },
  logTracker: {
    enableLogWriting: vi.fn(),
  },
  CLI_COLORS: {
    success: vi.fn((text: string) => text),
    error: vi.fn((text: string) => text),
    warning: vi.fn((text: string) => text),
    info: vi.fn((text: string) => text),
    debug: vi.fn((text: string) => text),
    cta: vi.fn((text: string) => text),
    dimmed: vi.fn((text: string) => text),
  },
}));

const fixes: Fix[] = [
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

vi.mock(import('./fixes/index.ts'), async (importOriginal) => ({
  ...(await importOriginal()),
  commandFixes: [{ id: 'command-fix', promptType: 'command' as const, run: async () => {} }],
}));

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  loadMainConfig: coreCommonMock.loadMainConfig,
}));

// Remove the old prompt mock - now handled in the node-logger mock

const reportInstallSettingChanges = vi.fn();

class PackageManager implements Partial<JsPackageManager> {
  reportInstallSettingChanges = reportInstallSettingChanges;

  async getModulePackageJSON(
    packageName: string,
    basePath?: string | undefined
  ): Promise<PackageJson | null> {
    return getModulePackageJSON(packageName, basePath);
  }
}

const packageManager = new PackageManager() as unknown as JsPackageManager;

const dryRun = false;
const yes = true;
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
  skipInstall,
  configDir,
  packageManager: packageManager,
  mainConfigPath,
  isUpgrade,
  storiesPaths: [],
};

const runFixWrapper = async ({ storybookVersion }: { storybookVersion: string }) => {
  return runFixes({
    ...common,
    storybookVersion,
  });
};

const runAutomigrateWrapper = async ({
  beforeVersion,
  storybookVersion,
}: {
  beforeVersion: string;
  storybookVersion: string;
}) => {
  getStorybookData.mockResolvedValue({
    ...common,
    beforeVersion,
    versionInstalled: storybookVersion,
    isLatest: true,
  });
  return doAutomigrate({ configDir, fixes });
};

describe('automigrate', () => {
  it.each([
    [true, /^Dry-running migration command-fix/],
    [false, /^Running migration command-fix/],
  ])('announces a command fix when dryRun is %s', async (dryRun, announcement) => {
    await automigrate({
      ...common,
      fixId: 'command-fix',
      dryRun,
      storybookVersion: '7.0.0',
      isLatest: false,
    });

    expect(logger.step).toHaveBeenCalledWith(expect.stringMatching(announcement));
  });
});

describe('runFixes', () => {
  beforeEach(() => {
    getModulePackageJSON.mockImplementation(() => {
      return {
        version: beforeVersion,
      };
    });
    check1.mockResolvedValue({ some: 'result' });
    vi.mocked(prompt.confirm).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be necessary to run fix-1 from SB 6.5.15 to 7.0.0', async () => {
    const { fixResults } = await runFixWrapper({ storybookVersion: '7.0.0' });

    expect(fixResults).toEqual({
      'fix-1': 'succeeded',
    });
    expect(run1).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.objectContaining({ edit: expect.any(Function) }),
        mainConfigPath,
        packageManager,
        result: {
          some: 'result',
        },
        skipInstall,
      })
    );
  });

  it('skips an opt-in fix with --yes unless the user named it', async () => {
    const optIn = { ...fixes[0], id: 'opt-in', defaultSelected: false };

    const unnamed = await runFixes({ ...common, fixes: [optIn], storybookVersion: '7.0.0' });
    expect(unnamed.fixResults).toEqual({ 'opt-in': 'skipped' });
    expect(run1).not.toHaveBeenCalled();

    const named = await runFixes({
      ...common,
      fixes: [optIn],
      fixId: 'opt-in',
      storybookVersion: '7.0.0',
    });
    expect(named.fixResults).toEqual({ 'opt-in': 'succeeded' });
    expect(run1).toHaveBeenCalled();
  });

  it('runs no fix in a dry run, and does not report the ones it would run as skipped', async () => {
    await runFixes({ ...common, dryRun: true, storybookVersion: '7.0.0' });

    expect(run1).not.toHaveBeenCalled();
    expect(vi.mocked(logger.log).mock.calls.flat().join('\n')).not.toMatch(/Skipped/);
  });

  it('lets a fix report what its run would do, in a dry run', async () => {
    const reportDryRun = vi.fn(async () => {});

    await runFixes({
      ...common,
      fixes: [{ ...fixes[0], reportDryRun }],
      dryRun: true,
      storybookVersion: '7.0.0',
    });

    expect(reportDryRun).toHaveBeenCalledWith(
      expect.objectContaining({ configDir, result: { some: 'result' } })
    );
  });

  it('should fail if an error is thrown by migration', async () => {
    check1.mockRejectedValue(new Error('check1 error'));

    const { fixResults } = await runFixWrapper({ storybookVersion: '7.0.0' });

    expect(fixResults).toEqual({
      'fix-1': 'check_failed',
    });
    expect(run1).not.toHaveBeenCalled();
  });

  it('should throw error if an error is thrown by migration', async () => {
    check1.mockRejectedValue(new Error('check1 error'));

    const result = runAutomigrateWrapper({ beforeVersion, storybookVersion: '7.0.0' });

    await expect(result).rejects.toThrow(
      'An error occurred while running the automigrate command.'
    );
    expect(run1).not.toHaveBeenCalled();
  });
});

describe('doAutomigrate', () => {
  beforeEach(() => {
    check1.mockResolvedValue({ some: 'result' });
    getStorybookData.mockResolvedValue({
      ...common,
      beforeVersion,
      versionInstalled: '7.0.0',
      isLatest: true,
    });
  });

  it('names the install settings a run would change, when it would apply a fix', async () => {
    vi.mocked(prompt.confirm).mockResolvedValue(true);

    await doAutomigrate({ configDir, fixes, dryRun: true });

    expect(reportInstallSettingChanges).toHaveBeenCalledTimes(1);
  });

  it('names no install settings when a run would apply no fix', async () => {
    vi.mocked(prompt.confirm).mockResolvedValue(false);

    await doAutomigrate({ configDir, fixes, dryRun: true });

    expect(reportInstallSettingChanges).not.toHaveBeenCalled();
  });

  it('names the doctor instead of running it, in a dry run', async () => {
    await doAutomigrate({ configDir, fixes, dryRun: true });

    const output = [logger.log, logger.step]
      .flatMap((method) => vi.mocked(method).mock.calls.flat())
      .join('\n');
    expect(output).toMatch(
      /Would run .*npx storybook doctor.* to verify the automigrations went well/
    );
    expect(output).not.toContain('Checking the health');
  });
});
