```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF (Legacy)"
import { sb } from 'storybook/test';

// Prevents postgres (Node-only) from loading in the browser
sb.mock(import('../src/db/client.ts'));

export default {};
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF"
import { definePreview } from '@storybook/tanstack-react';
import { sb } from 'storybook/test';

// Prevents postgres (Node-only) from loading in the browser
sb.mock(import('../src/db/client.ts'));

export default definePreview({});
```
