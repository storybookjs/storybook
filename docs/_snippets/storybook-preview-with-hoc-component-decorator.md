```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="component-3"
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

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="component-3"
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

