import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ProjectType,
  detect,
  detectBuilder,
  isStorybookInstantiated,
} from 'storybook/internal/cli';
import { JsPackageManagerFactory, loadMainConfig } from 'storybook/internal/common';
import { readConfig } from 'storybook/internal/csf-tools';
import { logTracker, logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';
import { Feature, SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

import { getProcessAncestry } from 'process-ancestry';

import * as addonA11y from './addon-dependencies/addon-a11y';
import * as addonVitest from './addon-dependencies/addon-vitest';
import * as commands from './commands';
import { generatorRegistry } from './generators/GeneratorRegistry';
import { baseGenerator } from './generators/baseGenerator';
import type { GeneratorModule } from './generators/types';
import { doInitiate } from './initiate';
import * as scaffoldModule from './scaffold-new-project';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('storybook/internal/csf-tools', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('process-ancestry', { spy: true });
vi.mock('./scaffold-new-project', { spy: true });
vi.mock('./addon-dependencies/addon-a11y', { spy: true });
vi.mock('./addon-dependencies/addon-vitest', { spy: true });
vi.mock('./generators/GeneratorRegistry', { spy: true });
vi.mock('./generators/baseGenerator', { spy: true });
vi.mock('./generators/configure', () => ({
  configureMain: vi.fn().mockResolvedValue({ mainPath: './.storybook/main.ts' }),
  configurePreview: vi.fn().mockResolvedValue({ previewConfigPath: './.storybook/preview.ts' }),
}));
vi.mock('./commands', { spy: true });
vi.mock('empathic/find', () => ({
  up: vi.fn(),
}));

describe('initiate integration tests', () => {
  let mockPackageManager: any;
  let mockGenerator: GeneratorModule;
  let mockTask: any;

  beforeEach(() => {
    mockPackageManager = {
      type: 'npm',
      installDependencies: vi.fn(),
      addDependencies: vi.fn(),
      getVersionedPackages: vi.fn().mockResolvedValue([]),
      latestVersion: vi.fn().mockResolvedValue('8.0.0'),
      getRunCommand: vi.fn().mockReturnValue('npm run storybook'),
      getAllDependencies: vi.fn().mockReturnValue({}),
      isStorybookInMonorepo: vi.fn().mockReturnValue(false),
      addStorybookCommandInScripts: vi.fn(),
      primaryPackageJson: {
        packageJson: {
          dependencies: {},
          devDependencies: {},
        },
      },
    };

    mockTask = {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
    };

    mockGenerator = {
      metadata: {
        projectType: ProjectType.REACT,
        renderer: SupportedRenderer.REACT,
      },
      configure: vi.fn().mockResolvedValue({
        extraPackages: [],
        addScripts: true,
        addComponents: false, // Skip file copying in tests
      }),
    };

    // Setup default mocks
    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue(mockPackageManager);
    vi.mocked(JsPackageManagerFactory.getPackageManagerType).mockReturnValue('npm');
    vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
    vi.mocked(scaffoldModule.scaffoldNewProject).mockResolvedValue(undefined);
    vi.mocked(detect).mockResolvedValue(ProjectType.REACT);
    vi.mocked(detectBuilder).mockResolvedValue(SupportedBuilder.VITE);
    vi.mocked(isStorybookInstantiated).mockReturnValue(false);
    vi.mocked(prompt.taskLog).mockReturnValue(mockTask);
    vi.mocked(prompt.select).mockResolvedValue(true);
    vi.mocked(prompt.confirm).mockResolvedValue(true);
    vi.mocked(logger.intro).mockImplementation(() => {});
    vi.mocked(logger.info).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.step).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(logger.outro).mockImplementation(() => {});
    vi.mocked(getProcessAncestry).mockReturnValue([]);
    vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
    vi.mocked(addonVitest.getAddonVitestDependencies).mockResolvedValue([]);
    vi.mocked(addonA11y.getAddonA11yDependencies).mockReturnValue([]);
    vi.mocked(logTracker.writeToFile).mockResolvedValue('/tmp/storybook.log');
    vi.mocked(ErrorCollector.getErrors).mockReturnValue([]);
    vi.mocked(commands.executeUserPreferences).mockResolvedValue({
      newUser: true,
      installType: 'recommended' as const,
      selectedFeatures: new Set([Feature.TEST]),
    });
    vi.mocked(loadMainConfig).mockResolvedValue({
      stories: [],
      addons: [],
      framework: { name: '@storybook/react-vite' },
    } as any);
    vi.mocked(readConfig).mockResolvedValue({
      parse: () => ({}),
      _exportsObject: {},
    } as any);
    vi.mocked(baseGenerator).mockResolvedValue({
      frameworkPackage: '@storybook/react-vite',
      rendererPackage: '@storybook/react',
      builderPackage: '@storybook/builder-vite',
      configDir: '.storybook',
      mainConfig: {
        stories: [],
        addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
        framework: { name: '@storybook/react-vite' },
      },
      mainConfigCSFFile: {
        parse: () => ({}),
        _exportsObject: {},
      } as any,
      previewConfigPath: './.storybook/preview.ts',
      storybookCommand: 'npm run storybook',
      shouldRunDev: true,
    } as any);

    vi.clearAllMocks();
  });

  describe('doInitiate', () => {
    it('should complete full init workflow for new user', async () => {
      const options = {
        yes: true,
        dev: false,
        skipInstall: false,
      } as any;

      const result = await doInitiate(options);

      expect(result).toMatchObject({
        shouldRunDev: false,
        shouldOnboard: true,
        projectType: ProjectType.REACT,
      });

      // Verify all commands were executed
      expect(detect).toHaveBeenCalled();
      expect(generatorRegistry.get).toHaveBeenCalledWith(ProjectType.REACT);
      expect(mockGenerator.configure).toHaveBeenCalled();
    });

    it('should handle empty directory scaffolding', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);

      const options = { yes: true, skipInstall: true } as any;

      await doInitiate(options);

      expect(scaffoldModule.scaffoldNewProject).toHaveBeenCalled();
    });

    it('should collect addon dependencies for test feature', async () => {
      vi.mocked(addonVitest.getAddonVitestDependencies).mockResolvedValue(['vitest']);

      const options = { yes: true } as any;

      await doInitiate(options);

      expect(addonVitest.getAddonVitestDependencies).toHaveBeenCalled();
      expect(addonA11y.getAddonA11yDependencies).toHaveBeenCalled();
    });

    it('should handle React Native projects', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.REACT_NATIVE);

      const rnGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.REACT_NATIVE,
          renderer: SupportedRenderer.REACT,
        },
        configure: vi.fn().mockResolvedValue({
          extraPackages: [],
          addScripts: true,
          addComponents: false,
          skipGenerator: true,
          shouldRunDev: false,
        }),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(rnGenerator);

      const options = { yes: true } as any;

      const result = await doInitiate(options);

      expect(result.shouldRunDev).toBe(false);
      expect(generatorRegistry.get).toHaveBeenCalledWith(ProjectType.REACT_NATIVE);
    });

    it('should handle React Native and RNW combination', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.REACT_NATIVE_AND_RNW);

      const rnwGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.REACT_NATIVE_AND_RNW,
          renderer: SupportedRenderer.REACT,
        },
        configure: vi.fn().mockResolvedValue({
          extraPackages: [],
          addScripts: true,
          addComponents: false, // Avoid import.meta.resolve in tests
        }),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(rnwGenerator);

      const options = { yes: true } as any;

      const result = await doInitiate(options);

      expect(result.shouldRunDev).toBe(false);
      expect(generatorRegistry.get).toHaveBeenCalledWith(ProjectType.REACT_NATIVE_AND_RNW);
    });

    it('should set shouldRunDev when dev flag is set', async () => {
      const options = { yes: true, dev: true, skipInstall: false } as any;

      const result = await doInitiate(options);

      expect(result.shouldRunDev).toBe(true);
    });

    it('should not run dev when skipInstall is true', async () => {
      const options = { yes: true, dev: true, skipInstall: true } as any;

      const result = await doInitiate(options);

      expect(result.shouldRunDev).toBe(false);
    });

    it('should handle different project types', async () => {
      const projectTypes = [
        { type: ProjectType.VUE3, renderer: SupportedRenderer.VUE3 },
        { type: ProjectType.ANGULAR, renderer: SupportedRenderer.ANGULAR },
        { type: ProjectType.SVELTE, renderer: SupportedRenderer.SVELTE },
      ];

      for (const { type: projectType, renderer } of projectTypes) {
        vi.clearAllMocks();
        vi.mocked(detect).mockResolvedValue(projectType);

        const generator: GeneratorModule = {
          metadata: {
            projectType,
            renderer,
          },
          configure: vi.fn().mockResolvedValue({
            extraPackages: [],
            addScripts: true,
            addComponents: false, // Avoid import.meta.resolve in tests
          }),
        };

        vi.mocked(generatorRegistry.get).mockReturnValue(generator);

        const options = { yes: true } as any;
        const result = await doInitiate(options);

        if ('projectType' in result) {
          expect(result.projectType).toBe(projectType);
        }
        expect(generatorRegistry.get).toHaveBeenCalledWith(projectType);
      }
    });

    it('should track telemetry with version info', async () => {
      vi.mocked(getProcessAncestry).mockReturnValue([
        { command: 'npx storybook@8.0.5 init' },
      ] as any);

      const options = { yes: true, disableTelemetry: false } as any;

      await doInitiate(options);

      // Telemetry is tracked by TelemetryService internally
      expect(getProcessAncestry).toHaveBeenCalled();
    });

    it('should handle generator execution errors', async () => {
      const error = new Error('Generator failed');
      vi.mocked(mockGenerator.configure).mockRejectedValue(error);

      const options = { yes: true } as any;

      await expect(doInitiate(options)).rejects.toThrow();
    });
  });

  describe('workflow integration', () => {
    it('should execute commands in correct order', async () => {
      const executionOrder: string[] = [];

      // Track execution order
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockImplementation(() => {
        executionOrder.push('preflight-check');
        return false;
      });

      vi.mocked(detect).mockImplementation(async () => {
        executionOrder.push('project-detection');
        return ProjectType.REACT;
      });

      vi.mocked(mockGenerator.configure).mockImplementation(async () => {
        executionOrder.push('generator-execution');
        return {
          extraPackages: [],
          addScripts: true,
          addComponents: false, // Avoid import.meta.resolve in tests
        };
      });

      const options = { yes: true } as any;

      await doInitiate(options);

      // In yes mode, user-preferences is handled without prompts
      expect(executionOrder).toContain('preflight-check');
      expect(executionOrder).toContain('project-detection');
      expect(executionOrder).toContain('generator-execution');

      // Verify correct order (preflight before detection before execution)
      expect(executionOrder.indexOf('preflight-check')).toBeLessThan(
        executionOrder.indexOf('project-detection')
      );
      expect(executionOrder.indexOf('project-detection')).toBeLessThan(
        executionOrder.indexOf('generator-execution')
      );
    });

    it('should pass data correctly between commands', async () => {
      const options = { yes: true } as any;

      const result = await doInitiate(options);

      // Verify packageManager is passed through commands
      if ('packageManager' in result) {
        expect(result.packageManager).toBeDefined();
        expect(result.storybookCommand).toBeDefined();
      }
    });
  });
});
