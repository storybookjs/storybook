import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorybookConfig } from 'storybook/internal/types';

import { getFrameworkInfo } from './get-framework-info';

vi.mock('storybook/internal/common', () => ({
  getStorybookInfo: vi.fn(),
}));

describe('getFrameworkInfo', () => {
  const defaultInfo = {
    frameworkPackage: '@storybook/react',
    rendererPackage: '@storybook/react',
    builderPackage: '@storybook/builder-vite',
  };

  beforeEach(async () => {
    const { getStorybookInfo } = await import('storybook/internal/common');
    vi.mocked(getStorybookInfo).mockResolvedValue(defaultInfo as any);
  });

  it('returns framework/builder/renderer with empty options when no framework provided', async () => {
    const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');
    expect(result).toEqual({
      framework: { name: defaultInfo.frameworkPackage, options: {} },
      builder: defaultInfo.builderPackage,
      renderer: defaultInfo.rendererPackage,
    });
  });

  it('passes configDir to getStorybookInfo', async () => {
    const configDir = '/my/project/.storybook';
    const { getStorybookInfo } = await import('storybook/internal/common');
    await getFrameworkInfo({} as StorybookConfig, configDir);
    expect(getStorybookInfo).toHaveBeenCalledWith(configDir);
  });

  it('returns provided framework options when object is passed', async () => {
    const options = { foo: 'bar' } as any;
    const result = await getFrameworkInfo(
      { framework: { name: '@storybook/react', options } } as any,
      '/tmp/.storybook'
    );
    expect(result.framework.options).toEqual(options);
  });
});
