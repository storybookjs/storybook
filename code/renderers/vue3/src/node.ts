import { defineRenderer, type HookContext, type Reduce } from '@storybook/core';
import type { Options } from '@storybook/core/internal/types';

import { experimental_vueDocgenEngine, type VueDocgenEngine } from './docgen/engine.ts';
import { getDocgenProvider, getManifests } from './docgen/provider.ts';
import { experimental_storyDocsProvider } from './docgen/story-docs-provider.ts';
import { getPreviewAnnotations } from './preview-annotations.ts';
import type { VueTypes } from './types.ts';

export type { VueDocgenEngine } from './docgen/engine.ts';
export type { VueTypes } from './types.ts';

// Consumed by external framework packages like storybook-vue3-rsbuild.
export { DOCGEN_WORKER_SPECIFIER } from './docgen/worker-specifier.ts';

/** The engine builder docgen plugins share with the docgen worker. */
export const vueDocgenEngine = experimental_vueDocgenEngine;

declare module '@storybook/core' {
  interface StorybookHooks {
    'legacy:experimental_vueDocgenEngine:extend': Reduce<
      (value: unknown, ctx?: HookContext) => Promise<VueDocgenEngine>
    >;
  }
}

/** Configure Vue rendering, annotations, and docgen. */
export const vue = defineRenderer<void, VueTypes>(() => ({
  meta: { name: '@storybook/vue3' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', async () =>
      getPreviewAnnotations(await storybook.callHook('core:docs:extend', {}))
    );
    storybook.hook('core:features:extend', (value) => ({ ...value, componentsManifest: true }));
    storybook.hook('core:docgen-enabled:extend', () => isTypescriptInstalled());
    storybook.hook('core:docgen-providers:collect', () => [getDocgenProvider()]);
    storybook.hook('core:story-docs-provider:extend', (value, ctx) =>
      experimental_storyDocsProvider(value ?? (async () => undefined), ctx as Options)
    );
    storybook.hook('index:manifests:extend', (value) =>
      getManifests(value ?? {}, storybook.options.features)
    );
    storybook.hook('core:import-parsers:collect', async () => {
      const { vueImportParser } = await import('./parsers/index.ts');
      return [vueImportParser];
    });
    storybook.hook(
      'legacy:experimental_vueDocgenEngine:extend',
      () => experimental_vueDocgenEngine(),
      'reduce'
    );
  },
}));

export default vue;

/** Server docgen runs on the optional `typescript` peer; without it, builder docgen stays on. */
function isTypescriptInstalled(): boolean {
  try {
    import.meta.resolve('typescript');
    return true;
  } catch {
    return false;
  }
}
