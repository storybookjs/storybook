import { promises as fs } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { commonGlobOptions, getProjectRoot } from 'storybook/internal/common';

import {
  type ProjectAutomigrationData,
  collectAutomigrationsAcrossProjects,
  promptForAutomigrations,
  runAutomigrations,
  runAutomigrationsForProjects,
} from './multi-project.ts';
import type { Fix } from './types.ts';

vi.mock('node:fs', { spy: true });
vi.mock('globby', () => ({
  globby: vi.fn(),
}));
// Kept as a full stub (not spy: true): the real p-limit schedules work asynchronously, which
// would make call-order assertions in this file non-deterministic. This synchronous pass-through
// is deliberate.
vi.mock('p-limit', () => ({
  default: vi.fn(() => vi.fn((fn) => fn())),
}));
vi.mock('storybook/internal/common', { spy: true });

vi.mock('storybook/internal/node-logger', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/node-logger')>()),
    prompt: {
      multiselect: vi.fn(),
      error: vi.fn(),
      taskLog: vi.fn(() => ({
        message: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        group: vi.fn(),
      })),
    },
    logger: {
      log: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      SYMBOLS: {
        success: '✔',
        error: '✕',
      },
    },
  };
});

const { mockFixWithDetection } = vi.hoisted(() => {
  const mockFixWithDetection = {
    id: 'fix-with-detection',
    check: vi.fn(),
    prompt: vi.fn().mockReturnValue('Prompt for fix-with-detection'),
    promptType: 'auto',
    run: vi.fn().mockResolvedValue(undefined),
    detectMissedTransformations: vi.fn(),
  };
  return { mockFixWithDetection };
});

// Kept as a full stub (not spy: true): this substitutes the real 19-entry `allFixes` catalog with
// a single controlled fake fix so the multi-project logic can be tested in isolation. spy: true
// would fall through to the real array instead, defeating that isolation.
vi.mock('./fixes', () => ({
  allFixes: [mockFixWithDetection],
}));

