```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    a11y: {
      options: {
        /*
         * Opt in to running WCAG 2.x AAA rules
         * Note that you must explicitly re-specify the defaults (all but the last array entry)
         * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter-examples for more details
         */
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice', 'wcag2aaa'],
      },
    },
  },
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  parameters: {
    a11y: {
      options: {
        /*
         * Opt in to running WCAG 2.x AAA rules
         * Note that you must explicitly re-specify the defaults (all but the last array entry)
         * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter-examples for more details
         */
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice', 'wcag2aaa'],
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    a11y: {
      options: {
        /*
         * Opt in to running WCAG 2.x AAA rules
         * Note that you must explicitly re-specify the defaults (all but the last array entry)
         * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter-examples for more details
         */
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice', 'wcag2aaa'],
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    a11y: {
      options: {
        /*
         * Opt in to running WCAG 2.x AAA rules
         * Note that you must explicitly re-specify the defaults (all but the last array entry)
         * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter-examples for more details
         */
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice', 'wcag2aaa'],
      },
    },
  },
});
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

export default definePreview({
  parameters: {
    a11y: {
      options: {
        /*
         * Opt in to running WCAG 2.x AAA rules
         * Note that you must explicitly re-specify the defaults (all but the last array entry)
         * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter-examples for more details
         */
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice', 'wcag2aaa'],
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

export default definePreview({
  parameters: {
    a11y: {
      options: {
        /*
         * Opt in to running WCAG 2.x AAA rules
         * Note that you must explicitly re-specify the defaults (all but the last array entry)
         * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter-examples for more details
         */
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice', 'wcag2aaa'],
      },
    },
  },
});
```
