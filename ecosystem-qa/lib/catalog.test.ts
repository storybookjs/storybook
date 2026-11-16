import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadEntries } from './catalog.ts';
import { DISCOVERED, ENTRY } from './fixtures.ts';
import { parsePlan } from './qa-plan.ts';
import { Catalog, pushesCycle } from './schema.ts';

const PLAN = parsePlan(readFileSync(new URL('./plan.fixture.md', import.meta.url), 'utf8'));

describe('catalog', () => {
  it('parses every checked-in entry', () => {
    expect(loadEntries().length).toBeGreaterThan(1);
  });

  it.each([
    ['an unknown repo class', { ...ENTRY, class: 'tier3' }],
    ['a repo without an owner', { ...ENTRY, repo: 'mealdrop' }],
    ['an unsupported package manager', { ...ENTRY, packageManager: 'deno' }],
    ['an unknown field', { ...ENTRY, branch: 'main' }],
    ['a tier 1 entry without a push target', { ...ENTRY, class: 'tier1' }],
    ['a push target outside the orgs with a push token', { ...ENTRY, pushTo: 'twentyhq/twenty' }],
    [
      'a repo that is its own push target and has no push token',
      { ...ENTRY, repo: 'twentyhq/twenty' },
    ],
    ['a Node version that is not a plain version', { ...ENTRY, node: 'lts/*' }],
    ['an entry without a push target on a branch name', { ...DISCOVERED, ref: 'main' }],
    ['an entry without a push target on a short commit', { ...DISCOVERED, ref: 'e'.repeat(12) }],
    ['an entry without a push target marked for Windows', { ...DISCOVERED, windows: true }],
    [
      "tags whose builder is not the framework package's",
      {
        ...ENTRY,
        tags: {
          framework: '@storybook/react-vite',
          builder: 'webpack5',
          major: 10,
          features: [],
        },
      },
    ],
    [
      'a feature outside the closed list',
      {
        ...ENTRY,
        tags: {
          framework: '@storybook/react-vite',
          builder: 'vite',
          major: 10,
          features: ['i18n'],
        },
      },
    ],
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

  it('accepts a tier 2 fork whose baseline is qa/base', () => {
    const [entry] = Catalog.parse([
      { ...DISCOVERED, pushTo: 'storybook-tmp/vue-dsfr', ref: 'qa/base' },
    ]);

    expect(entry?.pushTo).toBe('storybook-tmp/vue-dsfr');
  });

  it('accepts an entry without a push target, outside the orgs with a push token, on a full commit', () => {
    expect(Catalog.parse([DISCOVERED])).toEqual([DISCOVERED]);
  });

  it('finds tags on every checked-in entry', () => {
    expect(
      loadEntries()
        .filter((entry) => !entry.tags)
        .map((entry) => entry.id)
    ).toEqual([]);
  });

  it('accepts a plain Node version', () => {
    const [entry] = Catalog.parse([{ ...ENTRY, node: '24.11.0' }]);

    expect(entry?.node).toBe('24.11.0');
  });

  it('rejects duplicate ids', () => {
    expect(() => Catalog.parse([ENTRY, ENTRY])).toThrow(/unique/);
  });
});

describe('loadEntries', () => {
  it('adds each discovered repo of a plan as an entry at its commit that pushes nothing', () => {
    const entry = loadEntries(PLAN).find((candidate) => candidate.id === 'primer-react');

    expect(entry).toEqual({
      id: 'primer-react',
      repo: 'primer/react',
      ref: '998b471a4ad78c7c23426038ef0c4a5261fc41cf',
      class: 'tier2',
      packageManager: 'npm',
      storybookDir: 'packages/react',
      windows: false,
    });
    expect(pushesCycle(entry!)).toBe(false);
  });

  it('refuses a plan that discovers a repo under the id of a catalog entry', () => {
    const plan = { ...PLAN, discovered: [{ ...PLAN.discovered[0]!, id: 'mantine' }] };

    expect(() => loadEntries(plan)).toThrow(/unique/);
  });
});
