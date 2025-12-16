```js filename="next.config.js" language="js" renderer="react"
import path from 'node:path';

export default {
  // Any options here are included in Sass compilation for your stories
  sassOptions: {
    includePaths: [path.join(process.cwd(), 'styles')],
  },
};
```

```ts filename="next.config.ts" language="ts" renderer="react"
import * as path from 'path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Any options here are included in Sass compilation for your stories
  sassOptions: {
    includePaths: [path.join(process.cwd(), 'styles')],
  },
};

export default config;
```
