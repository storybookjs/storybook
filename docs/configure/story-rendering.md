---
title: 'Story rendering'
---

In Storybook, your stories render in a particular “preview” iframe (also called the Canvas) inside the larger Storybook web application. The JavaScript build configuration of the preview is controlled by a [builder](../builders/index.md) config, but you also may want to run some code for every story or directly control the rendered HTML to help your stories render correctly.

## Running code for every story

Code executed in the preview file (`.storybook/preview.js|ts`) runs for every story in your Storybook. This is useful for setting up global styles, initializing libraries, or anything else required to render your components.

<If notRenderer={['angular', 'vue']}>

Here's an example of how you might use the preview file to initialize a library that must run before your components render:

```ts
// .storybook/preview.ts
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-renderer';

import { initialize } from '../lib/your-library';

initialize();

const preview: Preview = {
  // ...
};

export default preview;
```

</If>

<If renderer={['angular', 'vue']}>

For example, with Vue, you can extend Storybook's application and register your library (e.g., [Fontawesome](https://github.com/FortAwesome/vue-fontawesome)). Or with Angular, add the package ([localize](https://angular.io/api/localize)) into your `polyfills.ts` and import it:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'vue/storybook-preview-with-library-decorator.library-3.js.mdx',
    'vue/storybook-preview-with-library-decorator.library-3.ts.mdx',
    'vue/storybook-preview-with-hoc-component-decorator.component-3.js.mdx',
    'vue/storybook-preview-with-hoc-component-decorator.component-3.ts.mdx',
    'angular/add-localize-package-to-polyfills.ts.mdx',
    'angular/storybook-preview-with-angular-polyfills.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

</If>

## Adding to &#60;head&#62;

If you need to add extra elements to the `head` of the preview iframe, for instance, to load static stylesheets, font files, or similar, you can create a file called [`.storybook/preview-head.html`](./index.md#configure-story-rendering) and add tags like this:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-preview-head-example.html.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="info">

Storybook will inject these tags into the _preview iframe_ where your components render, not the Storybook application UI.

</Callout>

However, it's also possible to modify the preview head HTML programmatically using a preset defined in the `main.js` file. Read the [presets documentation](../addons/writing-presets.md#ui-configuration) for more information.

## Adding to &#60;body&#62;

Sometimes, you may need to add different tags to the `<body>`. Helpful for adding some custom content roots.

You can accomplish this by creating a file called `preview-body.html` inside your `.storybook` directory and adding tags like this:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-preview-body-example.html.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

If using relative sizing in your project (like `rem` or `em`), you may update the base `font-size` by adding a `style` tag to `preview-body.html`:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-preview-body-font-size.html.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="info">

Storybook will inject these tags into the _preview iframe_ where your components render, not the Storybook application UI.

</Callout>

Just like how you have the ability to customize the preview `head` HTML tag, you can also follow the same steps to customize the preview `body` with a preset. To obtain more information on how to do this, refer to the [presets documentation](../addons/writing-presets.md#ui-configuration).
