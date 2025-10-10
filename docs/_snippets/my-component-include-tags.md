```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  //👇 Provides the `test-only` tag to all stories in this file
  tags: ['test-only'],
};

export default meta;
type Story = StoryObj<MyComponent>;

export const IncludeStory: Story = {
  //👇 Adds the `test-only` tag to this story to be included in the tests when enabled in the test-runner configuration
  tags: ['test-only'],
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  //👇 Provides the `test-only` tag to all stories in this file
  tags: ['test-only'],
};

export const IncludeStory = {
  //👇 Adds the `test-only` tag to this story to be included in the tests when enabled in the test-runner configuration
  tags: ['test-only'],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  //👇 Provides the `test-only` tag to all stories in this file
  tags: ['test-only'],
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IncludeStory: Story = {
  //👇 Adds the `test-only` tag to this story to be included in the tests when enabled in the test-runner configuration
  tags: ['test-only'],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `test-only` tag to all stories in this file
  tags: ['test-only'],
});

export const IncludeStory = meta.story({
  //👇 Adds the `test-only` tag to this story to be included in the tests when enabled in the test-runner configuration
  tags: ['test-only'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `test-only` tag to all stories in this file
  tags: ['test-only'],
});

export const IncludeStory = meta.story({
  //👇 Adds the `test-only` tag to this story to be included in the tests when enabled in the test-runner configuration
  tags: ['test-only'],
});
```
