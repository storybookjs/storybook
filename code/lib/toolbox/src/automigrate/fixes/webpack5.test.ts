import { describe, afterEach, it, expect, vi } from 'vitest';
import type { StorybookConfig } from '@storybook/core/types';
import type { JsPackageManager } from '@storybook/core/common';
import { webpack5 } from './webpack5';

const checkWebpack5 = async ({
  packageManager,
  main: mainConfig,
  storybookVersion = '6.3.0',
}: {
  packageManager: Partial<JsPackageManager>;
  main?: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
  mainConfig?: Partial<StorybookConfig>;
}) => {
  return webpack5.check({
    packageManager: packageManager as any,
    configDir: '',
    storybookVersion,
    mainConfig: mainConfig as any,
  });
};

describe('webpack5 fix', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sb < 6.3', () => {
    describe('webpack5 dependency', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/react':
              return Promise.resolve('6.2.0');
            case 'webpack':
              return Promise.resolve('5.0.0');
            default:
              return null;
          }
        },
      } as Partial<JsPackageManager>;

      it('should fail', async () => {
        await expect(
          checkWebpack5({
            packageManager,
            storybookVersion: '6.2.0',
          })
        ).rejects.toThrow();
      });
    });
    describe('no webpack5 dependency', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/react':
              return Promise.resolve('6.2.0');
            default:
              return null;
          }
        },
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkWebpack5({
            packageManager,
            storybookVersion: '6.2.0',
          })
        ).resolves.toBeFalsy();
      });
    });
  });
  describe('sb 6.3 - 7.0', () => {
    describe('webpack5 dependency', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/react':
              return Promise.resolve('6.3.0');
            case 'webpack':
              return Promise.resolve('5.0.0');
            default:
              return null;
          }
        },
      } as Partial<JsPackageManager>;

      describe('webpack5 builder', () => {
        it('should no-op', async () => {
          await expect(
            checkWebpack5({
              packageManager,
              main: { core: { builder: 'webpack5' } },
            })
          ).resolves.toBeFalsy();
        });
      });
      describe('custom builder', () => {
        it('should no-op', async () => {
          await expect(
            checkWebpack5({
              packageManager,
              main: { core: { builder: 'storybook-builder-vite' } },
            })
          ).resolves.toBeFalsy();
        });
      });
      describe('webpack4 builder', () => {
        it('should add webpack5 builder', async () => {
          await expect(
            checkWebpack5({
              packageManager,
              main: { core: { builder: 'webpack4' } },
            })
          ).resolves.toMatchObject({
            webpackVersion: '5.0.0',
            storybookVersion: '6.3.0',
          });
        });
      });
      describe('no builder', () => {
        it('should add webpack5 builder', async () => {
          await expect(
            checkWebpack5({
              packageManager,
              main: {},
            })
          ).resolves.toMatchObject({
            webpackVersion: '5.0.0',
            storybookVersion: '6.3.0',
          });
        });
      });
    });
    describe('no webpack dependency', () => {
      // @ts-expect-error (Type 'null' is not comparable)
      const packageManager = {
        getPackageVersion: () => {
          return null;
        },
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkWebpack5({
            packageManager,
          })
        ).resolves.toBeFalsy();
      });
    });
    describe('webpack4 dependency', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case 'webpack':
              return Promise.resolve('4.0.0');
            default:
              return null;
          }
        },
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkWebpack5({
            packageManager,
          })
        ).resolves.toBeFalsy();
      });
    });
  });
  describe('sb 7.0+', () => {
    describe('webpack5 dependency', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/react':
              return Promise.resolve('7.0.0-alpha.0');
            case 'webpack':
              return Promise.resolve('5.0.0');
            default:
              return null;
          }
        },
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkWebpack5({
            packageManager,
            main: {},
            storybookVersion: '7.0.0',
          })
        ).resolves.toBeFalsy();
      });
    });
  });
});
