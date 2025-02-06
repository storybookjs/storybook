```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
});
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
});
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
});
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};

export default meta;
```
