import { csfIndexer, experimental_indexers, features, services } from '../services/preset.ts';
import { defineAddon } from './addons.ts';
import type { Storybook } from './types.ts';

/** Core's defaults (CSF indexer, features, services); a host's own common addon extends them. */
export const commonAddon = defineAddon(() => ({
  meta: { name: 'storybook/core-common' },
  setup(storybook: Storybook): void {
    storybook.hook('core:services:register', () => services(storybook));
    storybook.hook('core:features:extend', (value) => features(value, storybook));
    // A non-function preset value merges into the previous one.
    storybook.hook('index:csf:extend', (value) =>
      value != null && typeof value === 'object' && !Array.isArray(value)
        ? { ...value, ...csfIndexer }
        : csfIndexer
    );
    storybook.hook('index:indexers:collect', (value) => experimental_indexers(value), 'reduce');
  },
}))();
