```js filename=".storybook/preview.js" renderer="ember" language="js"
import { setJSONDoc } from '@storybook/addon-docs/ember';

import docJson from '../dist/storybook-docgen/index.json';
setJSONDoc(docJson);

export default {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};
```
