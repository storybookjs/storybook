```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { withActions } from 'storybook/actions/decorator';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
};

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

import { withActions } from 'storybook/actions/decorator';

export default {
  component: Button,
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Meta } from '@storybook/your-framework';

import { withActions } from 'storybook/actions/decorator';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
} satisfies Meta<typeof Button>;

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { withActions } from 'storybook/actions/decorator';

export default {
  component: 'demo-button',
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

import { withActions } from 'storybook/actions/decorator';

const meta: Meta = {
  component: 'demo-button',
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
};

export default meta;
```
