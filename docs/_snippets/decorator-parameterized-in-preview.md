```ts filename=".storybook/preview.ts" renderer="angular" language="ts"
import type { Preview } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';

const preview: Preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    componentWrapperDecorator((story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          //  Your page layout is probably a little more complex than this
          return `<div class="page-layout">${story}</div>`;
        case 'page-mobile':
          return `<div class="page-mobile-layout">${story}</div>`;
        default:
          // In the default case, don't apply a layout
          return story;
      }
    }),
  ],
};

export default preview;
```

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 3"
import React from 'react';

export default {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          return (
            // Your page layout is probably a little more complex than this
            <div className="page-layout">
              <Story />
            </div>
          );
        case 'page-mobile':
          return (
            <div className="page-mobile-layout">
              <Story />
            </div>
          );
        default:
          // In the default case, don't apply a layout
          return <Story />;
      }
    },
  ],
};
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          return (
            // Your page layout is probably a little more complex than this
            <div className="page-layout">
              <Story />
            </div>
          );
        case 'page-mobile':
          return (
            <div className="page-mobile-layout">
              <Story />
            </div>
          );
        default:
          // In the default case, don't apply a layout
          return <Story />;
      }
    },
  ],
};

export default preview;
```

```jsx filename=".storybook/preview.jsx" renderer="solid" language="js"
export default {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          return (
            // Your page layout is probably a little more complex than this
            <div className="page-layout">
              <Story />
            </div>
          );
        case 'page-mobile':
          return (
            <div className="page-mobile-layout">
              <Story />
            </div>
          );
        default:
          // In the default case, don't apply a layout
          return <Story />;
      }
    },
  ],
};
```

```tsx filename=".storybook/preview.tsx" renderer="solid" language="ts"
import type { Preview } from 'storybook-solidjs-vite';

const preview: Preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          return (
            // Your page layout is probably a little more complex than this
            <div className="page-layout">
              <Story />
            </div>
          );
        case 'page-mobile':
          return (
            <div className="page-mobile-layout">
              <Story />
            </div>
          );
        default:
          // In the default case, don't apply a layout
          return <Story />;
      }
    },
  ],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="vue" language="js"
export default {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (_, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          // Your page layout is probably a little more complex than this
          return { template: '<div class="page-layout"><story/></div>' };
        case 'page-mobile':
          return { template: '<div class="page-mobile-layout"><story/></div>' };
        default:
          // In the default case, don't apply a layout
          return { template: '<story/>' };
      }
    },
  ],
};
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts"
import type { Preview } from '@storybook/vue3-vite';

const preview: Preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (_, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          // Your page layout is probably a little more complex than this ;)
          return { template: '<div class="page-layout"><story/></div>' };
        case 'page-mobile':
          return { template: '<div class="page-mobile-layout"><story/></div>' };
        default:
          // In the default case, don't apply a layout
          return { template: '<story/>' };
      }
    },
  ],
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="svelte" language="ts" tabTitle="Preview"
// Replace your-framework with svelte-vite or sveltekit
import type { Preview } from '@storybook/your-framework';

import PageLayout from './PageLayout.svelte';

const preview: Preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      return {
        Component: PageLayout,
        props: {
          layout: pageLayout || 'default',
          children: story,
        },
      };
    },
  ],
};

export default preview;
```

```svelte filename=".storybook/PageLayout.svelte" renderer="svelte" language="ts" tabTitle="Layout component"
<script lang="ts">
  interface Props {
    layout?: 'page' | 'page-mobile' | 'default';
    children?: import('svelte').Snippet;
  }

  let { layout = 'default', children }: Props = $props();
</script>

<!-- Your page layout is probably a little more complex than this -->
<div class={layout}>
  {@render children?.()}
</div>
```

```js filename=".storybook/preview.js" renderer="svelte" language="js" tabTitle="Preview"
import PageLayout from './PageLayout.svelte';

const preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      return {
        Component: PageLayout,
        props: {
          layout: pageLayout || 'default',
          children: story,
        },
      };
    },
  ],
};

export default preview;
```

```svelte filename=".storybook/PageLayout.svelte" renderer="svelte" language="js" tabTitle="Layout component"
<script>
  let { layout = 'default', children } = $props();
</script>

<!-- Your page layout is probably a little more complex than this -->
<div class={layout}>
  {@render children?.()}
</div>
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts"
import type { Preview } from '@storybook/web-components-vite';

import { html } from 'lit';

const preview: Preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          // Your page layout is probably a little more complex than this
          return html`<div class="page-layout">${story()}</div>`;
        case 'page-mobile':
          return html`<div class="page-mobile-layout">${story()}</div>`;
        default:
          // In the default case, don't apply a layout
          return story();
      }
    },
  ],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="Preview"
import { html } from 'lit';

const preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          // Your page layout is probably a little more complex than this
          return html`<div class="page-layout">${story()}</div>`;
        case 'page-mobile':
          return html`<div class="page-mobile-layout">${story()}</div>`;
        default:
          // In the default case, don't apply a layout
          return story();
      }
    },
  ],
};

export default preview;
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          return (
            // Your page layout is probably a little more complex than this
            <div className="page-layout">
              <Story />
            </div>
          );
        case 'page-mobile':
          return (
            <div className="page-mobile-layout">
              <Story />
            </div>
          );
        default:
          // In the default case, don't apply a layout
          return <Story />;
      }
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          return (
            // Your page layout is probably a little more complex than this
            <div className="page-layout">
              <Story />
            </div>
          );
        case 'page-mobile':
          return (
            <div className="page-mobile-layout">
              <Story />
            </div>
          );
        default:
          // In the default case, don't apply a layout
          return <Story />;
      }
    },
  ],
});
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (_, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          // Your page layout is probably a little more complex than this
          return { template: '<div class="page-layout"><story/></div>' };
        case 'page-mobile':
          return { template: '<div class="page-mobile-layout"><story/></div>' };
        default:
          // In the default case, don't apply a layout
          return { template: '<story/>' };
      }
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (_, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          // Your page layout is probably a little more complex than this
          return { template: '<div class="page-layout"><story/></div>' };
        case 'page-mobile':
          return { template: '<div class="page-mobile-layout"><story/></div>' };
        default:
          // In the default case, don't apply a layout
          return { template: '<story/>' };
      }
    },
  ],
});
```

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    componentWrapperDecorator((story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          //  Your page layout is probably a little more complex than this
          return `<div class="page-layout">${story}</div>`;
        case 'page-mobile':
          return `<div class="page-mobile-layout">${story}</div>`;
        default:
          // In the default case, don't apply a layout
          return story;
      }
    }),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="angular" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    componentWrapperDecorator((story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          //  Your page layout is probably a little more complex than this
          return `<div class="page-layout">${story}</div>`;
        case 'page-mobile':
          return `<div class="page-mobile-layout">${story}</div>`;
        default:
          // In the default case, don't apply a layout
          return story;
      }
    }),
  ],
});
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { html } from 'lit';

import { definePreview } from '@storybook/web-components-vite';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          // Your page layout is probably a little more complex than this
          return html`<div class="page-layout">${story()}</div>`;
        case 'page-mobile':
          return html`<div class="page-mobile-layout">${story()}</div>`;
        default:
          // In the default case, don't apply a layout
          return story();
      }
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { html } from 'lit';

import { definePreview } from '@storybook/web-components-vite';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          // Your page layout is probably a little more complex than this
          return html`<div class="page-layout">${story()}</div>`;
        case 'page-mobile':
          return html`<div class="page-mobile-layout">${story()}</div>`;
        default:
          // In the default case, don't apply a layout
          return story();
      }
    },
  ],
});
```
