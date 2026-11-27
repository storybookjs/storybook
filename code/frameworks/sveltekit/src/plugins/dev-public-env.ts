import type { Plugin } from 'vite';

export function devPublicEnv() {
  return {
    name: 'storybook:sveltekit-dev-public-env',
    apply: 'serve',
    transform: {
      // In development, `$app/env/public` reads `env` from this global, which SvelteKit's HTML sets.
      // Setting it in the module itself works regardless of which module Storybook evaluates first.
      // See https://github.com/sveltejs/kit/blob/090496890cedbbff15d998695d48cd31e7d698b7/packages/kit/src/core/env.js#L280-L283
      filter: { id: /\/generated\/dev\/env\/public\/client\.js(\?|$)/ },
      handler(code) {
        return `(globalThis.__sveltekit_dev ??= {}).env ??= {};${code}`;
      },
    },
  } satisfies Plugin;
}
