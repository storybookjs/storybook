import type { MockInstance } from 'vitest';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { StorybookConfigRaw } from '@storybook/core/types';
import { checkWebpack5Builder } from './checkWebpack5Builder';
import { getBuilderPackageName } from './mainConfigFile';

const mockMainConfig: StorybookConfigRaw = {
  framework: 'react',
  addons: [],
  stories: [],
};

vi.mock('./mainConfigFile');

describe('checkWebpack5Builder', () => {
  let loggerWarnSpy: MockInstance;
  let loggerInfoSpy: MockInstance;

  beforeEach(() => {
    loggerWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loggerInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
    loggerInfoSpy.mockRestore();
  });

  it('should return null and log a warning if storybook version is below 6.3.0', async () => {
    const result = await checkWebpack5Builder({
      mainConfig: mockMainConfig,
      storybookVersion: '6.2.9',
    });
    expect(result).toBeNull();
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.any(String));
  });

  it('should return null if storybook version is 7.0.0 or above', async () => {
    const result = await checkWebpack5Builder({
      mainConfig: mockMainConfig,
      storybookVersion: '7.0.0',
    });
    expect(result).toBeNull();
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });

  it('should return null and log a warning if mainConfig is missing', async () => {
    const result = await checkWebpack5Builder({
      // @ts-expect-error (Type 'undefined' is not assignable to type 'StorybookConfigRaw'.)
      mainConfig: undefined,
      storybookVersion: '6.3.0',
    });
    expect(result).toBeNull();
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.any(String));
  });

  it('should return null and log an info message if builderPackageName is found but not "webpack4"', async () => {
    vi.mocked(getBuilderPackageName).mockReturnValueOnce('webpack5');

    const result = await checkWebpack5Builder({
      mainConfig: mockMainConfig,
      storybookVersion: '6.3.0',
    });

    expect(result).toBeNull();
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.any(String));
  });

  it('should return { storybookVersion } if all checks pass', async () => {
    vi.mocked(getBuilderPackageName).mockReturnValueOnce('webpack4');

    const result = await checkWebpack5Builder({
      mainConfig: mockMainConfig,
      storybookVersion: '6.3.0',
    });

    expect(result).toEqual({ storybookVersion: '6.3.0' });
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerInfoSpy).not.toHaveBeenCalled();
  });
});
