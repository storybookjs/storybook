import type { JsPackageManager } from 'storybook/internal/common';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { lt } from 'semver';

import { blocker } from './block-addon-vitest-vitest4.ts';
import type { AutoblockOptions } from './types.ts';

vi.mock('semver');

type GetInstalledVersion = JsPackageManager['getInstalledVersion'];

const runCheck = (getInstalledVersion: GetInstalledVersion) =>
  blocker.check({
    packageManager: { getInstalledVersion } as JsPackageManager,
  } as AutoblockOptions);

const installed = (versions: Record<string, string | null>): GetInstalledVersion => {
  const getInstalledVersion: GetInstalledVersion = async (packageName) =>
    versions[packageName] ?? null;

  return vi.fn(getInstalledVersion);
};

describe('addonVitestVitest4 blocker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lt).mockReturnValue(false);
  });

  test('returns false when @storybook/addon-vitest is not installed', async () => {
    const getInstalledVersion = vi.fn<GetInstalledVersion>(async (packageName) => {
      return packageName === 'vitest' ? '3.2.4' : null;
    });

    const result = await runCheck(getInstalledVersion);

    expect(result).toBe(false);
    expect(getInstalledVersion).toHaveBeenCalledWith('@storybook/addon-vitest');
    expect(lt).not.toHaveBeenCalled();
  });

  test('has a stable id', () => {
    expect(blocker.id).toBe('addonVitestVitest4');
  });

  test('blocks when the effective Vitest version is below 4.0.0', async () => {
    vi.mocked(lt).mockReturnValue(true);

    // getInstalledVersion is vite-plus-aware, so '3.2.4' is what it reports for a
    // vendored install as well as a direct one.
    const result = await runCheck(
      installed({ '@storybook/addon-vitest': '11.0.0', vitest: '3.2.4' })
    );

    expect(result).toEqual({ vitestVersion: '3.2.4' });
    expect(lt).toHaveBeenCalledWith('3.2.4', '4.0.0');
  });

  test('blocks at the Vitest 3.0.0 boundary', async () => {
    vi.mocked(lt).mockReturnValue(true);

    const result = await runCheck(
      installed({ '@storybook/addon-vitest': '11.0.0', vitest: '3.0.0' })
    );

    expect(result).toEqual({ vitestVersion: '3.0.0' });
  });

  test('returns false at the Vitest 4.0.0 boundary', async () => {
    const result = await runCheck(
      installed({ '@storybook/addon-vitest': '11.0.0', vitest: '4.0.0' })
    );

    expect(result).toBe(false);
    expect(lt).toHaveBeenCalledWith('4.0.0', '4.0.0');
  });

  test('returns false for Vitest 5', async () => {
    const result = await runCheck(
      installed({ '@storybook/addon-vitest': '11.0.0', vitest: '5.0.0' })
    );

    expect(result).toBe(false);
  });

  test('returns false when vitest is not installed (unmet peer dependency)', async () => {
    const getInstalledVersion = installed({ '@storybook/addon-vitest': '11.0.0', vitest: null });

    const result = await runCheck(getInstalledVersion);

    expect(result).toBe(false);
    expect(getInstalledVersion).toHaveBeenCalledWith('vitest');
    expect(lt).not.toHaveBeenCalled();
  });

  test('does not block a vite-plus wrapper version leaking as 0.x', async () => {
    vi.mocked(lt).mockReturnValue(true);

    const result = await runCheck(
      installed({ '@storybook/addon-vitest': '11.0.0', vitest: '0.1.16' })
    );

    expect(result).toBe(false);
    expect(lt).not.toHaveBeenCalled();
  });

  test('returns false for a Vitest prerelease (getInstalledVersion coerces with includePrerelease)', async () => {
    const result = await runCheck(
      installed({ '@storybook/addon-vitest': '11.0.0', vitest: '4.0.0-beta.1' })
    );

    expect(result).toBe(false);
  });

  test('does not block when version detection throws', async () => {
    const result = await runCheck(async () => {
      throw new Error('version detection failed');
    });

    expect(result).toBe(false);
  });

  test('renders the title, message, and migration link', () => {
    const { title, message, link } = blocker.log({ vitestVersion: '3.2.4' });

    expect(title).toBe('Vitest 4 required by @storybook/addon-vitest');
    expect(message).toMatchInlineSnapshot(`
      "The addon requires Vitest 4.0.0 or higher. You are currently using Vitest 3.2.4.

      Please upgrade Vitest to 4.0.0 or higher before upgrading Storybook:
      1. Update vitest (and any @vitest/* packages) in your project to version 4
      2. Run your test suite to verify the migration"
    `);
    expect(link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-requires-vitest-40-or-higher'
    );
  });
});
