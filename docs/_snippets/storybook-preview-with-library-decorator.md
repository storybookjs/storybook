```js filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="preview"
import type { Preview } from '@storybook/angular';

import { setCompodocJson } from '@storybook/addon-docs/angular';

import docJson from '../documentation.json';

import '../src/polyfills';

setCompodocJson(docJson);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
```

```ts filename="src/polyfills.ts" renderer="angular" language="ts" tabTitle="polyfills"
import '@angular/localize/init';
```

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="library"
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

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="component"
import { setup } from '@storybook/vue3';

import { library } from '@fortawesome/fontawesome-svg-core';
import { faPlusSquare as fasPlusSquare } from '@fortawesome/free-solid-svg-icons';

import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

setup((app) => {
  //👇 Adds the icon to the library so you can use it in your story.
  library.add(fasPlusSquare);
  app.component('font-awesome-icon', FontAwesomeIcon);
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

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="library"
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

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="component"
import { setup, Preview } from '@storybook/vue3';

import { library } from '@fortawesome/fontawesome-svg-core';
import { faPlusSquare as fasPlusSquare } from '@fortawesome/free-solid-svg-icons';

import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

setup((app) => {
  //👇 Adds the icon to the library so you can use it in your story.
  library.add(fasPlusSquare);
  app.component('font-awesome-icon', FontAwesomeIcon);
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
