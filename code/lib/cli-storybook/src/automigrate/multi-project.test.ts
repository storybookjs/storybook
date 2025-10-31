import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ProjectAutomigrationData,
  collectAutomigrationsAcrossProjects,
  promptForAutomigrations,
} from './multi-project';
import type { Fix } from './types';

vi.mock('storybook/internal/node-logger', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/node-logger')>()),
    prompt: {
      multiselect: vi.fn(),
      error: vi.fn(),
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

const taskLogMock = {
  message: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
};

describe('multi-project automigrations', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
});
