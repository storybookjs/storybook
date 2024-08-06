import { describe, expect, it, vi } from 'vitest';
import * as sbcc from 'storybook/internal/common';
import { UpgradeStorybookToLowerVersionError } from 'storybook/internal/server-errors';
import { doUpgrade, getStorybookVersion } from './upgrade';
import { logger } from 'storybook/internal/node-logger';

const findInstallationsMock =
  vi.fn<(arg: string[]) => Promise<sbcc.InstallationMetadata | undefined>>();

vi.mock('storybook/internal/telemetry');
vi.mock('storybook/internal/common', async (importOriginal) => {
  const originalModule = (await importOriginal()) as typeof sbcc;
  return {
    ...originalModule,
    JsPackageManagerFactory: {
      getPackageManager: () => ({
        findInstallations: findInstallationsMock,
        latestVersion: async () => '8.0.0',
        retrievePackageJson: async () => {},
        getAllDependencies: async () => ({ storybook: '8.0.0' }),
      }),
    },
    versions: Object.keys(originalModule.versions).reduce(
      (acc, key) => {
        acc[key] = '8.0.0';
        return acc;
      },
      {} as Record<string, string>
    ),
  };
});

describe.each([
  ['│ │ │ ├── @babel/code-frame@7.10.3 deduped', null],
  [
    '│ ├── "@storybook/core/theming@6.0.0-beta.37 extraneous',
    { package: '@storybook/core/theming', version: '6.0.0-beta.37' },
  ],
  [
    '├─┬ @storybook/preset-create-react-app@3.1.2',
    { package: '@storybook/preset-create-react-app', version: '3.1.2' },
  ],
  ['│ ├─┬ @storybook/node-logger@5.3.19', { package: '@storybook/node-logger', version: '5.3.19' }],
  [
    'npm ERR! peer dep missing: @storybook/react@>=5.2, required by @storybook/preset-create-react-app@3.1.2',
    null,
  ],
])('getStorybookVersion', (input, output) => {
  it(`${input}`, () => {
    expect(getStorybookVersion(input)).toEqual(output);
  });
});

describe('Upgrade errors', () => {
  it('should throw an error when upgrading to a lower version number', async () => {
    findInstallationsMock.mockResolvedValue({
      dependencies: {
        storybook: [
          {
            version: '8.1.0',
          },
        ],
      },
      duplicatedDependencies: {},
      infoCommand: '',
      dedupeCommand: '',
    });

    await expect(doUpgrade({} as any)).rejects.toThrowError(UpgradeStorybookToLowerVersionError);
    expect(findInstallationsMock).toHaveBeenCalledWith(Object.keys(sbcc.versions));
  });
  it('should show a warning when upgrading to the same version number', async () => {
    findInstallationsMock.mockResolvedValue({
      dependencies: {
        storybook: [
          {
            version: '8.0.0',
          },
        ],
      },
      duplicatedDependencies: {},
      infoCommand: '',
      dedupeCommand: '',
    });

    // Mock as a throw, so that we don't have to mock the content of the doUpgrade fn that comes after it
    vi.spyOn(logger, 'warn').mockImplementation((error) => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw error;
    });

    await expect(doUpgrade({ packageManager: 'npm' } as any)).rejects.toContain(
      'You are upgrading Storybook to the same version that is currently installed in the project'
    );
    expect(findInstallationsMock).toHaveBeenCalledWith(Object.keys(sbcc.versions));
  });
});
