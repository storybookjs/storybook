# Storybook Core-Client

This package contains browser-side functionality shared amongst all the frameworks (React, RN, Vue 3, Ember, Angular, etc) in the old "v6" story store back-compatibility layer.

A framework calls the `start(renderToCanvas, { render, decorateStory })` function and provides:

- The `renderToCanvas` function, which tells Storybook how to render the result of a story function to the DOM
- The `render` function, which is a default mapping of `args` to a story result in CSFv3
- The `decorateStory` function, which tells Storybook how to combine decorators in the framework.

The `start` function will return a `configure()` function, which can be re-exported to be used in `preview.js` (deprecated), or automatically by the `main.js:stories` field to:

- return a list of CSF files
- `deprecated` make calls to the `storiesOf` API.
