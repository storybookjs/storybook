import { beforeEach, describe, expect, it, vi } from 'vitest';

import { copyTemplateFiles, getBabelDependencies } from 'storybook/internal/cli';
import { SupportedLanguage } from 'storybook/internal/types';

import { DependencyCollector } from '../../dependency-collector';
import reactNativeGenerator from './index';
import { generateReactNativeEntrypoint } from './generateEntrypoint';
import { runMetroCodemodOrFallback } from './metroConfig';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('./generateEntrypoint', { spy: true });
vi.mock('./metroConfig', { spy: true });

describe('REACT_NATIVE generator module', () => {
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
  });

  it('generates RFC entrypoint based on detected language', async () => {
    const packageManager = {
      getDependencyVersion: vi.fn().mockReturnValue(null),
      getVersionedPackages: vi.fn().mockResolvedValue([]),
      addScripts: vi.fn(),
    } as any;

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
    expect(runMetroCodemodOrFallback).toHaveBeenCalled();
  });
});
