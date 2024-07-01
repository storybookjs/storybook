```js filename="./test-runner-jest.config.js" renderer="common" language="js"
import { getJestConfig } from '@storybook/test-runner';

const defaultConfig = getJestConfig();

const config = {
  // The default Jest configuration comes from @storybook/test-runner
  ...defaultConfig,
  snapshotResolver: './snapshot-resolver.js',
};

export default config;
```

