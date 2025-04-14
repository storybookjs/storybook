```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="body"
export default {
  previewBody: (body) => `
    ${body}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="body"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
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

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="head"
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

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="head"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
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
