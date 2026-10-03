```js filename=".storybook/main.js" renderer="react" language="js"
import stylex from '@stylexjs/unplugin';

export default {
  framework: '@storybook/nextjs-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    return {
      ...config,
      plugins: [
        // The same options as the StyleX plugin in your babel.config.js
        stylex.vite({
          useCSSLayers: { before: ['reset'] },
          externalPackages: ['@acme/tokens'],
          unstable_moduleResolution: { type: 'commonJS' },
          cssInjectionTarget: (fileName) => /(^|\/)iframe-[\w-]+\.css$/.test(fileName),
        }),
        ...(config.plugins ?? []),
      ],
    };
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts"
import stylex from '@stylexjs/unplugin';
import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  framework: '@storybook/nextjs-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    return {
      ...config,
      plugins: [
        // The same options as the StyleX plugin in your babel.config.js
        stylex.vite({
          useCSSLayers: { before: ['reset'] },
          externalPackages: ['@acme/tokens'],
          unstable_moduleResolution: { type: 'commonJS' },
          cssInjectionTarget: (fileName) => /(^|\/)iframe-[\w-]+\.css$/.test(fileName),
        }),
        ...(config.plugins ?? []),
      ],
    };
  },
};

export default config;
```
