```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF 3"
export default {};
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Preview } from '@storybook/tanstack-react';

const preview: Preview = {};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/tanstack-react';

export default definePreview({});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/tanstack-react';

export default definePreview({});
```
