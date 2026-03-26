```js
addons.register('my-organisation/my-addon', (api) => {
  // Open a file in the editor
  api.openInEditor({
    file: './src/components/Button.tsx',
  });

  // Handle the api response
  api
    .openInEditor({
      file: './src/components/Button.tsx',
      line: 42,
      column: 15,
    })
    .then((response) => {
      if (response.error) {
        console.error('Failed to open file:', response.error);
      } else {
        console.log('File opened successfully');
      }
    });
});
```
