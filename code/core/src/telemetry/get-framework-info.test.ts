import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStorybookInfo, readDependencyManifest } from 'storybook/internal/common';
import type { PackageJson, StorybookConfig } from 'storybook/internal/types';

import { resolve } from 'pathe';

import { getFrameworkInfo } from './get-framework-info.ts';

vi.mock('storybook/internal/common', { spy: true });

const configDir = '/tmp/.storybook';

const defaultInfo = {
  frameworkPackage: '@storybook/react',
  rendererPackage: '@storybook/react',
  builderPackage: '@storybook/builder-vite',
};

beforeEach(() => {
  vi.mocked(getStorybookInfo).mockResolvedValue(defaultInfo as any);
  vi.mocked(readDependencyManifest).mockResolvedValue(undefined);
});

describe('getFrameworkInfo', () => {
  it('returns framework/builder/renderer with empty options when no framework provided', async () => {
    const result = await getFrameworkInfo({} as StorybookConfig, configDir);
    expect(result).toEqual({
      framework: { name: defaultInfo.frameworkPackage, options: {} },
      builder: defaultInfo.builderPackage,
      renderer: defaultInfo.rendererPackage,
    });
  });

  it('passes configDir to getStorybookInfo', async () => {
    await getFrameworkInfo({} as StorybookConfig, configDir);
    expect(getStorybookInfo).toHaveBeenCalledWith(configDir);
  });

  it('returns provided framework options when object is passed', async () => {
    const options = { foo: 'bar' } as any;
    const result = await getFrameworkInfo(
      { framework: { name: '@storybook/react', options } } as any,
      configDir
    );
    expect(result.framework.options).toEqual(options);
  });

  it('does not read the package.json of a framework the framework tables know', async () => {
    await getFrameworkInfo({} as StorybookConfig, configDir);

    expect(readDependencyManifest).not.toHaveBeenCalled();
  });

  describe('with pnpm virtual-store paths', () => {
    beforeEach(() => {
      vi.mocked(getStorybookInfo).mockResolvedValue({
        frameworkPackage: '/repo/node_modules/.pnpm/@storybook+react-vite@9.0.0',
        rendererPackage: '/repo/node_modules/.pnpm/@storybook+react@9.0.0_typescript@5.0.0',
        builderPackage: '/repo/node_modules/.pnpm/@storybook+builder-vite@9.0.0',
      } as any);
    });

    it('decodes them so no version-bearing fragment leaks', async () => {
      const result = await getFrameworkInfo({} as StorybookConfig, configDir);

      expect(result.framework.name).toBe('@storybook/react-vite');
      expect(result.renderer).toBe('@storybook/react');
      expect(result.builder).toBe('@storybook/builder-vite');
    });
  });

  describe.each<{
    reports: string;
    frameworkPackage: string;
    manifest: PackageJson | undefined;
    renderer: string | undefined;
  }>([
    {
      reports: 'its only renderer dependency',
      frameworkPackage: '@acme/storybook-framework',
      manifest: { dependencies: { '@storybook/react': '^10.0.0', react: '^19.0.0' } },
      renderer: '@storybook/react',
    },
    {
      reports: 'its only renderer peer dependency',
      frameworkPackage: '@acme/storybook-angular-framework',
      manifest: { peerDependencies: { '@storybook/angular': '^10.0.0' } },
      renderer: '@storybook/angular',
    },
    {
      reports: 'the Astro renderer over the renderers Astro lists as peers',
      frameworkPackage: '@storybook-astro/framework',
      manifest: {
        dependencies: { '@storybook-astro/renderer': '1.18.0' },
        peerDependencies: { '@storybook/react': '^10.0.0', '@storybook/vue3': '^10.0.0' },
      },
      renderer: '@storybook-astro/renderer',
    },
    {
      reports: 'no renderer when several are peer dependencies',
      frameworkPackage: '@acme/storybook-framework',
      manifest: {
        peerDependencies: { '@storybook/react': '^10.0.0', '@storybook/svelte': '^10.0.0' },
      },
      renderer: undefined,
    },
    {
      reports: 'no renderer when several are dependencies, whatever its peers',
      frameworkPackage: '@acme/storybook-framework',
      manifest: {
        dependencies: { '@storybook/react': '^10.0.0', '@storybook/vue3': '^10.0.0' },
        peerDependencies: { '@storybook/svelte': '^10.0.0' },
      },
      renderer: undefined,
    },
    {
      reports: 'no renderer when its package.json cannot be read',
      frameworkPackage: '@acme/storybook-framework',
      manifest: undefined,
      renderer: undefined,
    },
  ])(
    'for a framework the tables do not list, reports $reports',
    ({ frameworkPackage, manifest, renderer }) => {
      beforeEach(() => {
        vi.mocked(getStorybookInfo).mockResolvedValue({ frameworkPackage } as any);
        vi.mocked(readDependencyManifest).mockResolvedValue(manifest);
      });

      it('reads its package.json from the config dir', async () => {
        const result = await getFrameworkInfo({} as StorybookConfig, configDir);

        expect(readDependencyManifest).toHaveBeenCalledWith(resolve(configDir), frameworkPackage);
        expect(result.renderer).toBe(renderer);
      });
    }
  );

  describe.each([
    {
      form: 'a pnpm virtual-store path',
      frameworkPackage: '/repo/node_modules/.pnpm/@acme+storybook-framework@1.0.0',
    },
    {
      form: 'a Windows pnpm virtual-store path',
      frameworkPackage: 'C:\\repo\\node_modules\\.pnpm\\@acme+storybook-framework@1.0.0',
    },
  ])('for an unlisted framework given as $form', ({ frameworkPackage }) => {
    beforeEach(() => {
      vi.mocked(getStorybookInfo).mockResolvedValue({ frameworkPackage } as any);
      vi.mocked(readDependencyManifest).mockResolvedValue({
        dependencies: { '@storybook/html': '^10.0.0' },
      });
    });

    it('resolves its package.json by package name', async () => {
      const result = await getFrameworkInfo({} as StorybookConfig, configDir);

      expect(readDependencyManifest).toHaveBeenCalledWith(
        resolve(configDir),
        '@acme/storybook-framework'
      );
      expect(result.renderer).toBe('@storybook/html');
    });
  });

  describe('for an unlisted framework given as a file path', () => {
    const frameworkPath = '/repo/packages/storybook-framework/dist/index.js';

    beforeEach(() => {
      vi.mocked(getStorybookInfo).mockResolvedValue({ frameworkPackage: frameworkPath } as any);
      vi.mocked(readDependencyManifest).mockResolvedValue({
        name: '@acme/storybook-framework',
        peerDependencies: { '@storybook/vue3': '^10.0.0' },
      });
    });

    it('reads the package.json of the package the path is in', async () => {
      const result = await getFrameworkInfo({} as StorybookConfig, configDir);

      expect(readDependencyManifest).toHaveBeenCalledWith(resolve(configDir), frameworkPath);
      expect(result.renderer).toBe('@storybook/vue3');
    });
  });
});
