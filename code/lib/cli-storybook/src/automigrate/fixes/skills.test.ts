import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasStorybookSkills, installSkills } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { skills } from './skills.ts';

vi.mock('storybook/internal/cli', { spy: true });

const packageManager = { type: 'npm' } as JsPackageManager;

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

const runSkills = () =>
  runFix(skills, {
    packageManager,
    result: {},
    mainConfig: { stories: [] },
    mainConfigPath: '.storybook/main.ts',
    configDir: '.storybook',
    storybookVersion: '11.0.0',
    storiesPaths: [],
  });

describe('skills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasStorybookSkills).mockResolvedValue(false);
    vi.mocked(installSkills).mockResolvedValue({ result: 'installed', source: 'automigration' });
  });

  describe('check', () => {
    it.each([
      '@storybook/react-vite',
      '@storybook/nextjs',
      '@storybook/vue3-vite',
      '@storybook/angular-vite',
    ])('applies on the upgrade into 11 on %s', async (framework) => {
      await expect(checkFix(skills, checkOptions(framework))).resolves.toEqual({});
    });

    it.each([
      ['a framework without the docgen server', checkOptions('@storybook/svelte-vite')],
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

    it('does not apply when the project has the skills', async () => {
      vi.mocked(hasStorybookSkills).mockResolvedValue(true);

      await expect(checkFix(skills, checkOptions('@storybook/react-vite'))).resolves.toBeNull();
    });

    it('applies on any framework and version when requested by id', async () => {
      await expect(
        checkFix(
          skills,
          checkOptions('@storybook/svelte-vite', { beforeVersion: undefined, requested: true })
        )
      ).resolves.toEqual({});
    });
  });

  describe('run', () => {
    it('installs the skills', async () => {
      await runSkills();

      expect(installSkills).toHaveBeenCalledWith({ packageManager, source: 'automigration' });
    });

    it('installs nothing when another Storybook of the monorepo already installed them', async () => {
      vi.mocked(hasStorybookSkills).mockResolvedValue(true);

      await runSkills();

      expect(installSkills).not.toHaveBeenCalled();
    });

    it('fails when the install fails', async () => {
      vi.mocked(installSkills).mockResolvedValue({ result: 'failed', source: 'automigration' });

      await expect(runSkills()).rejects.toThrow('Could not install the Storybook skills');
    });
  });
});
