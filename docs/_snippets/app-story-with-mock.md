```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { App } from './app.component';

const meta: Meta<App> = {
  component: App,
};

export default meta;
type Story = StoryObj<App>;

export const Success: Story = {
  parameters: {
    fetch: {
      json: {
        JavaScript: 3390991,
        'C++': 44974,
        TypeScript: 15530,
        CoffeeScript: 12253,
        Python: 9383,
        C: 5341,
        Shell: 5115,
        HTML: 3420,
        CSS: 3171,
        Makefile: 189,
      },
    },
  },
};
```

```js filename="App.stories.js|jsx" renderer="common" language="js"
import App from './App';

export default {
  component: App,
};

export const Success = {
  parameters: {
    fetch: {
      json: {
        JavaScript: 3390991,
        'C++': 44974,
        TypeScript: 15530,
        CoffeeScript: 12253,
        Python: 9383,
        C: 5341,
        Shell: 5115,
        HTML: 3420,
        CSS: 3171,
        Makefile: 189,
      },
    },
  },
};
```

```ts filename="App.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import App from './App';

const meta = {
  component: App,
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Success: Story = {
  parameters: {
    fetch: {
      json: {
        JavaScript: 3390991,
        'C++': 44974,
        TypeScript: 15530,
        CoffeeScript: 12253,
        Python: 9383,
        C: 5341,
        Shell: 5115,
        HTML: 3420,
        CSS: 3171,
        Makefile: 189,
      },
    },
  },
};
```

```ts filename="App.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import App from './App';

const meta: Meta<typeof App> = {
  component: App,
};

export default meta;
type Story = StoryObj<typeof App>;

export const Success: Story = {
  parameters: {
    fetch: {
      json: {
        JavaScript: 3390991,
        'C++': 44974,
        TypeScript: 15530,
        CoffeeScript: 12253,
        Python: 9383,
        C: 5341,
        Shell: 5115,
        HTML: 3420,
        CSS: 3171,
        Makefile: 189,
      },
    },
  },
};
```

```js filename="App.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-app',
};

export const Success = {
  parameters: {
    fetch: {
      json: {
        JavaScript: 3390991,
        'C++': 44974,
        TypeScript: 15530,
        CoffeeScript: 12253,
        Python: 9383,
        C: 5341,
        Shell: 5115,
        HTML: 3420,
        CSS: 3171,
        Makefile: 189,
      },
    },
  },
};
```

```ts filename="App.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-app',
};

export default meta;
type Story = StoryObj;

export const Success: Story = {
  parameters: {
    fetch: {
      json: {
        JavaScript: 3390991,
        'C++': 44974,
        TypeScript: 15530,
        CoffeeScript: 12253,
        Python: 9383,
        C: 5341,
        Shell: 5115,
        HTML: 3420,
        CSS: 3171,
        Makefile: 189,
      },
    },
  },
};
```
