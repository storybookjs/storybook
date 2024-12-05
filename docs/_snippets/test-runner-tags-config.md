```js filename=".storybook/test-runner.js" renderer="common" language="js"
module.exports = {
  tags: {
    include: ['test-only', 'pages'],
    exclude: ['no-tests', 'tokens'],
    skip: ['skip-test', 'layout'],
  },
};
```

```ts filename=".storybook/test-runner.ts" renderer="common" language="ts"
import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  tags: {
    include: ['test-only', 'pages'],
    exclude: ['no-tests', 'tokens'],
    skip: ['skip-test', 'layout'],
  },
};

export default config;
```
