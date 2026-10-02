import type { Plugin } from 'vite';

export function configOverrides() {
  return {
    // SvelteKit sets SSR, we need it to be false when building
    name: 'storybook:sveltekit-overrides',
    apply: 'build',
    config: () => {
      return {
        build: { ssr: false },
        // SvelteKit defaults the app version to the build time, which would change every build
        define: { __SVELTEKIT_APP_VERSION__: JSON.stringify('storybook') },
      };
    },
  } satisfies Plugin;
}
