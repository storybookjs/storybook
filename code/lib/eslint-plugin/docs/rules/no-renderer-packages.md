# Do not import renderer packages directly in stories (no-renderer-packages)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>recommended</li><li>flat/recommended</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

This rule prevents importing Storybook renderer packages directly in stories. Instead, you should use framework-specific packages that are designed for your build tool (e.g., Vite, webpack).

The rule will suggest appropriate framework packages based on which renderer you're trying to use:

- For `@storybook/html`: Use `@storybook/html-vite` or `@storybook/html-webpack5`
- For `@storybook/preact`: Use `@storybook/preact-vite` or `@storybook/preact-webpack5`
- For `@storybook/react`: Use `@storybook/nextjs`, `@storybook/react-vite`, `@storybook/react-webpack5`, `@storybook/react-native-web-vite`, or `@storybook/experimental-nextjs-vite`
- For `@storybook/server`: Use `@storybook/server-webpack5`
- For `@storybook/svelte`: Use `@storybook/svelte-vite`, `@storybook/svelte-webpack5`, or `@storybook/sveltekit`
- For `@storybook/vue3`: Use `@storybook/vue3-vite` or `@storybook/vue3-webpack5`
- For `@storybook/web-components`: Use `@storybook/web-components-vite` or `@storybook/web-components-webpack5`

Examples of **incorrect** code for this rule:

```js
// Don't import renderer packages directly
import { something } from '@storybook/react';
import { something } from '@storybook/vue3';
import { something } from '@storybook/web-components';
```

Examples of **correct** code for this rule:

```js
// Do use the appropriate framework package for your build tool
import { something } from '@storybook/react-vite'; // For Vite
import { something } from '@storybook/vue3-webpack5'; // For Webpack 5
import { something } from '@storybook/web-components-vite'; // For Vite
import { something } from '@storybook/nextjs'; // For Next.js
```

## When Not To Use It

If you have a specific need to use renderer packages directly in your stories, you can disable this rule. However, it's recommended to use the framework-specific packages as they are optimized for your build tool and provide better integration with your development environment.

## Further Reading

For more information about Storybook's framework-specific packages and build tools, see:

- [Storybook for React](https://storybook.js.org/docs/react/get-started/install/)
- [Storybook for Vue](https://storybook.js.org/docs/vue/get-started/install/)
- [Storybook for Web Components](https://storybook.js.org/docs/web-components/get-started/install/)
- [Storybook for Svelte](https://storybook.js.org/docs/svelte/get-started/install/)
- [Storybook for HTML](https://storybook.js.org/docs/html/get-started/install/)
- [Storybook for Preact](https://storybook.js.org/docs/preact/get-started/install/)
