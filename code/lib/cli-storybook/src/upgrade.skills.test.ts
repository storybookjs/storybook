import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  hasStorybookSkills,
  installSkills,
  refreshAgentInstructions,
} from 'storybook/internal/cli';
import { type JsPackageManager, isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { runAutomigrations } from './automigrate/multi-project.ts';
import { FixStatus } from './automigrate/types.ts';
import { displayDoctorResults, runMultiProjectDoctor } from './doctor/index.ts';
import { type UpgradeOptions, upgrade } from './upgrade.ts';
import { type CollectProjectsSuccessResult, getProjects } from './util.ts';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/telemetry');
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./automigrate/multi-project.ts', { spy: true });
vi.mock('./doctor/index.ts', { spy: true });
vi.mock('./postinstallAddon.ts');
// Vitest workers have no terminal; these tests are about what follows the prompts.
vi.mock('./prompts.ts', () => ({ answersPromptsWithYes: ({ yes }: { yes?: boolean }) => !!yes }));
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
  vi.mocked(getProjects).mockResolvedValue({
    allProjects: projects,
    selectedProjects: projects,
    unreadProjects: 0,
  });

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
  vi.mocked(refreshAgentInstructions).mockResolvedValue();
});

describe('upgrade: refreshing the skills', () => {
  const skillsInUpgradeEvents = () =>
    vi
      .mocked(telemetry)
      .mock.calls.filter(([eventType]) => eventType === 'upgrade')
      .map(([, payload]) => (payload as { skills?: unknown }).skills);

  it('fails after reporting an incomplete automigration', async () => {
    vi.mocked(runAutomigrations).mockResolvedValue({
      automigrationResults: {
        '/repo/a/.storybook': {
          automigrationStatuses: {
            'story-sort-to-main': FixStatus.FAILED,
            'csf-factories': FixStatus.CHECK_FAILED,
            'argtypes-default-value': FixStatus.SUCCEEDED,
          },
          automigrationErrors: { 'story-sort-to-main': 'Comparator requires manual migration' },
          fileFailures: [
            {
              fixId: 'story-sort-to-main',
              file: '/repo/a/.storybook/preview.ts',
              kind: 'preview',
              message: 'Comparator requires manual migration',
            },
          ],
        },
      },
      detectedAutomigrations: [],
    });

    await expect(upgrade(baseOptions)).rejects.toThrow(
      'Some automigrations failed or skipped files'
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(
        /Failed to upgrade:[\s\S]*a\/\.storybook \(story-sort-to-main, csf-factories\)/
      )
    );
    expect(telemetry).toHaveBeenCalled();
  });

  it('fails after reporting files skipped by an otherwise successful automigration', async () => {
    vi.mocked(runAutomigrations).mockResolvedValue({
      automigrationResults: {
        '/repo/a/.storybook': {
          automigrationStatuses: { 'argtypes-default-value': FixStatus.SUCCEEDED },
          automigrationErrors: {},
          fileFailures: [
            {
              fixId: 'argtypes-default-value',
              file: '/repo/a/src/Stack.stories.tsx',
              kind: 'story',
              message: 'Cannot mutate spread field',
            },
            {
              fixId: 'argtypes-default-value',
              file: '/repo/a/src/Button.stories.tsx',
              kind: 'story',
              message: 'Cannot mutate spread field',
            },
          ],
        },
      },
      detectedAutomigrations: [],
    });

    await expect(upgrade(baseOptions)).rejects.toThrow(
      'Some automigrations failed or skipped files'
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(/Failed to upgrade:[\s\S]*a\/\.storybook \(argtypes-default-value\)/)
    );
  });

  it('refreshes installed skills once for the whole upgrade, and reports the result', async () => {
    await upgrade(baseOptions);

    expect(installSkills).toHaveBeenCalledTimes(1);
    expect(installSkills).toHaveBeenCalledWith({
      packageManager: expect.objectContaining({ type: 'npm' }),
      source: 'refresh',
      testSupported: false,
      sawEveryStorybook: true,
    });
    expect(skillsInUpgradeEvents()).toEqual([
      { result: 'installed', source: 'refresh' },
      { result: 'installed', source: 'refresh' },
    ]);
  });

  it('says that a Storybook could not be read, so the section keeps its test step', async () => {
    const projects = [project('/repo/a/.storybook')];
    vi.mocked(getProjects).mockResolvedValue({
      allProjects: projects,
      selectedProjects: projects,
      unreadProjects: 1,
    });

    await upgrade(baseOptions);

    expect(installSkills).toHaveBeenLastCalledWith(
      expect.objectContaining({ testSupported: false, sawEveryStorybook: false })
    );
  });

  it('says that --config-dir leaves Storybooks unread, so the section keeps its test step', async () => {
    await upgrade(baseOptions);
    expect(installSkills).toHaveBeenLastCalledWith(
      expect.objectContaining({ testSupported: false, sawEveryStorybook: true })
    );

    await upgrade({ ...baseOptions, configDir: ['/repo/a/.storybook'] });
    expect(installSkills).toHaveBeenLastCalledWith(
      expect.objectContaining({ testSupported: false, sawEveryStorybook: false })
    );
  });

  it('gives the section a test step when the main config of one Storybook lists addon-vitest', async () => {
    useProjects(
      project('/repo/a/.storybook'),
      project('/repo/b/.storybook', {
        mainConfig: { stories: [], addons: ['@storybook/addon-vitest'] },
      })
    );

    await upgrade(baseOptions);

    expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ testSupported: true }));
  });

  it('gives the section a test step when an automigration adds addon-vitest', async () => {
    vi.mocked(runAutomigrations).mockResolvedValue({
      automigrationResults: {
        '/repo/a/.storybook': {
          automigrationStatuses: { 'angular-to-angular-vite': FixStatus.SUCCEEDED },
          automigrationErrors: {},
          fileFailures: [],
          addonsToPostinstall: ['@storybook/addon-vitest'],
        },
      },
      detectedAutomigrations: [],
    });

    await upgrade(baseOptions);

    expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ testSupported: true }));
  });

  it('installs nothing when the project has no skills', async () => {
    vi.mocked(hasStorybookSkills).mockResolvedValue(false);

    await upgrade(baseOptions);

    expect(installSkills).not.toHaveBeenCalled();
    expect(skillsInUpgradeEvents()).toEqual([undefined, undefined]);
    expect(refreshAgentInstructions).toHaveBeenCalledTimes(1);
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

  describe('when the skills were offered', () => {
    const offered = (result: object = {}, configDir = '.storybook') =>
      vi.mocked(runAutomigrations).mockResolvedValue({
        automigrationResults: {},
        detectedAutomigrations: [
          {
            fix: { id: 'skills' },
            reports: [{ result, status: 'check_succeeded', project: { configDir } }],
          } as never,
        ],
      });
    const notInstalled = () =>
      vi
        .mocked(logger.warn)
        .mock.calls.filter(([message]) => String(message).startsWith('Did not install'));

    beforeEach(() => {
      vi.mocked(hasStorybookSkills).mockResolvedValue(false);
    });

    it('says how to add them when they are not there, for example unticked', async () => {
      offered();

      await upgrade(baseOptions);

      expect(notInstalled()).toEqual([
        [
          'Did not install the Storybook skills for AI agents. Add them with: npx storybook automigrate skills',
        ],
      ]);
    });

    it('names the config folder when it is not .storybook in the working directory', async () => {
      offered({}, join(process.cwd(), 'packages/a/.storybook'));

      await upgrade(baseOptions);

      expect(notInstalled()).toEqual([
        [
          'Did not install the Storybook skills for AI agents. Add them with: npx storybook automigrate skills --config-dir packages/a/.storybook',
        ],
      ]);
    });

    it('tells Angular to move to angular-vite first', async () => {
      offered({ afterAngularViteMigration: true });

      await upgrade(baseOptions);

      expect(notInstalled()).toEqual([
        [
          'Did not install the Storybook skills for AI agents. Add them with: npx storybook automigrate angular-to-angular-vite, and then npx storybook automigrate skills',
        ],
      ]);
    });

    it('says nothing once they are installed', async () => {
      offered();
      vi.mocked(hasStorybookSkills).mockResolvedValueOnce(false).mockResolvedValue(true);

      await upgrade(baseOptions);

      expect(notInstalled()).toEqual([]);
    });
  });
});

describe('upgrade: --dry-run', () => {
  it.each([
    { dryRun: true, calls: 0 },
    { dryRun: false, calls: 1 },
  ])(
    'installs and dedupes $calls time(s) in a monorepo when dryRun is $dryRun',
    async ({ dryRun, calls }) => {
      const installDependencies = vi.fn(async () => {});
      const dedupeDependencies = vi.fn(async () => {});
      const monorepo = project('/repo/a/.storybook');
      Object.assign(monorepo.packageManager, {
        type: 'pnpm',
        installDependencies,
        dedupeDependencies,
        isStorybookInMonorepo: () => true,
      });
      useProjects(monorepo);

      await upgrade({ ...baseOptions, dryRun, yes: true });

      expect(installDependencies).toHaveBeenCalledTimes(calls);
      expect(dedupeDependencies).toHaveBeenCalledTimes(calls);
    }
  );
});
