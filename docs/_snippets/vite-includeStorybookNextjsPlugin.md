```tsx
// vitest.config.ts
import { defineConfig } from "vite";
import { storybookNextJsPlugin } from '@storybook/nextjs-vite/vite-plugin'

export default defineConfig({
  plugins: [storybookNextJsPlugin()],
});
```