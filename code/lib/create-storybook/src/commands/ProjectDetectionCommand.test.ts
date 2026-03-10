import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { HandledError, PackageManagerName } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import type { Feature } from 'storybook/internal/types';
import { SupportedLanguage } from 'storybook/internal/types';

import type { CommandOptions } from '../generators/types';
import { ProjectTypeService } from '../services/ProjectTypeService';
import { ProjectDetectionCommand } from './ProjectDetectionCommand';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../services/ProjectTypeService', { spy: true });

describe('ProjectDetectionCommand', () => {
  let command: ProjectDetectionCommand;
  let mockPackageManager: JsPackageManager;
  let mockProjectTypeService: {
    validateProvidedType: ReturnType<typeof vi.fn>;
    autoDetectProjectType: ReturnType<typeof vi.fn>;
    isStorybookInstantiated: ReturnType<typeof vi.fn>;
    detectLanguage: ReturnType<typeof vi.fn>;
  };
  let options: CommandOptions;

  beforeEach(() => {
    mockPackageManager = {
      primaryPackageJson: { packageJson: {} },
    } as unknown as JsPackageManager;

    mockProjectTypeService = {
      validateProvidedType: vi.fn(),
      autoDetectProjectType: vi.fn(),
      isStorybookInstantiated: vi.fn().mockReturnValue(false),
      detectLanguage: vi.fn().mockResolvedValue(SupportedLanguage.JAVASCRIPT),
    };

    vi.mocked(ProjectTypeService).mockImplementation(function () {
      return mockProjectTypeService;
    });

    options = {
      packageManager: PackageManagerName.NPM,
      features: undefined as unknown as Array<Feature>,
    };

    command = new ProjectDetectionCommand(options, mockPackageManager);

    // Mock HandledError constructor
    vi.mocked(HandledError).mockImplementation(
      class MockHandledError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'HandledError';
        }
      } as any
    );

    vi.mocked(logger.step).mockImplementation(() => {});
    vi.mocked(logger.error).mockImplementation(() => {});
    vi.mocked(logger.debug).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should use provided project type when valid', async () => {
      options.type = ProjectType.REACT;
      vi.mocked(mockProjectTypeService.validateProvidedType).mockResolvedValue(ProjectType.REACT);

      const result = await command.execute();

      expect(result.projectType).toBe(ProjectType.REACT);
      expect(mockProjectTypeService.validateProvidedType).toHaveBeenCalledWith(ProjectType.REACT);
      expect(logger.step).toHaveBeenCalledWith(
        'Installing Storybook for user specified project type: react'
      );
      expect(mockProjectTypeService.autoDetectProjectType).not.toHaveBeenCalled();
    });

    it('should auto-detect project type when not provided', async () => {
      options.type = undefined;
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockResolvedValue(ProjectType.VUE3);

      const result = await command.execute();

      expect(result.projectType).toBe(ProjectType.VUE3);
      expect(mockProjectTypeService.autoDetectProjectType).toHaveBeenCalledWith(options);
      expect(logger.debug).toHaveBeenCalledWith('Project type detected: vue3');
    });

    it('should throw error for invalid provided type', async () => {
      options.type = ProjectType.UNSUPPORTED;
      const error = new HandledError('Unknown project type supplied: unsupported');
      vi.mocked(mockProjectTypeService.validateProvidedType).mockImplementation(async () => {
        logger.error(
          `The provided project type ${ProjectType.UNSUPPORTED} was not recognized by Storybook`
        );
        throw error;
      });

      await expect(command.execute()).rejects.toThrow(HandledError);

      expect(logger.error).toHaveBeenCalledWith(
        'The provided project type unsupported was not recognized by Storybook'
      );
    });

    it('should prompt for React Native variant when detected', async () => {
      options.type = undefined;
      options.yes = false;
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockResolvedValue(
        ProjectType.REACT_NATIVE
      );
      vi.mocked(prompt.select).mockResolvedValue(ProjectType.REACT_NATIVE_WEB);

      const result = await command.execute();

      expect(result.projectType).toBe(ProjectType.REACT_NATIVE_WEB);
      expect(prompt.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "We've detected a React Native project. Install:",
        })
      );
    });

    it('should not prompt for React Native variant when yes flag is set', async () => {
      options.type = undefined;
      options.yes = true;
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockResolvedValue(
        ProjectType.REACT_NATIVE
      );

      const result = await command.execute();

      expect(result.projectType).toBe(ProjectType.REACT_NATIVE);
      expect(prompt.select).not.toHaveBeenCalled();
    });

    it('should handle all React Native variants', async () => {
      options.type = undefined;
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockResolvedValue(
        ProjectType.REACT_NATIVE
      );
      vi.mocked(prompt.select).mockResolvedValue(ProjectType.REACT_NATIVE_AND_RNW);

      const result = await command.execute();

      expect(result.projectType).toBe(ProjectType.REACT_NATIVE_AND_RNW);
    });

    it('should check for existing Storybook installation', async () => {
      options.type = undefined;
      options.force = false;
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockResolvedValue(ProjectType.REACT);
      vi.mocked(mockProjectTypeService.isStorybookInstantiated).mockReturnValue(true);
      vi.mocked(prompt.confirm).mockResolvedValue(true);

      await command.execute();

      expect(mockProjectTypeService.isStorybookInstantiated).toHaveBeenCalled();
      expect(prompt.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('already instantiated'),
        })
      );
      expect(options.force).toBe(true);
    });

    it('should exit if user declines to force install', async () => {
      options.type = undefined;
      options.force = false;
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockResolvedValue(ProjectType.REACT);
      vi.mocked(mockProjectTypeService.isStorybookInstantiated).mockReturnValue(true);
      vi.mocked(prompt.confirm).mockResolvedValue(false);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await command.execute();

      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
    });

    it('should not check existing installation for Angular projects', async () => {
      options.type = undefined;
      options.force = false;
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockResolvedValue(
        ProjectType.ANGULAR
      );
      vi.mocked(mockProjectTypeService.isStorybookInstantiated).mockReturnValue(true);

      await command.execute();

      expect(prompt.confirm).not.toHaveBeenCalled();
    });

    it('should handle detection errors', async () => {
      options.type = undefined;
      const error = new Error('Detection failed');
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockImplementation(async () => {
        logger.error(String(error));
        throw new HandledError(error.message);
      });

      await expect(command.execute()).rejects.toThrow(HandledError);

      expect(logger.error).toHaveBeenCalledWith('Error: Detection failed');
    });

    it('should detect language from options or service', async () => {
      options.type = undefined;
      options.language = SupportedLanguage.TYPESCRIPT;
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockResolvedValue(ProjectType.REACT);

      const result = await command.execute();

      expect(result.language).toBe(SupportedLanguage.TYPESCRIPT);
      expect(mockProjectTypeService.detectLanguage).not.toHaveBeenCalled();
    });

    it('should use service to detect language when not provided', async () => {
      options.type = undefined;
      options.language = undefined;
      vi.mocked(mockProjectTypeService.autoDetectProjectType).mockResolvedValue(ProjectType.REACT);
      vi.mocked(mockProjectTypeService.detectLanguage).mockResolvedValue(
        SupportedLanguage.TYPESCRIPT
      );

      const result = await command.execute();

      expect(result.language).toBe(SupportedLanguage.TYPESCRIPT);
      expect(mockProjectTypeService.detectLanguage).toHaveBeenCalled();
    });
  });
});
