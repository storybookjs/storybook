```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

/**
 * Button is used for user interactions that do not navigate to another route
 */
export default {
  component: Button,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

/**
 * Button is used for user interactions that do not navigate to another route
 */
const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

/**
 * Button is used for user interactions that do not navigate to another route
 */
const meta = preview.meta({
  component: Button,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

/**
 * Button is used for user interactions that do not navigate to another route
 */
const meta = preview.meta({
  component: Button,
});
```
