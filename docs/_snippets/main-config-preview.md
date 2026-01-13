```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="Body (CSF 3)"
export default {
  previewBody: (body) => `
    ${body}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="Body (CSF 3)"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  previewBody: (body) => `
    ${body}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
};

export default config;
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="Head (CSF 3)"
export default {
  previewHead: (head) => `
    ${head}
    <style>
      html, body {
        background: #827979;
      }
    </style>
 `,
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="Head (CSF 3)"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  previewHead: (head) => `
    ${head}
    <style>
      html, body {
        background: #827979;
      }
    </style>
 `,
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="Body (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  previewBody: (body) => `
    ${body}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="Body (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  previewBody: (body) => `
    ${body}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="Head (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  previewHead: (head) => `
    ${head}
    <style>
      html, body {
        background: #827979;
      }
    </style>
 `,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="Head (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  previewHead: (head) => `
    ${head}
    <style>
      html, body {
        background: #827979;
      }
    </style>
 `,
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="Head (CSF Next 🧪)"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  previewHead: (head) => `
    ${head}
    <style>
      html, body {
        background: #827979;
      }
    </style>
 `,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="Head (CSF Next 🧪)"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  previewHead: (head) => `
    ${head}
    <style>
      html, body {
        background: #827979;
      }
    </style>
 `,
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="Body (CSF Next 🧪)"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  previewBody: (body) => `
    ${body}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="angular" language="js" tabTitle="Body (CSF Next 🧪)"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  previewBody: (body) => `
    ${body}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="Head (CSF Next 🧪)"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  previewHead: (head) => `
    ${head}
    <style>
      html, body {
        background: #827979;
      }
    </style>
 `,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="angular" language="js" tabTitle="Head (CSF Next 🧪)"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  previewHead: (head) => `
    ${head}
    <style>
      html, body {
        background: #827979;
      }
    </style>
 `,
});
```
