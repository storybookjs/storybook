```js filename="preset.js" renderer="common" language="js"
export const previewAnnotations = (entry = [], options) => {
  return [...entry, require.resolve('./dist/preview')];
};
```

