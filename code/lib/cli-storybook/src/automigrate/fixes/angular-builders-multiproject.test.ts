import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { StorybookConfig } from 'storybook/internal/types';
import type { JsPackageManager } from 'storybook/internal/common';
import { angularBuildersMultiproject } from './angular-builders-multiproject';
import * as helpers from 'storybook/internal/cli';

const checkAngularBuilders = async ({
  packageManager,
  mainConfig = {},
}: {
  packageManager: Partial<JsPackageManager>;
  mainConfig?: Partial<StorybookConfig>;
}) => {
  return angularBuildersMultiproject.check({
    packageManager: packageManager as any,
    mainConfig: mainConfig as any,
    storybookVersion: '7.0.0',
  });
};

vi.mock('storybook/internal/cli', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/cli')>()),
  isNxProject: vi.fn(),
  AngularJSON: vi.fn(),
}));

describe('is Nx project', () => {
  // @ts-expect-error (Type 'null' is not comparable)
  const packageManager = {
    getPackageVersion: () => {
      return null;
    },
  } as Partial<JsPackageManager>;

  beforeEach(() => {
    vi.mocked(helpers.isNxProject).mockResolvedValue('true');
  });

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
        getPackageVersion: vi.fn().mockResolvedValue(null),
      } as Partial<JsPackageManager>;

      it('should return null', async () => {
        await expect(
          checkAngularBuilders({ packageManager, mainConfig: { framework: '@storybook/angular' } })
        ).resolves.toBeNull();
      });
    });

    describe('Angular < 14.0.0', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          if (packageName === '@angular/core') {
            return Promise.resolve('12.0.0');
          }

          return null;
        },
      } as Partial<JsPackageManager>;

      it('should return null', async () => {
        await expect(
          checkAngularBuilders({ packageManager, mainConfig: { framework: '@storybook/angular' } })
        ).resolves.toBeNull();
      });
    });

    describe('Angular >= 14.0.0', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          if (packageName === '@angular/core') {
            return Promise.resolve('15.0.0');
          }

          return null;
        },
      } as Partial<JsPackageManager>;

      describe('has one Storybook builder defined', () => {
        beforeEach(() => {
          // Mock AngularJSON.constructor
          vi.mocked(helpers.AngularJSON).mockImplementation(
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

      describe('has one project', () => {
        beforeEach(() => {
          // Mock AngularJSON.constructor
          vi.mocked(helpers.AngularJSON).mockImplementation(
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
          vi.mocked(helpers.AngularJSON).mockImplementation(
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

        it('should return an empty object', async () => {
          await expect(
            checkAngularBuilders({
              packageManager,
              mainConfig: { framework: '@storybook/angular' },
            })
          ).resolves.toMatchObject({});
        });
      });
    });
  });
});
