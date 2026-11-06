import { describe, expect, it } from 'vitest';

import { loadCatalogEntry, parseCatalog } from './catalog.ts';

const valid = {
  id: 'mealdrop',
  repo: 'storybookjs/mealdrop',
  ref: 'main',
  class: 'owned',
  packageManager: 'yarn',
  storybookDir: '.',
  windows: true,
};

describe('catalog', () => {
  it('loads the checked-in entry by id', () => {
    expect(loadCatalogEntry('mealdrop').repo).toBe('storybookjs/mealdrop');
  });

  it.each([
    ['an unknown repo class', { ...valid, class: 'tier3' }],
    ['a repo without an owner', { ...valid, repo: 'mealdrop' }],
    ['an unsupported package manager', { ...valid, packageManager: 'bun' }],
    ['an unknown field', { ...valid, branch: 'main' }],
  ])('rejects %s', (_, entry) => {
    expect(() => parseCatalog([entry])).toThrow();
  });

  it('rejects duplicate ids', () => {
    expect(() => parseCatalog([valid, valid])).toThrow(/unique/);
  });
});
