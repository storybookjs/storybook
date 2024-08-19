```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="without-globals"
export default {
  parameters: {
    viewport: {
      viewports: {
        SmallPhone: {
          name: 'Small phone',
          styles: {
            width: '320px',
            height: '568px',
          },
        },
        LargePhone: {
          name: 'Large phone',
          styles: {
            width: '414px',
            height: '896px',
          },
        },
        Tablet: {
          name: 'Tablet',
          styles: {
            height: '1024px',
            width: '768px',
          },
        },
        Desktop: {
          name: 'Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
  },
};
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="globals-api"
export default {
  parameters: {
    viewport: {
      options: {
        SmallPhone: {
          name: 'Small phone',
          styles: {
            width: '320px',
            height: '568px',
          },
        },
        LargePhone: {
          name: 'Large phone',
          styles: {
            width: '414px',
            height: '896px',
          },
        },
        Tablet: {
          name: 'Tablet',
          styles: {
            height: '1024px',
            width: '768px',
          },
        },
        Desktop: {
          name: 'Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="without-globals"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  parameters: {
    viewport: {
      viewports: {
        SmallPhone: {
          name: 'Small phone',
          styles: {
            width: '320px',
            height: '568px',
          },
        },
        LargePhone: {
          name: 'Large phone',
          styles: {
            width: '414px',
            height: '896px',
          },
        },
        Tablet: {
          name: 'Tablet',
          styles: {
            height: '1024px',
            width: '768px',
          },
        },
        Desktop: {
          name: 'Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="globals-api"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  parameters: {
    viewport: {
      options: {
        SmallPhone: {
          name: 'Small phone',
          styles: {
            width: '320px',
            height: '568px',
          },
        },
        LargePhone: {
          name: 'Large phone',
          styles: {
            width: '414px',
            height: '896px',
          },
        },
        Tablet: {
          name: 'Tablet',
          styles: {
            height: '1024px',
            width: '768px',
          },
        },
        Desktop: {
          name: 'Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
  },
};

export default preview;
```
