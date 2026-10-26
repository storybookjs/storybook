```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { action } from 'storybook/actions';

import preview from '../.storybook/preview';

import Button from './button.component';

const meta = preview.meta({
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { action } from 'storybook/actions';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import { action } from 'storybook/actions';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    component: Button,
    args: {
      // 👇 Create an action that appears when the onClick event is fired
      onClick: action('on-click'),
    },
  });
</script>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { action } from 'storybook/actions';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    args: {
      // 👇 Create an action that appears when the onClick event is fired
      onClick: action('on-click'),
    },
  });
</script>
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { action } from 'storybook/actions';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import { action } from 'storybook/actions';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    component: Button,
    args: {
      // 👇 Create an action that appears when the onClick event is fired
      onClick: action('on-click'),
    },
  });
</script>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { action } from 'storybook/actions';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    args: {
      // 👇 Create an action that appears when the onClick event is fired
      onClick: action('on-click'),
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import { action } from 'storybook/actions';

import preview from '../.storybook/preview';

import Button from './Button';

const meta = preview.meta({
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import { action } from 'storybook/actions';

import preview from '../.storybook/preview';

import Button from './Button';

const meta = preview.meta({
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { action } from 'storybook/actions';

import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import { action } from 'storybook/actions';

import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/angular';

import { action } from 'storybook/actions';

import Button from './button.component';

const meta: Meta<Button> = {
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
};

export default meta;
```

```ts filename="Button.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { action } from 'storybook/actions';

import Button from './Button';

const meta = {
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```js filename="Button.stories.js" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { action } from 'storybook/actions';

import Button from './Button';

export default {
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/web-components-vite';

import { action } from 'storybook/actions';

const meta: Meta = {
  component: 'demo-button',
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
};

export default meta;
```

```ts filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { action } from 'storybook/actions';

export default {
  component: 'demo-button',
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
};
```
