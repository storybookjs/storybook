import path from 'node:path';

import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PackageJson, StorybookConfig } from '@storybook/core/types';

import { computeStorybookMetadata, metaFrameworks, sanitizeAddonName } from './storybook-metadata';

const packageJsonMock: PackageJson = {
  name: 'some-user-project',
  version: 'x.x.x',
};

const mainJsMock: StorybookConfig = {
  stories: [],
};

vi.mock('./package-json', () => {
  const getActualPackageVersion = vi.fn((name) =>
    Promise.resolve({
      name,
      version: 'x.x.x',
    })
  );

  const getActualPackageVersions = vi.fn((packages) =>
    Promise.all(Object.keys(packages).map(getActualPackageVersion))
  );

  const getActualPackageJson = vi.fn(() => ({
    dependencies: {
      '@storybook/react': 'x.x.x',
      '@storybook/builder-vite': 'x.x.x',
    },
  }));

  return {
    getActualPackageVersions,
    getActualPackageVersion,
    getActualPackageJson,
  };
});

vi.mock('./get-monorepo-type', () => ({
  getMonorepoType: () => 'Nx',
}));

vi.mock('detect-package-manager', () => ({
  detect: () => 'Yarn',
  getNpmVersion: () => '3.1.1',
}));

vi.mock('@storybook/core/common', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('@storybook/core/common')>()),
    getProjectRoot: () => process.cwd(),
  };
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
          packageJson: {
            ...packageJsonMock,
            dependencies: {
              [metaFramework]: 'x.x.x',
            },
          } as PackageJson,
          mainConfig: mainJsMock,
        });
        expect(res.metaFramework).toEqual({
          name,
          packageName: metaFramework,
          version: 'x.x.x',
        });
      }
    );
  });
});
