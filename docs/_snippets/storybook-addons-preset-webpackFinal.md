```js filename="example-addon/src/webpack/webpackFinal.js" renderer="common" language="js"
export function webpackFinal(config, options = {}) {
  const rules = [
    ...(config.module?.rules || []),
    {
      test: /\.custom-file-extension$/,
      loader: require.resolve(`custom-loader`),
    },
  ];
  config.module.rules = rules;

  return config;
}
```

```ts filename="example-addon/src/webpack/webpackFinal.ts" renderer="common" language="ts"
import type { Configuration as WebpackConfig } from 'webpack';

export function webpackFinal(config: WebpackConfig, options: any = {}) {
  const rules = [
    ...(config.module?.rules || []),
    {
      test: /\.custom-file$/,
      loader: require.resolve(`custom-loader`),
    },
  ];
  config.module.rules = rules;

  return config;
}
```

