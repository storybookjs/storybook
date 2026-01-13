```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const StyledHighlight: Story = {
  decorators: [
    componentWrapperDecorator((story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
      });
      return story;
    }),
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { componentWrapperDecorator } from '@storybook/angular';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './MyComponent.component';

const meta = preview.meta({
  component: MyComponent,
});

export const StyledHighlight = meta.story({
  decorators: [
    componentWrapperDecorator((story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
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

export const StyledHighlight = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
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

export const StyledHighlight: Story = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
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
  name="StyledHighlight"
  decorators={[
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
      });
      return storyFn();
    },
  ]}
/>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

export const StyledHighlight = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
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
  name="StyledHighlight"
  decorators={[
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
      });
      return storyFn();
    },
  ]}
/>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
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

export const StyledHighlight: Story = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
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

export const StyledHighlight = {
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
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

export const StyledHighlight: Story = {
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
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

export const StyledHighlight = {
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
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

export const StyledHighlight: Story = {
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'sb-highlight-pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes sb-highlight-pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
      });
      return story();
    },
  ],
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

const meta = preview.meta({
  component: 'my-component',
});

export const StyledHighlight = meta.story({
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
      });
      return story();
    },
  ],
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

const meta = preview.meta({
  component: 'my-component',
});

export const StyledHighlight = meta.story({
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'sb-highlight-pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes sb-highlight-pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
      });
      return story();
    },
  ],
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const StyledHighlight = meta.story({
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
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
import preview from '../.storybook/preview';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const StyledHighlight = meta.story({
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
      });
      return {
        template: '<story />',
      };
    },
  ],
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const StyledHighlight = meta.story({
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
      });
      return storyFn();
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const StyledHighlight = meta.story({
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        selectors: ['h2', 'a', '.storybook-button'],
        styles: {
          backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
          outline: '3px solid hotpink',
          animation: 'pulse 3s linear infinite',
          transition: 'outline-offset 0.2s ease-in-out',
        },
        hoverStyles: {
          outlineOffset: '3px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        keyframes: `@keyframes pulse {
          0% { outline-color: rgba(255, 105, 180, 1); }
          50% { outline-color: rgba(255, 105, 180, 0.2); }
          100% { outline-color: rgba(255, 105, 180, 1); }
        }`,
      });
      return storyFn();
    },
  ],
});
```
