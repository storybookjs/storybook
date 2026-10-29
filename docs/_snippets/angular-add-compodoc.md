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
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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
