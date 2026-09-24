import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installSkills } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { detectAgent, telemetry } from 'storybook/internal/telemetry';

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
    JsPackageManagerFactory: Object.assign(actual.JsPackageManagerFactory, {
      getPackageManager: () => ({
        type: 'npm',
        installDependencies: vi.fn(),
        isStorybookInMonorepo: () => false,
      }),
    }),
  };
});

const project = (configDir: string): CollectProjectsSuccessResult =>
  ({
    configDir,
    mainConfigPath: `${configDir}/main.ts`,
    mainConfig: {},
    beforeVersion: '9.0.0',
    currentCLIVersion: '11.0.0',
    isCanary: false,
    autoblockerCheckResults: null,
    packageManager: {
      type: 'npm',
      packageJsonPaths: [],
      precheckStorybookPackageInstall: vi.fn(),
    } as Partial<JsPackageManager> as JsPackageManager,
  }) as unknown as CollectProjectsSuccessResult;

const baseOptions: UpgradeOptions = {
  skipCheck: true,
  dryRun: false,
  yes: true,
  force: false,
  disableTelemetry: false,
};

describe('upgrade: the skills step', () => {
  const projects = [project('/repo/a/.storybook'), project('/repo/b/.storybook')];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProjects).mockResolvedValue({ allProjects: projects, selectedProjects: projects });
    vi.mocked(runAutomigrations).mockResolvedValue({
      automigrationResults: {},
      detectedAutomigrations: [],
    });
    vi.mocked(runMultiProjectDoctor).mockResolvedValue({});
    vi.mocked(displayDoctorResults).mockReturnValue(false);
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    for (const method of ['info', 'step', 'log', 'warn', 'debug'] as const) {
      vi.mocked(logger[method]).mockImplementation(() => {});
    }
    vi.mocked(prompt.taskLog).mockReturnValue({
      message: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<typeof prompt.taskLog>);
    vi.mocked(installSkills).mockResolvedValue({
      result: 'installed',
      source: 'prompt',
      refType: 'tag',
    });
  });

  it('runs once for the whole upgrade with the options derived from the CLI flags', async () => {
    await upgrade({ ...baseOptions, skills: false });

    expect(installSkills).toHaveBeenCalledTimes(1);
    expect(installSkills).toHaveBeenCalledWith({
      packageManager: expect.objectContaining({ type: 'npm' }),
      skillsFlag: false,
      yes: true,
      agent: true,
    });
  });

  it("attaches the result to every project's upgrade event", async () => {
    await upgrade(baseOptions);

    const upgradeEvents = vi
      .mocked(telemetry)
      .mock.calls.filter(([eventType]) => eventType === 'upgrade')
      .map(([, payload]) => payload);
    expect(upgradeEvents).toHaveLength(2);
    for (const event of upgradeEvents) {
      expect(event).toMatchObject({
        skills: { result: 'installed', source: 'prompt', refType: 'tag' },
      });
    }
  });

  it('never runs during a dry run', async () => {
    await upgrade({ ...baseOptions, dryRun: true });

    expect(installSkills).not.toHaveBeenCalled();
  });
});
