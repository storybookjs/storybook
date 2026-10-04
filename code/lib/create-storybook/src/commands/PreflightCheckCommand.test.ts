import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  JsPackageManagerFactory,
  PackageManagerName,
  resolveStorybookVersionSpecifier,
  invalidateProjectRootCache,
} from 'storybook/internal/common';
import { logger, once } from 'storybook/internal/node-logger';
import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import * as scaffoldModule from '../scaffold-new-project.ts';
import { PreflightCheckCommand } from './PreflightCheckCommand.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('../scaffold-new-project', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

describe('PreflightCheckCommand', () => {
  let command: PreflightCheckCommand;
  let mockPackageManager: any;
  let mockVersionService: any;
  const originalIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

  beforeEach(() => {
    mockPackageManager = {
      installDependencies: vi.fn(),
      precheckStorybookPackageInstall: vi.fn().mockResolvedValue(undefined),
      latestVersion: vi.fn().mockResolvedValue('8.0.0'),
      type: PackageManagerName.NPM,
      primaryPackageJson: { packageJson: { name: 'my-app' } },
    };

    mockVersionService = {
      getVersionInfo: vi.fn().mockResolvedValue({
        currentVersion: '8.0.0',
        latestVersion: '8.0.0',
        isPrerelease: false,
        isOutdated: false,
      }),
      getCurrentVersion: vi.fn().mockReturnValue('8.0.0'),
    };
    command = new PreflightCheckCommand(mockVersionService);

    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue(mockPackageManager);
    vi.mocked(JsPackageManagerFactory.getPackageManagerType).mockReturnValue(
      PackageManagerName.NPM
    );
    vi.mocked(scaffoldModule.scaffoldNewProject).mockResolvedValue(undefined);
    vi.mocked(invalidateProjectRootCache).mockImplementation(() => {});
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
    });
    vi.clearAllMocks();
    once.clear();
    vi.mocked(resolveStorybookVersionSpecifier).mockReturnValue(undefined);
  });

  afterAll(() => {
    if (originalIsTTYDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', originalIsTTYDescriptor);
    }
  });

  describe('execute', () => {
    it('should return package manager for non-empty directory', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);

      const result = await command.execute({ force: false } as any);

      expect(result.packageManager).toBe(mockPackageManager);
      expect(result.isEmptyProject).toBe(false);
      expect(scaffoldModule.scaffoldNewProject).not.toHaveBeenCalled();
      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });

    it('should scaffold new project when directory is empty', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);

      const result = await command.execute({ force: false, skipInstall: true } as any);

      expect(scaffoldModule.scaffoldNewProject).toHaveBeenCalledWith('npm', expect.any(Object));
      expect(invalidateProjectRootCache).toHaveBeenCalled();
      expect(result.isEmptyProject).toBe(true);
    });

    it('should install dependencies for empty project when not skipping install', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);

      await command.execute({ force: false, skipInstall: false } as any);

      expect(mockPackageManager.installDependencies).toHaveBeenCalled();
    });

    it('should not install dependencies when skipInstall is true', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);

      await command.execute({ force: false, skipInstall: true } as any);

      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });

    it('should use npm instead of yarn1 for empty directory', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);
      vi.mocked(JsPackageManagerFactory.getPackageManagerType).mockReturnValue(
        PackageManagerName.YARN1
      );

      await command.execute({ force: false, skipInstall: true } as any);

      expect(scaffoldModule.scaffoldNewProject).toHaveBeenCalledWith('npm', expect.any(Object));

      // Exactly one Yarn 1 warning total: the npm-fallback notice. The best-effort warning must
      // not fire on this path because the manager was forced to npm.
      const warnMessages = vi.mocked(logger.warn).mock.calls.map(([message]) => String(message));
      const yarn1Warnings = warnMessages.filter((message) => /yarn/i.test(message));

      expect(yarn1Warnings).toHaveLength(1);
      expect(yarn1Warnings[0]).toContain('Falling back to npm');
      expect(warnMessages.some((message) => message.includes('best-effort'))).toBe(false);
    });

    it('warns on a best-effort basis for Yarn 1 and continues init', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.type = PackageManagerName.YARN1;

      const result = await command.execute({ force: false } as any);

      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('Yarn Classic (v1) is supported on a best-effort basis')
      );
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('https://storybook.js.org/docs/get-started/install')
      );
      // Init continues past the preflight instead of blocking.
      expect(result.packageManager).toBe(mockPackageManager);
      expect(mockPackageManager.precheckStorybookPackageInstall).toHaveBeenCalled();
    });

    it.each([
      PackageManagerName.NPM,
      PackageManagerName.YARN2,
      PackageManagerName.PNPM,
      PackageManagerName.BUN,
    ])('does not emit the best-effort warning for %s', async (packageManagerType) => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.type = packageManagerType;

      await command.execute({ force: false } as any);

      expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    });

    it('should skip scaffolding when force is true', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);

      const result = await command.execute({ force: true } as any);

      expect(scaffoldModule.scaffoldNewProject).not.toHaveBeenCalled();
      expect(result.isEmptyProject).toBe(false);
    });

    it('should use provided package manager', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);

      await command.execute({ packageManager: 'yarn' as PackageManagerName });

      expect(JsPackageManagerFactory.getPackageManager).toHaveBeenCalledWith({
        force: 'yarn',
      });
    });

    it('should log the detected package manager', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.type = PackageManagerName.YARN2;

      await command.execute({ force: false } as any);

      expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Package manager: Yarn Berry');
    });

    it('should warn when package.json name is "storybook"', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.primaryPackageJson = { packageJson: { name: 'storybook' } };

      await command.execute({ force: false } as any);

      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('Your package.json "name" field is set to "storybook"')
      );
    });

    it('should not warn when package.json name is not "storybook"', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.primaryPackageJson = { packageJson: { name: 'my-project' } };

      await command.execute({ force: false } as any);

      expect(vi.mocked(logger.warn)).not.toHaveBeenCalledWith(
        expect.stringContaining('Your package.json "name" field is set to "storybook"')
      );
    });

    it('should keep an explicit storybookVersionSpecifier instead of overwriting it from ancestry', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      const specifier = 'https://pkg.pr.new/storybookjs/storybook/storybook@abc123';
      const options = { force: false, storybookVersionSpecifier: specifier };

      await command.execute(options as any);

      expect(options.storybookVersionSpecifier).toBe(specifier);
      expect(resolveStorybookVersionSpecifier).not.toHaveBeenCalled();
    });

    it('should fill storybookVersionSpecifier from process ancestry when it is unset', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      vi.mocked(resolveStorybookVersionSpecifier).mockReturnValue('10.6.0-alpha.7');
      const options = { force: false } as any;

      await command.execute(options);

      expect(resolveStorybookVersionSpecifier).toHaveBeenCalled();
      expect(options.storybookVersionSpecifier).toBe('10.6.0-alpha.7');
    });

    it('should call the package manager Storybook install precheck', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockVersionService.getCurrentVersion.mockReturnValue('10.4.0-alpha.17');

      await command.execute({ force: false, yes: true } as any);

      expect(mockPackageManager.precheckStorybookPackageInstall).toHaveBeenCalledWith({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: true,
        installContext: 'create',
      });
    });

    it('should ignore unexpected precheck failures', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.precheckStorybookPackageInstall.mockRejectedValueOnce(
        new Error('registry timeout')
      );

      await expect(command.execute({ force: false, yes: true } as any)).resolves.toEqual({
        packageManager: mockPackageManager,
        isEmptyProject: false,
      });

      expect(vi.mocked(logger.debug)).toHaveBeenCalledWith(
        expect.stringContaining('Skipping minimum-release-age precheck after an unexpected failure')
      );
    });

    it('should rethrow handled minimum-release-age precheck failures', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.precheckStorybookPackageInstall.mockRejectedValueOnce(
        new MinimumReleaseAgeHandledError({ message: 'blocked by minimum release age' })
      );

      await expect(command.execute({ force: false, yes: true } as any)).rejects.toThrow(
        'blocked by minimum release age'
      );
    });
  });
});
