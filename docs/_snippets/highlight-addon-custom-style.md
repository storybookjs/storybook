```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';
import { useChannel } from '@storybook/preview-api';
import { HIGHLIGHT } from '@storybook/addon-highlight';

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
        elements: ['h2', 'a', '.storybook-button'],
        color: 'blue',
        style: 'double', // 'dotted' | 'dashed' | 'solid' | 'double'
      });
      return story;
    }),
  ],
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js"
import { useChannel } from '@storybook/preview-api';
import { HIGHLIGHT } from '@storybook/addon-highlight';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const StyledHighlight = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        elements: ['h2', 'a', '.storybook-button'],
        color: 'blue',
        style: 'double', // 'dotted' | 'dashed' | 'solid' | 'double'
      });
      return storyFn();
    },
  ],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';
import { useChannel } from '@storybook/preview-api';
import { HIGHLIGHT } from '@storybook/addon-highlight';

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
        elements: ['h2', 'a', '.storybook-button'],
        color: 'blue',
        style: 'double', // 'dotted' | 'dashed' | 'solid' | 'double'
      });
      return storyFn();
    },
  ],
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';
import { useChannel } from '@storybook/preview-api';
import { HIGHLIGHT } from '@storybook/addon-highlight';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const StyledHighlight: Story = {
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        elements: ['h2', 'a', '.storybook-button'],
        color: 'blue',
        style: 'double', // 'dotted' | 'dashed' | 'solid' | 'double'
      });
      return storyFn();
    },
  ],
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
import { useChannel } from '@storybook/preview-api';
import { HIGHLIGHT } from '@storybook/addon-highlight';

import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
};

export const StyledHighlight = {
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        elements: ['h2', 'a', '.storybook-button'],
        color: 'blue',
        style: 'double', // 'dotted' | 'dashed' | 'solid' | 'double'
      });
      return {
        template: '<story />',
      };
    },
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';
import { useChannel } from '@storybook/preview-api';
import { HIGHLIGHT } from '@storybook/addon-highlight';

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
        elements: ['h2', 'a', '.storybook-button'],
        color: 'blue',
        style: 'double', // 'dotted' | 'dashed' | 'solid' | 'double'
      });
      return {
        template: '<story />',
      };
    },
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';
import { useChannel } from '@storybook/preview-api';
import { HIGHLIGHT } from '@storybook/addon-highlight';

import MyComponent from './MyComponent.vue';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const StyledHighlight: Story = {
  decorators: [
    () => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        elements: ['h2', 'a', '.storybook-button'],
        color: 'blue',
        style: 'double', // 'dotted' | 'dashed' | 'solid' | 'double'
      });
      return {
        template: '<story />',
      };
    },
  ],
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { useChannel } from '@storybook/preview-api';
import { HIGHLIGHT } from '@storybook/addon-highlight';

export default {
  component: 'my-component',
};

export const StyledHighlight = {
  decorators: [
    (story) => {
      const emit = useChannel({});
      emit(HIGHLIGHT, {
        elements: ['h2', 'a', '.storybook-button'],
        color: 'blue',
        style: 'double', // 'dotted' | 'dashed' | 'solid' | 'double'
      });
      return story();
    },
  ],
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';
import { useChannel } from '@storybook/preview-api';
import { HIGHLIGHT } from '@storybook/addon-highlight';

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
        elements: ['h2', 'a', '.storybook-button'],
        color: 'blue',
        style: 'double', // 'dotted' | 'dashed' | 'solid' | 'double'
      });
      return story();
    },
  ],
};
```

