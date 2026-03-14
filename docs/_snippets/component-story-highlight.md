```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import { type Meta, type StoryObj, componentWrapperDecorator } from '@storybook/angular';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './my-component.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Highlighted: Story = {
  decorators: [
    componentWrapperDecorator((story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return story;
    }),
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { componentWrapperDecorator } from '@storybook/angular';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import { MyComponent } from './my-component.component';

const meta = preview.meta({
  component: MyComponent,
});

export const Highlighted = meta.story({
  decorators: [
    componentWrapperDecorator((story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return story;
    }),
  ],
});
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const Highlighted = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return storyFn();
    },
  ],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Highlighted: Story = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return storyFn();
    },
  ],
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { useChannel } from 'storybook/preview-api';
  import { HIGHLIGHT } from 'storybook/highlight';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="Highlighted"
  decorators={[
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return storyFn();
    },
  ]}
/>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF 3"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

export const Highlighted = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return storyFn();
    },
  ],
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { useChannel } from 'storybook/preview-api';
  import { HIGHLIGHT } from 'storybook/highlight';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="Highlighted"
  decorators={[
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return storyFn();
    },
  ]}
/>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF 3"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Highlighted: Story = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return storyFn();
    },
  ],
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
};

export const Highlighted = {
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return {
        template: '<story />',
      };
    },
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Highlighted: Story = {
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return {
        template: '<story />',
      };
    },
  ],
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

export default {
  component: 'my-component',
};

export const Highlighted = {
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return story();
    },
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const Highlighted: Story = {
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return story();
    },
  ],
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const Highlighted = meta.story({
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return story();
    },
  ],
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const Highlighted = meta.story({
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return story();
    },
  ],
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const Highlighted = meta.story({
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return {
        template: '<story />',
      };
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const Highlighted = meta.story({
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return {
        template: '<story />',
      };
    },
  ],
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const Highlighted = meta.story({
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return storyFn();
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const Highlighted = meta.story({
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
      });
      return storyFn();
    },
  ],
});
```
