```js filename="preset.js" renderer="common" language="js" tabTitle="root-preset"
export const previewAnnotations = (entry = [], options) => {
  return [...entry, import.meta.resolve('./dist/preview')];
};
```

```ts filename="preset.ts" renderer="common" language="ts" tabTitle="root-preset"
export const previewAnnotations = (entry = [], options) => {
  return [...entry, import.meta.resolve('./dist/preview')];
};
```
