```js filename="setupFile.js|ts" renderer="common" language="js"
// Adjust the import based on the supported framework or Storybook's testing libraries (e.g., react, testing-vue3)
import { setProjectAnnotations } from '@storybook/your-framework';

// Replace this export with the default export from your Storybook preview file if you're working with a latest version of Storybook
import * as projectAnnotations from './.storybook/preview';

// Apply the global annotations from the Storybook preview file
setProjectAnnotations(projectAnnotations);
```
