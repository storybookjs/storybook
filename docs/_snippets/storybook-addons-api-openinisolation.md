```js
addons.register('my-organisation/my-addon', (api) => {
  // Open the current story in isolation mode
  api.openInIsolation('button--primary');

  // Open a story from an external ref in isolation
  api.openInIsolation('external-button--secondary', 'external-ref');

  // Open a story in docs view mode
  api.openInIsolation('button--primary', null, 'docs');
});
```
