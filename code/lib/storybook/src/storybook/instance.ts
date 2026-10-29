import './server/hooks.ts';
import '@storybook/manager/internal/deep/builder-manager/hooks';

import { createStorybook as createInstance } from '@storybook/core';
import type { CreateStorybookInput, Storybook } from '@storybook/core';
import { builtInAddons, isManagerEnabled } from '../features/index.ts';
import { legacyAdapter } from './compat/legacy-adapter.ts';
import { commonPlugin } from './server/common.ts';

export * from '@storybook/core/internal/instance';

/** Load and configure one isolated headless Storybook. */
export function createStorybook(input: CreateStorybookInput): Promise<Storybook> {
  // Built-in manager entries follow `meta.order`; other entries keep their setup order.
  const managerOrders = new Map<string, number>();
  return createInstance(input, {
    builtInAddons,
    async setupPlugin(plugin, storybook) {
      if (plugin.manager) {
        const entry = plugin.manager;
        const order = (builtInAddons as readonly unknown[]).includes(plugin)
          ? plugin.meta.order
          : undefined;
        if (order === undefined) {
          storybook.hook('manager:entries:collect', () => [entry]);
        } else {
          managerOrders.set(entry, order);
          // Flags resolve at collect time, after every plugin and preset could set them.
          storybook.hook(
            'manager:entries:collect',
            async (entries) =>
              isManagerEnabled(plugin, await storybook.callHook('core:features:extend', undefined))
                ? insertByOrder(entries, entry, managerOrders)
                : entries,
            'reduce'
          );
        }
      }
      await plugin.setup(storybook);
    },
    common: commonPlugin,
    legacy: legacyAdapter,
  });
}

/** Insert `entry` before the first ordered entry with a higher order. */
function insertByOrder(entries: string[], entry: string, orders: Map<string, number>): string[] {
  const order = orders.get(entry)!;
  const index = entries.findIndex((other) => (orders.get(other) ?? -Infinity) > order);
  return index === -1 ? [...entries, entry] : entries.toSpliced(index, 0, entry);
}
