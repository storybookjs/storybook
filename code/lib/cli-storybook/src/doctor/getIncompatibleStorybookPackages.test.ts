import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import type { AnalysedPackage } from './getIncompatibleStorybookPackages';
import {
  checkPackageCompatibility,
  getIncompatiblePackagesSummary,
  getIncompatibleStorybookPackages,
} from './getIncompatibleStorybookPackages';

vi.mock('picocolors', () => {
  return {
    default: {
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

      For more on Storybook 9 compatibility, see the linked GitHub issue:
      https://github.com/storybookjs/storybook/issues/30944"
    `);
  });
});
