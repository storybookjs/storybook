import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { HandledError, PackageManagerName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedFramework } from 'storybook/internal/types';

import reactGenerator from '../generators/REACT/index.ts';
import { generatorRegistry } from '../generators/GeneratorRegistry.ts';
import type { CommandOptions } from '../generators/types.ts';
import type { FrameworkDetectionService } from '../services/FrameworkDetectionService.ts';
import { FrameworkDetectionCommand } from './FrameworkDetectionCommand.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('FrameworkDetectionCommand', () => {
  const options: CommandOptions = { packageManager: PackageManagerName.NPM, yes: true };
  const packageManager = {
    getAllDependencies: vi.fn(),
  } as unknown as JsPackageManager;
  const frameworkDetectionService = {
    detectBuilder: vi.fn(),
    detectFramework: vi.fn(),
  } as unknown as FrameworkDetectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(generatorRegistry, 'get').mockReturnValue(reactGenerator);
    vi.mocked(frameworkDetectionService.detectBuilder).mockResolvedValue(SupportedBuilder.VITE);
    vi.mocked(frameworkDetectionService.detectFramework).mockReturnValue(
      SupportedFramework.REACT_VITE
    );
  });

  it.each(['react-scripts', '@storybook/preset-create-react-app'])(
    'fails with recovery guidance before prompting when %s is installed',
    async (dependency) => {
      vi.mocked(packageManager.getAllDependencies).mockReturnValue({ [dependency]: '5.0.1' });

      const command = new FrameworkDetectionCommand(packageManager, frameworkDetectionService);

      await expect(command.execute(ProjectType.REACT, options)).rejects.toThrow(HandledError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('--type react --builder vite')
      );
      expect(frameworkDetectionService.detectBuilder).not.toHaveBeenCalled();
    }
  );

  it('allows an explicit supported builder in Create React App', async () => {
    vi.mocked(packageManager.getAllDependencies).mockReturnValue({
      '@storybook/preset-create-react-app': '10.6.1',
    });

    const command = new FrameworkDetectionCommand(packageManager, frameworkDetectionService);
    const result = await command.execute(ProjectType.REACT, {
      ...options,
      builder: SupportedBuilder.VITE,
    });

    expect(result.framework).toBe(SupportedFramework.REACT_VITE);
    expect(frameworkDetectionService.detectBuilder).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('keeps builder detection for other React projects', async () => {
    vi.mocked(packageManager.getAllDependencies).mockReturnValue({ react: '18.3.1' });

    const command = new FrameworkDetectionCommand(packageManager, frameworkDetectionService);
    const result = await command.execute(ProjectType.REACT, options);

    expect(result.builder).toBe(SupportedBuilder.VITE);
    expect(frameworkDetectionService.detectBuilder).toHaveBeenCalledOnce();
  });
});
