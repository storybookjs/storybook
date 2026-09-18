# Do not import renderer packages directly in stories (no-renderer-packages)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>recommended</li><li>flat/recommended</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

This rule prevents importing Storybook renderer packages directly into stories. Instead, use framework-specific packages designed for your build tool (e.g., Vite, Webpack).

The rule will suggest appropriate framework packages based on which renderer you're trying to use:

- For `@storybook/html`: Use `@storybook/html-vite`
- For `@storybook/preact`: Use `@storybook/preact-vite`
- For `@storybook/react`: Use `@storybook/nextjs`, `@storybook/nextjs-vite`, `@storybook/react-vite`, `@storybook/react-webpack5`, or `@storybook/react-native-web-vite`
- For `@storybook/server`: Use `@storybook/server-webpack5`
- For `@storybook/svelte`: Use `@storybook/svelte-vite`, or `@storybook/sveltekit`
- For `@storybook/vue3`: Use `@storybook/vue3-vite`
- For `@storybook/web-components`: Use `@storybook/web-components-vite`

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
import { something } from '@storybook/vue3-vite'; // For Vite
import { something } from '@storybook/web-components-vite'; // For Vite
import { something } from '@storybook/nextjs'; // For Next.js
```

## When Not To Use It

If you have a specific need to use renderer packages directly in your stories, you can turn off this rule. However, it's recommended to use the framework-specific packages as they are optimized for your build tool and provide better integration with your development environment.

## Further Reading

For more information about Storybook's framework-specific packages and build tools, see:

- [Storybook for React](https://storybook.js.org/docs/get-started/frameworks/react-vite)
- [Storybook for Vue](https://storybook.js.org/docs/get-started/frameworks/vue3-vite)
- [Storybook for Web Components](https://storybook.js.org/docs/get-started/frameworks/web-components-vite)
- [Storybook for Svelte](https://storybook.js.org/docs/get-started/frameworks/svelte-vite)
- [Storybook for HTML](https://storybook.js.org/docs/get-started/install?renderer=html)
- [Storybook for Preact](https://storybook.js.org/docs/get-started/frameworks/preact-vite)
