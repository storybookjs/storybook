import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJson } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as mainConfigFile from './helpers/mainConfigFile.ts';
import { doAutomigrate, runFixes } from './index.ts';
import type { Fix } from './types.ts';

vi.mock('../doctor/index.ts', () => ({ doctor: vi.fn() }));
import { doctor } from '../doctor/index.ts';

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

  it("prints a skipped fix's skip warning exactly once under --yes, naming its command", async () => {
    const optIn = {
      ...fixes[0],
      id: 'generic-opt-in',
      defaultSelected: false,
      skipWarning:
        'The generic-opt-in migration was skipped. Run `npx storybook automigrate generic-opt-in` to migrate later.',
    };

    const { fixResults } = await runFixes({ ...common, fixes: [optIn], storybookVersion: '7.0.0' });

    expect(fixResults).toEqual({ 'generic-opt-in': 'skipped' });
    expect(run1).not.toHaveBeenCalled();
    const skipWarnings = vi
      .mocked(logger.warn)
      .mock.calls.filter(([message]) =>
        String(message).includes('npx storybook automigrate generic-opt-in')
      );
    expect(skipWarnings).toHaveLength(1);
  });

  it('skips a fix and prints its skip warning when the user declines it interactively', async () => {
    vi.mocked(prompt.confirm).mockResolvedValue(false);
    const declinable = {
      ...fixes[0],
      id: 'declinable-fix',
      skipWarning:
        'The declinable-fix migration was declined. Run `npx storybook automigrate declinable-fix` to migrate later.',
    };

    const { fixResults } = await runFixes({
      ...common,
      yes: false,
      fixes: [declinable],
      storybookVersion: '7.0.0',
    });

    expect(fixResults).toEqual({ 'declinable-fix': 'skipped' });
    expect(run1).not.toHaveBeenCalled();
    // The user was asked, and the warning names the command to run later.
    expect(vi.mocked(prompt.confirm)).toHaveBeenCalled();
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('npx storybook automigrate declinable-fix')
    );
  });

  it('does not print a skip warning in a dry run, where nothing was declined', async () => {
    const optIn = {
      ...fixes[0],
      id: 'generic-opt-in',
      defaultSelected: false,
      skipWarning: 'The generic-opt-in migration was skipped.',
    };

    await runFixes({
      ...common,
      dryRun: true,
      fixes: [optIn],
      storybookVersion: '7.0.0',
    });

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalledWith(
      expect.stringContaining('generic-opt-in migration was skipped')
    );
  });

  it('does not print a skip warning for fixes that define none', async () => {
    const optIn = { ...fixes[0], id: 'opt-in', defaultSelected: false };

    await runFixes({ ...common, fixes: [optIn], storybookVersion: '7.0.0' });

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });

  it('does not warn for a fix that cancels itself from run, so the doctor still reports its deprecation', async () => {
    const selfCancelling: Fix = {
      id: 'self-cancelling',
      async check() {
        return check1();
      },
      prompt() {
        return prompt1Message;
      },
      run: vi.fn(async () => false as const),
    };

    const { fixResults, warnedFixIds } = await runFixes({
      ...common,
      fixes: [selfCancelling],
      storybookVersion: '7.0.0',
    });

    // The fix ran and cancelled: skipped, but no skip warning was printed for it.
    expect(fixResults).toEqual({ 'self-cancelling': 'skipped' });
    expect(selfCancelling.run).toHaveBeenCalled();
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    expect(warnedFixIds).toEqual([]);
  });

  it('returns undefined warned ids on a dry run, where no skip warning was printed', async () => {
    const optIn = {
      ...fixes[0],
      id: 'generic-opt-in',
      defaultSelected: false,
      skipWarning: 'The generic-opt-in migration was skipped.',
    };

    const { warnedFixIds } = await runFixes({
      ...common,
      dryRun: true,
      fixes: [optIn],
      storybookVersion: '7.0.0',
    });

    expect(warnedFixIds).toBeUndefined();
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

  it('hands the doctor the ids whose skip warning was printed, not every skipped id', async () => {
    const declined: Fix = {
      id: 'declined-fix',
      defaultSelected: false,
      async check() {
        return check1();
      },
      prompt() {
        return prompt1Message;
      },
      run: async () => {},
      skipWarning: 'The declined-fix migration was skipped.',
    };
    const selfCancelling: Fix = {
      id: 'cancelled-fix',
      async check() {
        return check1();
      },
      prompt() {
        return prompt1Message;
      },
      run: vi.fn(async () => false as const),
    };
    getStorybookData.mockResolvedValue({
      ...common,
      beforeVersion,
      versionInstalled: '7.0.0',
      isLatest: true,
    });

    await doAutomigrate({
      configDir,
      yes: true,
      skipInstall: true,
      fixes: [declined, selfCancelling],
    });

    // The declined fix printed its skip warning; the fix that cancelled itself from `run` did
    // not, so the doctor still reports that one's deprecation.
    expect(vi.mocked(doctor)).toHaveBeenCalledWith(
      expect.objectContaining({ warnedFixIds: ['declined-fix'] })
    );
  });
});
