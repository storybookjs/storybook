import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType, detect, isStorybookInstantiated } from 'storybook/internal/cli';
import { JsPackageManagerFactory } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { getProcessAncestry } from 'process-ancestry';

import * as addonA11y from './addon-dependencies/addon-a11y';
import * as addonVitest from './addon-dependencies/addon-vitest';
import { generatorRegistry } from './generators/GeneratorRegistry';
import { doInitiate } from './initiate';
import * as scaffoldModule from './scaffold-new-project';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('process-ancestry', { spy: true });
vi.mock('./scaffold-new-project', { spy: true });
vi.mock('./addon-dependencies/addon-a11y', { spy: true });
vi.mock('./addon-dependencies/addon-vitest', { spy: true });
vi.mock('./generators/GeneratorRegistry', { spy: true });

describe('initiate integration tests', () => {
  let mockPackageManager: any;
  let mockGenerator: any;
  let mockTask: any;

  beforeEach(() => {
    mockPackageManager = {
      type: 'npm',
      installDependencies: vi.fn(),
      addDependencies: vi.fn(),
      getVersionedPackages: vi.fn().mockResolvedValue([]),
      latestVersion: vi.fn().mockResolvedValue('8.0.0'),
      getRunCommand: vi.fn().mockReturnValue('npm run storybook'),
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
    };

    mockGenerator = vi.fn().mockResolvedValue({ success: true });

    // Setup default mocks
    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue(mockPackageManager);
    vi.mocked(JsPackageManagerFactory.getPackageManagerType).mockReturnValue('npm');
    vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
    vi.mocked(scaffoldModule.scaffoldNewProject).mockResolvedValue(undefined);
    vi.mocked(detect).mockResolvedValue(ProjectType.REACT);
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
      expect(mockGenerator).toHaveBeenCalled();
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

      const options = { yes: true } as any;

      const result = await doInitiate(options);

      expect(result.shouldRunDev).toBe(false);
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('React Native (RN) Storybook')
      );
    });

    it('should handle React Native and RNW combination', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.REACT_NATIVE_AND_RNW);

      const options = { yes: true } as any;

      const result = await doInitiate(options);

      expect(result.shouldRunDev).toBe(false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('React Native Web (RNW)'));
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
      const projectTypes = [ProjectType.VUE3, ProjectType.ANGULAR, ProjectType.SVELTE];

      for (const projectType of projectTypes) {
        vi.clearAllMocks();
        vi.mocked(detect).mockResolvedValue(projectType);

        const options = { yes: true } as any;
        const result = await doInitiate(options);

        expect(result.projectType).toBe(projectType);
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
      vi.mocked(mockGenerator).mockRejectedValue(error);

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

      vi.mocked(mockGenerator).mockImplementation(async () => {
        executionOrder.push('generator-execution');
        return { success: true };
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
      expect(result.packageManager).toBeDefined();
      expect(result.storybookCommand).toBeDefined();
    });
  });
});
