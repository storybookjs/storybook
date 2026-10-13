import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasStorybookSkills, installSkills } from 'storybook/internal/cli';
import { type JsPackageManager, isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { runAutomigrations } from './automigrate/multi-project.ts';
import { displayDoctorResults, runMultiProjectDoctor } from './doctor/index.ts';
import { type UpgradeOptions, upgrade } from './upgrade.ts';
import { type CollectProjectsSuccessResult, getProjects } from './util.ts';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/telemetry');
vi.mock('storybook/internal/node-logger', { spy: true });
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

describe('upgrade: refreshing the skills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjects(project('/repo/a/.storybook'), project('/repo/b/.storybook'));
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
  });

  const skillsInUpgradeEvents = () =>
    vi
      .mocked(telemetry)
      .mock.calls.filter(([eventType]) => eventType === 'upgrade')
      .map(([, payload]) => (payload as { skills?: unknown }).skills);

  it('refreshes installed skills once for the whole upgrade, and reports the result', async () => {
    await upgrade(baseOptions);

    expect(installSkills).toHaveBeenCalledTimes(1);
    expect(installSkills).toHaveBeenCalledWith({
      packageManager: expect.objectContaining({ type: 'npm' }),
      source: 'refresh',
    });
    expect(skillsInUpgradeEvents()).toEqual([
      { result: 'installed', source: 'refresh' },
      { result: 'installed', source: 'refresh' },
    ]);
  });

  it('installs nothing when the project has no skills', async () => {
    vi.mocked(hasStorybookSkills).mockResolvedValue(false);

    await upgrade(baseOptions);

    expect(installSkills).not.toHaveBeenCalled();
    expect(skillsInUpgradeEvents()).toEqual([undefined, undefined]);
  });

  it('does not refresh skills that the skills automigration installed in the same upgrade', async () => {
    vi.mocked(hasStorybookSkills).mockResolvedValue(false);
    vi.mocked(runAutomigrations).mockImplementation(async () => {
      vi.mocked(hasStorybookSkills).mockResolvedValue(true);
      return { automigrationResults: {}, detectedAutomigrations: [] };
    });

    await upgrade(baseOptions);

    expect(installSkills).not.toHaveBeenCalled();
  });

  it('does not refresh on a dry run', async () => {
    await upgrade({ ...baseOptions, dryRun: true });

    expect(installSkills).not.toHaveBeenCalled();
  });
});
