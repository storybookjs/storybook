```ts filename="your-framework/src/client/preview/index.ts" renderer="common" language="ts"
import { start } from '@storybook/preview-api';

import './globals';

import render from './render';

const api = start(render);

// the boilerplate code
```

