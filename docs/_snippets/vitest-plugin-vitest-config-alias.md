```js filename=".storybook/main.js" renderer="common" tabTitle="Before"
import { mergeConfig } from 'vite';

export default {
  // ...
  viteFinal: async (viteConfig) => {
    return mergeConfig(viteConfig, {
      resolve: {
        alias: {
          '@components': '/src/components',
          // ...
        },
      },
    });
  },
};
```

```js filename="vitest.config.ts" renderer="common" tabTitle="After"
export default defineConfig({
  // ...
  resolve: {
    alias: {
      '@components': '/src/components',
      // ...
    },
  },
});
```
