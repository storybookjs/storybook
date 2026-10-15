```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF (Legacy)"
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

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF"
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
