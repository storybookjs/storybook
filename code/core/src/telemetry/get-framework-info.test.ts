import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorybookConfig } from 'storybook/internal/types';

import { readFile } from 'node:fs/promises';

import * as pkg from 'empathic/package';

import { readDependencyManifest } from 'storybook/internal/common';

import { resolve } from 'pathe';

import { getFrameworkInfo } from './get-framework-info.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('empathic/package', { spy: true });
vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  getStorybookInfo: vi.fn(),
  readDependencyManifest: vi.fn(),
}));

const configDir = '/tmp/.storybook';

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

  describe('for a framework the framework tables do not map to a renderer', () => {
    const mockFrameworkPackage = async (frameworkPackage: string) => {
      const { getStorybookInfo } = await import('storybook/internal/common');
      vi.mocked(getStorybookInfo).mockResolvedValue({ frameworkPackage } as any);
    };

    it.each([
      ['a package name', '@storybook/react-native'],
      ['a resolved path', '/repo/node_modules/@storybook/react-native'],
      ['a Windows path', 'C:\\repo\\node_modules\\@storybook\\react-native'],
      ['a pnpm virtual-store path', '/repo/node_modules/.pnpm/@storybook+react-native@10.0.0'],
    ])('reports a renderer configured as its own framework, given as %s', async (_, framework) => {
      await mockFrameworkPackage(framework);

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBe('@storybook/react-native');
      expect(readDependencyManifest).not.toHaveBeenCalled();
    });

    it('reports the renderer it depends on', async () => {
      await mockFrameworkPackage('@acme/storybook-framework');
      vi.mocked(readDependencyManifest).mockResolvedValueOnce({
        dependencies: { '@storybook/react': '^10.0.0', react: '^19.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(readDependencyManifest).toHaveBeenCalledWith(
        resolve(configDir),
        '@acme/storybook-framework'
      );
      expect(result.renderer).toBe('@storybook/react');
    });

    it('reports its only renderer peer dependency, as Analog has', async () => {
      await mockFrameworkPackage('@analogjs/storybook-angular');
      vi.mocked(readDependencyManifest).mockResolvedValueOnce({
        peerDependencies: { '@storybook/angular': '^10.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBe('@storybook/angular');
    });

    it('reports the Astro renderer over the renderers Astro lists as peers', async () => {
      await mockFrameworkPackage('@storybook-astro/framework');
      vi.mocked(readDependencyManifest).mockResolvedValueOnce({
        dependencies: { '@storybook-astro/renderer': '1.18.0' },
        peerDependencies: { '@storybook/react': '^10.0.0', '@storybook/vue3': '^10.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBe('@storybook-astro/renderer');
    });

    it('reports no renderer when several are peer dependencies', async () => {
      await mockFrameworkPackage('@acme/storybook-framework');
      vi.mocked(readDependencyManifest).mockResolvedValueOnce({
        peerDependencies: { '@storybook/react': '^10.0.0', '@storybook/svelte': '^10.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBeUndefined();
    });

    it('reports no renderer for a dependency named like an object property', async () => {
      await mockFrameworkPackage('@acme/storybook-framework');
      vi.mocked(readDependencyManifest).mockResolvedValueOnce({
        dependencies: { constructor: '1.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBeUndefined();
    });

    it('reports no renderer when its package.json cannot be read', async () => {
      await mockFrameworkPackage('@acme/storybook-framework');
      vi.mocked(readDependencyManifest).mockResolvedValueOnce(undefined);

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(result.renderer).toBeUndefined();
    });

    it('reads the nearest package.json of a framework given as a path', async () => {
      await mockFrameworkPackage('/repo/packages/storybook-framework/dist/index.js');
      vi.mocked(pkg.up).mockReturnValueOnce('/repo/packages/storybook-framework/package.json');
      vi.mocked(readFile).mockResolvedValueOnce(
        JSON.stringify({ peerDependencies: { '@storybook/vue3': '^10.0.0' } })
      );

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(pkg.up).toHaveBeenCalledWith({
        cwd: '/repo/packages/storybook-framework/dist/index.js',
      });
      expect(result.renderer).toBe('@storybook/vue3');
    });

    it('resolves a framework given as a pnpm virtual-store path by its package name', async () => {
      await mockFrameworkPackage('/repo/node_modules/.pnpm/@acme+storybook-framework@1.0.0');
      vi.mocked(readDependencyManifest).mockResolvedValueOnce({
        dependencies: { '@storybook/html': '^10.0.0' },
      });

      const result = await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

      expect(pkg.up).not.toHaveBeenCalled();
      expect(readDependencyManifest).toHaveBeenCalledWith(
        resolve(configDir),
        '@acme/storybook-framework'
      );
      expect(result.renderer).toBe('@storybook/html');
    });
  });

  it('resolves a framework given as a Windows pnpm virtual-store path by its package name', async () => {
    const { getStorybookInfo } = await import('storybook/internal/common');
    vi.mocked(getStorybookInfo).mockResolvedValue({
      frameworkPackage: 'C:\\repo\\node_modules\\.pnpm\\@acme+storybook-framework@1.0.0',
    } as any);
    vi.mocked(readDependencyManifest).mockResolvedValueOnce({
      dependencies: { '@storybook/html': '^10.0.0' },
    });

    const result = await getFrameworkInfo({} as StorybookConfig, configDir);

    expect(readDependencyManifest).toHaveBeenCalledWith(
      resolve(configDir),
      '@acme/storybook-framework'
    );
    expect(result.renderer).toBe('@storybook/html');
  });

  it('does not read the package.json of a framework the framework tables know', async () => {
    await getFrameworkInfo({} as StorybookConfig, '/tmp/.storybook');

    expect(readDependencyManifest).not.toHaveBeenCalled();
  });
});
