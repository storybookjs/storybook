```js filename="setupFile.js|ts" renderer="react" language="js"
// Storybook's preview file location
import * as globalStorybookConfig from './.storybook/preview';

import { setProjectAnnotations } from '@storybook/react';

setProjectAnnotations(globalStorybookConfig);
```

```js filename="setupFile.js|ts" renderer="vue" language="js"
// Storybook's preview file location
import * as globalStorybookConfig from './.storybook/preview';

import { setProjectAnnotations } from '@storybook/testing-vue3';

setProjectAnnotations(globalStorybookConfig);
```
