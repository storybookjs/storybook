# Angular Compodoc

Shared parsing of [Compodoc](https://compodoc.app/)'s `documentation.json` into Storybook argTypes.

`@storybook/angular` and `@storybook/angular-vite` both turn Compodoc metadata into controls, and the Vite framework does it a second time inside a Node docgen worker. This package holds that logic once so the three call sites cannot drift apart.

- The root entry is environment-agnostic: it reads no globals and takes the Compodoc JSON, the feature flag, the logger and the HTML unwrapper as arguments, so it runs in a Node worker as well as in the preview.
- `./browser` is the preview-side adapter that supplies those four things from the browser globals.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
