```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  // ...rest of preview
  /*
   * All stories in your project will have these tags applied:
   * - autodocs
   * - dev (implicit default)
   * - test (implicit default)
   */
  tags: ['autodocs'],
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import type { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  // ...rest of preview
  /*
   * All stories in your project will have these tags applied:
   * - autodocs
   * - dev (implicit default)
   * - test (implicit default)
   */
  tags: ['autodocs'],
};

export default preview;
```

```ts filename=".storybook/preview.js|ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework/preview';

const config definePreview({
  // ...rest of preview
  /*
   * All stories in your project will have these tags applied:
   * - autodocs
   * - dev (implicit default)
   * - test (implicit default)
   */
  tags: ['autodocs'],
});

export default config;
```

<!-- js & ts-4-9 (when applicable) still needed while providing both CSF 3 & 4 -->

```js filename=".storybook/preview.js|ts" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework/preview';

const config definePreview({
  // ...rest of preview
  /*
   * All stories in your project will have these tags applied:
   * - autodocs
   * - dev (implicit default)
   * - test (implicit default)
   */
  tags: ['autodocs'],
});

export default config;
```
