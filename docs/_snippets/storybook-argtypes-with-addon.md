```js filename=".storybook/my-addon/manager.js" renderer="common" language="js"
import { useArgTypes } from '@storybook/manager-api';

// inside your panel
const { argTypes } = useArgTypes();
```
