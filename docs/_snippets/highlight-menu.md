```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ],
        ],
      });
      return story;
    }),
  ],
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js"
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ],
        ],
      });
      return storyFn();
    },
  ],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts"
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ],
        ],
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ]
        ],
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ],
        ],
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ]
        ],
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ],
        ],
      });
      return storyFn();
    },
  ],
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ],
        ],
      });
      return {
        template: '<story />',
      };
    },
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ],
        ],
      });
      return {
        template: '<story />',
      };
    },
  ],
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ],
        ],
      });
      return story();
    },
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
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
        menu: [
          [
            {
              id: 'button-name',
              title: 'Login',
              description: 'Navigate to the login page',
              clickEvent: 'my-menu-click-event',
            },
            {
              id: 'h2-home',
              title: 'Acme',
              description: 'Navigate to the home page',
            },
          ],
        ],
      });
      return story();
    },
  ],
};
```
