```js filename="example-addon/src/webpack/webpackFinal.js" renderer="common" language="js"
import { fileURLtoPath } from 'node:url';
export function webpackFinal(config, options = {}) {
  const rules = [
    ...(config.module?.rules || []),
    {
      test: /\.custom-file-extension$/,
      loader: fileURLToPath(import.meta.resolve(`custom-loader`)),
    },
  ];
  config.module.rules = rules;

  return config;
}
```

```ts filename="example-addon/src/webpack/webpackFinal.ts" renderer="common" language="ts"
import { fileURLtoPath } from 'node:url';
import type { Configuration as WebpackConfig } from 'webpack';

export function webpackFinal(config: WebpackConfig, options: any = {}) {
  const rules = [
    ...(config.module?.rules || []),
    {
      test: /\.custom-file$/,
      loader: fileURLToPath(import.meta.resolve(`custom-loader`)),
    },
  ];
  config.module.rules = rules;

  return config;
}
```
