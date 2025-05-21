```js filename=".storybook/preview.js" renderer="common" language="js"
import { MINIMAL_VIEWPORTS } from 'storybook/viewport';

const kindleViewports = {
  kindleFire2: {
    name: 'Kindle Fire 2',
    styles: {
      width: '600px',
      height: '963px',
    },
  },
  kindleFireHD: {
    name: 'Kindle Fire HD',
    styles: {
      width: '533px',
      height: '801px',
    },
  },
};

export default {
  parameters: {
    viewport: {
      options: {
        ...MINIMAL_VIEWPORTS,
        ...kindleViewports,
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Preview } from '@storybook/your-framework';

import { MINIMAL_VIEWPORTS } from 'storybook/viewport';

const kindleViewports = {
  kindleFire2: {
    name: 'Kindle Fire 2',
    styles: {
      width: '600px',
      height: '963px',
    },
  },
  kindleFireHD: {
    name: 'Kindle Fire HD',
    styles: {
      width: '533px',
      height: '801px',
    },
  },
};

const preview: Preview = {
  parameters: {
    viewport: {
      options: {
        ...MINIMAL_VIEWPORTS,
        ...kindleViewports,
      },
    },
  },
};

export default preview;
```
