```ts filename="my-framework/src/server/options.ts" renderer="common" language="ts"
import { sync } from 'read-pkg-up';

export default {
  packageJson: sync({ cwd: process.cwd() }).packageJson,
  framework: 'my-framework',
  frameworkPath: '@my-framework/storybook',
  frameworkPresets: [import.meta.resolve('./framework-preset-my-framework.js')],
};
```
