```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Path/To/MyComponent',
  component: MyComponent,
  decorators: [
    /* ... */
  ],
  parameters: {
    /* ... */
  },
};

export default meta;
```

```js filename="MyComponent.story.js|jsx" renderer="common" language="js"
import { MyComponent } from './MyComponent';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Path/To/MyComponent',
  component: MyComponent,
  decorators: [
    /* ... */
  ],
  parameters: {
    /* ... */
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Meta } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Path/To/MyComponent',
  component: MyComponent,
  decorators: [
    /* ... */
  ],
  parameters: {
    /* ... */
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
export default {
  title: 'Path/To/MyComponent',
  component: 'my-component',
  decorators: [
    /* ... */
  ],
  parameters: {
    /* ... */
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  title: 'Path/To/MyComponent',
  component: 'my-component',
  decorators: [
    /* ... */
  ],
  parameters: {
    /* ... */
  },
};

export default meta;
```
