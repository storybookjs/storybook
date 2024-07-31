import { describe, afterEach, it, expect, vi } from 'vitest';
import type { StorybookConfigRaw } from '@storybook/core/types';
import type { JsPackageManager } from '@storybook/core/common';
import { cra5 } from './cra5';

const checkCra5 = async ({
  packageManager,
  main: mainConfig,
  storybookVersion = '7.0.0',
}: {
  packageManager: any;
  main?: Partial<StorybookConfigRaw> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  return cra5.check({
    packageManager,
    mainConfig: mainConfig as StorybookConfigRaw,
    storybookVersion,
  });
};

describe('cra5 fix', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sb < 6.3', () => {
    describe('cra5 dependency', () => {
      const packageManager = {
        getPackageVersion: vi.fn().mockResolvedValue('5.0.0'),
      } as Partial<JsPackageManager>;

      it('should fail', async () => {
        await expect(
          checkCra5({
            packageManager,
            storybookVersion: '6.2.0',
          })
        ).rejects.toThrow();
      });
    });
    describe('no cra5 dependency', () => {
      const packageManager = {
        getPackageVersion: vi.fn().mockResolvedValue(null),
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkCra5({
            packageManager,
            main: {},
          })
        ).resolves.toBeFalsy();
      });
    });
  });
  describe('sb 6.3 - 7.0', () => {
    describe('cra5 dependency', () => {
      const packageManager = {
        getPackageVersion: () => {
          return Promise.resolve('5.0.0');
        },
      } as Partial<JsPackageManager>;

      describe('webpack5 builder', () => {
        it('should no-op', async () => {
          await expect(
            checkCra5({
              packageManager,
              main: { core: { builder: 'webpack5' } },
            })
          ).resolves.toBeFalsy();
        });
      });
      describe('custom builder', () => {
        it('should no-op', async () => {
          await expect(
            checkCra5({
              packageManager,
              main: { core: { builder: 'storybook-builder-vite' } },
            })
          ).resolves.toBeFalsy();
        });
      });
      describe('webpack4 builder', () => {
        it('should add webpack5 builder', async () => {
          await expect(
            checkCra5({
              packageManager,
              main: { core: { builder: 'webpack4' } },
              storybookVersion: '6.3.0',
            })
          ).resolves.toMatchObject({
            craVersion: '5.0.0',
            storybookVersion: '6.3.0',
          });
        });
      });
      describe('no builder', () => {
        it('should add webpack5 builder', async () => {
          await expect(
            checkCra5({
              packageManager,
              main: {},
              storybookVersion: '6.3.0',
            })
          ).resolves.toMatchObject({
            craVersion: '5.0.0',
            storybookVersion: '6.3.0',
          });
        });
      });
    });
    describe('no cra dependency', () => {
      // @ts-expect-error (Type 'null' is not comparable)
      const packageManager = {
        getPackageVersion: () => {
          return null;
        },
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkCra5({
            packageManager,
            main: {},
          })
        ).resolves.toBeFalsy();
      });
    });
    describe('cra4 dependency', () => {
      const packageManager = {
        getPackageVersion: () => {
          return Promise.resolve('4.0.0');
        },
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkCra5({
            packageManager,
            main: {},
          })
        ).resolves.toBeFalsy();
      });
    });
  });
  describe('sb 7.0+', () => {
    describe('cra5 dependency', () => {
      const packageManager = {
        getPackageVersion: () => {
          return Promise.resolve('5.0.0');
        },
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkCra5({
            packageManager,
            main: {},
          })
        ).resolves.toBeFalsy();
      });
    });
  });
});
