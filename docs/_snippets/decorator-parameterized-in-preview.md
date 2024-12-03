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
          // Your page layout is probably a little more complex than this ;)
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

```js filename=".storybook/preview.jsx" renderer="react" language="js"
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
            // Your page layout is probably a little more complex than this ;)
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

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts"
import React from 'react';

import type { Preview } from '@storybook/react';

const preview: Preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          return (
            // Your page layout is probably a little more complex than this ;)
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
            // Your page layout is probably a little more complex than this ;)
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
import { Preview } from 'storybook-solidjs';

const preview: Preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading from parameters
      const { pageLayout } = parameters;
      switch (pageLayout) {
        case 'page':
          return (
            // Your page layout is probably a little more complex than this ;)
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
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts"
import type { Preview } from '@storybook/vue3';

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
