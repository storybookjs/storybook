```ts filename=".storybook/preview.ts" renderer="angular" language="ts"
import type { Preview } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';

const preview: Preview = {
  decorators: [componentWrapperDecorator((story) => `<div style="margin: 3em">${story}</div>`)],
};

export default preview;
```

```jsx filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 3"
import React from 'react';

export default {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
};
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
import React from 'react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
};

export default preview;
```

```jsx filename=".storybook/preview.js" renderer="solid" language="js"
export default {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
};
```

```js filename=".storybook/preview.tsx" renderer="solid" language="ts"
import type { Preview } from 'storybook-solidjs-vite';

const preview: Preview = {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="svelte" language="js"
import MarginDecorator from './MarginDecorator.svelte';

export default { decorators: [() => MarginDecorator] };
```

```ts filename=".storybook/preview.ts" renderer="svelte" language="ts"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { Preview } from '@storybook/your-framework';

import MarginDecorator from './MarginDecorator.svelte';

const preview: Preview = {
  decorators: [() => MarginDecorator],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF 3"
export default {
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="margin: 3em;"><story /></div>',
    }),
  ],
};
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Preview } from '@storybook/vue3-vite';

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

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

export default definePreview({
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="margin: 3em;"><story /></div>',
    }),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

export default definePreview({
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="margin: 3em;"><story /></div>',
    }),
  ],
});
```

```js filename=".storybook/preview.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};
```

```js filename=".storybook/preview.js" renderer="web-components" language="ts"
import type { Preview } from '@storybook/web-components-vite';

import { html } from 'lit';

const preview: Preview = {
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};

export default preview;
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
});
```
