```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="theme-provider"
import { componentWrapperDecorator } from '@storybook/angular';
import type { Preview } from '@storybook/angular';

import { ThemeProvider } from './theme-provider.component';

const preview: Preview = {
  decorators: [
    moduleMetadata({ declarations: [ThemeProvider] }),
    componentWrapperDecorator(
      (story) => `<theme-provider class="default">${story}</theme-provider>`
    ),
  ],
};
export default preview;

// or with globals of story context
const preview: Preview = {
  decorators: [
    moduleMetadata({ declarations: [ThemeProvider] }),
    componentWrapperDecorator(
      (story) => `<theme-provider [class]="theme">${story}</theme-provider>`,
      ({ globals }) => ({ theme: globals.theme })
    ),
  ],
};
export default preview;
```

```ts filename="src/polyfills.ts" renderer="angular" language="ts" tabTitle="angular-localize-polyfill"
import '@angular/localize/init';
```

```jsx filename=".storybook/preview.js" renderer="react" language="js"
import React from 'react';

import { ThemeProvider } from 'styled-components';

export default {
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
};
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts"
import React from 'react';

import { Preview } from '@storybook/react';

import { ThemeProvider } from 'styled-components';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="solid" language="js"
import { ThemeProvider } from 'solid-styled-components';

const theme = {
  colors: {
    primary: 'hotpink',
  },
};

export const decorators = [
  (Story) => (
    <ThemeProvider theme={theme}>
      <Story />
    </ThemeProvider>
  ),
];
```

```tsx filename=".storybook/preview.tsx" renderer="solid" language="ts"
import { Preview } from 'storybook-solidjs';
import { ThemeProvider, DefaultTheme } from 'solid-styled-components';

const theme: DefaultTheme = {
  colors: {
    primary: 'hotpink',
  },
};

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="2-library"
import Vue from 'vue';

import Vuex from 'vuex';

//👇 Storybook Vue app being extended and registering the library
Vue.use(Vuex);

export default {
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="margin: 3em;"><story /></div>',
    }),
  ],
};
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="2-library"
import Vue from 'vue';

import Vuex from 'vuex';

import { Preview } from '@storybook/vue';

//👇 Storybook Vue app being extended and registering the library
Vue.use(Vuex);

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

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="3-library"
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

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="3-library"
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

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="2-component"
import Vue from 'vue';

import { library } from '@fortawesome/fontawesome-svg-core';
import { faPlusSquare as fasPlusSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

library.add(fasPlusSquare);

//👇 Storybook Vue app being extended and registering the component
Vue.component('font-awesome-icon', FontAwesomeIcon);

export default {
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="margin: 3em;"><story /></div>',
    }),
  ],
};
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="2-component"
import Vue from 'vue';

import { Preview } from '@storybook/vue';

import { library } from '@fortawesome/fontawesome-svg-core';
import { faPlusSquare as fasPlusSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

library.add(fasPlusSquare);

//👇 Storybook Vue app being extended and registering the component
Vue.component('font-awesome-icon', FontAwesomeIcon);

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

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="3-component"
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

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="3-component"
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

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="2-mixin"
import Vue from 'vue';

//👇 Storybook Vue app being extended and registering the mixin
Vue.mixin({
  // Your mixin code
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

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="2-mixin"
import Vue from 'vue';

import { Preview } from '@storybook/vue';

//👇 Storybook Vue app being extended and registering the mixin
Vue.mixin({
  // Your mixin code
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
