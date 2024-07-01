```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  // ...rest of preview
  /**
   * 👇 All stories in your project will have these tags applied:
   *    - autodocs
   *    - dev (implicit default)
   *    - test (implicit default)
   */
  tags: ['autodocs'],
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import type { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  // ...rest of preview
  /**
   * 👇 All stories in your project will have these tags applied:
   *    - autodocs
   *    - dev (implicit default)
   *    - test (implicit default)
   */
  tags: ['autodocs'],
};

export default preview;
```

