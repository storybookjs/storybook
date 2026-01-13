```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  // Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
  framework: '@storybook/your-framework',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="angular" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
});
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  framework: '@storybook/web-components-vite',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  framework: '@storybook/web-components-vite',
  // 👇 Storybook will load all existing stories within the MyStories folder
  stories: ['../packages/MyStories'],
});
```
