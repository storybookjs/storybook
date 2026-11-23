import { describe, expect, it } from 'vitest';

import { getIncompatibleStorybookMessage } from './version-check.ts';

describe('getIncompatibleStorybookMessage', () => {
  it.each<{ name: string; input: [addonVersion: string, coreVersion: string]; expected: boolean }>([
    { name: 'the same version', input: ['11.0.0-beta.1', '11.0.0-beta.1'], expected: false },
    { name: 'an older major', input: ['11.0.0-beta.1', '10.6.6'], expected: true },
    { name: 'a newer major', input: ['11.0.3', '12.0.0'], expected: true },
    { name: 'an older patch', input: ['11.0.3', '11.0.2'], expected: false },
    { name: 'a newer minor', input: ['11.0.2', '11.1.0'], expected: false },
    { name: 'another prerelease', input: ['11.0.0-beta.3', '11.0.0-alpha.8'], expected: false },
    { name: 'a canary addon', input: ['0.0.0-pr-37356-sha-1a2b3c4d', '11.0.3'], expected: false },
    {
      name: 'a canary storybook',
      input: ['11.0.3', '0.0.0-pr-37356-sha-1a2b3c4d'],
      expected: false,
    },
    { name: 'an unreadable version', input: ['11.0.2', 'unknown'], expected: false },
  ])('$name is incompatible: $expected', ({ input, expected }) => {
    expect(getIncompatibleStorybookMessage(...input) !== undefined).toBe(expected);
  });

  it('names both versions and how to list the installed ones', () => {
    expect(getIncompatibleStorybookMessage('11.0.0-beta.1', '10.6.6')).toMatchInlineSnapshot(`
      "@storybook/addon-vitest@11.0.0-beta.1 is not compatible with storybook@10.6.6.

      Several versions of Storybook are installed, for example when only some packages of a monorepo were upgraded.
      Run "npm ls storybook" to see which ones, then use the same version for every "storybook" and "@storybook/*" dependency."
    `);
  });
});
