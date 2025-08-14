```ts filename=".storybook/preview.ts" renderer="common" language="ts"
import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;
export const beforeEach = async () => {
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
}
```

```js filename=".storybook/preview.js" renderer="common" language="js"
import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;
export const beforeEach = async () => {
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
}
```
