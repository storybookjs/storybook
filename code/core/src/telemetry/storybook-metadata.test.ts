import path from 'node:path';

import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getStorybookInfo, isCI } from 'storybook/internal/common';
import {
  type PackageJson,
  type StorybookConfig,
  SupportedBuilder,
  SupportedFramework,
  SupportedRenderer,
} from 'storybook/internal/types';

import { detect } from 'package-manager-detector';

import { type Settings, globalSettings } from '../cli/globalSettings';
import { getApplicationFileCount } from '../telemetry/get-application-file-count';
import { analyzeEcosystemPackages } from '../telemetry/get-known-packages';
import { getMonorepoType } from '../telemetry/get-monorepo-type';
import { getPackageManagerInfo } from '../telemetry/get-package-manager-info';
import { getPortableStoriesFileCount } from '../telemetry/get-portable-stories-usage';
import {
  getActualPackageJson,
  getActualPackageVersion,
  getActualPackageVersions,
} from './package-json';
import { computeStorybookMetadata, metaFrameworks, sanitizeAddonName } from './storybook-metadata';

vi.mock(import('../cli/globalSettings'), { spy: true });
vi.mock(import('./package-json'), { spy: true });
vi.mock(import('./get-monorepo-type'), { spy: true });
vi.mock(import('./get-framework-info'), { spy: true });
vi.mock(import('./get-package-manager-info'), { spy: true });
vi.mock(import('./get-portable-stories-usage'), { spy: true });
vi.mock(import('./get-application-file-count'), { spy: true });
vi.mock(import('./get-known-packages'), { spy: true });
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

const defaultInfo = {
  framework: SupportedFramework.REACT_VITE,
  renderer: SupportedRenderer.REACT,
  builder: SupportedBuilder.VITE,
  frameworkPackage: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  builderPackage: '@storybook/builder-vite',
  addons: [],
  mainConfig: {
    stories: [],
  },
  mainConfigPath: '',
  previewConfigPath: '',
  managerConfigPath: '',
  version: 'x.x.x',
};

