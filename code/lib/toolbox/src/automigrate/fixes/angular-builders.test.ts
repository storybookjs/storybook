import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { StorybookConfig } from '@storybook/core/types';
import { angularBuilders } from './angular-builders';
import * as helpers from '../../helpers';
import * as angularHelpers from '../../generators/ANGULAR/helpers';
import type { JsPackageManager } from '@storybook/core/common';

const checkAngularBuilders = async ({
  packageManager,
  mainConfig = {},
  storybookVersion = '7.0.0',
}: {
  packageManager: Partial<JsPackageManager>;
  mainConfig?: Partial<StorybookConfig>;
  storybookVersion?: string;
}) => {
  return angularBuilders.check({
    packageManager: packageManager as any,
    storybookVersion,
    mainConfig: mainConfig as any,
  });
};

vi.mock('../../helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../helpers')>()),
  isNxProject: vi.fn(),
}));

vi.mock('../../generators/ANGULAR/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../generators/ANGULAR/helpers')>()),
  AngularJSON: vi.fn(),
}));

describe('is Nx project', () => {
  beforeEach(() => {
    vi.mocked(helpers.isNxProject).mockResolvedValue('true');
  });

  const packageManager = {
    getPackageVersion: vi.fn().mockImplementation((packageName) => {
      if (packageName === '@angular/core') {
        return '12.0.0';
      }

      return null;
    }),
  } as Partial<JsPackageManager>;

  it('should return null', async () => {
    await expect(checkAngularBuilders({ packageManager })).resolves.toBeNull();
  });
});

describe('is not Nx project', () => {
  beforeEach(() => {
    vi.mocked(helpers.isNxProject).mockResolvedValue(undefined);
  });

  describe('angular builders', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('Angular not found', () => {
      const packageManager = {
        getPackageVersion: vi.fn().mockReturnValue(null),
      } as Partial<JsPackageManager>;

      it('should return null', async () => {
        await expect(checkAngularBuilders({ packageManager })).resolves.toBeNull();
      });
    });

    describe('Angular >= 16.0.0', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          if (packageName === '@angular/core') {
            return Promise.resolve('16.0.0');
          }

          return null;
        },
      } as Partial<JsPackageManager>;

      describe('has one Storybook builder defined', () => {
        beforeEach(() => {
          // Mock AngularJSON.constructor
          vi.mocked(angularHelpers.AngularJSON).mockImplementation(
            () =>
              ({
                hasStorybookBuilder: true,
              }) as any
          );
        });

        it('should return null', async () => {
          await expect(
            checkAngularBuilders({
              packageManager,
              mainConfig: { framework: '@storybook/angular' },
            })
          ).resolves.toBeNull();
        });
      });

      describe('has multiple projects without root project defined', () => {
        beforeEach(() => {
          // Mock AngularJSON.constructor
          vi.mocked(angularHelpers.AngularJSON).mockImplementation(
            () =>
              ({
                hasStorybookBuilder: false,
                projects: {
                  project1: { root: 'project1', architect: {} },
                  project2: { root: 'project2', architect: {} },
                },
                rootProject: null,
              }) as any
          );
        });

        it('should return null', async () => {
          await expect(
            checkAngularBuilders({
              packageManager,
              mainConfig: { framework: '@storybook/angular' },
            })
          ).resolves.toBeNull();
        });
      });

      describe('has one project', () => {
        beforeEach(() => {
          // Mock AngularJSON.constructor
          vi.mocked(angularHelpers.AngularJSON).mockImplementation(
            () =>
              ({
                hasStorybookBuilder: false,
                projects: {
                  project1: { root: 'project1', architect: {} },
                },
                rootProject: 'project1',
              }) as any
          );
        });

        it('should proceed and return data', async () => {
          await expect(
            checkAngularBuilders({
              packageManager,
              mainConfig: { framework: '@storybook/angular' },
            })
          ).resolves.toMatchObject({
            mainConfig: {},
            packageManager: {},
          });
        });
      });
    });
  });
});
