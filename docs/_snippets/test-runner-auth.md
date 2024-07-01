```js filename=".storybook/test-runner.js" renderer="common" language="js"
module.exports = {
  getHttpHeaders: async (url) => {
    const token = url.includes('prod') ? 'XYZ' : 'ABC';
    return {
      Authorization: `Bearer ${token}`,
    };
  },
};
```

```ts filename=".storybook/test-runner.ts" renderer="common" language="ts"
import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  getHttpHeaders: async (url) => {
    const token = url.includes('prod') ? 'prod-token' : 'dev-token';
    return {
      Authorization: `Bearer ${token}`,
    };
  },
};

export default config;
```

