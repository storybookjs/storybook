import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import { vue3 } from './vue3';

const checkVue3 = async ({
  main: mainConfig = {},
  storybookVersion = '7.0.0',
  packageManager,
}: {
  main?: Partial<StorybookConfig> & Record<string, unknown>;
  mainConfig?: Partial<StorybookConfig>;
  storybookVersion?: string;
  packageManager?: Partial<JsPackageManager>;
}) => {
  return vue3.check({
    packageManager: packageManager as any,
    storybookVersion,
    mainConfig: mainConfig as any,
  });
};

describe('vue3 fix', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sb < 6.3', () => {
    describe('no vue dependency', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/vue':
              return Promise.resolve('6.2.0');
            default:
              return null;
          }
        },
      } as Partial<JsPackageManager>;
      it('should no-op', async () => {
        await expect(
          checkVue3({
            packageManager,
            storybookVersion: '6.2.0',
          })
        ).resolves.toBeFalsy();
      });
    });
  });
  describe('sb 6.3 - 7.0', () => {
    describe('vue3 dependency', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/vue':
              return Promise.resolve('6.3.0');
            case 'vue':
              return Promise.resolve('3.0.0');
            default:
              return null;
          }
        },
      } as Partial<JsPackageManager>;

      describe('webpack5 builder', () => {
        it('should no-op', async () => {
          await expect(
            checkVue3({
              packageManager,
              main: { core: { builder: 'webpack5' } },
            })
          ).resolves.toBeFalsy();
        });
      });
      describe('custom builder', () => {
        it('should no-op', async () => {
          await expect(
            checkVue3({
              packageManager,
              main: { core: { builder: 'storybook-builder-vite' } },
            })
          ).resolves.toBeFalsy();
        });
      });
      describe('webpack4 builder', () => {
        it('should add webpack5 builder', async () => {
          await expect(
            checkVue3({
              packageManager,
              main: { core: { builder: 'webpack4' } },
              storybookVersion: '6.3.0',
            })
          ).resolves.toMatchObject({
            vueVersion: '3.0.0',
            storybookVersion: '6.3.0',
          });
        });
      });
      describe('no builder', () => {
        it('should add webpack5 builder', async () => {
          await expect(
            checkVue3({
              packageManager,
              main: {},
              storybookVersion: '6.3.0',
            })
          ).resolves.toMatchObject({
            vueVersion: '3.0.0',
            storybookVersion: '6.3.0',
          });
        });
      });
    });
    describe('no vue dependency', () => {
      it('should no-op', async () => {
        // @ts-expect-error (Type 'null' is not comparable)
        const packageManager = {
          getPackageVersion: (packageName) => {
            return null;
          },
        } as Partial<JsPackageManager>;

        await expect(
          checkVue3({
            packageManager,
            main: {},
          })
        ).resolves.toBeFalsy();
      });
    });
    describe('vue2 dependency', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          if (packageName === 'vue') {
            return Promise.resolve('2.0.0');
          }
          return null;
        },
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkVue3({
            packageManager,
            main: {},
          })
        ).resolves.toBeFalsy();
      });
    });
  });
  describe('sb 7.0+', () => {
    describe('vue3 dependency', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/vue':
              return Promise.resolve('7.0.0-alpha.0');
            case 'vue':
              return Promise.resolve('3.0.0');
            default:
              return null;
          }
        },
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkVue3({
            packageManager,
            main: {},
          })
        ).resolves.toBeFalsy();
      });
    });
  });
});
