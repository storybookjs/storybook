```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  // Replace sveltekit with svelte-vite if you are not working with SvelteKit
  framework: '@storybook/sveltekit',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx|svelte)'],
  addons: [
    // Other Storybook addons
    '@storybook/addon-svelte-csf', //👈 The Svelte CSF addon goes here
  ],
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
// Replace sveltekit with svelte-vite if you are not working with SvelteKit
import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
  framework: '@storybook/sveltekit',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx|svelte)'],
  addons: [
    // Other Storybook addons
    '@storybook/addon-svelte-csf', //👈 The Svelte CSF addon goes here
  ],
};

export default config;
```
