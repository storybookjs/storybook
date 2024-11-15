```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { componentWrapperDecorator, moduleMetadata } from '@storybook/angular';

import { Button } from './button.component';

import { Parent } from './parent.component'; // Parent contains ng-content

const meta: Meta<Button> = {
  component: Button,
  decorators: [
    moduleMetadata({
      declarations: [ParentComponent],
    }),
    // With template
    componentWrapperDecorator((story) => `<div style="margin: 3em">${story}</div>`),
    // With component which contains ng-content
    componentWrapperDecorator(Parent),
  ],
};

export default meta;
```

```js filename="Button.stories.js" renderer="html" language="js"
import { createButton } from './Button';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  decorators: [
    (story) => {
      const decorator = document.createElement('div');
      decorator.style.margin = '3em';
      decorator.appendChild(story());
      return decorator;
    },
  ],
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: (args) => createButton(args),
};
```

```ts filename="Button.stories.ts" renderer="html" language="ts"
import type { Meta, StoryObj } from '@storybook/html';

import { createButton, ButtonArgs } from './Button';

const meta: Meta<ButtonArgs> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  decorators: [
    (story) => {
      const decorator = document.createElement('div');
      decorator.style.margin = '3em';
      decorator.appendChild(story());
      return decorator;
    },
  ],
};

export default meta;
type Story = StoryObj<ButtonArgs>;

export const Primary: Story = {
  render: (args) => createButton(args),
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default {
  component: Button,
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

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
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

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  component: Button,
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
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

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: Button,
    decorators: [() => MarginDecorators],
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';
import MarginDecorator from './MarginDecorator.svelte';

export default {
  component: Button,
  decorators: [() => MarginDecorator],
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: Button,
    decorators: [() => MarginDecorators],
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';
import MarginDecorator from './MarginDecorator.svelte';

const meta = {
  component: Button,
  decorators: [() => MarginDecorator],
} satisfies Meta<typeof Button>;

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: Button,
    decorators: [() => ({
      Component: MarginDecorator,
    })],
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';
import MarginDecorator from './MarginDecorator.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
  decorators: [() => MarginDecorator],
};

export default meta;
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  component: Button,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story /></div>' })],
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story /></div>' })],
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
  decorators: [() => ({ template: '<div style="margin: 3em;"><story /></div>' })],
};

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'demo-button',
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};

export const Example = {};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

const meta: Meta = {
  component: 'demo-button',
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};

export default meta;
type Story = StoryObj;

export const Example: Story = {};
```
