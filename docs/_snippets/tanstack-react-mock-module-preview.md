```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF 4"
import { definePreview } from '@storybook/tanstack-react';
import { sb } from 'storybook/test';

// Prevents postgres (Node-only) from loading in the browser
sb.mock(import('../src/db/client.ts'));

export default definePreview({});
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { sb } from 'storybook/test';

// Prevents postgres (Node-only) from loading in the browser
sb.mock(import('../src/db/client.ts'));

export default {};
```
