import './server/hooks.ts';
import '@storybook/manager/internal/deep/builder-manager/hooks';

import { createStorybook as createInstance } from '@storybook/core';
import type { CreateStorybookInput, Storybook } from '@storybook/core';
import { builtInAddons, isManagerEnabled } from '../features/index.ts';
import { legacyAdapter } from './compat/legacy-adapter.ts';
import { commonAddon } from './server/common.ts';
import type { StaticBuild } from './server/run-static-build.ts';
import type { DevServer, DevServerCliOptions } from './server/start-dev-server.ts';

export * from '@storybook/core/internal/instance';

/** An instance whose `dev()` starts the product dev server and `build()` writes the static Storybook. */
export interface ProductStorybook extends Storybook {
  dev(): Promise<DevServer>;
  build(): Promise<StaticBuild>;
}

/** Create one isolated Storybook with the built-in features; `ready()` loads and configures it. */
export function createStorybook(
  input: CreateStorybookInput & { cliOptions?: DevServerCliOptions }
): ProductStorybook {
  // Built-in manager entries follow `meta.order`; other entries keep their setup order.
  const managerOrders = new Map<string, number>();
  return createInstance(input, {
    // Loaded on demand, so headless hosts skip the HTTP stack.
    async dev(storybook): Promise<DevServer> {
      const { startDevServer } = await import('./server/start-dev-server.ts');
      return startDevServer(storybook, input.cliOptions);
    },
    async build(storybook): Promise<StaticBuild> {
      const { runStaticBuild } = await import('./server/run-static-build.ts');
      return runStaticBuild(storybook, input.cliOptions);
    },
    builtInAddons,
    async setupAddon(addon, storybook) {
      if (addon.manager) {
        const entry = addon.manager;
        const order = (builtInAddons as readonly unknown[]).includes(addon)
          ? addon.meta.order
          : undefined;
        if (order === undefined) {
          storybook.hook('manager:entries:collect', () => [entry]);
        } else {
          managerOrders.set(entry, order);
          // Flags resolve at collect time, after every addon and preset could set them.
          storybook.hook(
            'manager:entries:collect',
            async (entries) =>
              isManagerEnabled(addon, await storybook.callHook('core:features:extend', undefined))
                ? insertByOrder(entries, entry, managerOrders)
                : entries,
            'reduce'
          );
        }
      }
      await addon.setup(storybook);
    },
    common: commonAddon,
    legacy: legacyAdapter,
  }) as ProductStorybook;
}

/** Insert `entry` before the first ordered entry with a higher order. */
function insertByOrder(entries: string[], entry: string, orders: Map<string, number>): string[] {
  const order = orders.get(entry)!;
  const index = entries.findIndex((other) => (orders.get(other) ?? -Infinity) > order);
  return index === -1 ? [...entries, entry] : entries.toSpliced(index, 0, entry);
}
