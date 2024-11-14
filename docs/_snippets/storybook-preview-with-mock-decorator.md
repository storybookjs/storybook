```js filename=".storybook/preview.js" renderer="common" language="js"
import { decorator } from '../__mocks__/isomorphic-fetch';

// Add the decorator to all stories
export default { decorators: [decorator] };
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { decorator } from '../__mocks__/isomorphic-fetch';

const preview: Preview = {
  decorators: [decorator],
};

export default preview;
```
