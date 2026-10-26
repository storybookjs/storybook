```ts filename="YourComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { componentWrapperDecorator } from '@storybook/angular';

import preview from '../.storybook/preview';

import { YourComponent } from './your.component';

const meta = preview.meta({
  component: YourComponent,
  decorators: [componentWrapperDecorator((story) => `<div style="margin: 3em">${story}</div>`)],
});
```

```ts filename="YourComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { type Meta, componentWrapperDecorator } from '@storybook/angular';

import { YourComponent } from './your.component';

const meta: Meta<YourComponent> = {
  component: YourComponent,
  decorators: [componentWrapperDecorator((story) => `<div style="margin: 3em">${story}</div>`)],
};

export default meta;
```

```jsx filename="YourComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { YourComponent } from './YourComponent';

const meta = preview.meta({
  component: YourComponent,
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

```tsx filename="YourComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { YourComponent } from './YourComponent';

const meta = preview.meta({
  component: YourComponent,
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

```jsx filename="YourComponent.stories.js|jsx" renderer="solid" language="js"
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

```tsx filename="YourComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta } from 'storybook-solidjs-vite';

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

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = preview.meta({
    component: YourComponent,
    decorators: [() => MarginDecorator],
  });
</script>
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [() => MarginDecorator],
  });
</script>
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = preview.meta({
    component: YourComponent,
    decorators: [() => MarginDecorator],
  });
</script>
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [() => MarginDecorator],
  });
</script>
```

```js filename="YourComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import YourComponent from './YourComponent.vue';

const meta = preview.meta({
  component: YourComponent,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story/></div>' })],
});
```

```ts filename="YourComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import YourComponent from './YourComponent.vue';

const meta = preview.meta({
  component: YourComponent,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story/></div>' })],
});
```

```ts filename="YourComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/vue3-vite';

import YourComponent from './YourComponent.vue';

const meta = {
  component: YourComponent,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story/></div>' })],
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```js filename="YourComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import YourComponent from './YourComponent.vue';

export default {
  component: YourComponent,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story/></div>' })],
};
```

```js filename="YourComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-your-component',
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
});
```

```ts filename="YourComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-your-component',
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
});
```

```js filename="YourComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { html } from 'lit';

export default {
  component: 'demo-your-component',
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};
```

```ts filename="YourComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/web-components-vite';

import { html } from 'lit';

const meta: Meta = {
  component: 'demo-your-component',
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};
export default meta;
```

```tsx filename="YourComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta } from '@storybook/your-framework';

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

```jsx filename="YourComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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
