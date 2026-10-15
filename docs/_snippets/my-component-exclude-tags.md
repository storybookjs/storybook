```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF (Legacy)"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './my-component.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
};

export default meta;
type Story = StoryObj<MyComponent>;

export const ExcludeStory: Story = {
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
};
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF"
import preview from '../.storybook/preview';

import { MyComponent } from './my-component.component';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
});

export const ExcludeStory = meta.story({
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
});
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF (Legacy)"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
};

export const ExcludeStory = {
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF (Legacy)"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExcludeStory: Story = {
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
});

export const ExcludeStory = meta.story({
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
});

export const ExcludeStory = meta.story({
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
});

export const ExcludeStory = meta.story({
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
});
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
});

export const ExcludeStory = meta.story({
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
});
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF (Legacy)"
export default {
  component: 'my-component',
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
};

export const ExcludeStory = {
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF (Legacy)"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-component',
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
};

export default meta;
type Story = StoryObj;

export const ExcludeStory: Story = {
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
});

export const ExcludeStory = meta.story({
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
});
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
  //👇 Provides the `no-tests` tag to all stories in this file
  tags: ['no-tests'],
});

export const ExcludeStory = meta.story({
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
});
```
