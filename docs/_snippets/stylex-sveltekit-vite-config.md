```ts filename="vite.config.ts" renderer="svelte" language="ts"
import { sveltekit } from '@sveltejs/kit/vite';
import stylex from '@stylexjs/unplugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    // After sveltekit(), without `enforce`, so StyleX compiles Svelte's output
    {
      ...stylex.vite({
        useCSSLayers: { before: ['reset'] },
        externalPackages: ['@acme/tokens'],
        unstable_moduleResolution: { type: 'commonJS' },
        cssInjectionTarget: (fileName) => /(^|\/)iframe-[\w-]+\.css$/.test(fileName),
      }),
      enforce: undefined,
    },
  ],
});
```
