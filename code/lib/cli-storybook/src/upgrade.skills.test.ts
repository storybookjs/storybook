import { relative } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasStorybookSkills, installSkills } from 'storybook/internal/cli';
import { type JsPackageManager, isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { detectAgent, telemetry } from 'storybook/internal/telemetry';

import { offersAngularViteMigration } from './automigrate/fixes/angular-to-angular-vite.ts';
import { runAutomigrations } from './automigrate/multi-project.ts';
import { FixStatus } from './automigrate/types.ts';
import { displayDoctorResults, runMultiProjectDoctor } from './doctor/index.ts';
import {
  forgetUpgradeStart,
  rememberUpgradeStart,
  upgradeStartVersion,
} from './pending-upgrade.ts';
import { type UpgradeOptions, upgrade } from './upgrade.ts';
import { type CollectProjectsSuccessResult, getProjects } from './util.ts';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/telemetry');
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./automigrate/fixes/angular-to-angular-vite.ts', { spy: true });
vi.mock('./automigrate/multi-project.ts', { spy: true });
vi.mock('./doctor/index.ts', { spy: true });
vi.mock('./pending-upgrade.ts');
// Vitest workers have no terminal; these tests are about what follows the prompts.
vi.mock('./prompts.ts', () => ({ answersPromptsWithYes: ({ yes }: { yes?: boolean }) => !!yes }));
vi.mock('./util.ts', { spy: true });
vi.mock(import('storybook/internal/common'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCI: vi.fn(),
    getProjectRoot: () => '/repo',
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
      getAllDependencies: () => ({}),
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
    vi.mocked(detectAgent).mockReturnValue(undefined);
    vi.mocked(upgradeStartVersion).mockImplementation(async (_, installed) => installed);
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

  // Without colors, so the assertions read like the terminal.
  const loggedText = () =>
    [...vi.mocked(logger.log).mock.calls, ...vi.mocked(logger.step).mock.calls]
      .map(([message]) => String(message).replace(/\x1b\[[0-9;]*m/g, ''))
      .join('\n');

  const skillsInUpgradeEvents = () =>
    vi
      .mocked(telemetry)
      .mock.calls.filter(([eventType]) => eventType === 'upgrade')
      .map(([, payload]) => (payload as { skills?: unknown }).skills);

  it('fails after reporting an incomplete automigration', async () => {
    vi.mocked(runAutomigrations).mockResolvedValue({
      automigrationResults: {
        '/repo/a/.storybook': {
          automigrationStatuses: { 'story-sort-to-main': FixStatus.FAILED },
          automigrationErrors: { 'story-sort-to-main': 'Comparator requires manual migration' },
          fileFailures: [],
        },
      },
      detectedAutomigrations: [],
    });

    await expect(upgrade(baseOptions)).rejects.toThrow('Some automigrations could not finish');
    expect(telemetry).toHaveBeenCalled();
    expect(loggedText()).toContain(
      'Automigrations left unfinished:\n• a/.storybook\nstory-sort-to-main failed: Comparator requires manual migration'
    );
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
          ],
        },
      },
      detectedAutomigrations: [],
    });

    await expect(upgrade(baseOptions)).rejects.toThrow('Some automigrations could not finish');
    expect(loggedText()).toContain(
      [
        'Automigrations left unfinished:',
        '• a/.storybook',
        'argtypes-default-value could not migrate 1 file:',
        '- a/src/Stack.stories.tsx: Cannot mutate spread field',
        `Every file and why: ${relative(process.cwd(), '/repo/automigrations-summary.md')}`,
      ].join('\n')
    );
  });

  it('succeeds when every automigration finished, without listing a project as failed', async () => {
    vi.mocked(runAutomigrations).mockResolvedValue({
      automigrationResults: {
        '/repo/a/.storybook': {
          automigrationStatuses: {
            'argtypes-default-value': FixStatus.SUCCEEDED,
            'upgrade-storybook-related-dependencies': FixStatus.SUCCEEDED,
          },
          automigrationErrors: {},
          fileFailures: [],
        },
      },
      detectedAutomigrations: [
        { fix: { id: 'argtypes-default-value', link: 'https://example.com/argtypes' } },
        { fix: { id: 'upgrade-storybook-related-dependencies' } },
      ] as Awaited<ReturnType<typeof runAutomigrations>>['detectedAutomigrations'],
    });

    await expect(upgrade(baseOptions)).resolves.toBeUndefined();
    expect(loggedText()).not.toContain('unfinished');
    expect(loggedText()).toContain('upgraded successfully');
    expect(loggedText()).toContain('argtypes-default-value');
    expect(loggedText()).not.toContain('undefined');
  });

  it('refreshes installed skills once for the whole upgrade, and reports the result', async () => {
    await upgrade(baseOptions);

    expect(installSkills).toHaveBeenCalledTimes(1);
    expect(installSkills).toHaveBeenCalledWith({
      packageManager: expect.objectContaining({ type: 'npm' }),
      source: 'refresh',
      testSupported: false,
    });
    expect(skillsInUpgradeEvents()).toEqual([
      { result: 'installed', source: 'refresh' },
      { result: 'installed', source: 'refresh' },
    ]);
  });

  it('gives the section a test step when one Storybook of the project has addon-vitest', async () => {
    const withVitest = project('/repo/b/.storybook');
    withVitest.packageManager.getAllDependencies = () => ({
      '@storybook/addon-vitest': '^11.0.0',
    });
    useProjects(project('/repo/a/.storybook'), withVitest);

    await upgrade(baseOptions);

    expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ testSupported: true }));
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

  it('migrates from the start of an unfinished upgrade, and forgets it after the automigrations', async () => {
    useProjects(project('/repo/a/.storybook', { beforeVersion: '11.0.0' }));
    vi.mocked(upgradeStartVersion).mockResolvedValue('10.6.7');

    await upgrade(baseOptions);

    expect(vi.mocked(runAutomigrations).mock.calls[0][0]).toEqual([
      expect.objectContaining({ configDir: '/repo/a/.storybook', beforeVersion: '10.6.7' }),
    ]);
    expect(rememberUpgradeStart).toHaveBeenCalledWith('/repo/a/.storybook', {
      from: '10.6.7',
      to: '11.0.0',
    });
    expect(forgetUpgradeStart).toHaveBeenCalledWith('/repo/a/.storybook');
    expect(vi.mocked(forgetUpgradeStart).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(runAutomigrations).mock.invocationCallOrder[0]
    );
  });

  it('remembers nothing on a dry run', async () => {
    await upgrade({ ...baseOptions, dryRun: true });

    expect(rememberUpgradeStart).not.toHaveBeenCalled();
    expect(forgetUpgradeStart).not.toHaveBeenCalled();
  });

  describe('in CI', () => {
    beforeEach(() => {
      vi.mocked(isCI).mockReturnValue(true);
      vi.mocked(detectAgent).mockReturnValue(undefined);
      vi.mocked(hasStorybookSkills).mockResolvedValue(false);
    });

    it('tells an Angular project to move to angular-vite before it adds the skills', async () => {
      vi.mocked(offersAngularViteMigration).mockResolvedValueOnce(true);
      useProjects(
        project('/repo/a/.storybook', {
          mainConfig: { stories: [], framework: '@storybook/angular' },
        })
      );

      await upgrade(baseOptions);

      expect(skippedWarnings()).toEqual([
        [
          'Skipped the Storybook skills for AI agents because CI is set. Add them with: npx storybook automigrate angular-to-angular-vite --yes, and then npx storybook automigrate skills --yes',
        ],
      ]);
    });

    const skippedWarnings = () =>
      vi
        .mocked(logger.warn)
        .mock.calls.filter(([message]) =>
          String(message).includes('the Storybook skills for AI agents')
        );

    it('says once that it skipped the skills, and how to add them', async () => {
      useProjects(
        project('/repo/a/.storybook', {
          mainConfig: { stories: [], framework: '@storybook/react-vite' },
        }),
        project('/repo/b/.storybook', {
          mainConfig: { stories: [], framework: '@storybook/react-vite' },
        })
      );

      await upgrade(baseOptions);

      expect(skippedWarnings()).toEqual([
        [
          'Skipped the Storybook skills for AI agents because CI is set. Add them with: npx storybook automigrate skills --yes',
        ],
      ]);
    });

    it('says nothing when no project supports the skills', async () => {
      useProjects(
        project('/repo/a/.storybook', {
          mainConfig: { stories: [], framework: '@storybook/html-vite' },
        })
      );

      await upgrade(baseOptions);

      expect(skippedWarnings()).toEqual([]);
    });

    it('says nothing when a coding agent set CI, because the skills automigration installs them', async () => {
      vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
      vi.mocked(runAutomigrations).mockImplementation(async () => {
        vi.mocked(hasStorybookSkills).mockResolvedValue(true);
        return { automigrationResults: {}, detectedAutomigrations: [] };
      });
      useProjects(
        project('/repo/a/.storybook', {
          mainConfig: { stories: [], framework: '@storybook/react-vite' },
        })
      );

      await upgrade(baseOptions);

      expect(skippedWarnings()).toEqual([]);
    });

    it('says nothing when the upgrade skips the automigrations', async () => {
      useProjects(
        project('/repo/a/.storybook', {
          mainConfig: { stories: [], framework: '@storybook/react-vite' },
        })
      );

      await upgrade({ ...baseOptions, skipAutomigrations: true });

      expect(skippedWarnings()).toEqual([]);
    });

    it('says nothing on a dry run', async () => {
      useProjects(
        project('/repo/a/.storybook', {
          mainConfig: { stories: [], framework: '@storybook/react-vite' },
        })
      );

      await upgrade({ ...baseOptions, dryRun: true });

      expect(skippedWarnings()).toEqual([]);
    });

    it('says nothing about adding skills that the project has', async () => {
      vi.mocked(hasStorybookSkills).mockResolvedValue(true);
      vi.mocked(installSkills).mockResolvedValue({ result: 'skipped', source: 'ci' });
      useProjects(
        project('/repo/a/.storybook', {
          mainConfig: { stories: [], framework: '@storybook/react-vite' },
        })
      );

      await upgrade(baseOptions);

      expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ source: 'refresh' }));
      expect(skippedWarnings()).toEqual([]);
    });
  });

  describe('outside CI', () => {
    beforeEach(() => {
      vi.mocked(hasStorybookSkills).mockResolvedValue(false);
      useProjects(
        project('/repo/a/.storybook', {
          mainConfig: { stories: [], framework: '@storybook/react-vite' },
        })
      );
    });

    const notInstalledWarnings = () =>
      vi
        .mocked(logger.warn)
        .mock.calls.filter(([message]) =>
          String(message).includes('the Storybook skills for AI agents')
        );

    it('says how to add the skills when the automigration did not install them', async () => {
      await upgrade(baseOptions);

      expect(notInstalledWarnings()).toEqual([
        [
          'Did not install the Storybook skills for AI agents. Add them with: npx storybook automigrate skills --yes',
        ],
      ]);
    });

    it('says nothing when the automigration installed them', async () => {
      vi.mocked(runAutomigrations).mockImplementation(async () => {
        vi.mocked(hasStorybookSkills).mockResolvedValue(true);
        return { automigrationResults: {}, detectedAutomigrations: [] };
      });

      await upgrade(baseOptions);

      expect(notInstalledWarnings()).toEqual([]);
    });
  });
});
