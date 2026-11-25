import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type JsPackageManager, type PackageJson, effects } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';

import * as mainConfigFile from './helpers/mainConfigFile.ts';
import { doAutomigrate, runFixes } from './index.ts';
import { type Fix, FixStatus } from './types.ts';

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
    dryRunChange: vi.fn((text: string) => text),
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

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  loadMainConfig: coreCommonMock.loadMainConfig,
}));

// Remove the old prompt mock - now handled in the node-logger mock

class PackageManager implements Partial<JsPackageManager> {
  async getModulePackageJSON(
    packageName: string,
    basePath?: string | undefined
  ): Promise<PackageJson | null> {
    return getModulePackageJSON(packageName, basePath);
  }
}

const packageManager = new PackageManager() as unknown as JsPackageManager;

const yes = true;
const skipInstall = false;
const configDir = '/path/to/config';
const mainConfigPath = '/path/to/mainConfig';
const beforeVersion = '6.5.15';
const isUpgrade = true;

const common = {
  fixes,
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

describe('a dry run', () => {
  beforeEach(() => {
    effects.setDryRun(true);
    check1.mockResolvedValue({ some: 'result' });
    vi.mocked(prompt.confirm).mockResolvedValue(true);
  });

  afterEach(() => {
    effects.setDryRun(false);
    vi.clearAllMocks();
  });

  it('runs each selected fix and reports its result', async () => {
    const { fixResults } = await runFixWrapper({ storybookVersion: '7.0.0' });

    expect(run1).toHaveBeenCalled();
    expect(fixResults).toEqual({ 'fix-1': FixStatus.SUCCEEDED });
  });

  it('lists a notification as a manual migration without prompting', async () => {
    const notification: Fix = {
      id: 'notice',
      promptType: 'notification',
      check: async () => ({}),
      prompt: () => 'Read this',
    };

    const { fixResults, fixSummary } = await runFixes({
      ...common,
      fixes: [notification],
      yes: false,
      storybookVersion: '7.0.0',
    });

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(fixResults).toEqual({ notice: FixStatus.MANUAL_SUCCEEDED });
    expect(fixSummary.manual).toEqual(['notice']);
  });

  it('fails when a fix fails, and lists the doctor among the steps of a run', async () => {
    run1.mockImplementationOnce(() => {
      throw new Error('cannot migrate');
    });
    getStorybookData.mockResolvedValue({
      ...common,
      beforeVersion,
      versionInstalled: '7.0.0',
      isLatest: true,
    });

    await expect(doAutomigrate({ configDir, fixes })).rejects.toThrow(
      'An error occurred while running the automigrate command.'
    );

    expect(effects.describeDryRunChanges()).toContain(
      'run npx storybook doctor to verify the automigrations went well'
    );
  });
});
