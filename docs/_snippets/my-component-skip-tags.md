```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="story"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  tags: ['skip-test'], // 👈 Provides the `skip-test` tag to all stories in this file
};

export const SkipStory = {
  //👇 Adds the `skip-test` tag to this story to allow it to be skipped in the tests when enabled in the test-runner configuration
  tags: ['skip-test'],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="story"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  tags: ['skip-test'], // 👈 Provides the `skip-test` tag to all stories in this file
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const SkipStory: Story = {
  //👇 Adds the `skip-test` tag to this story to allow it to be skipped in the tests when enabled in the test-runner configuration
  tags: ['skip-test'],
};
```
