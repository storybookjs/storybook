```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { componentWrapperDecorator } from '@storybook/angular';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import { MyComponent } from './my-component.component';

const meta = preview.meta({
  component: MyComponent,
});

export const ResetHighlight = meta.story({
  decorators: [
    componentWrapperDecorator((story) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return story;
    }),
  ],
});
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { type Meta, type StoryObj, componentWrapperDecorator } from '@storybook/angular';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './my-component.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const ResetHighlight: Story = {
  decorators: [
    componentWrapperDecorator((story) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return story;
    }),
  ],
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const ResetHighlight = meta.story({
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return storyFn();
    },
  ],
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const ResetHighlight = meta.story({
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return storyFn();
    },
  ],
});
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import { useChannel } from 'storybook/preview-api';
  import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    component: MyComponent,
  });
</script>

<Story
  name="ResetHighlight"
  decorators={[
    (storyFn) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return storyFn();
    },
  ]}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { useChannel } from 'storybook/preview-api';
  import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="ResetHighlight"
  decorators={[
    (storyFn) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return storyFn();
    },
  ]}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import { useChannel } from 'storybook/preview-api';
  import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    component: MyComponent,
  });
</script>

<Story
  name="ResetHighlight"
  decorators={[
    (storyFn) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return storyFn();
    },
  ]}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { useChannel } from 'storybook/preview-api';
  import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="ResetHighlight"
  decorators={[
    (storyFn) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return storyFn();
    },
  ]}
/>
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const ResetHighlight = meta.story({
  decorators: [
    () => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return {
        template: '<story />',
      };
    },
  ],
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const ResetHighlight = meta.story({
  decorators: [
    () => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return {
        template: '<story />',
      };
    },
  ],
});
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const ResetHighlight = meta.story({
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return story();
    },
  ],
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const ResetHighlight = meta.story({
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return story();
    },
  ],
});
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

export default {
  component: 'my-component',
};

export const ResetHighlight = {
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return story();
    },
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const ResetHighlight: Story = {
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return story();
    },
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ResetHighlight: Story = {
  decorators: [
    () => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return {
        template: '<story />',
      };
    },
  ],
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
};

export const ResetHighlight = {
  decorators: [
    () => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return {
        template: '<story />',
      };
    },
  ],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ResetHighlight: Story = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return storyFn();
    },
  ],
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const ResetHighlight = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(RESET_HIGHLIGHT); //👈 Remove previously highlighted elements
      emit(HIGHLIGHT, {
        id: 'my-highlight',
        selectors: ['header', 'section', 'footer'],
      });
      return storyFn();
    },
  ],
};
```
