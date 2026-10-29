```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 4"
// Replace your-framework with the framework you are using, e.g., nextjs, nextjs-vite, react-vite, etc.
import { definePreview } from '@storybook/your-framework';

const preview = definePreview({
  parameters: {
    docs: {
      source: {
        transform: async (source) => {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = await import('prettier/plugins/estree');

          return prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        },
      },
    },
  },
});

export default preview;
```

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 4"
// Replace your-framework with the framework you are using, e.g., nextjs, nextjs-vite, react-vite, etc.
import { definePreview } from '@storybook/your-framework';

const preview = definePreview({
  parameters: {
    docs: {
      source: {
        transform: async (source) => {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = await import('prettier/plugins/estree');

          return prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        },
      },
    },
  },
});

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { definePreview } from '@storybook/vue3-vite';

const preview = definePreview({
  parameters: {
    docs: {
      source: {
        transform: async (source) => {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = await import('prettier/plugins/estree');

          return prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        },
      },
    },
  },
});

export default preview;
```

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF 4"
import { definePreview } from '@storybook/vue3-vite';

const preview = definePreview({
  parameters: {
    docs: {
      source: {
        transform: async (source) => {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = await import('prettier/plugins/estree');

          return prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        },
      },
    },
  },
});

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { definePreview } from '@storybook/angular';

const preview = definePreview({
  parameters: {
    docs: {
      source: {
        transform: async (source) => {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = await import('prettier/plugins/estree');

          return prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        },
      },
    },
  },
});

export default preview;
```

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { definePreview } from '@storybook/web-components-vite';

const preview = definePreview({
  parameters: {
    docs: {
      source: {
        transform: async (source) => {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = await import('prettier/plugins/estree');

          return prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        },
      },
    },
  },
});

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { definePreview } from '@storybook/web-components-vite';

const preview = definePreview({
  parameters: {
    docs: {
      source: {
        transform: async (source) => {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = await import('prettier/plugins/estree');

          return prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        },
      },
    },
  },
});

export default preview;
```

```ts filename=".storybook/preview.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g., nextjs-vite, vue3-vite, angular, sveltekit, etc.
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    docs: {
      source: {
        transform: async (source) => {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = await import('prettier/plugins/estree');

          return prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        },
      },
    },
  },
};

export default preview;
```

```js filename=".storybook/preview.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  parameters: {
    docs: {
      source: {
        transform: async (source) => {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = await import('prettier/plugins/estree');

          return prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        },
      },
    },
  },
};
```
