import { describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import * as findUp from 'find-up';

import {
  detectBuilderInfo as _getBuilderInfo,
  getNextjsAddonOptions,
} from './new-frameworks-utils';

vi.mock('find-up');

type GetBuilderInfoParams = Parameters<typeof _getBuilderInfo>[0]['mainConfig'];

const getBuilderInfo = async ({
  mainConfig = {},
  packageManager = {},
  configDir = '.storybook',
}: {
  mainConfig?: Partial<GetBuilderInfoParams>;
  packageManager?: Partial<JsPackageManager>;
  configDir?: string;
}) => {
  return _getBuilderInfo({
    mainConfig: mainConfig as any,
    configDir,
    packageManager: packageManager as any,
  });
};

describe('getBuilderInfo', () => {
  it('should infer webpack5 info from builder', async () => {
    await expect(
      getBuilderInfo({
        mainConfig: {
          core: {
            builder: '@storybook/builder-webpack5',
          },
        },
      })
    ).resolves.toEqual({ name: 'webpack5', options: {} });

    await expect(
      getBuilderInfo({
        mainConfig: {
          core: {
            builder: {
              name: '@storybook/builder-webpack5',
              options: { lazyCompilation: true },
            },
          },
        },
      })
    ).resolves.toEqual({
      name: 'webpack5',
      options: { lazyCompilation: true },
    });
  });

  it('should infer webpack5 info from framework', async () => {
    await expect(
      getBuilderInfo({
        packageManager: {
          getPackageVersion: (packageName) => {
            if (packageName === '@storybook/react-webpack5') {
              return Promise.resolve('1.0.0');
            }

            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: '@storybook/react-webpack5',
        },
      })
    ).resolves.toEqual({ name: 'webpack5', options: {} });

    await expect(
      getBuilderInfo({
        mainConfig: {
          framework: {
            name: '@storybook/react-webpack5',
            options: {
              builder: {
                lazyCompilation: true,
              },
            },
          },
        },
      })
    ).resolves.toEqual({
      name: 'webpack5',
      options: { lazyCompilation: true },
    });
  });

  it('should infer vite info from builder', async () => {
    await expect(
      getBuilderInfo({
        mainConfig: {
          core: { builder: '@storybook/builder-vite' },
        },
      })
    ).resolves.toEqual({ name: 'vite', options: {} });

    await expect(
      getBuilderInfo({
        mainConfig: {
          core: {
            builder: {
              name: '@storybook/builder-vite',
              options: { foo: 'bar' },
            },
          },
        },
      })
    ).resolves.toEqual({
      name: 'vite',
      options: { foo: 'bar' },
    });
  });

  it('should infer vite info from framework', async () => {
    await expect(
      getBuilderInfo({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
      })
    ).resolves.toEqual({ name: 'vite', options: {} });

    await expect(
      getBuilderInfo({
        mainConfig: {
          framework: {
            name: '@storybook/react-vite',
            options: { builder: { foo: 'bar' } },
          },
        },
      })
    ).resolves.toEqual({
      name: 'vite',
      options: { foo: 'bar' },
    });
  });

  it('should infer vite info from known community frameworks', async () => {
    await expect(
      getBuilderInfo({
        mainConfig: {
          framework: 'storybook-framework-qwik',
        },
      })
    ).resolves.toEqual({ name: 'vite', options: {} });

    await expect(
      getBuilderInfo({
        mainConfig: {
          framework: {
            name: 'storybook-solidjs-vite',
            options: { builder: { foo: 'bar' } },
          },
        },
      })
    ).resolves.toEqual({
      name: 'vite',
      options: { foo: 'bar' },
    });
  });

  it('when main.js has legacy renderer as framework, it should infer vite info from vite config file', async () => {
    const findUpSpy = vi
      .spyOn(findUp, 'default')
      .mockReturnValueOnce(Promise.resolve('vite.config.js'));
    await expect(getBuilderInfo({ mainConfig: { framework: 'react' } })).resolves.toEqual({
      name: 'vite',
      options: {},
    });
    expect(findUpSpy).toHaveBeenCalledTimes(1);
  });

  it('when main.js has legacy renderer as framework, it should infer webpack info from webpack config file', async () => {
    const findUpSpy = vi
      .spyOn(findUp, 'default')
      .mockReturnValueOnce(Promise.resolve(undefined))
      .mockReturnValueOnce(Promise.resolve('webpack.config.js'));
    await expect(getBuilderInfo({ mainConfig: { framework: 'react' } })).resolves.toEqual({
      name: 'webpack5',
      options: {},
    });
    expect(findUpSpy).toHaveBeenCalledTimes(2);
  });

  it('when main.js has no builder or framework, it should infer vite info from vite config file', async () => {
    const findUpSpy = vi
      .spyOn(findUp, 'default')
      .mockReturnValueOnce(Promise.resolve('vite.config.js'));
    await expect(getBuilderInfo({ mainConfig: {} })).resolves.toEqual({
      name: 'vite',
      options: {},
    });
    expect(findUpSpy).toHaveBeenCalledTimes(1);
  });

  it('when main.js has no builder or framework, it should infer webpack info from webpack config file', async () => {
    const findUpSpy = vi
      .spyOn(findUp, 'default')
      .mockReturnValueOnce(Promise.resolve(undefined))
      .mockReturnValueOnce(Promise.resolve('webpack.config.js'));
    await expect(getBuilderInfo({ mainConfig: {} })).resolves.toEqual({
      name: 'webpack5',
      options: {},
    });
    expect(findUpSpy).toHaveBeenCalledTimes(2);
  });

  it('when main.js has no builder or framework, and there is no vite or webpack config, infer vite from dependencies', async () => {
    const findUpSpy = vi.spyOn(findUp, 'default').mockReturnValue(Promise.resolve(undefined));
    await expect(
      getBuilderInfo({
        mainConfig: {},
        packageManager: {
          getPackageVersion: (packageName) => {
            if (packageName === '@storybook/builder-vite') {
              return Promise.resolve('7.0.0');
            }
            return Promise.resolve(null);
          },
        },
      })
    ).resolves.toEqual({
      name: 'vite',
      options: {},
    });
    expect(findUpSpy).toHaveBeenCalledTimes(2);
  });

  it('when main.js has no builder or framework, and there is no vite or webpack config, infer webpack from dependencies', async () => {
    const findUpSpy = vi.spyOn(findUp, 'default').mockReturnValue(Promise.resolve(undefined));
    await expect(
      getBuilderInfo({
        mainConfig: {},
        packageManager: {
          getPackageVersion: (packageName) => {
            if (packageName === '@storybook/builder-webpack5') {
              return Promise.resolve('7.0.0');
            }
            return Promise.resolve(null);
          },
        },
      })
    ).resolves.toEqual({
      name: 'webpack5',
      options: {},
    });
    expect(findUpSpy).toHaveBeenCalledTimes(2);
  });
});

describe('getNextjsAddonOptions', () => {
  it('should find storybook-addon-next and extract its options', () => {
    expect(getNextjsAddonOptions(['foo', 'bar'])).toEqual({});
    expect(getNextjsAddonOptions(['foo', 'storybook-addon-next'])).toEqual({});
    expect(getNextjsAddonOptions(['foo', { name: 'storybook-addon-next' }])).toEqual({});
    expect(getNextjsAddonOptions(['foo', { name: 'storybook-addon-next', options: {} }])).toEqual(
      {}
    );
    expect(
      getNextjsAddonOptions([
        'foo',
        {
          name: 'storybook-addon-next',
          options: {
            nextConfigPath: 'foo/bar',
          },
        },
      ])
    ).toEqual({ nextConfigPath: 'foo/bar' });
  });
});
