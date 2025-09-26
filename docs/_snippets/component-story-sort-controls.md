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

```js filename="YourComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { YourComponent } from './YourComponent';

export default {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
};
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
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';

import YourComponent from './YourComponent.svelte';

const meta = {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```ts filename="YourComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { YourComponent } from './YourComponent';

const meta = {
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```js filename="YourComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'your-component',
  parameters: { controls: { sort: 'requiredFirst' } },
};
```

```ts filename="YourComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'your-component',
  parameters: { controls: { sort: 'requiredFirst' } },
};

export default meta;
```

```ts filename="YourComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { YourComponent } from './YourComponent';

const meta = preview.meta({
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="YourComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { YourComponent } from './YourComponent';

const meta = preview.meta({
  component: YourComponent,
  parameters: { controls: { sort: 'requiredFirst' } },
});
```
