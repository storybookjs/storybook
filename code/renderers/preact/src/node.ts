import { defineRenderer, type Collect, type HookContext } from '@storybook/core';

import { getPreviewAnnotations } from './preview-annotations.ts';
import type { PreactRenderer } from './types.ts';

export type { PreactRenderer } from './types.ts';

const OPTIMIZE_VITE_DEPS = ['preact/compat/jsx-runtime'];

// Same type as builder-vite's declaration; preact does not depend on the builder.
declare module '@storybook/core' {
  interface StorybookHooks {
    'builder:vite-deps:collect': Collect<(value: string[], ctx?: HookContext) => string[]>;
  }
}

/** Configure Preact rendering and the react aliases to preact/compat. */
export const preact = defineRenderer<void, PreactRenderer>(() => ({
  meta: { name: '@storybook/preact' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', async () =>
      getPreviewAnnotations(await storybook.callHook('core:docs:extend', {}))
    );
    // Mirrors @preact/preset-vite, which aliases react and react-dom to preact/compat.
    storybook.hook(
      'legacy:resolvedReact:extend',
      (value) => ({ ...value, react: 'preact/compat', reactDom: 'preact/compat' }),
      'reduce'
    );
    storybook.hook('builder:vite-deps:collect', () => OPTIMIZE_VITE_DEPS, 'collect');
  },
}));

export default preact;
