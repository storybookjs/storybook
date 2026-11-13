import { describe, expect, it } from 'vitest';

import { ENTRY } from './fixtures.ts';
import { unsandboxedRefusal } from './sandbox-policy.ts';
import type { CatalogEntry } from './schema.ts';

const thirdParty = (windows: boolean): CatalogEntry => ({
  ...ENTRY,
  id: 'gutenberg',
  class: 'tier1',
  pushTo: 'storybook-tmp/gutenberg',
  windows,
});

describe('unsandboxedRefusal', () => {
  it.each(['linux', 'macos', 'windows'] as const)('lets an owned repo run on %s', (os) => {
    expect(unsandboxedRefusal(ENTRY, os)).toBeUndefined();
  });

  it('lets a repo of someone else run on Windows when the catalog marks it for Windows', () => {
    expect(unsandboxedRefusal(thirdParty(true), 'windows')).toBeUndefined();
  });

  it('refuses a repo of someone else on Windows without that mark', () => {
    expect(unsandboxedRefusal(thirdParty(false), 'windows')).toBe(
      'gutenberg is not an owned repo and the catalog does not mark it for Windows, so it cannot run with --sandbox none.'
    );
  });

  it.each(['linux', 'macos'] as const)(
    'refuses a repo of someone else on %s, where a sandbox exists',
    (os) => {
      expect(unsandboxedRefusal(thirdParty(true), os)).toBe(
        `gutenberg is not an owned repo, so on ${os} it cannot run with --sandbox none.`
      );
    }
  );
});
