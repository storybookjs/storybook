import { describe, expect, it } from 'vitest';

import type { InstallationMetadata } from 'storybook/internal/common';

import { getDeprecatedPackagesWarning } from './getDeprecatedPackagesWarning.ts';

const installation = (dependencies: Record<string, string>): InstallationMetadata => ({
  dependencies: Object.fromEntries(
    Object.entries(dependencies).map(([name, version]) => [name, [{ version, location: '' }]])
  ),
  duplicatedDependencies: {},
  infoCommand: '',
  dedupeCommand: '',
});

const warningFor = (installed: Record<string, string>, storybookVersion: string) =>
  getDeprecatedPackagesWarning(installation(installed), storybookVersion, installed);

describe('getDeprecatedPackagesWarning', () => {
  it('lists @storybook/nextjs as deprecated from Storybook 11', () => {
    const warning = warningFor({ '@storybook/nextjs': '11.0.0', storybook: '11.0.0' }, '11.0.0');

    expect(warning).toContain('@storybook/nextjs@11.0.0');
    expect(warning).toContain('MIGRATION.md#nextjs-storybooknextjs-is-deprecated');
    expect(warning).toContain('storybook automigrate nextjs-to-nextjs-vite');
  });

  it('lists @storybook/nextjs on a Storybook 11 prerelease', () => {
    expect(
      warningFor({ '@storybook/nextjs': '11.0.0-rc.0', storybook: '11.0.0-rc.0' }, '11.0.0-rc.0')
    ).toContain('@storybook/nextjs@11.0.0-rc.0');
  });

  it('does not list @storybook/nextjs before Storybook 11', () => {
    expect(
      warningFor({ '@storybook/nextjs': '10.6.0', storybook: '10.6.0' }, '10.6.0')
    ).toBeUndefined();
  });

  it('returns nothing when no deprecated package is installed', () => {
    expect(
      warningFor({ '@storybook/nextjs-vite': '11.0.0', storybook: '11.0.0' }, '11.0.0')
    ).toBeUndefined();
  });

  it('ignores a deprecated package that the project does not depend on', () => {
    expect(
      getDeprecatedPackagesWarning(
        installation({ '@storybook/nextjs': '11.0.0', storybook: '11.0.0' }),
        '11.0.0',
        { '@storybook/react-vite': '^11.0.0', storybook: '^11.0.0' }
      )
    ).toBeUndefined();
  });

  it('returns nothing when the installed packages could not be listed', () => {
    expect(getDeprecatedPackagesWarning(undefined, '11.0.0', {})).toBeUndefined();
  });

  it('returns nothing when the Storybook version is not valid semver', () => {
    expect(
      warningFor({ '@storybook/nextjs': '11.0.0', storybook: '11.0.0' }, 'not-a-version')
    ).toBeUndefined();
  });
});
