import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getStorybookData, hasStorybookSkills, installSkills } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { detectAgent, telemetry } from 'storybook/internal/telemetry';
import { SupportedRenderer } from 'storybook/internal/types';

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

const terminalStreams = [process.stdin, process.stdout];
const originalIsTTY = terminalStreams.map((stream) =>
  Object.getOwnPropertyDescriptor(stream, 'isTTY')
);
const setIsTTY = (stream: NodeJS.ReadStream | NodeJS.WriteStream, value: boolean) =>
  Object.defineProperty(stream, 'isTTY', { value, configurable: true });

const useProjects = (...projects: CollectProjectsSuccessResult[]) =>
  vi.mocked(getProjects).mockResolvedValue({ allProjects: projects, selectedProjects: projects });

const VUE_CONFIG_DIR = '/repo/vue/.storybook';
const useFrameworks = () =>
  vi.mocked(getStorybookData).mockImplementation(
    async ({ configDir }) =>
      (configDir === VUE_CONFIG_DIR
        ? {
            renderer: SupportedRenderer.VUE3,
            frameworkPackage: '@storybook/vue3-vite',
            builderPackage: '@storybook/builder-vite',
          }
        : {
            renderer: SupportedRenderer.REACT,
            frameworkPackage: '@storybook/react-vite',
            builderPackage: '@storybook/builder-vite',
          }) as Awaited<ReturnType<typeof getStorybookData>>
  );

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
    useFrameworks();
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
      useProjects(project(VUE_CONFIG_DIR, { beforeVersion: '11.0.0' }));

      await upgrade(baseOptions);

      expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ source: 'installed' }));
    });
  });

  describe('when the project does not have the skills', () => {
    it.each(['10.3.0', '11.0.0-alpha.1'])(
      'asks on an upgrade from %s, a version that did not offer the skills',
      async (beforeVersion) => {
        useProjects(project('/repo/a/.storybook', { beforeVersion }));

        await upgrade(baseOptions);

        expect(prompt.confirm).toHaveBeenCalledTimes(1);
      }
    );

    it('asks with Yes preselected and installs on Yes', async () => {
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
      ['from 11', project('/repo/a/.storybook', { beforeVersion: '11.0.0' })],
      [
        'from the first prerelease that offers the skills',
        project('/repo/a/.storybook', { beforeVersion: '11.0.0-alpha.2' }),
      ],
      [
        'from a canary',
        project('/repo/a/.storybook', { beforeVersion: '0.0.0-pr-1-sha-abc', isCanary: true }),
      ],
      ['on an unsupported framework', project(VUE_CONFIG_DIR)],
    ])('does nothing on an upgrade %s', async (_, upgraded) => {
      useProjects(upgraded);

      await upgrade(baseOptions);

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(installSkills).not.toHaveBeenCalled();
      expect(skillsInUpgradeEvents()).toEqual([undefined]);
    });

    it('asks when only one of the projects is supported and comes from before the skills', async () => {
      useProjects(
        project('/repo/a/.storybook', { beforeVersion: '11.0.0' }),
        project(VUE_CONFIG_DIR),
        project('/repo/c/.storybook')
      );

      await upgrade(baseOptions);

      expect(prompt.confirm).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['an agent', () => vi.mocked(detectAgent).mockReturnValue({ name: 'claude' }), {}, 'agent'],
      ['--yes', () => {}, { yes: true }, 'yes'],
      ['a run without a terminal', () => setIsTTY(process.stdin, false), {}, 'default'],
    ])('installs without asking for %s', async (_, arrange, options, source) => {
      arrange();

      await upgrade({ ...baseOptions, ...options });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ source }));
    });
  });

  it('never asks in CI', async () => {
    vi.mocked(isCI).mockReturnValue(true);

    await upgrade(baseOptions);

    expect(prompt.confirm).not.toHaveBeenCalled();
  });

  it("attaches the result to every project's upgrade event", async () => {
    await upgrade(baseOptions);

    expect(skillsInUpgradeEvents()).toEqual([
      { result: 'installed', source: 'prompt' },
      { result: 'installed', source: 'prompt' },
    ]);
  });

  it('leaves installed skills alone on a canary, which has no skills tag', async () => {
    vi.mocked(hasStorybookSkills).mockResolvedValue(true);
    useProjects(project('/repo/a/.storybook', { isCanary: true }));

    await upgrade(baseOptions);

    expect(installSkills).not.toHaveBeenCalled();
  });

  it('never runs during a dry run', async () => {
    vi.mocked(hasStorybookSkills).mockResolvedValue(true);

    await upgrade({ ...baseOptions, dryRun: true });

    expect(installSkills).not.toHaveBeenCalled();
  });
});
