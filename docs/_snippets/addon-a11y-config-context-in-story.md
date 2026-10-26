```ts filename="Button.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ...rest of story file

export const ExampleStory: Story = {
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ...rest of story file

export const ExampleStory = {
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ...rest of story file

export const ExampleStory: Story = {
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
});

export const ExampleStory = meta.story({
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
});

export const ExampleStory = meta.story({
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './button.component';

const meta = preview.meta({
  component: Button,
});

export const ExampleStory = meta.story({
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
});
```

```js filename="Button.stories.js" renderer="common" language="js"
// ...rest of story file

export const ExampleStory = {
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>

<Story
  name="ExampleStory"
  parameters={{
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  }}
/>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF Next 🧪"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    component: Button,
  });
</script>

<Story
  name="ExampleStory"
  parameters={{
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  }}
/>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>

<Story
  name="ExampleStory"
  parameters={{
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  }}
/>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF Next 🧪"
<script module>
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    component: Button,
  });
</script>

<Story
  name="ExampleStory"
  parameters={{
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  }}
/>
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button';

const meta = preview.meta({
  component: Button,
});

export const ExampleStory = meta.story({
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button';

const meta = preview.meta({
  component: Button,
});

export const ExampleStory = meta.story({
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
});

export const ExampleStory = meta.story({
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
});

export const ExampleStory = meta.story({
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
});
```
