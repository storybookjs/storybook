```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="body (CSF 3)"
export default {
  previewBody: (body) => `
    ${body}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="body (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
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

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="body (CSF 3)"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="body (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
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

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="head (CSF 3)"
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

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="head (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
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

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="head (CSF 3)"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="head (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
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
