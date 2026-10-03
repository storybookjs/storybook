```ts filename="vite.config.ts" renderer="react" language="ts"
import react from '@vitejs/plugin-react';
import stylex from '@stylexjs/unplugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // Use the same StyleX options as your app, so class names and variables match
    stylex.vite({
      useCSSLayers: { before: ['reset'] },
      // Token packages installed in node_modules (see "Tokens from a package" below)
      externalPackages: ['@acme/tokens'],
      unstable_moduleResolution: { type: 'commonJS' },
      // Put the StyleX CSS in Storybook's preview CSS file in static builds
      cssInjectionTarget: (fileName) => /(^|\/)iframe-[\w-]+\.css$/.test(fileName),
    }),
    react(),
  ],
});
```
