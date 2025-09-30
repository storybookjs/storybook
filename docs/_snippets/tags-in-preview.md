```js filename=".storybook/preview.js" renderer="common" language="js"
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

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

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
