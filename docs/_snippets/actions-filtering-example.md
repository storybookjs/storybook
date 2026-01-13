```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
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

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
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

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;

export default definePreview({
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
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;
export default definePreview({
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
});
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;

export default definePreview({
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
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;
export default definePreview({
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
});
```

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';

import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;

export default definePreview({
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
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="angular" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';

import { action } from 'storybook/actions';
import { spyOn } from 'storybook/test';

const originalConsoleLog = console.log;
export default definePreview({
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
});
```
