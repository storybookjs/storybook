```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  parameters: { actions: { argTypesRegex: '^on.*' } },
};

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  parameters: { actions: { argTypesRegex: '^on.*' } },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: { actions: { argTypesRegex: '^on.*' } },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  parameters: { actions: { argTypesRegex: '^on.*' } },
};

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  parameters: { actions: { argTypesRegex: '^on.*' } },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
  parameters: { actions: { argTypesRegex: '^on.*' } },
};

export default meta;
```

