```ts filename=".storybook/preview.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., nextjs-vite, sveltekit, etc.)
import { definePreview } from '@storybook/your-framework';
import addonA11y from '@storybook/addon-a11y';

export default definePreview({
  // 👇 Add your addons here
  addons: [addonA11y()],
  parameters: {
    // type-safe!
    a11y: {
      options: { xpath: true },
    },
  },
});
```
