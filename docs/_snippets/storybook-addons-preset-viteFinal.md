```js filename="example-addon/src/vite/viteFinal.js" renderer="common" language="js"
export function ViteFinal(config, options = {}) {
  config.plugins.push(
    new MyCustomPlugin({
      someOption: true,
    }),
  );

  return config;
}
```

```ts filename="example-addon/src/vite/viteFinal.ts" renderer="common" language="ts"
export function ViteFinal(config: any, options: any = {}) {
  config.plugins.push(
    new MyCustomPlugin({
      someOption: true,
    }),
  );

  return config;
}
```

