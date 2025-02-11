```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ❌ Don't use the package's index file to import the component.
// import { MyComponent } from '@component-package';

// ✅ Use the component's export to import it directly.
import { MyComponent } from '@component-package/src/MyComponent';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'MyComponent',
  component: MyComponent,
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

// ❌ Don't use the package's index file to import the component.
// import { MyComponent } from '@component-package';

// ✅ Use the component's export to import it directly.
import { MyComponent } from '@component-package/src/MyComponent';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'MyComponent',
  component: MyComponent,
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

// ❌ Don't use the package's index file to import the component.
// import { MyComponent } from '@component-package';

// ✅ Use the component's export to import it directly.
import { MyComponent } from '@component-package/src/MyComponent';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'MyComponent',
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

// ❌ Don't use the package's index file to import the component.
// import { MyComponent } from '@component-package';

// ✅ Use the component's export to import it directly.
import { MyComponent } from '@component-package/src/MyComponent';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'MyComponent',
  component: MyComponent,
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

// ❌ Don't use the package's index file to import the component.
// import { MyComponent } from '@component-package';

// ✅ Use the component's export to import it directly.
import { MyComponent } from '@component-package/src/MyComponent';

const meta: Meta<typeof MyComponent> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'MyComponent',
  component: MyComponent,
};

export default meta;
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

// ❌ Don't use the package's index file to import the component.
// import { MyComponent } from '@component-package';

// ✅ Use the component's export to import it directly.
import { MyComponent } from '@component-package/src/MyComponent';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'MyComponent',
  component: MyComponent,
});
```
