```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './Button';

const meta: Meta<Button> = {
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};
export default meta;
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts-4-9"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;
export default meta;
```

```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};
export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  title: 'Button',
  component: 'demo-button',
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};
export default meta;
```

