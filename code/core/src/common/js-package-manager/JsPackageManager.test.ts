import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, prompt } from 'storybook/internal/node-logger';

import { JsPackageManager } from './JsPackageManager.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

const mockVersions = vi.hoisted(() => ({
  '@storybook/react': '8.3.0',
}));

vi.mock('../versions', () => ({
  default: mockVersions,
}));

describe('JsPackageManager', () => {
  let jsPackageManager: JsPackageManager;
  let mockLatestVersion: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // @ts-expect-error Ignore abstract class error
    jsPackageManager = new JsPackageManager();
    mockLatestVersion = vi.spyOn(jsPackageManager, 'latestVersion');

    vi.clearAllMocks();
  });

  describe('getVersionedPackages method', () => {
    it('should return the latest stable release version when current version is the latest stable release', async () => {
      mockLatestVersion.mockResolvedValue('8.3.0');

      const result = await jsPackageManager.getVersionedPackages(['@storybook/react']);

      expect(result).toEqual(['@storybook/react@^8.3.0']);
    });

    it('should return the current version when it is not the latest stable release', async () => {
      mockLatestVersion.mockResolvedValue('8.3.1');

      const result = await jsPackageManager.getVersionedPackages(['@storybook/react']);

      expect(result).toEqual(['@storybook/react@8.3.0']);
    });

    it('should get the requested version when the package is not in the monorepo', async () => {
      mockLatestVersion.mockResolvedValue('2.0.0');

      const result = await jsPackageManager.getVersionedPackages(['@storybook/new-addon@^next']);

      expect(result).toEqual(['@storybook/new-addon@^next']);
    });

    it('should map pkg.pr.new create-storybook specifiers to Storybook packages', async () => {
      const result = await jsPackageManager.getVersionedPackages(['@storybook/react'], {
        storybookVersionSpecifier: 'https://pkg.pr.new/create-storybook@abc123',
      });

      expect(result).toEqual(['@storybook/react@https://pkg.pr.new/@storybook/react@abc123']);
      expect(mockLatestVersion).not.toHaveBeenCalled();
    });

    it('should map repo-scoped pkg.pr.new specifiers to Storybook packages', async () => {
      const result = await jsPackageManager.getVersionedPackages(['@storybook/react'], {
        storybookVersionSpecifier: 'https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef',
      });

      expect(result).toEqual([
        '@storybook/react@https://pkg.pr.new/storybookjs/storybook/@storybook/react@deadbeef',
      ]);
      expect(mockLatestVersion).not.toHaveBeenCalled();
    });

    it('should keep npm tags and prereleases on the CLI version path', async () => {
      mockLatestVersion.mockResolvedValue('8.3.1');

      await expect(
        jsPackageManager.getVersionedPackages(['@storybook/react'], {
          storybookVersionSpecifier: 'next',
        })
      ).resolves.toEqual(['@storybook/react@8.3.0']);
      await expect(
        jsPackageManager.getVersionedPackages(['@storybook/react'], {
          storybookVersionSpecifier: '10.6.0-alpha.7',
        })
      ).resolves.toEqual(['@storybook/react@8.3.0']);
    });

    it('should return the package name as is if it is not a Storybook package', async () => {
      const result = await jsPackageManager.getVersionedPackages(['some-other-package']);

      expect(result).toEqual(['some-other-package']);
    });
  });

  describe('installDependencies method', () => {
    it('propagates a truncated npm stderr tail into the thrown error', async () => {
      const stderr = [
        'npm error code ERESOLVE',
        ...Array.from({ length: 30 }, (_, i) => `npm error while resolving line ${i}`),
        'npm error Could not resolve dependency: vitest@5.0.0',
      ].join('\n');
      vi.mocked(prompt.executeTaskWithSpinner).mockRejectedValue(
        Object.assign(new Error('Command failed: npm install'), { stderr })
      );

      const error = await jsPackageManager.installDependencies().then(
        () => null,
        (e) => e
      );

      // The tail (last 15 lines) is folded into the error message...
      expect(error.message).toContain('Could not resolve dependency: vitest@5.0.0');
      // ...truncated: the head of a long stderr does not leak into the message...
      expect(error.message).not.toContain('npm error code ERESOLVE');
      // ...and is printed so failures behind the spinner name themselves.
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(expect.stringContaining('vitest@5.0.0'));
    });

    it('logs and folds a short stderr tail into the thrown error', async () => {
      const stderr = [
        'npm error code ERESOLVE',
        'npm error Could not resolve dependency: vitest@5.0.0',
      ].join('\n');
      vi.mocked(prompt.executeTaskWithSpinner).mockRejectedValue(
        Object.assign(new Error('Command failed: npm install'), { stderr })
      );

      const error = await jsPackageManager.installDependencies().then(
        () => null,
        (e) => e
      );

      // Short outputs are surfaced too — not silently dropped because they fit the tail window.
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(expect.stringContaining('ERESOLVE'));
      expect(error.message).toContain('Could not resolve dependency: vitest@5.0.0');
    });

    it('does not duplicate the tail when the error message already contains it', async () => {
      // A plain Error with no structured stderr: getErrorLogs falls back to the message itself,
      // so the tail equals the message and appending would duplicate it.
      const message =
        'Command failed: npm install\nnpm error code ERESOLVE\nnpm error Could not resolve dependency: vitest@5.0.0';
      vi.mocked(prompt.executeTaskWithSpinner).mockRejectedValue(new Error(message));

      const error = await jsPackageManager.installDependencies().then(
        () => null,
        (e) => e
      );

      // The tail is still printed, but not appended a second time.
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(expect.stringContaining('ERESOLVE'));
      expect(error.message).toBe(message);
    });

    it('resolves and clears the installed version cache on success', async () => {
      const clearSpy = vi.spyOn(jsPackageManager, 'clearInstalledVersionCache');
      vi.mocked(prompt.executeTaskWithSpinner).mockResolvedValue(undefined);

      await expect(jsPackageManager.installDependencies()).resolves.toBeUndefined();
      expect(clearSpy).toHaveBeenCalled();
    });
  });
});
