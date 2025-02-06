<!-- TODO: Vet this example for CSF Factories (usage with addons) -->

```js filename="preset.js" renderer="common" language="js"
export function config(entry = []) {
  return [...entry, require.resolve('./defaultParameters')];
}
```
