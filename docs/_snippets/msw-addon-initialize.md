```js filename=".storybook/preview.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { mswLoader } from 'msw-storybook-addon/csf3';

export default {
  /*
   * Register the MSW loader for all stories
   * See https://github.com/mswjs/msw-storybook-addon#csf-30
   * to learn how to customize it
   */
  loaders: [mswLoader()],
};
```

```ts filename=".storybook/preview.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { mswLoader } from 'msw-storybook-addon/csf3';

const preview: Preview = {
  /*
   * Register the MSW loader for all stories
   * See https://github.com/mswjs/msw-storybook-addon#csf-30
   * to learn how to customize it
   */
  loaders: [mswLoader()],
};

export default preview;
```

```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import addonMsw from 'msw-storybook-addon';

export default definePreview({
  /*
   * Register the MSW loader for all stories
   * See https://github.com/mswjs/msw-storybook-addon#csf-next
   * to learn how to customize it
   */
  addons: [addonMsw()],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import addonMsw from 'msw-storybook-addon';

export default definePreview({
  /*
   * Register the MSW loader for all stories
   * See https://github.com/mswjs/msw-storybook-addon#csf-next
   * to learn how to customize it
   */
  addons: [addonMsw()],
});
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import addonMsw from 'msw-storybook-addon';

export default definePreview({
  /*
   * Register the MSW loader for all stories
   * See https://github.com/mswjs/msw-storybook-addon#csf-next
   * to learn how to customize it
   */
  addons: [addonMsw()],
});
```

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import addonMsw from 'msw-storybook-addon';

export default definePreview({
  /*
   * Register the MSW loader for all stories
   * See https://github.com/mswjs/msw-storybook-addon#csf-next
   * to learn how to customize it
   */
  addons: [addonMsw()],
});
```

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';

import addonMsw from 'msw-storybook-addon';

export default definePreview({
  /*
   * Register the MSW loader for all stories
   * See https://github.com/mswjs/msw-storybook-addon#csf-next
   * to learn how to customize it
   */
  addons: [addonMsw()],
});
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import addonMsw from 'msw-storybook-addon';

export default definePreview({
  /*
   * Register the MSW loader for all stories
   * See https://github.com/mswjs/msw-storybook-addon#csf-next
   * to learn how to customize it
   */
  addons: [addonMsw()],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import addonMsw from 'msw-storybook-addon';

export default definePreview({
  /*
   * Register the MSW loader for all stories
   * See https://github.com/mswjs/msw-storybook-addon#csf-next
   * to learn how to customize it
   */
  addons: [addonMsw()],
});
```
