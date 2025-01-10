import { describe, expect, it } from 'vitest';

import type { JsPackageManager } from '@storybook/core/common';

import { getAddonSvelteCsfVersion } from './index';

describe('installed', () => {
  it.each([
    ['3.0.0', ''],
    ['4.0.0', '4'],
    ['5.0.0', '^5.0.0-next.0'],
    ['6.0.0', ''],
    ['3.0.0-next.0', ''],
    ['4.0.0-next.0', '4'],
    ['4.2.19::__archiveUrl=https%3A%2F%2Fregistry.npmjs.org%2Fsvelte%2F-%2Fsvelte-4.2.19.tgz', '4'],
    ['5.0.0-next.0', '^5.0.0-next.0'],
    ['6.0.0-next.0', ''],
  ])('svelte %s => %s', async (svelteVersion, expectedAddonSpecifier) => {
    const packageManager = {
      getInstalledVersion: async (pkg: string) => (pkg === 'svelte' ? svelteVersion : undefined),
      getAllDependencies: async () => ({ svelte: `^${svelteVersion}` }),
    } as any as JsPackageManager;
    await expect(getAddonSvelteCsfVersion(packageManager)).resolves.toBe(expectedAddonSpecifier);
  });
});

describe('uninstalled', () => {
  it.each([
    ['^3', ''],
    ['^4', '4'],
    ['^5', '^5.0.0-next.0'],
    ['^6', ''],
    ['^3.0.0-next.0', ''],
    ['^4.0.0-next.0', '4'],
    ['^5.0.0-next.0', '^5.0.0-next.0'],
    ['^6.0.0-next.0', ''],
  ])('svelte %s => %s', async (svelteSpecifier, expectedAddonSpecifier) => {
    const packageManager = {
      getInstalledVersion: async (pkg: string) => undefined,
      getAllDependencies: async () => ({ svelte: svelteSpecifier }),
    } as any as JsPackageManager;
    await expect(getAddonSvelteCsfVersion(packageManager)).resolves.toBe(expectedAddonSpecifier);
  });
});
