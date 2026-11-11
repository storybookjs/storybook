import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasStorybookSkills, installSkills } from 'storybook/internal/cli';
import { type JsPackageManager, isCI } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { applyFixes } from '../pipeline.ts';
import { angularToAngularVite } from './angular-to-angular-vite.ts';
import { allFixes } from './index.ts';
import { skills } from './skills.ts';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const packageManager = {
  type: 'npm',
  getAllDependencies: vi.fn(),
  getDeclaredVersionSpecifier: vi.fn(),
} as Partial<JsPackageManager> as JsPackageManager;

const useDependencies = (dependencies: Record<string, string>) => {
  vi.mocked(packageManager.getAllDependencies).mockReturnValue(dependencies);
  vi.mocked(packageManager.getDeclaredVersionSpecifier).mockImplementation(
    async (name) => dependencies[name] ?? null
  );
};

const angular21 = { '@storybook/angular': '10.3.0', '@angular/core': '^21.0.0' };

const checkOptions = (
  framework: string,
  overrides: { beforeVersion?: string; storybookVersion?: string; requested?: boolean } = {}
) => ({
  packageManager,
  mainConfig: { stories: [], framework } as StorybookConfigRaw,
  beforeVersion: '10.3.0',
  storybookVersion: '11.0.0',
  configDir: '.storybook',
  storiesPaths: [],
  ...overrides,
});

const runOptions = {
  packageManager,
  mainConfig: { stories: [] },
  mainConfigPath: '.storybook/main.ts',
  configDir: '.storybook',
  storybookVersion: '11.0.0',
  storiesPaths: [],
};

const runSkills = (result: { afterAngularViteMigration?: boolean } = {}) =>
  runFix(skills, { ...runOptions, result });

describe('skills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isCI).mockReturnValue(false);
    vi.mocked(hasStorybookSkills).mockResolvedValue(false);
    vi.mocked(installSkills).mockResolvedValue({ result: 'installed', source: 'automigration' });
    useDependencies({});
    vi.mocked(logger.warn).mockImplementation(() => {});
  });

  describe('check', () => {
    it.each(['@storybook/react-vite', '@storybook/sveltekit'])(
      'applies on the upgrade into 11 on %s',
      async (framework) => {
        await expect(checkFix(skills, checkOptions(framework))).resolves.toEqual({});
      }
    );

    it.each([
      ['an unsupported framework', checkOptions('@storybook/html-vite')],
      ['Nuxt', checkOptions('@storybook-vue/nuxt')],
      ['an upgrade within 11', checkOptions('@storybook/react-vite', { beforeVersion: '11.0.0' })],
      [
        'a prerelease of 11',
        checkOptions('@storybook/react-vite', { beforeVersion: '11.0.0-alpha.1' }),
      ],
      [
        'a run outside an upgrade',
        checkOptions('@storybook/react-vite', { beforeVersion: undefined }),
      ],
    ])('does not apply on %s', async (_, options) => {
      await expect(checkFix(skills, options)).resolves.toBeNull();
    });

    it('applies on Angular when the upgrade can migrate it to angular-vite', async () => {
      useDependencies(angular21);

      await expect(checkFix(skills, checkOptions('@storybook/angular'))).resolves.toEqual({
        afterAngularViteMigration: true,
      });
    });

    it('does not apply on Angular that the upgrade cannot migrate to angular-vite', async () => {
      useDependencies({ ...angular21, '@angular/core': '^20.0.0' });

      await expect(checkFix(skills, checkOptions('@storybook/angular'))).resolves.toBeNull();
    });

    it('does not apply on Angular when requested by id, without the migration', async () => {
      useDependencies(angular21);

      await expect(
        checkFix(skills, checkOptions('@storybook/angular', { requested: true }))
      ).resolves.toBeNull();
    });

    it('does not apply in CI, where the skills are never installed', async () => {
      vi.mocked(isCI).mockReturnValue(true);

      await expect(checkFix(skills, checkOptions('@storybook/react-vite'))).resolves.toBeNull();
    });

    it('does not apply when the project has the skills', async () => {
      vi.mocked(hasStorybookSkills).mockResolvedValue(true);

      await expect(checkFix(skills, checkOptions('@storybook/react-vite'))).resolves.toBeNull();
    });

    it('applies on any version when requested by id', async () => {
      await expect(
        checkFix(
          skills,
          checkOptions('@storybook/react-vite', { beforeVersion: undefined, requested: true })
        )
      ).resolves.toEqual({});
    });

    it('does not apply on an unsupported framework, even when requested by id', async () => {
      await expect(
        checkFix(skills, checkOptions('@storybook/html-vite', { requested: true }))
      ).resolves.toBeNull();
    });
  });

  describe('run', () => {
    it('installs the skills', async () => {
      await runSkills();

      expect(installSkills).toHaveBeenCalledWith({
        packageManager,
        source: 'automigration',
        stdio: 'pipe',
      });
    });

    it('installs nothing when another Storybook of the monorepo already installed them', async () => {
      vi.mocked(hasStorybookSkills).mockResolvedValue(true);

      await runSkills();

      expect(installSkills).not.toHaveBeenCalled();
    });

    it('installs the skills on Angular after the angular-vite migration ran', async () => {
      useDependencies({ ...angular21, '@storybook/angular-vite': '11.0.0' });

      await runSkills({ afterAngularViteMigration: true });

      expect(installSkills).toHaveBeenCalled();
    });

    it('installs nothing on Angular when the angular-vite migration was not selected', async () => {
      useDependencies(angular21);

      await runSkills({ afterAngularViteMigration: true });

      expect(installSkills).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('npx storybook automigrate angular-to-angular-vite')
      );
    });

    it('does not warn on Angular when another Storybook of the monorepo installed the skills', async () => {
      useDependencies(angular21);
      vi.mocked(hasStorybookSkills).mockResolvedValue(true);

      await runSkills({ afterAngularViteMigration: true });

      expect(installSkills).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('runs after the angular-vite migration, which it relies on', () => {
      expect(allFixes.indexOf(angularToAngularVite)).toBeLessThan(allFixes.indexOf(skills));
    });

    it('is skipped, not failed, when the install fails', async () => {
      vi.mocked(installSkills).mockResolvedValue({ result: 'failed', source: 'automigration' });

      const outcomes = await applyFixes(runOptions, [{ fix: skills, result: {} }]);

      expect(outcomes.get('skills')).toEqual({ status: 'skipped' });
    });
  });
});
