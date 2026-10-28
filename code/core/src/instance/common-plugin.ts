import type { Options, PresetPropertyFn } from '@storybook/core/internal/types';

import { csfIndexer, experimental_indexers, features, services } from '../services/preset.ts';
import type { HookContext } from './hooks.ts';
import { defineAddon } from './plugins.ts';
import type { Storybook } from './types.ts';

/** Core's defaults (CSF indexer, features, services); a host's own common plugin extends them. */
export const commonPlugin = defineAddon(() => ({
  meta: { name: 'storybook/core-common' },
  setup(storybook: Storybook): void {
    const hook = storybook.hook as (
      name: string,
      fn: (value: never, ctx?: HookContext) => unknown,
      kind: 'reduce' | 'notify'
    ) => void;
    const options = (ctx?: HookContext): Options =>
      ({ ...ctx, presets: storybook.presets }) as Options;
    const reduce = (name: string, fn: (value: never, options: Options) => unknown): void =>
      hook(name, (value, ctx) => fn(value, options(ctx)), 'reduce');

    hook('core:services:register', (value, ctx) => services(value, options(ctx)), 'notify');
    reduce('core:features:extend', features as PresetPropertyFn<'features'>);
    // A non-function preset value merges into the previous one.
    reduce('index:csf:extend', (value: unknown) =>
      value != null && typeof value === 'object' && !Array.isArray(value)
        ? { ...value, ...csfIndexer }
        : csfIndexer
    );
    reduce(
      'index:indexers:collect',
      experimental_indexers as PresetPropertyFn<'experimental_indexers'>
    );
  },
}))();
