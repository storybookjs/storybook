import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hasStorybookSkills, installSkills } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { isCI } from 'storybook/internal/common';
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
    supportsAiFeatures: true,
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

const terminalStreams = [process.stdin, process.stdout];
const originalIsTTY = terminalStreams.map((stream) =>
  Object.getOwnPropertyDescriptor(stream, 'isTTY')
);
const setIsTTY = (stream: NodeJS.ReadStream | NodeJS.WriteStream, value: boolean) =>
  Object.defineProperty(stream, 'isTTY', { value, configurable: true });

const useProjects = (...projects: CollectProjectsSuccessResult[]) =>
  vi.mocked(getProjects).mockResolvedValue({ allProjects: projects, selectedProjects: projects });

describe('upgrade: the skills step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjects(project('/repo/a/.storybook'), project('/repo/b/.storybook'));
    vi.mocked(runAutomigrations).mockResolvedValue({
      automigrationResults: {},
      detectedAutomigrations: [],
    });
    vi.mocked(runMultiProjectDoctor).mockResolvedValue({});
    vi.mocked(displayDoctorResults).mockReturnValue(false);
    vi.mocked(detectAgent).mockReturnValue(undefined);
    vi.mocked(isCI).mockReturnValue(false);
    for (const method of ['info', 'step', 'log', 'warn', 'debug'] as const) {
      vi.mocked(logger[method]).mockImplementation(() => {});
    }
    vi.mocked(prompt.taskLog).mockReturnValue({
      message: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<typeof prompt.taskLog>);
    vi.mocked(prompt.confirm).mockResolvedValue(true);
    vi.mocked(hasStorybookSkills).mockResolvedValue(false);
    vi.mocked(installSkills).mockImplementation(async ({ source }) => ({
      result: 'installed',
      source,
    }));
    setIsTTY(process.stdin, true);
    setIsTTY(process.stdout, true);
  });

  afterEach(() => {
    terminalStreams.forEach((stream, index) => {
      const original = originalIsTTY[index];
      if (original) {
        Object.defineProperty(stream, 'isTTY', original);
      } else {
        delete (stream as { isTTY?: boolean }).isTTY;
      }
    });
  });

  const skillsInUpgradeEvents = () =>
    vi
      .mocked(telemetry)
      .mock.calls.filter(([eventType]) => eventType === 'upgrade')
      .map(([, payload]) => (payload as { skills?: unknown }).skills);

  describe('when the project has the skills', () => {
    beforeEach(() => {
      vi.mocked(hasStorybookSkills).mockResolvedValue(true);
    });

    it('refreshes them once for the whole upgrade, without asking', async () => {
      await upgrade(baseOptions);

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(installSkills).toHaveBeenCalledTimes(1);
      expect(installSkills).toHaveBeenCalledWith({
        packageManager: expect.objectContaining({ type: 'npm' }),
        source: 'installed',
      });
    });

    it('refreshes them on an upgrade within the same major and on an unsupported framework', async () => {
      useProjects(
        project('/repo/a/.storybook', { beforeVersion: '11.0.0', supportsAiFeatures: false })
      );

      await upgrade(baseOptions);

      expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ source: 'installed' }));
    });
  });

  describe('when the project does not have the skills', () => {
    it('asks on an upgrade from before 11 and installs on Yes', async () => {
      await upgrade(baseOptions);

      expect(prompt.confirm).toHaveBeenCalledWith(
        {
          message: 'Install the official Storybook skills for AI agents into this project?',
          initialValue: true,
        },
        expect.anything()
      );
      expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ source: 'prompt' }));
    });

    it('installs nothing on No', async () => {
      vi.mocked(prompt.confirm).mockResolvedValue(false);

      await upgrade(baseOptions);

      expect(installSkills).not.toHaveBeenCalled();
      expect(skillsInUpgradeEvents()).toEqual([
        { result: 'declined', source: 'prompt' },
        { result: 'declined', source: 'prompt' },
      ]);
    });

    it('installs nothing when the prompt is canceled', async () => {
      vi.mocked(prompt.confirm).mockImplementation(async (_, promptOptions) => {
        await promptOptions?.onCancel?.();
        return true;
      });

      await upgrade(baseOptions);

      expect(installSkills).not.toHaveBeenCalled();
    });

    it.each([
      ['from 11', { beforeVersion: '11.0.0' }],
      ['from an 11 prerelease', { beforeVersion: '11.0.0-alpha.1' }],
      ['on an unsupported framework', { supportsAiFeatures: false }],
    ])('does nothing on an upgrade %s', async (_, overrides) => {
      useProjects(project('/repo/a/.storybook', overrides));

      await upgrade(baseOptions);

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(installSkills).not.toHaveBeenCalled();
      expect(skillsInUpgradeEvents()).toEqual([undefined]);
    });

    it('asks when only one of the projects is supported and comes from before 11', async () => {
      useProjects(
        project('/repo/a/.storybook', { beforeVersion: '11.0.0' }),
        project('/repo/b/.storybook', { supportsAiFeatures: false }),
        project('/repo/c/.storybook')
      );

      await upgrade(baseOptions);

      expect(prompt.confirm).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['an agent', () => vi.mocked(detectAgent).mockReturnValue({ name: 'claude' }), {}, 'agent'],
      ['--yes', () => {}, { yes: true }, 'yes'],
      ['a run without a terminal', () => setIsTTY(process.stdin, false), {}, 'default'],
      ['CI', () => vi.mocked(isCI).mockReturnValue(true), {}, 'default'],
    ])('installs without asking for %s', async (_, arrange, options, source) => {
      arrange();

      await upgrade({ ...baseOptions, ...options });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ source }));
    });
  });

  it("attaches the result to every project's upgrade event", async () => {
    await upgrade(baseOptions);

    expect(skillsInUpgradeEvents()).toEqual([
      { result: 'installed', source: 'prompt' },
      { result: 'installed', source: 'prompt' },
    ]);
  });

  it('never runs during a dry run', async () => {
    vi.mocked(hasStorybookSkills).mockResolvedValue(true);

    await upgrade({ ...baseOptions, dryRun: true });

    expect(installSkills).not.toHaveBeenCalled();
  });
});
