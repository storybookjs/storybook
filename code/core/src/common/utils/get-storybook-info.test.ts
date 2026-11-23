import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';

import { SupportedRenderer } from 'storybook/internal/types';

import { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';
import { findConfigFile, getStorybookInfo } from './get-storybook-info.ts';
import { loadMainConfig } from './load-main-config.ts';

vi.mock('node:fs', { spy: true });
vi.mock('./load-main-config.ts', { spy: true });

const configDir = join('/project', '.storybook');

describe('findConfigFile', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(existsSync).mockImplementation(fs.existsSync as typeof existsSync);
  });

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
  ['@storybook/react-native', SupportedRenderer.REACT_NATIVE, '@storybook/react-native'],
  ['@storybook-astro/framework', SupportedRenderer.ASTRO, '@storybook-astro/renderer'],
  ['@analogjs/storybook-angular', SupportedRenderer.ANGULAR, '@storybook/angular'],
  ['@storybook/react-vite', SupportedRenderer.REACT, '@storybook/react'],
])('getStorybookInfo renderer detection for %s', (framework, renderer, rendererPackage) => {
  beforeEach(() => {
    vi.spyOn(JsPackageManager, 'listAllPackageJsonPaths').mockReturnValue([]);
    vi.mocked(loadMainConfig).mockResolvedValue({ framework });
  });

  it('detects the renderer and its package', async () => {
    const info = await getStorybookInfo(configDir);

    expect(info.renderer).toBe(renderer);
    expect(info.rendererPackage).toBe(rendererPackage);
  });
});
