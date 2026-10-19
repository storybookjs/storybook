import { describe, expect, it } from 'vitest';

import { isYarnBerryVersion } from './link.ts';

describe('isYarnBerryVersion', () => {
  it('accepts Yarn 2 and newer, including prereleases', () => {
    expect(isYarnBerryVersion('2.4.3')).toBe(true);
    expect(isYarnBerryVersion('4.18.1\n')).toBe(true);
    expect(isYarnBerryVersion('6.0.0-rc.23')).toBe(true);
    expect(isYarnBerryVersion('10.1.0')).toBe(true);
  });

  it('rejects Yarn Classic and unreadable versions', () => {
    expect(isYarnBerryVersion('1.22.22')).toBe(false);
    expect(isYarnBerryVersion('')).toBe(false);
  });
});
