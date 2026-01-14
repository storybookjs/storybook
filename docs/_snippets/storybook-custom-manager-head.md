```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
});
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
});
```
