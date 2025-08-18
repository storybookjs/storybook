```js filename="preset.js" renderer="common" language="js"
export function previewAnnotations(entry = []) {
  return [...entry, import.meta.resolve('./defaultParameters')];
}
```
