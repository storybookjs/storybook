```ts filename=".storybook/preview.ts" renderer="angular" language="ts"
import type { Preview } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';

const preview: Preview = {
  decorators: [componentWrapperDecorator((story) => `<div style="margin: 3em">${story}</div>`)],
};

export default preview;
```

```jsx filename=".storybook/preview.jsx" renderer="react" language="js"
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

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts"
import React from 'react';

import { Preview } from '@storybook/react';

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
import { Preview } from 'storybook-solidjs';

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
import type { Preview } from '@storybook/svelte';

import MarginDecorator from './MarginDecorator.svelte';

const preview: Preview = {
  decorators: [() => MarginDecorator],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="vue" language="js"
export default {
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="margin: 3em;"><story /></div>',
    }),
  ],
};
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts"
import { Preview } from '@storybook/vue3';

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

```js filename=".storybook/preview.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};
```
