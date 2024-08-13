```js filename="vitest.config.js" renderer="vue" language="js" tabTitle="Vite"
import { defineConfig } from 'vitest/config';
import { mergeConfig } from 'vite';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      clearMocks: true,
      setupFiles: './src/setupTests.js', //👈 Our configuration file enabled here
    },
  })
);
```

```ts filename="vitest.config.ts" renderer="vue" language="ts" tabTitle="Vite"
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { mergeConfig } from 'vite';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      clearMocks: true,
      setupFiles: './src/setupTests.ts', //👈 Our configuration file enabled here
    },
  })
);
```

```json filename="package.json" renderer="vue" language="js" tabTitle="Jest"
{
  "scripts": {
    "test": "jest --setupFiles ./setupFile.js"
  }
}
```

```json filename="src/setupTests.js" renderer="vue" language="ts" tabTitle="Jest"
{
  "scripts": {
    "test": "jest --setupFiles ./setupFile.js"
  }
}
```
