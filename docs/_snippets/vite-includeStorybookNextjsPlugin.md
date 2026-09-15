```ts filename="vitest.config.ts" renderer="react" language="ts"
import { defineConfig } from 'vite';
import { storybookNextJsPlugin } from '@storybook/nextjs-vite/vite-plugin';

export default defineConfig({
  // Required when configuring Vitest manually or using portable stories; loaded automatically by the Vitest addon
  plugins: [storybookNextJsPlugin()],
});
```
