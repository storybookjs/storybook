```js filename=".storybook/test-runner.js" renderer="common" language="js" tabTitle="config"
module.exports = {
  tags: {
    exclude: ['no-tests'],
  },
};
```

```ts filename=".storybook/test-runner.ts" renderer="common" language="ts" tabTitle="config"
import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  tags: {
    exclude: ['no-tests'],
  },
};

export default config;
```

