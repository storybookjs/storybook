```js filename="preset.js" renderer="common" language="js"
export const previewAnnotations = (entry = [], options) => {
  return [...entry, import.meta.resolve('./dist/preview')];
};
```
