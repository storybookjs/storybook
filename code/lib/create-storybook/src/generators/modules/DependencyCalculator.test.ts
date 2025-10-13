import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configureEslintPlugin, extractEslintInfo } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { isCI } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { DependencyCalculator } from './DependencyCalculator';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/common', async () => {
  const actual = await vi.importActual('storybook/internal/common');
  return {
    ...actual,
    isCI: vi.fn(),
    getPackageDetails: vi.fn().mockImplementation((pkg: string) => {
      const match = pkg.match(/^(@?[^@]+)(?:@(.+))?$/);
      return match ? [match[1], match[2]] : [pkg, undefined];
    }),
  };
});
vi.mock('storybook/internal/node-logger', { spy: true });

describe('DependencyCalculator', () => {
  let calculator: DependencyCalculator;
  let mockPackageManager: JsPackageManager;

  beforeEach(() => {
    calculator = new DependencyCalculator();
    mockPackageManager = {
      primaryPackageJson: {
        packageJson: {
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
          },
        },
      },
    } as any;

    vi.mocked(isCI).mockReturnValue(false);
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.clearAllMocks();
  });

  describe('filterInstalledPackages', () => {
    it('should filter out installed packages', () => {
      const packages = ['react', 'vue', '@storybook/react'];
      const installed = new Set(['react', '@storybook/react']);

      const result = calculator.filterInstalledPackages(packages, installed);

      expect(result).toEqual(['vue']);
    });

    it('should return all packages when none are installed', () => {
      const packages = ['react', 'vue'];
      const installed = new Set([]);

      const result = calculator.filterInstalledPackages(packages, installed);

      expect(result).toEqual(['react', 'vue']);
    });

    it('should strip versions when checking', () => {
      const packages = ['react@18.0.0', 'vue@3.0.0'];
      const installed = new Set(['react']);

      const result = calculator.filterInstalledPackages(packages, installed);

      expect(result).toEqual(['vue@3.0.0']);
    });
  });

  describe('getInstalledDependencies', () => {
    it('should return all installed dependencies', () => {
      const installed = calculator.getInstalledDependencies(mockPackageManager);

      expect(installed).toContain('react');
      expect(installed).toContain('react-dom');
      expect(installed).toContain('typescript');
      expect(installed.size).toBe(3);
    });

    it('should handle empty package.json', () => {
      mockPackageManager.primaryPackageJson.packageJson = {
        dependencies: {},
        devDependencies: {},
      };

      const installed = calculator.getInstalledDependencies(mockPackageManager);

      expect(installed.size).toBe(0);
    });
  });

  describe('calculatePackagesToInstall', () => {
    it('should filter out already installed packages', () => {
      const packages = ['react@18.0.0', 'vue@3.0.0', 'storybook@8.0.0'];

      const result = calculator.calculatePackagesToInstall(packages, mockPackageManager);

      expect(result).toContain('vue@3.0.0');
      expect(result).toContain('storybook@8.0.0');
      expect(result).not.toContain('react@18.0.0');
    });

    it('should remove duplicate packages', () => {
      const packages = ['storybook@8.0.0', 'vue@3.0.0', 'storybook@8.0.0'];

      const result = calculator.calculatePackagesToInstall(packages, mockPackageManager);

      expect(result.filter((p) => p.startsWith('storybook'))).toHaveLength(1);
    });

    it('should filter falsy values', () => {
      const packages = ['storybook@8.0.0', '', undefined as any, null as any, 'vue@3.0.0'];

      const result = calculator.calculatePackagesToInstall(packages, mockPackageManager);

      expect(result).toEqual(['storybook@8.0.0', 'vue@3.0.0']);
    });
  });

  describe('configureEslintIfNeeded', () => {
    it('should skip in CI environment', async () => {
      vi.mocked(isCI).mockReturnValue(true);
      const packagesToInstall: string[] = [];

      const result = await calculator.configureEslintIfNeeded(mockPackageManager, packagesToInstall);

      expect(result).toBeNull();
      expect(extractEslintInfo).not.toHaveBeenCalled();
    });

    it('should add eslint plugin when eslint is present and plugin not installed', async () => {
      vi.mocked(extractEslintInfo).mockResolvedValue({
        hasEslint: true,
        isStorybookPluginInstalled: false,
        isFlatConfig: false,
        eslintConfigFile: '.eslintrc.js',
      } as any);

      vi.mocked(configureEslintPlugin).mockResolvedValue(undefined);

      const packagesToInstall: string[] = [];

      const result = await calculator.configureEslintIfNeeded(mockPackageManager, packagesToInstall);

      expect(result).toBe('eslint-plugin-storybook');
      expect(packagesToInstall).toContain('eslint-plugin-storybook');
      expect(configureEslintPlugin).toHaveBeenCalledWith({
        eslintConfigFile: '.eslintrc.js',
        packageManager: mockPackageManager,
        isFlatConfig: false,
      });
    });

    it('should not add plugin when eslint is not present', async () => {
      vi.mocked(extractEslintInfo).mockResolvedValue({
        hasEslint: false,
        isStorybookPluginInstalled: false,
        isFlatConfig: false,
        eslintConfigFile: null,
      } as any);

      const packagesToInstall: string[] = [];

      const result = await calculator.configureEslintIfNeeded(mockPackageManager, packagesToInstall);

      expect(result).toBeNull();
      expect(packagesToInstall).not.toContain('eslint-plugin-storybook');
    });

    it('should not add plugin when already installed', async () => {
      vi.mocked(extractEslintInfo).mockResolvedValue({
        hasEslint: true,
        isStorybookPluginInstalled: true,
        isFlatConfig: false,
        eslintConfigFile: '.eslintrc.js',
      } as any);

      const packagesToInstall: string[] = [];

      const result = await calculator.configureEslintIfNeeded(mockPackageManager, packagesToInstall);

      expect(result).toBeNull();
      expect(packagesToInstall).not.toContain('eslint-plugin-storybook');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(extractEslintInfo).mockRejectedValue(new Error('ESLint error'));

      const packagesToInstall: string[] = [];

      const result = await calculator.configureEslintIfNeeded(mockPackageManager, packagesToInstall);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to configure ESLint plugin')
      );
    });
  });

  describe('consolidatePackages', () => {
    it('should include all package types', () => {
      const result = calculator.consolidatePackages(
        ['@storybook/react-vite'],
        ['@storybook/addon-essentials'],
        ['prop-types'],
        true
      );

      expect(result).toEqual([
        'storybook',
        '@storybook/react-vite',
        '@storybook/addon-essentials',
        'prop-types',
      ]);
    });

    it('should exclude framework packages when installFrameworkPackages is false', () => {
      const result = calculator.consolidatePackages(
        ['@storybook/react-vite'],
        ['@storybook/addon-essentials'],
        [],
        false
      );

      expect(result).toEqual(['storybook', '@storybook/addon-essentials']);
      expect(result).not.toContain('@storybook/react-vite');
    });

    it('should filter out falsy values', () => {
      const result = calculator.consolidatePackages(
        ['@storybook/react-vite', ''],
        ['', '@storybook/addon-essentials'],
        [undefined as any, null as any, 'prop-types'],
        true
      );

      expect(result).toEqual([
        'storybook',
        '@storybook/react-vite',
        '@storybook/addon-essentials',
        'prop-types',
      ]);
    });

    it('should always include storybook package', () => {
      const result = calculator.consolidatePackages([], [], [], false);

      expect(result).toContain('storybook');
    });
  });
});

