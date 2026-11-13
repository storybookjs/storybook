import { afterEach, describe, expect, it } from 'vitest';

import { globToRegexp } from './glob-to-regexp.ts';

const originalPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

const glob = '/src/**/*.stories.@(js|jsx|mjs|ts|tsx)';

describe('globToRegexp', () => {
  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it('treats backslashes as separators on Windows', () => {
    setPlatform('win32');

    const regex = globToRegexp(glob);

    expect(regex.test('\\src\\components\\Button.stories.tsx')).toBe(true);
    expect(regex.test('/src/components/Button.stories.tsx')).toBe(true);
  });

  it('treats only forward slashes as separators on other platforms', () => {
    setPlatform('linux');

    const regex = globToRegexp(glob);

    expect(regex.test('/src/components/Button.stories.tsx')).toBe(true);
    expect(regex.test('\\src\\components\\Button.stories.tsx')).toBe(false);
  });
});
