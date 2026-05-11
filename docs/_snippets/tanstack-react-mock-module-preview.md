```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF 3"
import { sb } from 'storybook/test';

// Prevents postgres (Node-only) from loading in the browser
sb.mock(import('../src/db/client.ts'));

export default {};
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/tanstack-react';
import { sb } from 'storybook/test';

// Prevents postgres (Node-only) from loading in the browser
sb.mock(import('../src/db/client.ts'));

export default definePreview({});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->
