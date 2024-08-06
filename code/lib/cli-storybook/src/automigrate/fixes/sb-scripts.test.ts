import { describe, afterEach, it, expect, vi } from 'vitest';
import type { JsPackageManager } from 'storybook/internal/common';
import { getStorybookScripts, sbScripts } from './sb-scripts';

const checkSbScripts = async ({
  packageManager,
  storybookVersion = '7.0.0',
}: {
  packageManager: Partial<JsPackageManager>;
  storybookVersion?: string;
}) => {
  return sbScripts.check({
    packageManager: packageManager as any,
    storybookVersion,
    mainConfig: {} as any,
  });
};

describe('getStorybookScripts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('detects default storybook scripts', () => {
    expect(
      getStorybookScripts({
        'sb:upgrade': 'sb upgrade',
        storybook: 'start-storybook',
        'build-storybook': 'build-storybook',
      })
    ).toEqual({
      'build-storybook': {
        before: 'build-storybook',
        after: 'storybook build',
      },
      storybook: {
        before: 'start-storybook',
        after: 'storybook dev',
      },
      'sb:upgrade': {
        before: 'sb upgrade',
        after: 'storybook upgrade',
      },
    });
  });

  it('skips non-storybook scripts', () => {
    expect(
      getStorybookScripts({
        start: 'server start',
        'start-storybook': 'MOCKS=true start-storybook -p 9000',
        'storybook:start-ci': 'CI=true yarn start-storybook',
        'storybook:build-ci': 'CI=true yarn build-storybook',
      })
    ).toEqual({
      'start-storybook': {
        before: 'MOCKS=true start-storybook -p 9000',
        after: 'MOCKS=true storybook dev -p 9000',
      },
    });
  });
});

describe('sb-scripts fix', () => {
  describe('sb < 7.0', () => {
    describe('does nothing', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/react':
              return Promise.resolve('6.2.0');
            default:
              return null;
          }
        },
        retrievePackageJson: () => Promise.resolve({}),
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkSbScripts({
            packageManager,
            storybookVersion: '6.2.0',
          })
        ).resolves.toBeFalsy();
      });
    });
  });

  describe('sb >= 7.0', () => {
    describe('with old scripts', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/react':
              return Promise.resolve('7.0.0-alpha.0');
            default:
              return null;
          }
        },
        retrievePackageJson: () =>
          Promise.resolve({
            scripts: {
              storybook: 'start-storybook -p 6006',
              'build-storybook': 'build-storybook -o build/storybook',
            },
            dependencies: {},
            devDependencies: {},
          }),
      } as Partial<JsPackageManager>;

      it('should update scripts to new format', async () => {
        await expect(
          checkSbScripts({
            packageManager,
          })
        ).resolves.toEqual(
          expect.objectContaining({
            storybookScripts: {
              'build-storybook': {
                after: 'storybook build -o build/storybook',
                before: 'build-storybook -o build/storybook',
              },
              storybook: {
                after: 'storybook dev -p 6006',
                before: 'start-storybook -p 6006',
              },
            },
          })
        );
      });
    });

    describe('with old custom scripts', () => {
      it('should update scripts to new format', async () => {
        const packageManager = {
          getPackageVersion: (packageName) => {
            switch (packageName) {
              case '@storybook/react':
                return Promise.resolve('7.0.0-alpha.0');
              default:
                return null;
            }
          },
          retrievePackageJson: () =>
            Promise.resolve({
              scripts: {
                'storybook:ci': 'yarn start-storybook --ci',
                'storybook:build': 'build-storybook -o build/storybook',
                'storybook:build-mocked': 'MOCKS=true yarn storybook:build',
                'test-storybook:ci':
                  'concurrently -k -s first -n "SB,TEST" -c "magenta,blue" "CI=true build-storybook --quiet && npx http-server storybook-static --port 6006 --silent" "wait-on tcp:6006 && yarn test-storybook"',
              },
              dependencies: {},
              devDependencies: {},
            }),
        } as Partial<JsPackageManager>;

        await expect(
          checkSbScripts({
            packageManager,
          })
        ).resolves.toEqual(
          expect.objectContaining({
            storybookScripts: {
              'storybook:build': {
                after: 'storybook build -o build/storybook',
                before: 'build-storybook -o build/storybook',
              },
              'test-storybook:ci': {
                before:
                  'concurrently -k -s first -n "SB,TEST" -c "magenta,blue" "CI=true build-storybook --quiet && npx http-server storybook-static --port 6006 --silent" "wait-on tcp:6006 && yarn test-storybook"',
                after:
                  'concurrently -k -s first -n "SB,TEST" -c "magenta,blue" "CI=true storybook build --quiet && npx http-server storybook-static --port 6006 --silent" "wait-on tcp:6006 && yarn test-storybook"',
              },
            },
          })
        );
      });
    });

    describe('already containing new scripts', () => {
      const packageManager = {
        getPackageVersion: (packageName) => {
          switch (packageName) {
            case '@storybook/react':
              return Promise.resolve('7.0.0-alpha.0');
            default:
              return null;
          }
        },
        retrievePackageJson: () =>
          Promise.resolve({
            scripts: {
              storybook: 'storybook dev -p 6006',
              'build-storybook': 'storybook build -o build/storybook',
            },
            dependencies: {},
            devDependencies: {},
          }),
      } as Partial<JsPackageManager>;

      it('should no-op', async () => {
        await expect(
          checkSbScripts({
            packageManager,
          })
        ).resolves.toBeFalsy();
      });
    });
  });
});
