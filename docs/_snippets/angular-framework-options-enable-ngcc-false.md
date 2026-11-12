```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { defineMain } from '@storybook/angular/node';

const config = defineMain({
  stories: [/* ... */],
  addons: [/* ... */],
  framework: {
    name: '@storybook/angular',
    options: {
      enableNgcc: false,
    },
  },
});

export default config;
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: [/* ... */],
  addons: [/* ... */],
  framework: {
    name: '@storybook/angular',
    options: {
      enableNgcc: false,
    },
  },
};

export default config;
```
