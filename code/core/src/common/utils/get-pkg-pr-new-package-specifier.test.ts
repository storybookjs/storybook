import { describe, expect, it } from 'vitest';

import {
  getPkgPrNewPackageSpecifier,
  isPkgPrNewVersionSpecifier,
} from './get-pkg-pr-new-package-specifier.ts';

describe('isPkgPrNewVersionSpecifier', () => {
  it.each([
    'https://pkg.pr.new/storybook@abc123',
    'https://pkg.pr.new/create-storybook@abc123',
    'https://pkg.pr.new/@storybook/react@abc123',
    'https://pkg.pr.new/storybookjs/storybook/storybook@abc123',
    'https://pkg.pr.new/storybookjs/storybook/create-storybook@abc123',
    'https://pkg.pr.new/storybookjs/storybook/@storybook/react@abc123',
    'http://pkg.pr.new/storybookjs/storybook/storybook@deadbeef',
  ])('detects %s', (specifier) => {
    expect(isPkgPrNewVersionSpecifier(specifier)).toBe(true);
  });

  it.each([
    undefined,
    '',
    'latest',
    'next',
    '10.5.0',
    '10.6.0-alpha.7',
    '10.6.0-beta.1',
    '10.6.0-rc.0',
    '0.0.0-pr-34799-sha-abc123',
    'https://registry.npmjs.org/storybook/-/storybook-10.5.0.tgz',
    'https://pkg.pr.new/unrelated-package@abc123',
    'https://example.com/storybook@abc123',
  ])('rejects %s', (specifier) => {
    expect(isPkgPrNewVersionSpecifier(specifier)).toBe(false);
  });
});

describe('getPkgPrNewPackageSpecifier', () => {
  it('maps a compact create-storybook specifier onto a Storybook package', () => {
    expect(
      getPkgPrNewPackageSpecifier('@storybook/react', 'https://pkg.pr.new/create-storybook@abc123')
    ).toBe('https://pkg.pr.new/@storybook/react@abc123');
  });

  it('maps a repo-scoped storybook specifier onto sibling packages', () => {
    expect(
      getPkgPrNewPackageSpecifier(
        '@storybook/react-vite',
        'https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef'
      )
    ).toBe('https://pkg.pr.new/storybookjs/storybook/@storybook/react-vite@deadbeef');
  });

  it('keeps the storybook package on the same repo-scoped URL', () => {
    expect(
      getPkgPrNewPackageSpecifier(
        'storybook',
        'https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef'
      )
    ).toBe('https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef');
  });

  it('returns undefined for npm tags, stables, and prereleases', () => {
    expect(getPkgPrNewPackageSpecifier('storybook', 'latest')).toBeUndefined();
    expect(getPkgPrNewPackageSpecifier('storybook', 'next')).toBeUndefined();
    expect(getPkgPrNewPackageSpecifier('storybook', '10.5.0')).toBeUndefined();
    expect(getPkgPrNewPackageSpecifier('storybook', '10.6.0-alpha.7')).toBeUndefined();
  });
});
