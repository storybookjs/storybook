import path from 'node:path';

import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getStorybookInfo, isCI } from 'storybook/internal/common';
import type { PackageJson, StorybookConfig } from 'storybook/internal/types';

import { detect } from 'package-manager-detector';

import { type Settings, globalSettings } from '../cli/globalSettings';
import { getMonorepoType } from '../telemetry/get-monorepo-type';
import {
  getActualPackageJson,
  getActualPackageVersion,
  getActualPackageVersions,
} from './package-json';
import { computeStorybookMetadata, metaFrameworks, sanitizeAddonName } from './storybook-metadata';

vi.mock(import('../cli/globalSettings'), { spy: true });
vi.mock(import('./package-json'), { spy: true });
vi.mock(import('./get-monorepo-type'), { spy: true });
vi.mock(import('package-manager-detector'), { spy: true });
vi.mock(import('storybook/internal/common'), { spy: true });

const packageJsonMock: PackageJson = {
  name: 'some-user-project',
  version: 'x.x.x',
};

const packageJsonPath = process.cwd();

const mainJsMock: StorybookConfig = {
  stories: [],
};

beforeEach(() => {
  vi.mocked(getStorybookInfo).mockImplementation(() => ({
    version: '9.0.0',
    framework: 'react',
    frameworkPackage: '@storybook/react',
    renderer: 'react',
    rendererPackage: '@storybook/react',
  }));

  vi.mocked(detect).mockImplementation(async () => ({
    name: 'yarn',
    version: '3.1.1',
    agent: 'yarn@berry',
  }));

  vi.mocked(getMonorepoType).mockImplementation(() => 'Nx');

  vi.mocked(getActualPackageJson).mockImplementation(async () => ({
    dependencies: {
      '@storybook/react': 'x.x.x',
      '@storybook/builder-vite': 'x.x.x',
    },
  }));

  vi.mocked(getActualPackageVersion).mockImplementation(async (name) => ({
    name,
    version: 'x.x.x',
  }));

  vi.mocked(getActualPackageVersions).mockImplementation((packages) =>
    Promise.all(Object.keys(packages).map(getActualPackageVersion))
  );
});

const originalSep = path.sep;

