```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './Button';

const meta: Meta<Button> = {
  component: Button,
  /*
   * All stories in this file will:
   * - Be included in the docs page
   * - Not appear in Storybook's sidebar
   */
  tags: ['autodocs', '!dev'],
};
export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    /*
     * All stories in this file will:
     * - Be included in the docs page
     * - Not appear in Storybook's sidebar
     */
    tags: ['autodocs', '!dev'],
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  /*
   * All stories in this file will:
   * - Be included in the docs page
   * - Not appear in Storybook's sidebar
   */
  tags: ['autodocs', '!dev'],
};
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  /*
   * All stories in this file will:
   * - Be included in the docs page
   * - Not appear in Storybook's sidebar
   */
  tags: ['autodocs', '!dev'],
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    /*
     * All stories in this file will:
     * - Be included in the docs page
     * - Not appear in Storybook's sidebar
     */
    tags: ['autodocs', '!dev'],
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
  /*
   * All stories in this file will:
   * - Be included in the docs page
   * - Not appear in Storybook's sidebar
   */
  tags: ['autodocs', '!dev'],
} satisfies Meta<typeof Button>;
export default meta;
```

```ts filename="Button.stories.ts" renderer="common" language="ts-4-9"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  /*
   * All stories in this file will:
   * - Be included in the docs page
   * - Not appear in Storybook's sidebar
   */
  tags: ['autodocs', '!dev'],
} satisfies Meta<typeof Button>;
export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    /*
     * All stories in this file will:
     * - Be included in the docs page
     * - Not appear in Storybook's sidebar
     */
    tags: ['autodocs', '!dev'],
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
  /*
   * All stories in this file will:
   * - Be included in the docs page
   * - Not appear in Storybook's sidebar
   */
  tags: ['autodocs', '!dev'],
};
export default meta;
```

```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  /*
   * All stories in this file will:
   * - Be included in the docs page
   * - Not appear in Storybook's sidebar
   */
  tags: ['autodocs', '!dev'],
};
export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  title: 'Button',
  component: 'demo-button',
  /*
   * All stories in this file will:
   * - Be included in the docs page
   * - Not appear in Storybook's sidebar
   */
  tags: ['autodocs', '!dev'],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
  /*
   * All stories in this file will:
   * - Be included in the docs page
   * - Not appear in Storybook's sidebar
   */
  tags: ['autodocs', '!dev'],
};
export default meta;
```
