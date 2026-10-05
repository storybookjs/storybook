```ts filename="vite.config.ts" renderer="react" language="ts"
import react from '@vitejs/plugin-react';
import stylex from '@stylexjs/unplugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    stylex.vite({
      // Your app's StyleX options. Storybook uses this file too, so they always match.
      useCSSLayers: { before: ['reset'] },
      // Storybook's static build: add the StyleX CSS to the preview CSS file.
      // Your app has no iframe-*.css file, so its build keeps StyleX's default choice.
      cssInjectionTarget: (fileName) => /(^|\/)iframe-[\w-]+\.css$/.test(fileName),
    }),
    react(),
  ],
});
```
