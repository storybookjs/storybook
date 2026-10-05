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
        // Your app's StyleX options. Storybook uses this file too, so they always match.
        useCSSLayers: { before: ['reset'] },
        // Storybook's static build: add the StyleX CSS to the preview CSS file.
        // Your app has no iframe-*.css file, so its build keeps StyleX's default choice.
        cssInjectionTarget: (fileName) => /(^|\/)iframe-[\w-]+\.css$/.test(fileName),
      }),
      enforce: undefined,
    },
  ],
});
```
