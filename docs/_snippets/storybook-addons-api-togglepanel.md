```js
addons.register('my-organisation/my-addon', (api) => {
  // Toggle panel visibility
  api.togglePanel();

  // Show the panel
  api.togglePanel(true);

  // Hide the panel
  api.togglePanel(false);
});
```
