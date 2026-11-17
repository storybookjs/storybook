import { rmSync } from 'node:fs';
import { join } from 'pathe';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasStorybookSkills, installSkills } from 'storybook/internal/cli';
import { type JsPackageManager, isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { runAutomigrations } from './automigrate/multi-project.ts';
import { displayDoctorResults, runMultiProjectDoctor } from './doctor/index.ts';
import { type UpgradeOptions, upgrade } from './upgrade.ts';
import { type CollectProjectsSuccessResult, getProjects } from './util.ts';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/telemetry');
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('./automigrate/multi-project.ts', { spy: true });
vi.mock('./doctor/index.ts', { spy: true });
vi.mock('./util.ts', { spy: true });
vi.mock(import('storybook/internal/common'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCI: vi.fn(),
    JsPackageManagerFactory: Object.assign(actual.JsPackageManagerFactory, {
      getPackageManager: () => ({
        type: 'npm',
        installDependencies: async () => {},
        isStorybookInMonorepo: () => false,
      }),
    }),
  };
});

const project = (
  configDir: string,
  overrides: Partial<CollectProjectsSuccessResult> = {}
): CollectProjectsSuccessResult =>
  ({
    configDir,
    mainConfigPath: `${configDir}/main.ts`,
    mainConfig: {},
    beforeVersion: '10.3.0',
    currentCLIVersion: '11.0.0',
    isCanary: false,
    autoblockerCheckResults: null,
    packageManager: {
      type: 'npm',
      packageJsonPaths: [],
      precheckStorybookPackageInstall: async () => {},
      installDependencies: async () => {},
      isStorybookInMonorepo: () => false,
    } as Partial<JsPackageManager> as JsPackageManager,
    ...overrides,
  }) as unknown as CollectProjectsSuccessResult;

const baseOptions: UpgradeOptions = {
  skipCheck: true,
  dryRun: false,
  yes: false,
  force: false,
  disableTelemetry: false,
};

const useProjects = (...projects: CollectProjectsSuccessResult[]) =>
  vi.mocked(getProjects).mockResolvedValue({ allProjects: projects, selectedProjects: projects });

// Shared setup for the suite: reset mocks and give every external mock a safe default.
// `rmSync` is stubbed to a no-op so tests never delete the real cache directory under
// this working tree.
beforeEach(() => {
  vi.clearAllMocks();
  useProjects(project('/repo/a/.storybook'));
  vi.mocked(runAutomigrations).mockResolvedValue({
    automigrationResults: {},
    detectedAutomigrations: [],
  });
  vi.mocked(runMultiProjectDoctor).mockResolvedValue({});
  vi.mocked(displayDoctorResults).mockReturnValue(false);
  vi.mocked(isCI).mockReturnValue(false);
  for (const method of ['info', 'step', 'log', 'warn', 'debug'] as const) {
    vi.mocked(logger[method]).mockImplementation(() => {});
  }
  vi.mocked(prompt.taskLog).mockReturnValue({
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  } as unknown as ReturnType<typeof prompt.taskLog>);
  vi.mocked(hasStorybookSkills).mockResolvedValue(true);
  vi.mocked(installSkills).mockResolvedValue({ result: 'installed', source: 'refresh' });
  vi.mocked(rmSync).mockImplementation(() => {});
});

describe('upgrade: cache directory cleanup', () => {
  const storybookCacheDirectory = join(process.cwd(), 'node_modules', '.cache', 'storybook');

  it('removes the Storybook cache directory on upgrade', async () => {
    await upgrade(baseOptions);

    expect(rmSync).toHaveBeenCalledWith(storybookCacheDirectory, {
      recursive: true,
      force: true,
    });
  });

  it('does not fail the upgrade when removing the cache directory fails', async () => {
    vi.mocked(rmSync).mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });

    await expect(upgrade(baseOptions)).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('cache directory'));
  });

  it('does not remove the cache directory on a dry run', async () => {
    await upgrade({ ...baseOptions, dryRun: true });

    expect(rmSync).not.toHaveBeenCalled();
  });
});
