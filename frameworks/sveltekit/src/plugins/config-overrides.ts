import type { Plugin } from 'vite';

export function configOverrides() {
  return {
    // SvelteKit sets SSR, we need it to be false when building
    name: 'storybook:sveltekit-overrides',
    apply: 'build',
    config: () => {
      return { build: { ssr: false } };
    },
  } satisfies Plugin;
}
