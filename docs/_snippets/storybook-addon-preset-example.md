```js filename=".storybook/my-addon/preset.js" renderer="common" language="js"
export function previewAnnotations(entry = []) {
  return [...entry, import.meta.resolve('./defaultParameters')];
}

export function managerEntries(entries) {
  return [...entries, import.meta.resolve('./register')];
}

export default {
  parameters: {
    backgrounds: {
      values: [
        { name: 'light', value: '#F8F8F8' },
        { name: 'dark', value: '#333333' },
      ],
    },
  },
};
```
