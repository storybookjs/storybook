```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, svelte)
import type { Preview } from '@storybook/your-framework';

import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;
const preview: Preview = {
  async beforeEach() {
    spyOn(console, 'log')
    // Disable automatic logging in the actions panel
    .mockName('')
    .mockImplementation((args) => {
      // Check if the log message matches a certain pattern
      if (someCondition(args)) {
        // Manually log an action
        action('console.log')(args);
      }

      // Call the original console.log function
      originalConsoleLog(...args);
    });
  },
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js"
import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;
export default {
  async beforeEach() {
    spyOn(console, 'log')
    // Disable automatic logging in the actions panel
    .mockName('')
    .mockImplementation((args) => {
      // Check if the log message matches a certain pattern
      if (someCondition(args)) {
        // Manually log an action
        action('console.log')(args);
      }

      // Call the original console.log function
      originalConsoleLog(...args);
    });
  },
};
```
