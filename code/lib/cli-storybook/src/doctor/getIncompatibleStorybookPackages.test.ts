import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import type { AnalysedPackage } from './getIncompatibleStorybookPackages.ts';
import {
  checkPackageCompatibility,
  getIncompatiblePackagesSummary,
  getIncompatibleStorybookPackages,
} from './getIncompatibleStorybookPackages.ts';

vi.mock('picocolors', async (importOriginal) => {
  const { default: actual } = await importOriginal<{ default: typeof import('picocolors') }>();
  return {
    default: {
      ...actual,
      yellow: (str: string) => str,
      cyan: (str: string) => str,
      bold: (str: string) => str,
    },
  };
});

const packageManagerMock = {
  getAllDependencies: vi.fn(),
  latestVersion: vi.fn(),
  getModulePackageJSON: vi.fn(),
} as Partial<JsPackageManager> as JsPackageManager;

describe('checkPackageCompatibility', () => {
  beforeEach(() => {
    vi.mocked(packageManagerMock.getAllDependencies).mockReturnValue({});
    vi.mocked(packageManagerMock.latestVersion).mockResolvedValue('9.0.0');
    vi.mocked(packageManagerMock.getModulePackageJSON).mockResolvedValue({ version: '9.0.0' });
  });

  it('returns that a package is incompatible', async () => {
    const packageName = 'my-storybook-package';
    vi.mocked(packageManagerMock.getModulePackageJSON).mockResolvedValueOnce({
      name: packageName,
      version: '1.0.0',
      dependencies: {
        storybook: '8.0.0',
      },
    });
    const result = await checkPackageCompatibility(packageName, {
      currentStorybookVersion: '9.0.0',
      packageManager: packageManagerMock as JsPackageManager,
    });
    expect(result).toEqual(
      expect.objectContaining({
        packageName: 'my-storybook-package',
        packageVersion: '1.0.0',
        hasIncompatibleDependencies: true,
      })
    );
  });

  it('returns that a package is compatible', async () => {
    const packageName = 'my-storybook-package';
    vi.mocked(packageManagerMock.getModulePackageJSON).mockResolvedValueOnce({
      name: packageName,
      version: '1.0.0',
      dependencies: {
        'storybook/internal/common': '9.0.0',
      },
    });
    const result = await checkPackageCompatibility(packageName, {
      currentStorybookVersion: '9.0.0',
      packageManager: packageManagerMock as JsPackageManager,
    });
    expect(result).toEqual(
      expect.objectContaining({
        packageName: 'my-storybook-package',
        packageVersion: '1.0.0',
        hasIncompatibleDependencies: false,
      })
    );
  });

  it.each([
    ['ignores a 0.x range', '^0.4.0', '11.0.0', false],
    [
      'flags a range whose canary part comes first',
      '^0.0.0-0 || ^10.0.0 || ^10.3.0-0',
      '11.0.0-beta.3',
      true,
    ],
    ['accepts a range with a canary part', '^0.0.0-0 || ^10.6.0-0 || ^11.0.0-0', '11.0.0', false],
    [
      'accepts a canary through the canary part',
      '^0.0.0-0 || ^10.0.0',
      '0.0.0-pr-1-sha-abc',
      false,
    ],
    [
      'accepts a prerelease of a minor the range does not list',
      '^0.0.0-0 || ^10.1.0-0 || ^11.0.0-0',
      '11.1.0-alpha.1',
      false,
    ],
    ['accepts a prerelease within a plain range', '^10.0.0', '10.7.0-alpha.1', false],
  ])('%s', async (_, range, currentStorybookVersion, hasIncompatibleDependencies) => {
    vi.mocked(packageManagerMock.getModulePackageJSON).mockResolvedValueOnce({
      name: 'my-storybook-package',
      version: '1.0.0',
      peerDependencies: { storybook: range },
    });
    const result = await checkPackageCompatibility('my-storybook-package', {
      currentStorybookVersion,
      packageManager: packageManagerMock as JsPackageManager,
    });
    expect(result.hasIncompatibleDependencies).toBe(hasIncompatibleDependencies);
  });

  it('returns that a package is incompatible and because it is core, can be upgraded', async () => {
    const packageName = '@storybook/addon-docs';

    vi.mocked(packageManagerMock.getModulePackageJSON).mockResolvedValueOnce({
      name: packageName,
      version: '8.0.0',
      dependencies: {
        storybook: '8.0.0',
      },
    });

    const result = await checkPackageCompatibility(packageName, {
      currentStorybookVersion: '9.0.0',
      packageManager: packageManagerMock,
    });

    expect(result).toEqual(
      expect.objectContaining({
        packageName: '@storybook/addon-docs',
        packageVersion: '8.0.0',
        hasIncompatibleDependencies: true,
        availableUpdate: '9.0.0',
      })
    );
  });

  it('returns that an addon is incompatible because it uses legacy consolidated packages', async () => {
    const packageName = '@storybook/addon-designs';

    vi.mocked(packageManagerMock.getModulePackageJSON).mockResolvedValueOnce({
      name: packageName,
      version: '8.0.0',
      dependencies: {
        '@storybook/core-common': '8.0.0',
      },
    });

    const result = await checkPackageCompatibility(packageName, {
      currentStorybookVersion: '9.0.0',
      packageManager: packageManagerMock,
    });

    expect(result).toEqual(
      expect.objectContaining({
        packageName: '@storybook/addon-designs',
        packageVersion: '8.0.0',
        hasIncompatibleDependencies: true,
      })
    );
  });
});

