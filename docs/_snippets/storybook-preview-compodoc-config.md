```ts filename=".storybook/preview.ts" renderer="angular" language="ts"
import type { Preview } from '@storybook/angular';
import { setCompodocJson } from '@storybook/addon-docs/angular';

import docJson from '../documentation.json'; // The path to your generated json file from Compodoc contains all your documentation information.

setCompodocJson(docJson);

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
```
