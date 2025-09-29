```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

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

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
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

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
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
