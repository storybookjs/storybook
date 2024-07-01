```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
import { addons } from '@storybook/preview-api';

// Register the addon with a unique name.
addons.register('my-organisation/my-addon', (api) => {});
```