const taskLogMock = {
  message: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  group: vi.fn().mockReturnValue({
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
};

describe('multi-project automigrations', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getProjectRoot).mockReturnValue('/project/root');
    vi.mocked(commonGlobOptions).mockReturnValue({});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const createMockFix = (id: string, checkResult: any = {}): Fix => ({
    id,
    check: vi.fn().mockResolvedValue(checkResult),
    prompt: vi.fn().mockReturnValue(`Prompt for ${id}`),
    promptType: 'auto',
    run: vi.fn(),
  });

  const createMockProject = (configDir: string): ProjectAutomigrationData => ({
    configDir,
    packageManager: {} as any,
    mainConfig: {} as any,
    mainConfigPath: `${configDir}/main.js`,
    storybookVersion: '8.0.0',
    beforeVersion: '7.0.0',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
  });

  describe('collectAutomigrationsAcrossProjects', () => {
    it('should collect automigrations across multiple projects', async () => {
      const fix1 = createMockFix('fix1', { needsFix: true });
      const fix2 = createMockFix('fix2', { needsFix: true });
      const fix3 = createMockFix('fix3', null); // This fix doesn't apply

      const project1 = createMockProject('/project1/.storybook');
      const project2 = createMockProject('/project2/.storybook');

      const results = await collectAutomigrationsAcrossProjects({
        fixes: [fix1, fix2, fix3],
        projects: [project1, project2],
        taskLog: taskLogMock,
      });

      expect(results).toHaveLength(3);
      expect(results[0].fix.id).toBe('fix1');
      expect(results[0].reports.every((report) => report.status === 'check_succeeded')).toBe(true);
      expect(results[1].fix.id).toBe('fix2');
      expect(results[1].reports.every((report) => report.status === 'check_succeeded')).toBe(true);
      expect(results[2].fix.id).toBe('fix3');
      expect(results[2].reports.every((report) => report.status === 'not_applicable')).toBe(true);
    });

    it('should deduplicate automigrations across projects', async () => {
      const fix1 = createMockFix('fix1', { needsFix: true });

      const project1 = createMockProject('/project1/.storybook');
      const project2 = createMockProject('/project2/.storybook');
      const project3 = createMockProject('/project3/.storybook');

      const results = await collectAutomigrationsAcrossProjects({
        fixes: [fix1],
        projects: [project1, project2, project3],
        taskLog: taskLogMock,
      });

      expect(results).toHaveLength(1);
      expect(results[0].fix.id).toBe('fix1');
      expect(results[0].reports).toHaveLength(3);
    });

    it('should handle check errors gracefully', async () => {
      const fix1 = createMockFix('fix1', { needsFix: true });
      const fix2 = createMockFix('fix2', { needsFix: true });
      fix1.check = vi.fn().mockRejectedValue(new Error('Check failed'));

      const project1 = createMockProject('/project1/.storybook');

      const results = await collectAutomigrationsAcrossProjects({
        fixes: [fix1, fix2],
        projects: [project1],
        taskLog: taskLogMock,
      });

      expect(results).toHaveLength(2);
      expect(results[0].fix.id).toBe('fix1');
      expect(results[0].reports.every((report) => report.status === 'check_failed')).toBe(true);
    });
  });

  describe('promptForAutomigrations', () => {
    it('should call multiselect with required: false', async () => {
      const { prompt } = await import('storybook/internal/node-logger');
      const multiselectMock = vi.mocked(prompt.multiselect);
      multiselectMock.mockResolvedValue(['fix1']);

      const fix1 = createMockFix('fix1', { needsFix: true });
      const project1 = createMockProject('/project1/.storybook');

      const automigrations = [
        {
          fix: fix1,
          reports: [
            {
              result: { needsFix: true },
              status: 'check_succeeded' as const,
              project: project1,
            },
          ],
        },
      ];

      await promptForAutomigrations(automigrations, { dryRun: false, yes: false });

      expect(multiselectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Select automigrations to run',
          required: false,
        })
      );
    });

    it('should return empty array when user selects nothing', async () => {
      const { prompt } = await import('storybook/internal/node-logger');
      const multiselectMock = vi.mocked(prompt.multiselect);
      multiselectMock.mockResolvedValue([]);

      const fix1 = createMockFix('fix1', { needsFix: true });
      const project1 = createMockProject('/project1/.storybook');

      const automigrations = [
        {
          fix: fix1,
          reports: [
            {
              result: { needsFix: true },
              status: 'check_succeeded' as const,
              project: project1,
            },
          ],
        },
      ];

      const result = await promptForAutomigrations(automigrations, {
        dryRun: false,
        yes: false,
      });

      expect(result).toEqual([]);
    });

    it('should return all automigrations when yes option is true', async () => {
      const { logger } = await import('storybook/internal/node-logger');
      const logSpy = vi.spyOn(logger, 'log');

      const fix1 = createMockFix('fix1', { needsFix: true });
      const fix2 = createMockFix('fix2', { needsFix: true });
      const project1 = createMockProject('/project1/.storybook');

      const automigrations = [
        {
          fix: fix1,
          reports: [
            {
              result: { needsFix: true },
              status: 'check_succeeded' as const,
              project: project1,
            },
          ],
        },
        {
          fix: fix2,
          reports: [
            {
              result: { needsFix: true },
              status: 'check_succeeded' as const,
              project: project1,
            },
          ],
        },
      ];

      const result = await promptForAutomigrations(automigrations, { dryRun: false, yes: true });

      expect(result).toEqual(automigrations);
      expect(logSpy).toHaveBeenCalledWith('Running all detected automigrations:');
    });

    it('should return empty array when dryRun is true', async () => {
      const { logger } = await import('storybook/internal/node-logger');
      const logSpy = vi.spyOn(logger, 'log');

      const fix1 = createMockFix('fix1', { needsFix: true });
      const project1 = createMockProject('/project1/.storybook');

      const automigrations = [
        {
          fix: fix1,
          reports: [
            {
              result: { needsFix: true },
              status: 'check_succeeded' as const,
              project: project1,
            },
          ],
        },
      ];

      const result = await promptForAutomigrations(automigrations, { dryRun: true, yes: false });

      expect(result).toEqual([]);
      expect(logSpy).toHaveBeenCalledWith(
        'Detected automigrations (dry run - no changes will be made):'
      );
    });
  });

  describe('runAutomigrationsForProjects - missed transformations', () => {
    beforeEach(() => {
      vi.mocked(fs.stat)
        .mockReset()
        .mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readFile).mockReset().mockResolvedValue('');
    });

    it('excludes another project`s own safe-set files from the aggregated missedTransformations even though they match the pattern (monorepo cross-contamination guard)', async () => {
      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      vi.mocked(globby).mockReset();

      const fix = createMockFix('fix-with-detection', { needsFix: true });
      fix.detectMissedTransformations = vi
        .fn()
        .mockReturnValue([{ label: 'old-pattern', regex: /old-pattern/ }]);

      // Project A is the one that actually ran the fix.
      const projectA: ProjectAutomigrationData = {
        ...createMockProject('/project1/.storybook'),
        mainConfigPath: '/project1/.storybook/main.ts',
      };
      // Project B did not run this fix, but it is part of the same run and has
      // its own legitimate story file that happens to still contain the stale pattern.
      const projectB: ProjectAutomigrationData = {
        ...createMockProject('/project2/.storybook'),
        mainConfigPath: '/project2/.storybook/main.ts',
        storiesPaths: ['/project2/src/Button.stories.ts'],
      };

      vi.mocked(globby).mockResolvedValue([
        // Belongs to project B's own safe set - must be excluded.
        '/project2/src/Button.stories.ts',
        // A genuine leftover file outside any known project's safe set.
        '/packages/other-app/src/leftover.ts',
      ]);
      vi.mocked(fs.readFile).mockResolvedValue("import x from 'old-pattern';");

      const automigrations = [
        {
          fix,
          reports: [
            {
              result: { needsFix: true },
              status: 'check_succeeded' as const,
              project: projectA,
            },
          ],
        },
      ];

      const { missedTransformations } = await runAutomigrationsForProjects(automigrations, {
        automigrations,
        dryRun: false,
        yes: false,
        skipInstall: false,
        // The safe set must be built from ALL projects known in this run, not
        // just the ones with successful fixes.
        projects: [projectA, projectB],
      });

      expect(missedTransformations).toEqual([
        {
          file: '/packages/other-app/src/leftover.ts',
          fixId: 'fix-with-detection',
          label: 'old-pattern',
        },
      ]);
    });
  });

  describe('runAutomigrations - missed transformations aggregation', () => {
    const createMockCollectProjectsResult = (configDir: string, storiesPaths: string[] = []) =>
      ({
        configDir,
        packageManager: {} as any,
        mainConfig: {} as any,
        mainConfigPath: `${configDir}/main.ts`,
        previewConfigPath: undefined,
        isUpgrade: true,
        beforeVersion: '7.0.0',
        currentCLIVersion: '8.0.0',
        latestCLIVersionOnNPM: '8.0.0',
        autoblockerCheckResults: null,
        storiesPaths,
        hasCsfFactoryPreview: false,
        isCanary: false,
        isCLIOutdated: false,
        isCLIPrerelease: false,
        isCLIExactPrerelease: false,
        isCLIExactLatest: false,
      }) as any;

    beforeEach(() => {
      mockFixWithDetection.check.mockReset();
      mockFixWithDetection.run.mockReset().mockResolvedValue(undefined);
      mockFixWithDetection.detectMissedTransformations.mockReset();
      vi.mocked(fs.stat)
        .mockReset()
        .mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readFile).mockReset().mockResolvedValue('');
    });

    it('scans for missed transformations once per run (not once per project) and returns a single flat list', async () => {
      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      vi.mocked(globby).mockReset();
      vi.mocked(globby).mockResolvedValue(['/packages/other-app/src/leftover.ts']);
      vi.mocked(fs.readFile).mockResolvedValue("import x from 'stale-import';");

      mockFixWithDetection.check.mockResolvedValue({ needsFix: true });
      mockFixWithDetection.detectMissedTransformations.mockReturnValue([
        { label: 'stale-import', regex: /stale-import/ },
      ]);

      const projectA = createMockCollectProjectsResult('/project1/.storybook');
      const projectB = createMockCollectProjectsResult('/project2/.storybook');

      const result = await runAutomigrations([projectA, projectB], {
        dryRun: false,
        yes: true,
        skipInstall: true,
        disableTelemetry: true,
      } as any);

      // The expensive filesystem scan must happen exactly once for the whole
      // run, regardless of how many projects successfully ran the fix.
      expect(globby).toHaveBeenCalledTimes(1);

      // Both projectA and projectB successfully ran the same fix, so the same
      // { fixId, label } pattern was produced twice. The leftover file must still
      // be reported exactly once, not once per project that ran the fix.
      expect(result.missedTransformations).toEqual([
        {
          file: '/packages/other-app/src/leftover.ts',
          fixId: 'fix-with-detection',
          label: 'stale-import',
        },
      ]);
    });
  });
});
