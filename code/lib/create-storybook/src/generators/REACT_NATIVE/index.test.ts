import { beforeEach, describe, expect, it, vi } from 'vitest';

import { copyTemplateFiles, getBabelDependencies } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';
import { SupportedLanguage } from 'storybook/internal/types';

import { DependencyCollector } from '../../dependency-collector';
import reactNativeGenerator from './index';
import { generateReactNativeEntrypoint } from './generateEntrypoint';
import { runMetroCodemodOrFallback } from './metroConfig';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./generateEntrypoint', { spy: true });
vi.mock('./metroConfig', { spy: true });

describe('REACT_NATIVE generator module', () => {
  const createPackageManager = (scripts?: Record<string, string>) =>
    ({
      getDependencyVersion: vi.fn().mockReturnValue(null),
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
      features: new Set(),
      dependencyCollector: new DependencyCollector(),
      yes: true,
    });

    expect(generateReactNativeEntrypoint).toHaveBeenCalledWith({
      language: SupportedLanguage.JAVASCRIPT,
    });
    expect(packageManager.addScripts).toHaveBeenCalledWith({
      'storybook-generate': 'sb-rn-get-stories',
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
      features: new Set(),
      dependencyCollector: new DependencyCollector(),
      yes: true,
    });
    await reactNativeGenerator.postConfigure?.({ packageManager });

    expect(packageManager.addScripts).toHaveBeenCalledWith({
      'storybook-generate': 'sb-rn-get-stories',
    });

    const logged = String(vi.mocked(logger.log).mock.calls.at(-1)?.[0] ?? '');
    expect(logged).toContain('STORYBOOK_ENABLED=true');
    expect(logged).toContain('Could not infer');
  });
});
