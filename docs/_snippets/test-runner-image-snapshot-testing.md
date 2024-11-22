```js filename=".storybook/test-runner.js" renderer="common" language="js"
const { waitForPageReady } = require('@storybook/test-runner');

const { toMatchImageSnapshot } = require('jest-image-snapshot');

const customSnapshotsDir = `${process.cwd()}/__snapshots__`;

/** @type { import('@storybook/test-runner').TestRunnerConfig } */
module.exports = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  async postVisit(page, context) {
    // Waits for the page to be ready before taking a screenshot to ensure consistent results
    await waitForPageReady(page);

    // To capture a screenshot for different browsers, add page.context().browser().browserType().name() to get the browser name to prefix the file name
    const image = await page.screenshot();
    expect(image).toMatchImageSnapshot({
      customSnapshotsDir,
      customSnapshotIdentifier: context.id,
    });
  },
};
```

```ts filename=".storybook/test-runner.ts" renderer="common" language="ts"
import { TestRunnerConfig, waitForPageReady } from '@storybook/test-runner';

import { toMatchImageSnapshot } from 'jest-image-snapshot';

const customSnapshotsDir = `${process.cwd()}/__snapshots__`;

const config: TestRunnerConfig = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  async postVisit(page, context) {
    // Waits for the page to be ready before taking a screenshot to ensure consistent results
    await waitForPageReady(page);

    // To capture a screenshot for for different browsers, add page.context().browser().browserType().name() to get the browser name to prefix the file name
    const image = await page.screenshot();
    expect(image).toMatchImageSnapshot({
      customSnapshotsDir,
      customSnapshotIdentifier: context.id,
    });
  },
};
export default config;
```
