import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorybookConfig } from 'storybook/internal/types';

import { readFile } from 'node:fs/promises';

import { getFrameworkInfo } from './get-framework-info.ts';
import { getActualPackageJson } from './package-json.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./package-json.ts', { spy: true });
vi.mock('storybook/internal/common', () => ({
  getStorybookInfo: vi.fn(),
  rendererPackages: {
    '@storybook/angular': 'angular',
    '@storybook/html': 'html',
    '@storybook/react': 'react',
    '@storybook/svelte': 'svelte',
    '@storybook/vue3': 'vue3',
  },
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

  it('decodes pnpm virtual-store paths so no version-bearing fragment leaks', async () => {
    const { getStorybookInfo } = await import('storybook/internal/common');
    vi.mocked(getStorybookInfo).mockResolvedValue({
      frameworkPackage: '/repo/node_modules/.pnpm/@storybook+react-vite@9.0.0',
      rendererPackage: '/repo/node_modules/.pnpm/@storybook+react@9.0.0_typescript@5.0.0',
      builderPackage: '/repo/node_modules/.pnpm/@storybook+builder-vite@9.0.0',
    } as any);

    const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

    expect(result.framework.name).toBe('@storybook/react-vite');
    expect(result.renderer).toBe('@storybook/react');
    expect(result.builder).toBe('@storybook/builder-vite');
  });

  it('returns provided framework options when object is passed', async () => {
    const options = { foo: 'bar' } as any;
    const result = await getFrameworkInfo(
      { framework: { name: '@storybook/react', options } } as any,
      '/tmp/.storybook'
    );
    expect(result.framework.options).toEqual(options);
  });

  describe('for a framework the registry does not know', () => {
    beforeEach(async () => {
      const { getStorybookInfo } = await import('storybook/internal/common');
      vi.mocked(getStorybookInfo).mockResolvedValue({
        frameworkPackage: '@acme/storybook-framework',
      } as any);
    });

    it('reports the renderer it depends on', async () => {
      vi.mocked(getActualPackageJson).mockResolvedValue({
        dependencies: { '@storybook/react': '^10.0.0', react: '^19.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(getActualPackageJson).toHaveBeenCalledWith('@acme/storybook-framework');
      expect(result.renderer).toBe('@storybook/react');
    });

    it('reports its only renderer peer dependency', async () => {
      vi.mocked(getActualPackageJson).mockResolvedValue({
        peerDependencies: { '@storybook/angular': '^10.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBe('@storybook/angular');
    });

    it('prefers a renderer dependency over renderer peer dependencies', async () => {
      vi.mocked(getActualPackageJson).mockResolvedValue({
        dependencies: { '@storybook/html': '^10.0.0' },
        peerDependencies: { '@storybook/react': '^10.0.0', '@storybook/vue3': '^10.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBe('@storybook/html');
    });

    it('reports no renderer when several are peer dependencies', async () => {
      vi.mocked(getActualPackageJson).mockResolvedValue({
        peerDependencies: { '@storybook/react': '^10.0.0', '@storybook/svelte': '^10.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBeUndefined();
    });

    it('reports no renderer when its package.json cannot be read', async () => {
      vi.mocked(getActualPackageJson).mockResolvedValue(undefined);

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBeUndefined();
    });

    it('reads the package.json of a framework given as a path', async () => {
      const { getStorybookInfo } = await import('storybook/internal/common');
      vi.mocked(getStorybookInfo).mockResolvedValue({
        frameworkPackage: '/repo/node_modules/@acme/storybook-framework',
      } as any);
      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({ peerDependencies: { '@storybook/vue3': '^10.0.0' } })
      );

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(readFile).toHaveBeenCalledWith(
        '/repo/node_modules/@acme/storybook-framework/package.json',
        'utf-8'
      );
      expect(result.renderer).toBe('@storybook/vue3');
    });
  });

  it('does not read the package.json of a framework the registry knows', async () => {
    await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

    expect(getActualPackageJson).not.toHaveBeenCalled();
  });
});
