import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType, detect, isStorybookInstantiated } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { HandledError } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { ProjectDetectionCommand } from './ProjectDetectionCommand';

vi.mock('storybook/internal/cli', async () => {
  const actual = await vi.importActual('storybook/internal/cli');
  return {
    ...actual,
    detect: vi.fn(),
    isStorybookInstantiated: vi.fn(),
  };
});

vi.mock('storybook/internal/common', async () => {
  const actual = await vi.importActual('storybook/internal/common');
  return {
    ...actual,
    HandledError: class HandledError extends Error {},
  };
});

vi.mock('storybook/internal/node-logger', { spy: true });

describe('ProjectDetectionCommand', () => {
  let command: ProjectDetectionCommand;
  let mockPackageManager: JsPackageManager;

  beforeEach(() => {
    command = new ProjectDetectionCommand();
    mockPackageManager = {} as any;

    vi.mocked(isStorybookInstantiated).mockReturnValue(false);
    vi.mocked(logger.step).mockImplementation(() => {});
    vi.mocked(logger.error).mockImplementation(() => {});

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should use provided project type when valid', async () => {
      const options = { type: 'react' } as any;

      const result = await command.execute(mockPackageManager, options);

      expect(result).toBe(ProjectType.REACT);
      expect(logger.step).toHaveBeenCalledWith(
        'Installing Storybook for user specified project type: react'
      );
      expect(detect).not.toHaveBeenCalled();
    });

    it('should auto-detect project type when not provided', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.VUE3);
      const options = {} as any;

      const result = await command.execute(mockPackageManager, options);

      expect(result).toBe(ProjectType.VUE3);
      expect(detect).toHaveBeenCalledWith(mockPackageManager, options);
      expect(logger.debug).toHaveBeenCalledWith('Project type detected: VUE3');
    });

    it('should throw error for invalid provided type', async () => {
      const options = { type: 'invalid-framework' } as any;

      await expect(command.execute(mockPackageManager, options)).rejects.toThrow(HandledError);

      expect(logger.error).toHaveBeenCalledWith(
        'The provided project type invalid-framework was not recognized by Storybook'
      );
    });

    it('should prompt for React Native variant when detected', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.REACT_NATIVE);
      vi.mocked(prompt.select).mockResolvedValue(ProjectType.REACT_NATIVE_WEB);
      const options = { yes: false } as any;

      const result = await command.execute(mockPackageManager, options);

      expect(result).toBe(ProjectType.REACT_NATIVE_WEB);
      expect(prompt.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "We've detected a React Native project. Install:",
        })
      );
    });

    it('should not prompt for React Native variant when yes flag is set', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.REACT_NATIVE);
      const options = { yes: true } as any;

      const result = await command.execute(mockPackageManager, options);

      expect(result).toBe(ProjectType.REACT_NATIVE);
      expect(prompt.select).not.toHaveBeenCalled();
    });

    it('should handle all React Native variants', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.REACT_NATIVE);
      vi.mocked(prompt.select).mockResolvedValue(ProjectType.REACT_NATIVE_AND_RNW);
      const options = {} as any;

      const result = await command.execute(mockPackageManager, options);

      expect(result).toBe(ProjectType.REACT_NATIVE_AND_RNW);
    });

    it('should check for existing Storybook installation', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.REACT);
      vi.mocked(isStorybookInstantiated).mockReturnValue(true);
      vi.mocked(prompt.confirm).mockResolvedValue(true);
      const options = { force: false } as any;

      await command.execute(mockPackageManager, options);

      expect(isStorybookInstantiated).toHaveBeenCalled();
      expect(prompt.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('already instantiated'),
        })
      );
      expect(options.force).toBe(true);
    });

    it('should exit if user declines to force install', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.REACT);
      vi.mocked(isStorybookInstantiated).mockReturnValue(true);
      vi.mocked(prompt.confirm).mockResolvedValue(false);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const options = { force: false } as any;

      await command.execute(mockPackageManager, options);

      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
    });

    it('should not check existing installation for Angular projects', async () => {
      vi.mocked(detect).mockResolvedValue(ProjectType.ANGULAR);
      vi.mocked(isStorybookInstantiated).mockReturnValue(true);
      const options = { force: false } as any;

      await command.execute(mockPackageManager, options);

      expect(prompt.confirm).not.toHaveBeenCalled();
    });

    it('should handle detection errors', async () => {
      const error = new Error('Detection failed');
      vi.mocked(detect).mockRejectedValue(error);
      const options = {} as any;

      await expect(command.execute(mockPackageManager, options)).rejects.toThrow(HandledError);

      expect(logger.error).toHaveBeenCalledWith('Error: Detection failed');
    });
  });
});
