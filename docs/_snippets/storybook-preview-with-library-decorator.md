```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="library-3"
import { setup } from '@storybook/vue3';

import { createPinia } from 'pinia';

setup((app) => {
  //👇 Registers a global Pinia instance inside Storybook to be consumed by existing stories
  app.use(createPinia());
});

export default {
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="margin: 3em;"><story /></div>',
    }),
  ],
};
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="library-3"
import { setup, Preview } from '@storybook/vue3';

import { createPinia } from 'pinia';

setup((app) => {
  //👇 Registers a global Pinia instance inside Storybook to be consumed by existing stories
  app.use(createPinia());
});

const preview: Preview = {
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="margin: 3em;"><story /></div>',
    }),
  ],
};

export default preview;
```

