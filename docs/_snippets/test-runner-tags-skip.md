```js filename=".storybook/test-runner.js" renderer="common" language="js" tabTitle="config"
module.exports = {
  tags: {
    skip: ['skip-test'],
  },
};
```

```ts filename=".storybook/test-runner.ts" renderer="common" language="ts" tabTitle="config"
import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  tags: {
    skip: ['skip-test'],
  },
};

export default config;
```

