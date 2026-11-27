```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  // ...
  framework: '@storybook/angular', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/11/writing-stories/csf/upgrade
import { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/angular', // 👈 Add this
};

export default config;
```
