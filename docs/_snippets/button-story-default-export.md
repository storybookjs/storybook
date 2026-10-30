```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './button.component';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: 'demo-button',
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    /* 👇 The title prop is optional.
    * See https://storybook.js.org/docs/configure/#configure-story-loading
    * to learn how to generate automatic titles
    */
    title: 'Button',
    component: Button,
  });
</script>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    /* 👇 The title prop is optional.
    * See https://storybook.js.org/docs/configure/#configure-story-loading
    * to learn how to generate automatic titles
    */
    title: 'Button',
    component: Button,
  });
</script>
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: 'demo-button',
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    /* 👇 The title prop is optional.
    * See https://storybook.js.org/docs/configure/#configure-story-loading
    * to learn how to generate automatic titles
    */
    title: 'Button',
    component: Button,
  });
</script>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    /* 👇 The title prop is optional.
    * See https://storybook.js.org/docs/configure/#configure-story-loading
    * to learn how to generate automatic titles
    */
    title: 'Button',
    component: Button,
  });
</script>
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
});
```

```js filename="Button.stories.js" renderer="html" language="js"
import { createButton } from './Button';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
};
```

```ts filename="Button.stories.ts" renderer="html" language="ts"
import type { Meta } from '@storybook/html';

import { createButton, ButtonArgs } from './Button';

const meta: Meta<ButtonArgs> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
};

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
});
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
});
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
});
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
};

export default meta;
```

```ts filename="Button.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Button } from './Button';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
};

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  title: 'Button',
  component: 'demo-button',
};
```
