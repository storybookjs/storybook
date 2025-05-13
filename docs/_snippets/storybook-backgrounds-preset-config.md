```js filename="preset.js" renderer="common" language="js"
export function config(entry = []) {
  return [...entry, require.resolve('./defaultParameters')];
}
```
