```js filename="CSF 3 - Button.stories.js|jsx" renderer="common" language="js"
export default { component: Button };
```

```ts filename="CSF 3 - Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular/';

const meta: Meta<Button> = {
  component: Button,
};
```

```ts filename="CSF 3 - Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

const meta: Meta<typeof Button> = {
  component: Button,
};
```