describe('storybook-metadata', () => {
  let cwdSpy: MockInstance;
  beforeEach(() => {
    // @ts-expect-error the property is read only but we can change it for testing purposes
    path.sep = originalSep;
  });

  afterEach(() => {
    cwdSpy?.mockRestore();
    // @ts-expect-error the property is read only but we can change it for testing purposes
    path.sep = originalSep;
  });

  describe('sanitizeAddonName', () => {
    it('special addon names', () => {
      const addonNames = [
        '@storybook/preset-create-react-app',
        'storybook-addon-deprecated/register',
        'storybook-addon-ends-with-js/register.js',
        '@storybook/addon-knobs/preset',
        '@storybook/addon-ends-with-js/preset.js',
        '@storybook/addon-postcss/dist/index.js',
        '../local-addon/register.js',
        '../../',
      ].map(sanitizeAddonName);

      expect(addonNames).toEqual([
        '@storybook/preset-create-react-app',
        'storybook-addon-deprecated',
        'storybook-addon-ends-with-js',
        '@storybook/addon-knobs',
        '@storybook/addon-ends-with-js',
        '@storybook/addon-postcss',
        '../local-addon',
        '../../',
      ]);
    });

    it('Windows paths', () => {
      // @ts-expect-error the property is read only but we can change it for testing purposes
      path.sep = '\\';
      const cwdMockPath = `C:\\Users\\username\\storybook-app`;
      cwdSpy = vi.spyOn(process, `cwd`).mockReturnValueOnce(cwdMockPath);

      expect(sanitizeAddonName(`${cwdMockPath}\\local-addon\\themes.js`)).toEqual(
        '$SNIP\\local-addon\\themes'
      );
    });

    it('Linux paths', () => {
      // @ts-expect-error the property is read only but we can change it for testing purposes
      path.sep = '/';
      const cwdMockPath = `/Users/username/storybook-app`;
      cwdSpy = vi.spyOn(process, `cwd`).mockReturnValue(cwdMockPath);

      expect(sanitizeAddonName(`${cwdMockPath}/local-addon/themes.js`)).toEqual(
        '$SNIP/local-addon/themes'
      );
    });
  });

  describe('computeStorybookMetadata', () => {
    describe('pnp paths', () => {
      it('should parse pnp paths for known frameworks', async () => {
        const unixResult = await computeStorybookMetadata({
          packageJson: packageJsonMock,
          packageJsonPath,
          configDir: '.storybook',
          mainConfig: {
            ...mainJsMock,
            framework: {
              name: '/Users/foo/storybook/.yarn/__virtual__/@storybook-react-vite-virtual-769c990b9/0/cache/@storybook-react-vite-npm-7.1.0-alpha.38-512b-a23.zip/node_modules/@storybook/react-vite',
              options: {
                strictMode: false,
              },
            },
          },
        });

        expect(unixResult.framework).toEqual({
          name: '@storybook/react-vite',
          options: { strictMode: false },
        });

        const windowsResult = await computeStorybookMetadata({
          packageJson: packageJsonMock,
          packageJsonPath,
          configDir: '.storybook',
          mainConfig: {
            ...mainJsMock,
            framework: {
              name: 'C:\\Users\\foo\\storybook\\.yarn\\__virtual__\\@storybook-react-vite-virtual-769c990b9\\0\\cache\\@storybook-react-vite-npm-7.1.0-alpha.38-512b-a23.zip\\node_modules\\@storybook\\react-vite',
              options: {
                strictMode: false,
              },
            },
          },
        });

        expect(windowsResult.framework).toEqual({
          name: '@storybook/react-vite',
          options: { strictMode: false },
        });
      });

      it('should parse pnp paths for unknown frameworks', async () => {
        const unixResult = await computeStorybookMetadata({
          packageJson: packageJsonMock,
          packageJsonPath,
          configDir: '.storybook',
          mainConfig: {
            ...mainJsMock,
            framework: {
              name: '/Users/foo/my-project/.yarn/__virtual__/@storybook-react-vite-virtual-769c990b9/0/cache/@storybook-react-rust-npm-7.1.0-alpha.38-512b-a23.zip/node_modules/storybook-react-rust',
            },
          },
        });

        expect(unixResult.framework).toEqual({
          name: 'storybook-react-rust',
        });

        const windowsResult = await computeStorybookMetadata({
          packageJson: packageJsonMock,
          packageJsonPath,
          configDir: '.storybook',
          mainConfig: {
            ...mainJsMock,
            framework: {
              name: 'C:\\Users\\foo\\my-project\\.yarn\\__virtual__\\@storybook-react-vite-virtual-769c990b9\\0\\cache\\@storybook-react-rust-npm-7.1.0-alpha.38-512b-a23.zip\\node_modules\\storybook-react-rust',
            },
          },
        });

        expect(windowsResult.framework).toEqual({
          name: 'storybook-react-rust',
        });
      });

      it('should sanitize pnp paths for local frameworks', async () => {
        // @ts-expect-error the property is read only but we can change it for testing purposes
        path.sep = '/';
        cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/Users/foo/my-projects');

        const unixResult = await computeStorybookMetadata({
          packageJson: packageJsonMock,
          packageJsonPath,
          configDir: '.storybook',
          mainConfig: {
            ...mainJsMock,
            framework: {
              name: '/Users/foo/my-projects/.storybook/some-local-framework',
            },
          },
        });

        expect(unixResult.framework).toEqual({
          name: '$SNIP/.storybook/some-local-framework',
        });

        // @ts-expect-error the property is read only but we can change it for testing purposes
        path.sep = '\\';
        cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('C:\\Users\\foo\\my-project');
        const windowsResult = await computeStorybookMetadata({
          packageJson: packageJsonMock,
          packageJsonPath,
          configDir: '.storybook',
          mainConfig: {
            ...mainJsMock,
            framework: {
              name: 'C:\\Users\\foo\\my-project\\.storybook\\some-local-framework',
            },
          },
        });

        expect(windowsResult.framework).toEqual({
          name: '$SNIP\\.storybook\\some-local-framework',
        });
      });
    });

    it('should return frameworkOptions from mainjs', async () => {
      const reactResult = await computeStorybookMetadata({
        packageJson: packageJsonMock,
        packageJsonPath,
        configDir: '.storybook',
        mainConfig: {
          ...mainJsMock,
          framework: {
            name: '@storybook/react-vite',
            options: {
              strictMode: false,
            },
          },
        },
      });

      expect(reactResult.framework).toEqual({
        name: '@storybook/react-vite',
        options: { strictMode: false },
      });

      const angularResult = await computeStorybookMetadata({
        packageJson: packageJsonMock,
        packageJsonPath,
        configDir: '.storybook',
        mainConfig: {
          ...mainJsMock,
          framework: {
            name: '@storybook/angular',
            options: {
              enableIvy: true,
              enableNgcc: true,
            },
          },
        },
      });

      expect(angularResult.framework).toEqual({
        name: '@storybook/angular',
        options: { enableIvy: true, enableNgcc: true },
      });
    });

    it('should separate storybook packages and addons', async () => {
      const result = await computeStorybookMetadata({
        packageJson: {
          ...packageJsonMock,
          devDependencies: {
            '@storybook/react': 'x.y.z',
            '@storybook/addon-essentials': 'x.x.x',
            '@storybook/addon-knobs': 'x.x.y',
            'storybook-addon-deprecated': 'x.x.z',
          },
        } as PackageJson,
        configDir: '.storybook',
        packageJsonPath,
        mainConfig: {
          ...mainJsMock,
          addons: [
            '@storybook/addon-essentials',
            'storybook-addon-deprecated/register',
            '@storybook/addon-knobs/preset',
          ],
        },
      });

      expect(result.addons).toMatchInlineSnapshot(`
        {
          "@storybook/addon-essentials": {
            "options": undefined,
            "version": "x.x.x",
          },
          "@storybook/addon-knobs": {
            "options": undefined,
            "version": "x.x.x",
          },
          "storybook-addon-deprecated": {
            "options": undefined,
            "version": "x.x.x",
          },
        }
      `);
      expect(result.storybookPackages).toMatchInlineSnapshot(`
        {
          "@storybook/react": {
            "version": "x.x.x",
          },
        }
      `);
    });

    it('should return user specified features', async () => {
      const features = {};

      const result = await computeStorybookMetadata({
        packageJson: packageJsonMock,
        packageJsonPath,
        configDir: '.storybook',
        mainConfig: {
          ...mainJsMock,
          features,
        },
      });

      expect(result.features).toEqual(features);
    });

    it('should infer builder and renderer from framework package.json', async () => {
      expect(
        await computeStorybookMetadata({
          packageJson: packageJsonMock,
          packageJsonPath,
          configDir: '.storybook',
          mainConfig: {
            ...mainJsMock,
            framework: '@storybook/react-vite',
          },
        })
      ).toMatchObject({
        framework: { name: '@storybook/react-vite' },
        renderer: '@storybook/react',
        builder: '@storybook/builder-vite',
      });
    });

    it('should return the number of refs', async () => {
      const res = await computeStorybookMetadata({
        packageJson: packageJsonMock,
        packageJsonPath,
        configDir: '.storybook',
        mainConfig: {
          ...mainJsMock,
          refs: {
            a: { title: '', url: '' },
            b: { title: '', url: '' },
          },
        },
      });
      expect(res.refCount).toEqual(2);
    });

    it('only reports addon options for addon-essentials', async () => {
      const res = await computeStorybookMetadata({
        packageJson: packageJsonMock,
        packageJsonPath,
        configDir: '.storybook',
        mainConfig: {
          ...mainJsMock,
          addons: [
            { name: '@storybook/addon-essentials', options: { controls: false } },
            { name: 'addon-foo', options: { foo: 'bar' } },
          ],
        },
      });
      expect(res.addons).toMatchInlineSnapshot(`
        {
          "@storybook/addon-essentials": {
            "options": {
              "controls": false,
            },
            "version": "x.x.x",
          },
          "addon-foo": {
            "options": undefined,
            "version": "x.x.x",
          },
        }
      `);
    });

    it.each(Object.entries(metaFrameworks))(
      'should detect the supported metaframework: %s',
      async (metaFramework, name) => {
        const res = await computeStorybookMetadata({
          configDir: '.storybook',
          packageJson: {
            ...packageJsonMock,
            dependencies: {
              [metaFramework]: 'x.x.x',
            },
          } as PackageJson,
          packageJsonPath,
          mainConfig: mainJsMock,
        });
        expect(res.metaFramework).toEqual({
          name,
          packageName: metaFramework,
          version: 'x.x.x',
        });
      }
    );

    it('should detect userSince info', async () => {
      vi.mocked(isCI).mockImplementation(() => false);
      vi.mocked(globalSettings).mockResolvedValue({
        value: {
          userSince: 1717334400000,
        },
      } as Settings);

      const res = await computeStorybookMetadata({
        configDir: '.storybook',
        packageJson: packageJsonMock,
        packageJsonPath,
        mainConfig: mainJsMock,
      });

      expect(globalSettings).toHaveBeenCalled();

      expect(res.userSince).toEqual(1717334400000);
    });

    it('should not detect userSince info in CI', async () => {
      vi.mocked(isCI).mockImplementation(() => true);
      vi.mocked(globalSettings).mockResolvedValue({} as Settings);

      const res = await computeStorybookMetadata({
        configDir: '.storybook',
        packageJson: packageJsonMock,
        packageJsonPath,
        mainConfig: mainJsMock,
      });

      expect(globalSettings).not.toHaveBeenCalled();
      expect(res.userSince).not.toBeDefined();
    });
  });
});