describe('getIncompatibleStorybookPackages', () => {
  beforeEach(() => {
    vi.mocked(packageManagerMock.getAllDependencies).mockReturnValue({});
    vi.mocked(packageManagerMock.latestVersion).mockResolvedValue('9.0.0');
    vi.mocked(packageManagerMock.getModulePackageJSON).mockResolvedValue({ version: '9.0.0' });
  });

  it('succeeds if only core storybook packages used', async () => {
    vi.mocked(packageManagerMock.getAllDependencies).mockReturnValueOnce({
      storybook: '9.0.0',
    });

    const result = await getIncompatibleStorybookPackages({
      currentStorybookVersion: '9.0.0',
      packageManager: packageManagerMock as JsPackageManager,
    });

    expect(result).toHaveLength(0);
  });

  it('returns an array of incompatible packages', async () => {
    // Mock a non-core storybook package that would be found
    vi.mocked(packageManagerMock.getAllDependencies).mockReturnValueOnce({
      'react-storybook-addon': '1.0.0',
    });

    vi.mocked(packageManagerMock.getModulePackageJSON).mockResolvedValueOnce({
      name: 'react-storybook-addon',
      version: '1.0.0',
      dependencies: {
        storybook: '8.0.0',
      },
    });

    const result = await getIncompatibleStorybookPackages({
      currentStorybookVersion: '9.0.0',
      packageManager: packageManagerMock as JsPackageManager,
    });

    expect(result).toEqual([
      expect.objectContaining({
        packageName: 'react-storybook-addon',
        hasIncompatibleDependencies: true,
      }),
    ]);
  });
});

describe('getIncompatiblePackagesSummary', () => {
  // necessary for windows and unix output to match in the assertions
  const normalizeLineBreaks = (str: string) => str.replace(/\r\n|\r|\n/g, '\n').trim();

  it('generates a summary message for incompatible packages', () => {
    const analysedPackages: AnalysedPackage[] = [
      {
        packageName: 'storybook-react',
        packageVersion: '1.0.0',
        hasIncompatibleDependencies: true,
      },
      {
        packageName: '@storybook/addon-docs',
        packageVersion: '8.0.0',
        hasIncompatibleDependencies: true,
        availableUpdate: '9.0.0',
      },
    ];
    const summary = getIncompatiblePackagesSummary(analysedPackages, '9.0.0');

    expect(normalizeLineBreaks(summary)).toMatchInlineSnapshot(`
      "You are currently using Storybook 9.0.0 but you have packages which are incompatible with it:

      - storybook-react@1.0.0
      - @storybook/addon-docs@8.0.0 (9.0.0 available!)
      
      Please consider updating your packages or contacting the maintainers for compatibility details.

      For more details on compatibility guidance, see:
      https://github.com/storybookjs/storybook/issues/36283"
    `);
  });
});
