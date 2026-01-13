```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  // Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
  framework: '@storybook/your-framework',
  stories: [
    '../src/**/*.mdx', // 👈 These will display first in the sidebar
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', // 👈 Followed by these
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: [
    '../src/**/*.mdx', // 👈 These will display first in the sidebar
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', // 👈 Followed by these
  ],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: [
    '../src/**/*.mdx', // 👈 These will display first in the sidebar
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', // 👈 Followed by these
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: [
    '../src/**/*.mdx', // 👈 These will display first in the sidebar
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', // 👈 Followed by these
  ],
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: [
    '../src/**/*.mdx', // 👈 These will display first in the sidebar
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', // 👈 Followed by these
  ],
});
```

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: [
    '../src/**/*.mdx', // 👈 These will display first in the sidebar
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', // 👈 Followed by these
  ],
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
  stories: [
    '../src/**/*.mdx', // 👈 These will display first in the sidebar
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', // 👈 Followed by these
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="angular" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
  stories: [
    '../src/**/*.mdx', // 👈 These will display first in the sidebar
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', // 👈 Followed by these
  ],
});
```
