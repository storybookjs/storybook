```ts filename="Button.stories.js|ts" renderer="common" language="ts"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  parameters: {
    // type-safe!
    layout: 'centered',
  },
});
```

```ts filename="Button.stories.ts" renderer="angular" language="ts"
import preview from '../.storybook/preview';

import { Button } from './button.component';

const meta = preview.meta({
  component: Button,
  parameters: {
    // type-safe!
    layout: 'centered',
  },
});
```

```ts filename="Button.stories.js|ts" renderer="vue" language="ts"
import preview from '../.storybook/preview';

import { Button } from './button.vue';

const meta = preview.meta({
  component: Button,
  parameters: {
    // type-safe!
    layout: 'centered',
  },
});
```

```ts filename="Button.stories.js|ts" renderer="web-components" language="ts"
import preview from '../.storybook/preview';

import { Button } from './demo-button';

const meta = preview.meta({
  component: 'demo-button',
  parameters: {
    // type-safe!
    layout: 'centered',
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    component: Button,
    parameters: {
      // type-safe!
      layout: 'centered',
    },
  });
</script>
```
