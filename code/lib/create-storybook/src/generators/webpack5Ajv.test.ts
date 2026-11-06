import { describe, expect, it } from 'vitest';

import { SupportedBuilder } from 'storybook/internal/types';

import { WEBPACK5_AJV_PACKAGE, resolveWebpack5AjvPackageToInstall } from './webpack5Ajv.ts';

describe('resolveWebpack5AjvPackageToInstall', () => {
  it('does not install ajv for Vite projects', () => {
    expect(
      resolveWebpack5AjvPackageToInstall({
        builder: SupportedBuilder.VITE,
        declaredAjvRange: undefined,
      })
    ).toBeNull();
  });

  it('installs ajv@8 for a fresh Webpack 5 project', () => {
    expect(
      resolveWebpack5AjvPackageToInstall({
        builder: SupportedBuilder.WEBPACK5,
        declaredAjvRange: undefined,
      })
    ).toBe(WEBPACK5_AJV_PACKAGE);
  });

  it('leaves an existing compatible direct ajv@8 range alone', () => {
    expect(
      resolveWebpack5AjvPackageToInstall({
        builder: SupportedBuilder.WEBPACK5,
        declaredAjvRange: '^8.12.0',
      })
    ).toBeNull();
  });

  it('stops with an actionable error when a direct ajv@6 range is present', () => {
    expect(() =>
      resolveWebpack5AjvPackageToInstall({
        builder: SupportedBuilder.WEBPACK5,
        declaredAjvRange: '^6.12.6',
      })
    ).toThrow(/ajv@\^6\.12\.6/);

    expect(() =>
      resolveWebpack5AjvPackageToInstall({
        builder: SupportedBuilder.WEBPACK5,
        declaredAjvRange: '^6.12.6',
      })
    ).toThrow(/will not overwrite/);
  });
});
