```js filename="./test-runner-jest.config.js" renderer="common" language="js"
import { getJestConfig } from '@storybook/test-runner';

const defaultConfig = getJestConfig();

const config = {
  ...defaultConfig,
  snapshotSerializers: [
    // Sets up the custom serializer to preprocess the HTML before it's passed onto the test-runner
    './snapshot-serializer.js',
    ...defaultConfig.snapshotSerializers,
  ],
};

export default config;
```
