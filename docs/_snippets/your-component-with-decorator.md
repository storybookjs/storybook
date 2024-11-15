```ts filename="YourComponent.stories.ts" renderer="angular" language="ts"
import { componentWrapperDecorator } from '@storybook/angular';

import type { Meta } from '@storybook/angular';

import { YourComponent } from './your.component';

const meta: Meta<YourComponent> = {
  component: YourComponent,
  decorators: [componentWrapperDecorator((story) => `<div style="margin: 3em">${story}</div>`)],
};

export default meta;
```

```js filename="YourComponent.stories.js|jsx" renderer="react" language="js"
import { YourComponent } from './YourComponent';

export default {
  component: YourComponent,
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

```ts filename="YourComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta } from '@storybook/react';

import { YourComponent } from './YourComponent';

const meta = {
  component: YourComponent,
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```ts filename="YourComponent.stories.ts|tsx" renderer="react" language="ts"
import type { Meta } from '@storybook/react';

import { YourComponent } from './YourComponent';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
};

export default meta;
```

```js filename="YourComponent.stories.js|jsx" renderer="solid" language="js"
import { YourComponent } from './YourComponent';

export default {
  component: YourComponent,
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
};
```

```js filename="YourComponent.stories.js|jsx" renderer="solid" language="js" tabTitle="story-function-js"
import { YourComponent } from './YourComponent';

// Replacing the <Story/> element with a Story function is also a good way of writing decorators.
// Useful to prevent the full remount of the component's story.
export default {
  component: YourComponent,
  decorators: [(Story) => <div style={{ margin: '3em' }}>{Story()}</div>],
};
```

```tsx filename="YourComponent.stories.ts|tsx" renderer="solid" language="ts" tabTitle="story-function-ts"
import type { Meta } from 'storybook-solidjs';

import { YourComponent } from './YourComponent';

// Replacing the <Story/> element with a Story function is also a good way of writing decorators.
// Useful to prevent the full remount of the component's story.
const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  decorators: [(Story) => <div style={{ margin: '3em' }}>{Story()}</div>],
};

export default meta;
```

```tsx filename="YourComponent.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta } from 'storybook-solidjs';

import { YourComponent } from './YourComponent';

const meta = {
  component: YourComponent,
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```tsx filename="YourComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta } from 'storybook-solidjs';

import { YourComponent } from './YourComponent';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [() => ({
      Component: MarginDecorator,
    })],
  });
</script>
```

```js filename="YourComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import YourComponent from './YourComponent.svelte';
import MarginDecorator from './MarginDecorator.svelte';

export default {
  component: YourComponent,
  decorators: [() => MarginDecorator],
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [() => MarginDecorator],
  });
</script>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';
import MarginDecorator from './MarginDecorator.svelte';

const meta = {
  component: Button,
  decorators: [() => MarginDecorator],
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [() => MarginDecorator],
  });
</script>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';
import MarginDecorator from './MarginDecorator.svelte';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  decorators: [() => MarginDecorator],
};

export default meta;
```

```js filename="YourComponent.stories.js" renderer="vue" language="js"
import YourComponent from './YourComponent.vue';

export default {
  component: YourComponent,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story/></div>' })],
};
```

```ts filename="YourComponent.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta } from '@storybook/vue3';

import YourComponent from './YourComponent.vue';

const meta = {
  component: YourComponent,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story/></div>' })],
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```ts filename="YourComponent.stories.ts" renderer="vue" language="ts"
import type { Meta } from '@storybook/vue3';

import YourComponent from './YourComponent.vue';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story/></div>' })],
};

export default meta;
```

```js filename="YourComponent.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'demo-your-component',
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};
```

```ts filename="YourComponent.stories.ts" renderer="web-components" language="ts"
import { html } from 'lit';

import type { Meta } from '@storybook/web-components';

const meta: Meta<YourComponentProps> = {
  component: 'demo-your-component',
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};
export default meta;
```
