```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="globals-api"
import { INITIAL_VIEWPORTS, MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

export default {
  parameters: {
    viewport: {
      options: {
        ...INITIAL_VIEWPORTS,
        ...MINIMAL_VIEWPORTS,
      },
    },
  },
  initialGlobals: {
    viewport: {
      value: 'iphone14promax',
      isRotated: false,
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="globals-api"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { INITIAL_VIEWPORTS, MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

const preview: Preview = {
  parameters: {
    viewport: {
      options: {
        ...INITIAL_VIEWPORTS,
        ...MINIMAL_VIEWPORTS,
      },
    },
  },
  initialGlobals: {
    viewport: {
      value: 'iphone14promax',
      isRotated: false,
    },
  },
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="without-globals"
import { INITIAL_VIEWPORTS, MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

export default {
  parameters: {
    viewport: {
      viewports: {
        ...INITIAL_VIEWPORTS,
        ...MINIMAL_VIEWPORTS,
      },
      defaultViewport: 'iphone14promax',
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="without-globals"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { INITIAL_VIEWPORTS, MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

const preview: Preview = {
  parameters: {
    viewport: {
      viewports: {
        ...INITIAL_VIEWPORTS,
        ...MINIMAL_VIEWPORTS,
      },
      defaultViewport: 'iphone14promax',
    },
  },
};

export default preview;
```
