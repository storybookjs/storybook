import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ProjectAutomigrationData,
  collectAutomigrationsAcrossProjects,
} from './multi-project';
import type { Fix } from './types';

vi.mock('storybook/internal/common', () => ({
  prompt: {
    multiselect: vi.fn(),
  },
}));

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
    versionRange: ['7.0.0', '8.0.0'],
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
      });

      expect(results).toHaveLength(2);
      expect(results[0].fix.id).toBe('fix1');
      expect(results[0].projects).toHaveLength(2);
      expect(results[1].fix.id).toBe('fix2');
      expect(results[1].projects).toHaveLength(2);
    });

    it('should deduplicate automigrations across projects', async () => {
      const fix1 = createMockFix('fix1', { needsFix: true });

      const project1 = createMockProject('/project1/.storybook');
      const project2 = createMockProject('/project2/.storybook');
      const project3 = createMockProject('/project3/.storybook');

      const results = await collectAutomigrationsAcrossProjects({
        fixes: [fix1],
        projects: [project1, project2, project3],
      });

      expect(results).toHaveLength(1);
      expect(results[0].fix.id).toBe('fix1');
      expect(results[0].projects).toHaveLength(3);
    });

    it('should respect version ranges when isUpgrade is true', async () => {
      const fix1 = createMockFix('fix1', { needsFix: true });
      fix1.versionRange = ['6.0.0', '7.0.0'];

      const project1 = createMockProject('/project1/.storybook');
      project1.beforeVersion = '5.0.0'; // Outside range
      project1.storybookVersion = '7.0.0';

      const results = await collectAutomigrationsAcrossProjects({
        fixes: [fix1],
        projects: [project1],
      });

      expect(results).toHaveLength(0);
      expect(fix1.check).not.toHaveBeenCalled();
    });

    it('should handle check errors gracefully', async () => {
      const fix1 = createMockFix('fix1', { needsFix: true });
      const fix2 = createMockFix('fix2', { needsFix: true });
      fix1.check = vi.fn().mockRejectedValue(new Error('Check failed'));

      const project1 = createMockProject('/project1/.storybook');

      const results = await collectAutomigrationsAcrossProjects({
        fixes: [fix1, fix2],
        projects: [project1],
      });

      expect(results).toHaveLength(1);
      expect(results[0].fix.id).toBe('fix2');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to check fix fix1 for project /project1/.storybook:',
        expect.any(Error)
      );
    });
  });
});
