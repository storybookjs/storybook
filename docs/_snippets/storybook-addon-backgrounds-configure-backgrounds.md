```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

// To apply a set of backgrounds to all stories of Button:
const meta: Meta<Button> = {
  component: Button,
  parameters: {
    backgrounds: {
      default: 'twitter',
      values: [
        { name: 'twitter', value: '#00aced' },
        { name: 'facebook', value: '#3b5998' },
      ],
    },
  },
};

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

// To apply a set of backgrounds to all stories of Button:
export default {
  component: Button,
  parameters: {
    backgrounds: {
      default: 'twitter',
      values: [
        { name: 'twitter', value: '#00aced' },
        { name: 'facebook', value: '#3b5998' },
      ],
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

// To apply a set of backgrounds to all stories of Button:
const meta = {
  component: Button,
  parameters: {
    backgrounds: {
      default: 'twitter',
      values: [
        { name: 'twitter', value: '#00aced' },
        { name: 'facebook', value: '#3b5998' },
      ],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

// To apply a set of backgrounds to all stories of Button:
const meta: Meta<typeof Button> = {
  component: Button,
  parameters: {
    backgrounds: {
      default: 'twitter',
      values: [
        { name: 'twitter', value: '#00aced' },
        { name: 'facebook', value: '#3b5998' },
      ],
    },
  },
};

export default meta;
```

