---
title: 'Story rendering'
---

In Storybook, your stories render in a particular “preview” iframe (Canvas tab) inside the larger Storybook web application. The JavaScript build configuration of the preview is controlled by a [webpack](../builders/webpack.md) config, but you also may want to directly control the rendered HTML to help your stories render correctly.

## Adding to &#60;head&#62;

If you need to add extra elements to the `head` of the preview iframe, for instance, to load static stylesheets, font files, or similar, you can create a file called [`.storybook/preview-head.html`](./index.md#configure-story-rendering) and add tags like this:

<CodeSnippets
paths={[
'common/storybook-preview-head-example.html.mdx',
]}
/>

<Callout variant="info">

Storybook will inject these tags into the _preview iframe_ where your components render, not the Storybook application UI.

</Callout>

However, it's also possible to modify the preview head HTML programmatically using a preset defined in the `main.js` file. Read the [presets documentation](../addons/writing-presets.md#ui-configuration) for more information.

## Adding to &#60;body&#62;

Sometimes, you may need to add different tags to the `<body>`. Helpful for adding some custom content roots.

You can accomplish this by creating a file called `preview-body.html` inside your `.storybook` directory and adding tags like this:

<CodeSnippets
paths={[
'common/storybook-preview-body-example.html.mdx',
]}
/>

If using relative sizing in your project (like `rem` or `em`), you may update the base `font-size` by adding a `style` tag to `preview-body.html`:

<CodeSnippets
paths={[
'common/storybook-preview-body-font-size.html.mdx',
]}
/>

<Callout variant="info">

Storybook will inject these tags into the _preview iframe_ where your components render, not the Storybook application UI.

</Callout>

Just like how you have the ability to customize the preview `head` HTML tag, you can also follow the same steps to customize the preview `body` with a preset. To obtain more information on how to do this, refer to the [presets documentation](../addons/writing-presets.md#ui-configuration).
