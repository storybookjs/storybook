```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { definePreview } from '@storybook/angular';

// 👇 Add these
import { setCompodocJson } from '@storybook/addon-docs/angular';
import docJson from '../documentation.json';
setCompodocJson(docJson);

const preview = definePreview({
  // ...
});

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF 3 is deprecated and will be removed in Storybook 12
import type { Preview } from '@storybook/angular';

// 👇 Add these
import { setCompodocJson } from '@storybook/addon-docs/angular';
import docJson from '../documentation.json';
setCompodocJson(docJson);

const preview: Preview = {
  // ...
};

export default preview;
```