beforeEach(() => {
  vi.mocked(getStorybookInfo).mockImplementation(async () => defaultInfo);

  vi.mocked(detect).mockImplementation(async () => ({
    name: 'yarn',
    version: '3.1.1',
    agent: 'yarn@berry',
  }));

  vi.mocked(getMonorepoType).mockImplementation(() => 'Nx');

  vi.mocked(getPackageManagerInfo).mockImplementation(async () => ({
    type: 'yarn',
    version: '3.1.1',
    agent: 'yarn@berry',
    nodeLinker: 'node_modules',
  }));

  vi.mocked(getPortableStoriesFileCount).mockImplementation(async () => 5);

  vi.mocked(getApplicationFileCount).mockImplementation(async () => 10);

  vi.mocked(analyzeEcosystemPackages).mockImplementation(async () => ({
    testPackages: { jest: 'x.x.x' },
    stylingPackages: { tailwindcss: '3.0.0' },
    routerPackages: { 'react-router-dom': '^6.0.0' },
    stateManagementPackages: { redux: '4.0.0' },
    dataFetchingPackages: { axios: '>=1.0.0' },
    uiLibraryPackages: { '@mui/material': '5.0.0' },
    i18nPackages: { i18next: '22.0.0' },
  }));

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
        'CUSTOM:local-addon',
        'CUSTOM:..',
      ]);
    });

    it('Windows paths', () => {
      // @ts-expect-error the property is read only but we can change it for testing purposes
      path.sep = '\\';
      const cwdMockPath = `C:\\Users\\username\\storybook-app`;
      cwdSpy = vi.spyOn(process, `cwd`).mockReturnValueOnce(cwdMockPath);

      expect(sanitizeAddonName(`${cwdMockPath}\\local-addon\\themes.js`)).toEqual(
        'CUSTOM:local-addon'
      );
    });

    it('Linux paths', () => {
      // @ts-expect-error the property is read only but we can change it for testing purposes
      path.sep = '/';
      const cwdMockPath = `/Users/username/storybook-app`;
      cwdSpy = vi.spyOn(process, `cwd`).mockReturnValue(cwdMockPath);

      expect(sanitizeAddonName(`${cwdMockPath}/local-addon/themes.js`)).toEqual(
        'CUSTOM:local-addon'
      );
    });

    describe('normalizes path-like addon definitions', () => {
      it('node_modules and package-manager cache or pnp like paths', () => {
        const snippedAddonNames = [
          '$SNIP/node_modules/@storybook/addon-docs',
          '$SNIP\\node_modules\\@storybook\\addon-docs',
          '$SNIP/node_modules/.pnpm/@storybook+addon-a11y@10.0.8_storybook@10.0.8_@testing-library+dom@10.4.0_prettier@3.7._4a81ac32f3a0cc0e4b95fdb0fa907a4f/node_modules/@storybook/addon-a11y',
          '$SNIP\\node_modules\\.pnpm\\@storybook+addon-onboarding_2f3ab626f8b157d8b10cc93b0c4f7171\\node_modules\\@storybook\\addon-onboarding',
          '$SNIP/common/temp/node_modules/.pnpm/@storybook+addon-essentials@8.5.8_storybook@8.5.8/node_modules/@storybook/addon-essentials',
          '$SNIP/.yarn/__virtual__/@storybook-addon-jest-virtual-ceb31c55cc/0/cache/@storybook-addon-jest-npm-9.1.12-adf55af7e8-904699d820.zip/node_modules/@storybook/addon-jest',
          '$SNIP\\.yarn\\__virtual__\\@storybook-addon-actions-virtual-ecf55a46d7\\4\\Users\\Foo\\AppData\\Local\\Yarn\\Berry\\cache\\@storybook-addon-actions-npm-8.6.7-0b3fcdd2b2-10.zip\\node_modules\\@storybook\\addon-actions',
          '$SNIP/.yarn/cache/@storybook-addon-webpack5-compiler-babel-npm-4.0.0-7fea55bdc6-abe15a1cd3.zip/node_modules/@storybook/addon-webpack5-compiler-babel',
        ].map(sanitizeAddonName);

        expect(snippedAddonNames).toEqual([
          '@storybook/addon-docs',
          '@storybook/addon-docs',
          '@storybook/addon-a11y',
          '@storybook/addon-onboarding',
          '@storybook/addon-essentials',
          '@storybook/addon-jest',
          '@storybook/addon-actions',
          '@storybook/addon-webpack5-compiler-babel',
        ]);

        const filePathAddonNames = [
          '/tmp/yarn_node_modules/7/1fb08592505aa9425e2d6d3ffdc05d84087e575a/yarn_install_node_modules/js/packages/config-storybook/node_modules/@storybook/addon-links/dist/cjs/index.js',
          '/node_modules/@chromatic-com/storybook',
          '../../../@storybook/addon-links',
          '/C:/Users/foo/OneDrive%20-%20BAR%20BAZ/Desktop/project/node_modules/@storybook/addon-coverage',
          'C:\\Users\\Foo\\AppData\\Local\\Yarn\\Berry\\cache\\@storybook-addon-measure-npm-7.6.21-61d2a610cb-10.zip\\node_modules\\@storybook\\addon-measure',
          '/home/foo/project/node_modules/.pnpm/@storybook+addon-docs@10.0.2_@types+react@19.2.2_esbuild@0.25.10_rollup@4.31.0_storyboo_7cb8a1f4d4ca81d0abdb0f0cfacb0423/node_modules/@storybook/addon-docs',
          '/home/foo/.yarn/berry/cache/@storybook-addon-interactions-npm-7.6.1-9e0ac1ff40-10.zip/node_modules/@storybook/addon-interactions',
          '/Users/foo/project/node_modules/@storybook/addon-links/dist/cjs/index.js',
        ].map(sanitizeAddonName);

        expect(filePathAddonNames).toEqual([
          '@storybook/addon-links',
          '@chromatic-com/storybook',
          '@storybook/addon-links',
          '@storybook/addon-coverage',
          '@storybook/addon-measure',
          '@storybook/addon-docs',
          '@storybook/addon-interactions',
          '@storybook/addon-links',
        ]);
      });

      it('custom, local, or non-node_modules paths', () => {
        const addonNames = [
          'file://$SNIP/.storybook/redesign-addon',
          '$SNIP/addons/airtracker',
          '$SNIP/preset/index',
          '$SNIP/src',
          '../../../tools/storybook/src/plugins/storybook-translations',
          './html-addon',
          '..',
          'file:///D:/foo/templates/.storybook/addons/some-addon',
        ].map(sanitizeAddonName);

        expect(addonNames).toEqual([
          'CUSTOM:redesign-addon',
          'CUSTOM:airtracker',
          'CUSTOM:preset',
          'CUSTOM:src',
          'CUSTOM:storybook-translations',
          'CUSTOM:html-addon',
          'CUSTOM:..',
          'CUSTOM:some-addon',
        ]);
      });
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
        vi.mocked(getStorybookInfo).mockImplementation(async () => ({
          ...defaultInfo,
          frameworkPackage:
            '/Users/foo/my-project/.yarn/__virtual__/@storybook-react-vite-virtual-769c990b9/0/cache/@storybook-react-rust-npm-7.1.0-alpha.38-512b-a23.zip/node_modules/storybook-react-rust' as any,
        }));

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

        vi.mocked(getStorybookInfo).mockImplementation(async () => ({
          ...defaultInfo,
          frameworkPackage: '/Users/foo/my-projects/.storybook/some-local-framework' as any,
        }));

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
      });

      it('should sanitize pnp paths for local frameworks on Windows', async () => {
        // @ts-expect-error the property is read only but we can change it for testing purposes
        path.sep = '\\';
        cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('C:\\Users\\foo\\my-project');

        vi.mocked(getStorybookInfo).mockImplementation(async () => ({
          ...defaultInfo,
          frameworkPackage: 'C:\\Users\\foo\\my-project\\.storybook\\some-local-framework' as any,
        }));

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

    it('should include knownPackages in metadata', async () => {
      const res = await computeStorybookMetadata({
        configDir: '.storybook',
        packageJson: {
          ...packageJsonMock,
          dependencies: {
            jest: '29.0.0',
            'react-router-dom': '^6.0.0',
            tailwindcss: '3.0.0',
            redux: '4.0.0',
            axios: '>=1.0.0',
            '@mui/material': '5.0.0',
            i18next: '22.0.0',
          },
        } as PackageJson,
        packageJsonPath,
        mainConfig: mainJsMock,
      });

      expect(res.knownPackages).toMatchInlineSnapshot(`
        {
          "dataFetchingPackages": {
            "axios": ">=1.0.0",
          },
          "i18nPackages": {
            "i18next": "22.0.0",
          },
          "routerPackages": {
            "react-router-dom": "^6.0.0",
          },
          "stateManagementPackages": {
            "redux": "4.0.0",
          },
          "stylingPackages": {
            "tailwindcss": "3.0.0",
          },
          "testPackages": {
            "jest": "x.x.x",
          },
          "uiLibraryPackages": {
            "@mui/material": "5.0.0",
          },
        }
      `);
    });
  });
});
