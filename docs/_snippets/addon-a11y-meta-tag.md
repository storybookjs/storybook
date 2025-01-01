```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular/';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};

export default meta;
```

```js filename="Button.stories.js" renderer="html" language="js"
export default {
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta } from '@storybook/your-renderer';

import { Button } from './Button';

const meta = {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta } from '@storybook/your-renderer';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
} satisfies Meta<typeof Button>;

export default meta;
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    // 👇 Re-apply the a11ytest tag for this component's stories
    tags: ['a11ytest'],
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    // 👇 Re-apply the a11ytest tag for this component's stories
    tags: ['a11ytest'],
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
} satisfies Meta<typeof Button>;

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    // 👇 Re-apply the a11ytest tag for this component's stories
    tags: ['a11ytest'],
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};

export default meta;
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
  // 👇 Re-apply the a11ytest tag for this component's stories
  tags: ['a11ytest'],
};

export default meta;
```
