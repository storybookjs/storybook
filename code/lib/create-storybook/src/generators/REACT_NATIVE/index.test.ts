import { beforeEach, describe, expect, it, vi } from 'vitest';

import { copyTemplateFiles, getBabelDependencies } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';
import { SupportedLanguage } from 'storybook/internal/types';

import { DependencyCollector } from '../../dependency-collector.ts';
import { TelemetryService } from '../../services/TelemetryService.ts';
import reactNativeGenerator from './index.ts';
import { generateReactNativeEntrypoint } from './generateEntrypoint.ts';
import { runMetroCodemodOrFallback } from './metroConfig.ts';
import { detectReactNativeEntrypointTemplateVariant } from './index.ts';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./generateEntrypoint', { spy: true });
vi.mock('./metroConfig', { spy: true });

describe('REACT_NATIVE generator module', () => {
  const telemetryService = new TelemetryService();
  const createPackageManager = (scripts?: Record<string, string>) =>
    ({
      getDependencyVersion: vi.fn().mockReturnValue(null),
      getAllDependencies: vi.fn().mockReturnValue({}),
      getVersionedPackages: vi.fn().mockResolvedValue([]),
      addScripts: vi.fn(),
      getRunCommand: vi.fn((scriptName: string) => `npm run ${scriptName}`),
      primaryPackageJson: {
        packageJson: {
          scripts,
        },
      },
    }) as any;

  beforeEach(() => {
    vi.mocked(getBabelDependencies).mockResolvedValue([]);
    vi.mocked(copyTemplateFiles).mockResolvedValue();
    vi.mocked(generateReactNativeEntrypoint).mockResolvedValue({
      targetPath: '.rnstorybook/index.js',
      extension: 'js',
    });
    vi.mocked(runMetroCodemodOrFallback).mockResolvedValue({
      status: 'updated',
    });
    vi.mocked(logger.log).mockImplementation(() => {});
  });

  it('generates RFC entrypoint and platform scripts based on detected language', async () => {
    const packageManager = createPackageManager({
      ios: 'react-native run-ios',
      android: 'react-native run-android',
      start: 'react-native start',
      test: 'jest',
    });

    await reactNativeGenerator.configure(packageManager, {
      framework: null,
      renderer: reactNativeGenerator.metadata.renderer,
      builder: reactNativeGenerator.metadata.builderOverride as any,
      language: SupportedLanguage.JAVASCRIPT,
      telemetryService,
      features: new Set(),
      dependencyCollector: new DependencyCollector(),
      yes: true,
    });

    expect(generateReactNativeEntrypoint).toHaveBeenCalledWith({
      language: SupportedLanguage.JAVASCRIPT,
    });
    expect(packageManager.getVersionedPackages).toHaveBeenCalledWith(
      expect.arrayContaining(['cross-env'])
    );
    expect(packageManager.addScripts).toHaveBeenCalledWith({
      'storybook:ios': 'cross-env STORYBOOK_ENABLED=true react-native run-ios',
      'storybook:android': 'cross-env STORYBOOK_ENABLED=true react-native run-android',
    });
    expect(runMetroCodemodOrFallback).toHaveBeenCalled();
  });

  it('overwrites existing storybook platform scripts when deriving new values', async () => {
    const packageManager = createPackageManager({
      ios: 'react-native run-ios',
      android: 'react-native run-android',
      'storybook:ios': 'echo old-ios',
      'storybook:android': 'echo old-android',
    });

    await reactNativeGenerator.configure(packageManager, {
      framework: null,
      renderer: reactNativeGenerator.metadata.renderer,
      builder: reactNativeGenerator.metadata.builderOverride as any,
      language: SupportedLanguage.TYPESCRIPT,
      telemetryService,
      features: new Set(),
      dependencyCollector: new DependencyCollector(),
      yes: true,
    });

    expect(packageManager.addScripts).toHaveBeenCalledWith(
      expect.objectContaining({
        'storybook:ios': 'cross-env STORYBOOK_ENABLED=true react-native run-ios',
        'storybook:android': 'cross-env STORYBOOK_ENABLED=true react-native run-android',
      })
    );
  });

  it('postConfigure removes legacy entry replacement copy', async () => {
    const packageManager = createPackageManager({
      ios: 'react-native run-ios',
      android: 'react-native run-android',
    });

    await reactNativeGenerator.configure(packageManager, {
      framework: null,
      renderer: reactNativeGenerator.metadata.renderer,
      builder: reactNativeGenerator.metadata.builderOverride as any,
      language: SupportedLanguage.JAVASCRIPT,
      telemetryService,
      features: new Set(),
      dependencyCollector: new DependencyCollector(),
      yes: true,
    });
    await reactNativeGenerator.postConfigure?.({ packageManager });

    const logged = String(vi.mocked(logger.log).mock.calls.at(-1)?.[0] ?? '');
    expect(logged).not.toContain('Replace the contents of your app entry');
    expect(logged).toContain('npm run storybook:ios');
    expect(logged).toContain('npm run storybook:android');
  });

  it('postConfigure shows env fallback warning when scripts are missing', async () => {
    const packageManager = createPackageManager({
      start: 'react-native start',
    });

    await reactNativeGenerator.configure(packageManager, {
      framework: null,
      renderer: reactNativeGenerator.metadata.renderer,
      builder: reactNativeGenerator.metadata.builderOverride as any,
      language: SupportedLanguage.JAVASCRIPT,
      telemetryService,
      features: new Set(),
      dependencyCollector: new DependencyCollector(),
      yes: true,
    });
    await reactNativeGenerator.postConfigure?.({ packageManager });

    expect(packageManager.addScripts).toHaveBeenCalledWith({});
    expect(packageManager.getVersionedPackages).toHaveBeenCalledWith(
      expect.not.arrayContaining(['cross-env'])
    );

    const logged = String(vi.mocked(logger.log).mock.calls.at(-1)?.[0] ?? '');
    expect(logged).toContain('STORYBOOK_ENABLED=true');
    expect(logged).toContain('Could not infer');
  });

  it('does not add cross-env when it is already a dependency', async () => {
    const packageManager = createPackageManager({
      ios: 'react-native run-ios',
      android: 'react-native run-android',
    });
    packageManager.getDependencyVersion = vi.fn((dep: string) =>
      dep === 'cross-env' ? '^7.0.3' : null
    );

    await reactNativeGenerator.configure(packageManager, {
      framework: null,
      renderer: reactNativeGenerator.metadata.renderer,
      builder: reactNativeGenerator.metadata.builderOverride as any,
      language: SupportedLanguage.JAVASCRIPT,
      telemetryService,
      features: new Set(),
      dependencyCollector: new DependencyCollector(),
      yes: true,
    });

    expect(packageManager.getVersionedPackages).toHaveBeenCalledWith(
      expect.not.arrayContaining(['cross-env'])
    );
  });
});

describe('detectReactNativeEntrypointTemplateVariant', () => {
  it('returns expo when expo dependency is present', () => {
    expect(
      detectReactNativeEntrypointTemplateVariant({
        expo: '^51.0.0',
        'react-native': '0.76.0',
      })
    ).toBe('expo');
  });

  it('returns expo when expo-router dependency is present', () => {
    expect(
      detectReactNativeEntrypointTemplateVariant({
        'expo-router': '^4.0.0',
        'react-native': '0.76.0',
      })
    ).toBe('expo');
  });

  it('returns default when expo dependencies are missing', () => {
    expect(
      detectReactNativeEntrypointTemplateVariant({
        'react-native': '0.76.0',
      })
    ).toBe('default');
  });
});
