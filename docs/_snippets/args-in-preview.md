```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
};
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Preview } from '@storybook/your-renderer';

const preview = {
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
} satisfies Preview;

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
});
```
