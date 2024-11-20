```ts filename="YourComponent.stories.ts" renderer="angular" language="ts"
import type { Meta } from  from '@storybook/angular';

import { YourComponent } from './YourComponent.component';

const meta: Meta<YourComponent> = {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
};

export default meta;
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    parameters: { controls: { sort: 'requiredFirst' } },
  });
</script>
```

```js filename="YourComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import YourComponent from './YourComponent.svelte';

export default {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
};
```

```js filename="YourComponent.stories.js|jsx" renderer="common" language="js"
import { YourComponent } from './YourComponent';

export default {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    parameters: { controls: { sort: 'requiredFirst' } },
  });
</script>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';

const meta = {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```ts filename="YourComponent.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { YourComponent } from './YourComponent';

const meta = {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    parameters: { controls: { sort: 'requiredFirst' } },
  });
</script>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
};

export default meta;
```

```ts filename="YourComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { YourComponent } from './YourComponent';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
};

export default meta;
```

```js filename="YourComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'your-component',
  parameters: { controls: { sort: 'requiredFirst' } },
};
```

```ts filename="YourComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

const meta: Meta = {
  component: 'your-component',
  parameters: { controls: { sort: 'requiredFirst' } },
};

export default meta;
```
