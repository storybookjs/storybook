import { beforeEach, describe, expect, it, vi } from 'vitest';

import { once, logger } from 'storybook/internal/node-logger';

import { PackageManagerName } from './JsPackageManager.ts';
import { warnOnYarn1 } from './warnOnYarn1.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('warnOnYarn1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    once.clear();
  });

  it('warns with the pretty label and docs link for Yarn 1', () => {
    warnOnYarn1(PackageManagerName.YARN1);

    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('Yarn Classic (v1) is supported on a best-effort basis')
    );
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('https://storybook.js.org/docs/get-started/install')
    );
  });

  it('warns only once per process for repeated Yarn 1 calls', () => {
    warnOnYarn1(PackageManagerName.YARN1);
    warnOnYarn1(PackageManagerName.YARN1);

    // once.warn records invocations; the deduped EMISSION lands on logger.warn.
    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);
  });

  it.each([
    PackageManagerName.NPM,
    PackageManagerName.YARN2,
    PackageManagerName.PNPM,
    PackageManagerName.BUN,
  ])('stays silent for %s', (packageManagerType) => {
    warnOnYarn1(packageManagerType);

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });

  it('never throws when logging fails', () => {
    vi.mocked(logger.warn).mockImplementationOnce(() => {
      throw new Error('logging exploded');
    });

    expect(() => warnOnYarn1(PackageManagerName.YARN1)).not.toThrow();
  });
});
