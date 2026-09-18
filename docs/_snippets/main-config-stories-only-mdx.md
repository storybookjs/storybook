```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g., nextjs-vite, vue3-vite, angular, sveltekit, etc.
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  // ...
  // define at least one local story/page here
  stories: ['../Introduction.mdx'],
  // define composed Storybooks here
  refs: {
    firstProject: { title: 'First', url: 'some-url' },
    secondProject: { title: 'Second', url: 'other-url' },
  },
};

export default preview;
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  // ...
  // define at least one local story/page here
  stories: ['../Introduction.mdx'],
  // define composed Storybooks here
  refs: {
    firstProject: { title: 'First', url: 'some-url' },
    secondProject: { title: 'Second', url: 'other-url' },
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using, e.g., nextjs, nextjs-vite, react-vite, etc.
import { defineMain } from '@storybook/your-framework/node';

const config = defineMain({
  // ...
  // define at least one local story/page here
  stories: ['../Introduction.mdx'],
  // define composed Storybooks here
  refs: {
    firstProject: { title: 'First', url: 'some-url' },
    secondProject: { title: 'Second', url: 'other-url' },
  },
});

export default config;
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using, e.g., nextjs, nextjs-vite, react-vite, etc.
import { defineMain } from '@storybook/your-framework/node';

const config = defineMain({
  // ...
  // define at least one local story/page here
  stories: ['../Introduction.mdx'],
  // define composed Storybooks here
  refs: {
    firstProject: { title: 'First', url: 'some-url' },
    secondProject: { title: 'Second', url: 'other-url' },
  },
});

export default config;
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

const config = defineMain({
  // ...
  // define at least one local story/page here
  stories: ['../Introduction.mdx'],
  // define composed Storybooks here
  refs: {
    firstProject: { title: 'First', url: 'some-url' },
    secondProject: { title: 'Second', url: 'other-url' },
  },
});

export default config;
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

const config = defineMain({
  // ...
  // define at least one local story/page here
  stories: ['../Introduction.mdx'],
  // define composed Storybooks here
  refs: {
    firstProject: { title: 'First', url: 'some-url' },
    secondProject: { title: 'Second', url: 'other-url' },
  },
});

export default config;
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

const config = defineMain({
  // ...
  // define at least one local story/page here
  stories: ['../Introduction.mdx'],
  // define composed Storybooks here
  refs: {
    firstProject: { title: 'First', url: 'some-url' },
    secondProject: { title: 'Second', url: 'other-url' },
  },
});

export default config;
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

const config = defineMain({
  // ...
  // define at least one local story/page here
  stories: ['../Introduction.mdx'],
  // define composed Storybooks here
  refs: {
    firstProject: { title: 'First', url: 'some-url' },
    secondProject: { title: 'Second', url: 'other-url' },
  },
});

export default config;
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

const config = defineMain({
  // ...
  // define at least one local story/page here
  stories: ['../Introduction.mdx'],
  // define composed Storybooks here
  refs: {
    firstProject: { title: 'First', url: 'some-url' },
    secondProject: { title: 'Second', url: 'other-url' },
  },
});

export default config;
```
