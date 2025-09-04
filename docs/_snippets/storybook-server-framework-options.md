```ts filename="my-framework/src/server/options.ts" renderer="common" language="ts"
import { readFileSync } from 'node:fs';
import * as pkg from 'empathic/package';

export default {
  packageJson: JSON.parse(readFileSync(pkg.up({ cwd: process.cwd() }))),
  framework: 'my-framework',
  frameworkPath: '@my-framework/storybook',
  frameworkPresets: [import.meta.resolve('./framework-preset-my-framework.js')],
};
```
