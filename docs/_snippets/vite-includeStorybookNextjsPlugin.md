```ts filename="vitest.config.ts" renderer="react" language="ts"
import { defineConfig } from 'vite';
import { storybookNextJsPlugin } from '@storybook/nextjs-vite/vite-plugin';

export default defineConfig({
  // only necessary when not using @storybook/addon-vitest, otherwise the plugin is loaded automatically
  plugins: [storybookNextJsPlugin()],
});
```
