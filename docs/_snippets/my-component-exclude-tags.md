```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="story"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  tags: ['no-tests'], // 👈 Provides the `no-tests` tag to all stories in this file
};

export const ExcludeStory = {
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="story"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  tags: ['no-tests'], // 👈 Provides the `no-tests` tag to all stories in this file
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const ExcludeStory: Story = {
  //👇 Adds the `no-tests` tag to this story to exclude it from the tests when enabled in the test-runner configuration
  tags: ['no-tests'],
};
```

