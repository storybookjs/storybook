```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
};

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
import type { Meta } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    //👇 Creates specific argTypes
    argTypes: {
      backgroundColor: { control: 'color' },
    },
    args: {
      //👇 Now all Button stories will be primary.
      primary: true,
    },
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    //👇 Creates specific argTypes
    argTypes: {
      backgroundColor: { control: 'color' },
    },
    args: {
      //👇 Now all Button stories will be primary.
      primary: true,
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    //👇 Creates specific argTypes
    argTypes: {
      backgroundColor: { control: 'color' },
    },
    args: {
      //👇 Now all Button stories will be primary.
      primary: true,
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
};

export default meta;
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    //👇 Now all Button stories will be primary.
    primary: true,
  },
};

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  // 👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    // 👇 Now all Button stories will be primary.
    primary: true,
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
  // 👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    // 👇 Now all Button stories will be primary.
    primary: true,
  },
};

export default meta;
```
