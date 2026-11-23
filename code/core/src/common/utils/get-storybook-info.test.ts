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

const rendererCases = [
  ['@storybook/react-native', SupportedRenderer.REACT_NATIVE, '@storybook/react-native'],
  ['@storybook-astro/framework', SupportedRenderer.ASTRO, '@storybook-astro/renderer'],
  ['@analogjs/storybook-angular', SupportedRenderer.ANGULAR, '@storybook/angular'],
  ['@storybook/react-vite', SupportedRenderer.REACT, '@storybook/react'],
] as const;

const frameworkFieldForms = [
  ['package name', (pkg: string) => pkg],
  ['POSIX path', (pkg: string) => `/project/node_modules/${pkg}`],
  ['Windows path', (pkg: string) => `C:\\project\\node_modules\\${pkg.replace('/', '\\')}`],
  [
    'pnpm virtual-store path',
    (pkg: string) => `/project/node_modules/.pnpm/${pkg.replace('/', '+')}@1.0.0`,
  ],
] as const;

describe('getStorybookInfo renderer detection', () => {
  beforeEach(() => {
    vi.spyOn(JsPackageManager, 'listAllPackageJsonPaths').mockReturnValue([]);
  });

  it.each(
    rendererCases.flatMap(([pkg, renderer, rendererPackage]) =>
      frameworkFieldForms.map(
        ([form, toField]) => [pkg, form, toField(pkg), renderer, rendererPackage] as const
      )
    )
  )(
    'detects the renderer of %s given as a %s',
    async (_pkg, _form, framework, renderer, rendererPackage) => {
      vi.mocked(loadMainConfig).mockResolvedValue({ framework, stories: [] });

      const info = await getStorybookInfo(configDir);

      expect(info.renderer).toBe(renderer);
      expect(info.rendererPackage).toBe(rendererPackage);
    }
  );

  it('detects the framework and builder of Analog', async () => {
    vi.mocked(loadMainConfig).mockResolvedValue({
      framework: '@analogjs/storybook-angular',
      stories: [],
    });

    const info = await getStorybookInfo(configDir);

    expect(info.framework).toBe(SupportedFramework.ANALOG);
    expect(info.builderPackage).toBe('@storybook/builder-vite');
  });
});
