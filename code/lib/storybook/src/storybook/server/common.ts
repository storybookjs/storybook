import {
  defineAddon,
  internal_commonPlugin as coreCommonPlugin,
  type HookContext,
  type Storybook,
} from '@storybook/core/internal/instance';
import type { Options } from '@storybook/core/internal/types';

import * as common from './presets/common-defaults.ts';
import { createStoryScreenshotAccess } from './story-screenshot.ts';

/** Register the product's defaults on top of core's; core sets this up before every other plugin. */
export const commonPlugin = defineAddon(() => ({
  meta: { name: 'storybook/common' },
  async setup(storybook: Storybook): Promise<void> {
    await coreCommonPlugin.setup(storybook);
    const storyScreenshots = createStoryScreenshotAccess(storybook);
    storybook.hook('core:story-render:extend', () => storyScreenshots);
    storybook.hook('core:instance:close', () => storyScreenshots.close());
    const hook = storybook.hook as (
      name: string,
      fn: (value: never, ctx?: HookContext) => unknown,
      kind: 'reduce' | 'notify'
    ) => void;
    const options = (ctx?: HookContext): Options =>
      ({ ...ctx, presets: storybook.presets }) as Options;
    const reduce = (name: string, fn: (value: never, options: Options) => unknown): void =>
      hook(name, (value, ctx) => fn(value, options(ctx)), 'reduce');

    reduce('core:static-dirs:collect', common.staticDirs);
    reduce('manager:favicon:extend', common.favicon);
    reduce('builder:babel:extend', common.babel);
    reduce('manager:title:extend', common.title);
    reduce('preview:log-level:extend', common.logLevel);
    reduce('preview:head:extend', common.previewHead);
    reduce('core:env:extend', common.env);
    reduce('preview:body:extend', common.previewBody);
    reduce('core:typescript:extend', common.typescript);
    reduce('server:api:extend', common.experimental_serverAPI);
    reduce('core:config:extend', common.core);
    reduce('core:framework-options:extend', common.frameworkOptions);
    reduce('manager:head:extend', common.managerHead);
    hook(
      'server:channel:ready',
      (channel, ctx) => common.experimental_serverChannel(channel, options(ctx) as never),
      'notify'
    );
    reduce('legacy:resolvedReact:extend', common.resolvedReact);
    reduce('manager:entries:collect', common.managerEntries);

    reduce('server:app:extend', common.experimental_devServer);
    reduce('index:generator:extend', common.storyIndexGenerator);
  },
}))();
