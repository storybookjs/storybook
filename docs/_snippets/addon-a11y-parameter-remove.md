```ts filename="Button.stories.ts" renderer="angular" language="ts"
import { Meta } from '@storybook/angular';

import { Button } from './Button.component';

const meta: Meta<Button> = {
  component: Button,
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
};
export default meta;
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
} satisfies Meta<typeof Button>;
export default meta;
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    parameters: {
      // 👇 Remove this once all stories pass accessibility tests
      // a11y: { test: 'todo' },
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button.svelte';

const meta = {
  component: Button,
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
} satisfies Meta<typeof Button>;
export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    parameters: {
      // 👇 Remove this once all stories pass accessibility tests
      // a11y: { test: 'todo' },
    },
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { Button } from './Button.svelte';

export default {
  component: Button,
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-button',
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
};
export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
};
```
