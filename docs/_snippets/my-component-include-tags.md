```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="story"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  tags: ['test-only'], // 👈 Provides the `test-only` tag to all stories in this file
};

export const IncludeStory = {
  //👇 Adds the `test-only` tag to this story to be included in the tests when enabled in the test-runner configuration
  tags: ['test-only'],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="story"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  tags: ['test-only'], // 👈 Provides the `test-only` tag to all stories in this file
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const IncludeStory: Story = {
  //👇 Adds the `test-only` tag to this story to be included in the tests when enabled in the test-runner configuration
  tags: ['test-only'],
};
```
