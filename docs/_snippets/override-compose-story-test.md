```js filename="Form.test.js|ts" renderer="common" language="js" tabTitle="compose-stories"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, svelte, etc.)
import { composeStories } from '@storybook/your-renderer';

import * as stories from './LoginForm.stories';

const { ValidForm } = composeStories(stories, {
  decorators: [
    // Decorators defined here will be added to all composed stories from this function
  ],
  globalTypes: {
    // Override globals for all composed stories from this function
  },
  parameters: {
    // Override parameters for all composed stories from this function
  },
});
```

```js filename="Form.test.js|ts" renderer="common" language="js" tabTitle="compose-story"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, svelte, etc.)
import { composeStories } from '@storybook/your-renderer';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const ValidForm = composeStory(ValidFormStory, Meta, {
  decorators: [
    // Decorators defined here will be added to this story
  ],
  globalTypes: {
    // Override globals for this story
  },
  parameters: {
    // Override parameters for this story
  },
});
```
