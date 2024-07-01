```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/<your-framework>';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>; // 👈 Satisfies operator being used for stricter type checking.

export default meta;
```

