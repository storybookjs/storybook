```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="Without globals API"
import { MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

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
      viewports: {
        ...MINIMAL_VIEWPORTS,
        ...kindleViewports,
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="Without globals API"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Preview } from '@storybook/your-renderer';
import { MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

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
      viewports: {
        ...MINIMAL_VIEWPORTS,
        ...kindleViewports,
      },
    },
  },
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="With globals API"
import { MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

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

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="With globals API"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Preview } from '@storybook/your-renderer';
import { MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

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
