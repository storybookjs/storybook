```js filename="preset.js" renderer="common" language="js" tabTitle="root-preset"
export const previewAnnotations = (entry = [], options) => {
  return [...entry, require.resolve('./dist/preview')];
};
```

```js filename="preset.js" renderer="common" language="ts" tabTitle="root-preset"
export const previewAnnotations = (entry = [], options) => {
  return [...entry, require.resolve('./dist/preview')];
};
```

