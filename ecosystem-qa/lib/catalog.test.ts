import { describe, expect, it } from 'vitest';

import { loadCatalogEntry } from './catalog.ts';
import { ENTRY } from './fixtures.ts';
import { Catalog } from './schema.ts';

describe('catalog', () => {
  it('loads the checked-in entry by id', () => {
    expect(loadCatalogEntry('mealdrop').repo).toBe('storybookjs/mealdrop');
  });

  it.each([
    ['an unknown repo class', { ...ENTRY, class: 'tier3' }],
    ['a repo without an owner', { ...ENTRY, repo: 'mealdrop' }],
    ['an unsupported package manager', { ...ENTRY, packageManager: 'bun' }],
    ['an unknown field', { ...ENTRY, branch: 'main' }],
    ['a push target outside the orgs with a push token', { ...ENTRY, pushTo: 'twentyhq/twenty' }],
  ])('rejects %s', (_, entry) => {
    expect(() => Catalog.parse([entry])).toThrow();
  });

  it.each(['storybook-tmp/twenty', 'storybookjs/twenty'])(
    'accepts %s as the push target of an upstream repo',
    (pushTo) => {
      const [entry] = Catalog.parse([
        { ...ENTRY, id: 'twenty', repo: 'twentyhq/twenty', class: 'tier1', pushTo },
      ]);

      expect(entry?.pushTo).toBe(pushTo);
    }
  );

  it('rejects duplicate ids', () => {
    expect(() => Catalog.parse([ENTRY, ENTRY])).toThrow(/unique/);
  });
});
