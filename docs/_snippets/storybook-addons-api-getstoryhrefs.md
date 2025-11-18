```js
addons.register('my-organisation/my-addon', (api) => {
  // Get the manager and preview URLs for a story
  const { managerHref, previewHref } = api.getStoryHrefs('button--primary');

  // Get absolute URLs based on the current manager URL (origin)
  api.getStoryHrefs('button--primary', { base: 'origin' });

  // Get absolute URLs based on the dev server's local network IP address
  api.getStoryHrefs('button--primary', { base: 'network' });

  // Get clean URLs without args or globals
  api.getStoryHrefs('button--primary', { inheritArgs: false, inheritGlobals: false });

  // With args and globals (merged on top of inherited args/globals) as well as a custom query param
  // Note that args and globals should be serialized (see `buildArgsParam` from `storybook/internal/router`)
  api.getStoryHrefs('button--primary', { queryParams: { args: 'label:Label', globals: 'outline:!true', custom: 'value' } });

  // Link to a story from an external ref
  api.getStoryHrefs('button--primary', { refId: 'external-ref' });

  // Link to a docs page
  api.getStoryHrefs('button--docs', { viewMode: 'docs' });
});
```
