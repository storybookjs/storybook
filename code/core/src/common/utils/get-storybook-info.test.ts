import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';

import { SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';
import { findConfigFile, getStorybookInfo } from './get-storybook-info.ts';
import { loadMainConfig } from './load-main-config.ts';

vi.mock('node:fs', { spy: true });
vi.mock('./load-main-config.ts', { spy: true });

const configDir = join('/project', '.storybook');

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(fs.existsSync as typeof existsSync);
});

describe('findConfigFile', () => {
  it.each(['main.mts', 'main.cts', 'main.ts', 'main.js'])('finds %s', (file) => {
    vol.fromJSON({ [join(configDir, file)]: '' });

    expect(findConfigFile('main', configDir)).toBe(join(configDir, file));
  });

  it('returns null when there is no config file', () => {
    vol.fromJSON({ [join(configDir, 'preview.ts')]: '' });

    expect(findConfigFile('main', configDir)).toBeNull();
  });
});

describe.each([
  {
    framework: '@storybook/react-native',
    renderer: SupportedRenderer.REACT_NATIVE,
    rendererPackage: '@storybook/react-native',
  },
  {
    // The renderer-as-framework lookup matches paths too; path forms are covered by matchPackageName
    framework: '/project/node_modules/.pnpm/@storybook+react-native@1.0.0',
    renderer: SupportedRenderer.REACT_NATIVE,
    rendererPackage: '@storybook/react-native',
  },
  {
    framework: '@storybook-astro/framework',
    renderer: SupportedRenderer.ASTRO,
    rendererPackage: '@storybook-astro/renderer',
  },
  {
    framework: '@analogjs/storybook-angular',
    renderer: SupportedRenderer.ANGULAR,
    rendererPackage: '@storybook/angular',
  },
  {
    framework: '@storybook/react-vite',
    renderer: SupportedRenderer.REACT,
    rendererPackage: '@storybook/react',
  },
])('getStorybookInfo for $framework', ({ framework, renderer, rendererPackage }) => {
  beforeEach(() => {
    vi.spyOn(JsPackageManager, 'listAllPackageJsonPaths').mockReturnValue([]);
    vi.mocked(loadMainConfig).mockResolvedValue({ framework, stories: [] });
  });

  it('detects the renderer and its package', async () => {
    const info = await getStorybookInfo(configDir);

    expect(info.renderer).toBe(renderer);
    expect(info.rendererPackage).toBe(rendererPackage);
  });
});

describe('getStorybookInfo for Analog', () => {
  beforeEach(() => {
    vi.spyOn(JsPackageManager, 'listAllPackageJsonPaths').mockReturnValue([]);
    vi.mocked(loadMainConfig).mockResolvedValue({
      framework: '@analogjs/storybook-angular',
      stories: [],
    });
  });

  it('detects the framework and builder', async () => {
    const info = await getStorybookInfo(configDir);

    expect(info.framework).toBe(SupportedFramework.ANALOG);
    expect(info.builderPackage).toBe('@storybook/builder-vite');
  });
});
