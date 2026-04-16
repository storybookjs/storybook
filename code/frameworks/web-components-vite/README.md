# Storybook for Web components & Vite

See [documentation](https://storybook.js.org/docs/get-started/frameworks/web-components-vite?renderer=web-components&ref=readme) for installation instructions, usage examples, APIs, and more.

## Stencil

If you are using Stencil and register components with `defineCustomElements()` from the generated loader, enable Stencil's import injection so Vite can include the lazy-loaded component entry files in static Storybook builds.

For Stencil 4.26 and later:

```ts
import type { Config } from '@stencil/core';

export const config: Config = {
	extras: {
		enableImportInjection: true,
	},
};
```

For older Stencil versions, use `experimentalImportInjection: true` instead.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
