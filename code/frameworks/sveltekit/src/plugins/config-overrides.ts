import type { Plugin } from 'vite';

export function configOverrides() {
  return {
    // SvelteKit sets SSR, we need it to be false when building
    name: 'storybook:sveltekit-overrides',
    apply: 'build',
    config: () => {
      return {
        build: { ssr: false },
        // SvelteKit's compile plugin defines these, and Storybook removes that plugin. `$app/env/public`
        // reads `env` from the payload. See https://github.com/sveltejs/kit/blob/090496890cedbbff15d998695d48cd31e7d698b7/packages/kit/src/exports/vite/build/index.js#L346-L349
        // and https://github.com/sveltejs/kit/blob/090496890cedbbff15d998695d48cd31e7d698b7/packages/kit/src/exports/vite/build/index.js#L1064-L1075
        define: {
          __SVELTEKIT_PAYLOAD__: JSON.stringify({ env: {} }),
          __SVELTEKIT_MANIFEST_ASSETS__: '[]',
          __SVELTEKIT_MANIFEST_IMMUTABLE__: '[]',
          __SVELTEKIT_MANIFEST_PRERENDERED__: '[]',
          __SVELTEKIT_MANIFEST_ROUTES__: '[]',
        },
      };
    },
  } satisfies Plugin;
}
