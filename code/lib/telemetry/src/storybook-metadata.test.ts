import type { PackageJson, StorybookConfig } from '@storybook/types';

import path from 'path';
import { computeStorybookMetadata, metaFrameworks, sanitizeAddonName } from './storybook-metadata';

const packageJsonMock: PackageJson = {
  name: 'some-user-project',
  version: 'x.x.x',
};

const mainJsMock: StorybookConfig = {
  stories: [],
};

jest.mock('./package-json', () => {
  const getActualPackageVersion = jest.fn((name) =>
    Promise.resolve({
      name,
      version: 'x.x.x',
    })
  );

  const getActualPackageVersions = jest.fn((packages) =>
    Promise.all(Object.keys(packages).map(getActualPackageVersion))
  );

  const getActualPackageJson = jest.fn((name) => ({
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

jest.mock('./get-monorepo-type', () => ({
  getMonorepoType: () => 'Nx',
}));

jest.mock('detect-package-manager', () => ({
  detect: () => 'Yarn',
  getNpmVersion: () => '3.1.1',
}));

const originalSep = path.sep;

describe('storybook-metadata', () => {
  let cwdSpy: jest.SpyInstance;
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
    test('special addon names', () => {
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

    test('Windows paths', () => {
      // @ts-expect-error the property is read only but we can change it for testing purposes
      path.sep = '\\';
      const cwdMockPath = `C:\\Users\\username\\storybook-app`;
      cwdSpy = jest.spyOn(process, `cwd`).mockReturnValueOnce(cwdMockPath);

      expect(sanitizeAddonName(`${cwdMockPath}\\local-addon\\themes.js`)).toEqual(
        '$SNIP\\local-addon\\themes'
      );
    });

    test('Linux paths', () => {
      // @ts-expect-error the property is read only but we can change it for testing purposes
      path.sep = '/';
      const cwdMockPath = `/Users/username/storybook-app`;
      cwdSpy = jest.spyOn(process, `cwd`).mockReturnValue(cwdMockPath);

      expect(sanitizeAddonName(`${cwdMockPath}/local-addon/themes.js`)).toEqual(
        '$SNIP/local-addon/themes'
      );
    });
  });

  describe('computeStorybookMetadata', () => {
    describe('pnp paths', () => {
      test('should parse pnp paths for known frameworks', async () => {
        const unixResult = await computeStorybookMetadata({
          packageJson: packageJsonMock,
          mainConfig: {
            ...mainJsMock,
            framework: {
              name: '/Users/foo/storybook/.yarn/__virtual__/@storybook-react-vite-virtual-769c990b9/0/cache/@storybook-react-vite-npm-7.1.0-alpha.38-512b-a23.zip/node_modules/@storybook/react-vite',
              options: {
                fastRefresh: false,
              },
            },
          },
        });

        expect(unixResult.framework).toEqual({
          name: '@storybook/react-vite',
          options: { fastRefresh: false },
        });

        const windowsResult = await computeStorybookMetadata({
          packageJson: packageJsonMock,
          mainConfig: {
            ...mainJsMock,
            framework: {
              name: 'C:\\Users\\foo\\storybook\\.yarn\\__virtual__\\@storybook-react-vite-virtual-769c990b9\\0\\cache\\@storybook-react-vite-npm-7.1.0-alpha.38-512b-a23.zip\\node_modules\\@storybook\\react-vite',
              options: {
                fastRefresh: false,
              },
            },
          },
        });

        expect(windowsResult.framework).toEqual({
          name: '@storybook/react-vite',
          options: { fastRefresh: false },
        });
      });

      test('should parse pnp paths for unknown frameworks', async () => {
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

      test('should sanitize pnp paths for local frameworks', async () => {
        // @ts-expect-error the property is read only but we can change it for testing purposes
        path.sep = '/';
        cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/Users/foo/my-projects');

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
        cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('C:\\Users\\foo\\my-project');
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

    test('should return frameworkOptions from mainjs', async () => {
      const reactResult = await computeStorybookMetadata({
        packageJson: packageJsonMock,
        mainConfig: {
          ...mainJsMock,
          framework: {
            name: '@storybook/react-vite',
            options: {
              fastRefresh: false,
            },
          },
        },
      });

      expect(reactResult.framework).toEqual({
        name: '@storybook/react-vite',
        options: { fastRefresh: false },
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

    test('should separate storybook packages and addons', async () => {
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
        Object {
          "@storybook/addon-essentials": Object {
            "options": undefined,
            "version": "x.x.x",
          },
          "@storybook/addon-knobs": Object {
            "options": undefined,
            "version": "x.x.x",
          },
          "storybook-addon-deprecated": Object {
            "options": undefined,
            "version": "x.x.x",
          },
        }
      `);
      expect(result.storybookPackages).toMatchInlineSnapshot(`
        Object {
          "@storybook/react": Object {
            "version": "x.x.x",
          },
        }
      `);
    });

    test('should return user specified features', async () => {
      const features = {
        storyStoreV7: true,
      };

      const result = await computeStorybookMetadata({
        packageJson: packageJsonMock,
        mainConfig: {
          ...mainJsMock,
          features,
        },
      });

      expect(result.features).toEqual(features);
    });

    test('should infer builder and renderer from framework package.json', async () => {
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

    test('should return the number of refs', async () => {
      const res = await computeStorybookMetadata({
        packageJson: packageJsonMock,
        mainConfig: {
          ...mainJsMock,
          refs: {
            a: { id: '', version: '', title: '', url: '' },
            b: { id: '', version: '', title: '', url: '' },
          },
        },
      });
      expect(res.refCount).toEqual(2);
    });

    test('only reports addon options for addon-essentials', async () => {
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
        Object {
          "@storybook/addon-essentials": Object {
            "options": Object {
              "controls": false,
            },
            "version": "x.x.x",
          },
          "addon-foo": Object {
            "options": undefined,
            "version": "x.x.x",
          },
        }
      `);
    });

    test.each(Object.entries(metaFrameworks))(
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
