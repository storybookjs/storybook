```js filename=".storybook/preview.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { mswLoader } from 'msw-storybook-addon/csf3';

/*
 * The loader starts MSW for you.
 * See https://github.com/mswjs/msw-storybook-addon#custom-worker-setup
 * to learn how to customize it
 */
export default {
  loaders: [mswLoader()], // 👈 Add the MSW loader to all stories
};
```

```ts filename=".storybook/preview.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { mswLoader } from 'msw-storybook-addon/csf3';

/*
 * The loader starts MSW for you.
 * See https://github.com/mswjs/msw-storybook-addon#custom-worker-setup
 * to learn how to customize it
 */
const preview: Preview = {
  loaders: [mswLoader()], // 👈 Add the MSW loader to all stories
};

export default preview;
```

```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import addonMsw from 'msw-storybook-addon';

/*
 * The addon starts MSW for you.
 * See https://github.com/mswjs/msw-storybook-addon#custom-worker-setup
 * to learn how to customize it
 */
export default definePreview({
  addons: [addonMsw()], // 👈 Add the MSW addon to all stories
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import addonMsw from 'msw-storybook-addon';

/*
 * The addon starts MSW for you.
 * See https://github.com/mswjs/msw-storybook-addon#custom-worker-setup
 * to learn how to customize it
 */
export default definePreview({
  addons: [addonMsw()], // 👈 Add the MSW addon to all stories
});
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import addonMsw from 'msw-storybook-addon';

/*
 * The addon starts MSW for you.
 * See https://github.com/mswjs/msw-storybook-addon#custom-worker-setup
 * to learn how to customize it
 */
export default definePreview({
  addons: [addonMsw()], // 👈 Add the MSW addon to all stories
});
```

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import addonMsw from 'msw-storybook-addon';

/*
 * The addon starts MSW for you.
 * See https://github.com/mswjs/msw-storybook-addon#custom-worker-setup
 * to learn how to customize it
 */
export default definePreview({
  addons: [addonMsw()], // 👈 Add the MSW addon to all stories
});
```

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';

import addonMsw from 'msw-storybook-addon';

/*
 * The addon starts MSW for you.
 * See https://github.com/mswjs/msw-storybook-addon#custom-worker-setup
 * to learn how to customize it
 */
export default definePreview({
  addons: [addonMsw()], // 👈 Add the MSW addon to all stories
});
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import addonMsw from 'msw-storybook-addon';

/*
 * The addon starts MSW for you.
 * See https://github.com/mswjs/msw-storybook-addon#custom-worker-setup
 * to learn how to customize it
 */
export default definePreview({
  addons: [addonMsw()], // 👈 Add the MSW addon to all stories
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import addonMsw from 'msw-storybook-addon';

/*
 * The addon starts MSW for you.
 * See https://github.com/mswjs/msw-storybook-addon#custom-worker-setup
 * to learn how to customize it
 */
export default definePreview({
  addons: [addonMsw()], // 👈 Add the MSW addon to all stories
});
```
