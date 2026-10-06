import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportedBuilder, SupportedLanguage } from 'storybook/internal/types';

import { DependencyCollector } from '../../dependency-collector.ts';
import { TelemetryService } from '../../services/TelemetryService.ts';
import reactNativeGenerator from '../REACT_NATIVE/index.ts';
import reactNativeWebGenerator from '../REACT_NATIVE_WEB/index.ts';
import dualGenerator from './index.ts';

vi.mock('../REACT_NATIVE/index.ts', { spy: true });
vi.mock('../REACT_NATIVE_WEB/index.ts', { spy: true });

describe('REACT_NATIVE_AND_RNW generator', () => {
  const telemetryService = new TelemetryService();

  beforeEach(() => {
    vi.mocked(reactNativeGenerator.configure).mockResolvedValue({
      storybookConfigFolder: '.rnstorybook',
      skipGenerator: true,
      shouldRunDev: false,
      storybookCommand: null,
    });
    vi.mocked(reactNativeWebGenerator.configure).mockResolvedValue({
      extraPackages: ['vite', 'react-native-web'],
    });
  });

  it('maps #.storybook/preview to the web preview', async () => {
    const packageManager = {
      writePackageJson: vi.fn(),
      primaryPackageJson: {
        operationDir: process.cwd(),
        packageJson: {},
      },
    } as any;

    await dualGenerator.configure(packageManager, {
      framework: dualGenerator.metadata.framework as any,
      renderer: dualGenerator.metadata.renderer,
      builder: SupportedBuilder.VITE,
      language: SupportedLanguage.TYPESCRIPT,
      telemetryService,
      features: new Set(),
      dependencyCollector: new DependencyCollector(),
      yes: true,
    });

    expect(packageManager.writePackageJson).toHaveBeenCalledWith(
      expect.objectContaining({
        imports: expect.objectContaining({
          '#.storybook/preview': './.storybook/preview.ts',
        }),
      }),
      process.cwd()
    );
  });

  it('maps a JavaScript project to preview.js', async () => {
    const packageManager = {
      writePackageJson: vi.fn(),
      primaryPackageJson: {
        operationDir: process.cwd(),
        packageJson: {},
      },
    } as any;

    await dualGenerator.configure(packageManager, {
      framework: dualGenerator.metadata.framework as any,
      renderer: dualGenerator.metadata.renderer,
      builder: SupportedBuilder.VITE,
      language: SupportedLanguage.JAVASCRIPT,
      telemetryService,
      features: new Set(),
      dependencyCollector: new DependencyCollector(),
      yes: true,
    });

    expect(packageManager.writePackageJson).toHaveBeenCalledWith(
      expect.objectContaining({
        imports: expect.objectContaining({
          '#.storybook/preview': './.storybook/preview.js',
        }),
      }),
      process.cwd()
    );
  });
});
