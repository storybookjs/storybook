```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
// ❌ Don't use the package's index file to import the component.
import { MyComponent } from '@component-package';

// ✅ Use the component's export to import it directly.
import { MyComponent } from '@component-package/src/MyComponent';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'MyComponent',
  component: MyComponent,
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

// ❌ Don't use the package's index file to import the component.
import { MyComponent } from '@component-package';

// ✅ Use the component's export to import it directly.
import { MyComponent } from '@component-package/src/MyComponent';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'MyComponent',
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

// ❌ Don't use the package's index file to import the component.
import { MyComponent } from '@component-package';

// ✅ Use the component's export to import it directly.
import { MyComponent } from '@component-package/src/MyComponent';

const meta: Meta<typeof MyComponent> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'MyComponent',
  component: MyComponent,
};

export default meta;
```
