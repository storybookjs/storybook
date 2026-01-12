```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  //👇 Provides the `skip-test` tag to all stories in this file
  tags: ['skip-test'],
};

export default meta;
type Story = StoryObj<MyComponent>;

export const SkipStory: Story = {
  //👇 Adds the `skip-test` tag to this story to allow it to be skipped in the tests when enabled in the test-runner configuration
  tags: ['skip-test'],
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  //👇 Provides the `skip-test` tag to all stories in this file
  tags: ['skip-test'],
};

export const SkipStory = {
  //👇 Adds the `skip-test` tag to this story to allow it to be skipped in the tests when enabled in the test-runner configuration
  tags: ['skip-test'],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  //👇 Provides the `skip-test` tag to all stories in this file
  tags: ['skip-test'],
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SkipStory: Story = {
  //👇 Adds the `skip-test` tag to this story to allow it to be skipped in the tests when enabled in the test-runner configuration
  tags: ['skip-test'],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `skip-test` tag to all stories in this file
  tags: ['skip-test'],
});

export const SkipStory = meta.story({
  //👇 Adds the `skip-test` tag to this story to allow it to be skipped in the tests when enabled in the test-runner configuration
  tags: ['skip-test'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `skip-test` tag to all stories in this file
  tags: ['skip-test'],
});

export const SkipStory = meta.story({
  //👇 Adds the `skip-test` tag to this story to allow it to be skipped in the tests when enabled in the test-runner configuration
  tags: ['skip-test'],
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `skip-test` tag to all stories in this file
  tags: ['skip-test'],
});

export const SkipStory = meta.story({
  //👇 Adds the `skip-test` tag to this story to allow it to be skipped in the tests when enabled in the test-runner configuration
  tags: ['skip-test'],
});
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `skip-test` tag to all stories in this file
  tags: ['skip-test'],
});

export const SkipStory = meta.story({
  //👇 Adds the `skip-test` tag to this story to allow it to be skipped in the tests when enabled in the test-runner configuration
  tags: ['skip-test'],
});
```
