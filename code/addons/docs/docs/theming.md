<h1>Storybook Docs Theming</h1>

[Storybook Docs](../README.md) is themable! There are three different levels of theming, just to keep things interesting:

- [Storybook theming](#storybook-theming)
- [CSS escape hatches](#css-escape-hatches)
- [MDX component overrides](#mdx-component-overrides)
- [More resources](#more-resources)

## Storybook theming

Storybook theming is the **recommended way** to theme your docs. Docs uses the same theme system as [Storybook UI](https://storybook.js.org/docs/react/configure/theming), but is themed independently from the main UI.

Supposing you have a Storybook theme defined for the main UI in `.storybook/manager.js`:

```js
// or a custom theme
import { themes } from '@storybook/theming';
import { addons } from '@storybook/manager-api';

addons.setConfig({
  theme: themes.dark,
});
```

Here's how you'd specify the same theme for docs in `.storybook/preview.js`:

```js
import { themes } from '@storybook/theming';

// or global addParameters
export const parameters = {
  docs: {
    theme: themes.dark,
  },
};
```

## CSS escape hatches

The Storybook theme API is narrow by design. If you want to have fine-grained control over the CSS, all of the Docs components are tagged with class names to make this possible. This is advanced usage: use at your own risk.

The classes correspond to markdown elements (e.g. `sbdocs-title`, `sbdocs-subtitle`, `sbdocs-p`, etc.) to UI elements on the page (e.g. `sbdocs-container`, `sbdocs-content`, etc.). To see the currently available classes, use "inspect element" in your browser.

You can style these classes in `.storybook/preview-head.html`. For example, here's how to make the content wider for UHD displays:

```html
<style>
  .sbdocs.sbdocs-content {
    max-width: 1440px;
  }
</style>
```

> NOTE: All of these elements also have the `sbdocs` class, which is an idiomatic way of increasing the CSS specificity so you don't have to use `!important`.

## MDX component overrides

If you're using MDX, there's one more level of themability. MDX allows you to [completely override the components](https://mdxjs.com/advanced/components) that are rendered from markdown using a `components` parameter. This is an advanced usage that we don't officially support in Storybook, but it's a powerful mechanism if you need it.

Here's how you might insert a custom code renderer for `code` blocks on the page, in `.storybook/preview.js`:

```js
import { addParameters } from '@storybook/react';
import { CodeBlock } from './CodeBlock';

addParameters({
  docs: {
    components: {
      code: CodeBlock,
    },
  },
});
```

You can even override a Storybook _block_ component.

Here's how you might insert a custom `<Preview />` block:

```js
import { MyPreview } from './MyPreview';

addParameters({
  docs: {
    components: {
      Preview: MyPreview,
    },
  },
});
```

## More resources

- References: [README](../README.md) / [DocsPage](docspage.md) / [MDX](mdx.md) / [FAQ](faq.md) / [Recipes](recipes.md) / [Theming](theming.md) / [Props](props-tables.md)
- Framework-specific docs: [React](../react/README.md) / [Vue 3](../vue3/README.md) / [Angular](../angular/README.md) / [Web components](../web-components/README.md) / [Ember](../ember/README.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
