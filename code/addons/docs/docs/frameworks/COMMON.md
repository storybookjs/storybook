<h1>Storybook Docs Common Setup</h1>

Storybook Docs transforms your Storybook stories into world-class component documentation. Docs supports [all web frameworks that Storybook supports](../README.md#framework-support).

Popular frameworks like [React](../react/README.md)/[Vue 3](../vue3/README.md)/[Angular](../angular/README.md)/[Ember](../ember/README.md)/[Web components](../web-components/README.md) have their own framework-specific optimizations and setup guides. This README documents the "common" setup for other frameworks that don't have any docs-specific optimizations.

- [Installation](#installation)
- [DocsPage](#docspage)
- [MDX](#mdx)
- [IFrame height](#iframe-height)
- [More resources](#more-resources)

## Installation

First add the package. Make sure that the versions for your `@storybook/*` packages match:

```sh
yarn add -D @storybook/addon-docs
```

Then add the following to your `.storybook/main.js` addons:

```js
export default {
  addons: ['@storybook/addon-docs'],
};
```

## DocsPage

When you [install docs](#installation) you should get basic [DocsPage](../docs/docspage.md) documentation automagically for all your stories, available in the `Docs` tab of the Storybook UI.

## MDX

[MDX](../docs/mdx.md) is a convenient way to document your components in Markdown and embed documentation components, such as stories and props tables, inline.

Docs has peer dependencies on `react`. If you want to write stories in MDX, you may need to add this dependency as well:

```sh
yarn add -D react
```

Then update your `.storybook/main.js` to make sure you load MDX files:

```js
export default {
  stories: ['../src/stories/**/*.stories.@(js|mdx)'],
};
```

Finally, you can create MDX files like this:

```md
import { Meta, Story, ArgsTable } from '@storybook/addon-docs';

<Meta title='App Component' />

# App Component

Some **markdown** description, or whatever you want.

<Story name='basic' height='400px'>{() => {
return { ... }; // should match the typical story format for your framework
}}</Story>
```

## IFrame height

In the "common" setup, Storybook Docs renders stories inside `iframe`s, with a default height of `60px`. You can update this default globally, or modify the `iframe` height locally per story in `DocsPage` and `MDX`.

To update the global default, modify `.storybook/preview.js`:

```ts
export const parameters = { docs: { story: { iframeHeight: '400px' } } };
```

For `DocsPage`, you need to update the parameter locally in a story:

```ts
export const basic = () => ...
basic.parameters = {
  docs: { story: { iframeHeight: '400px' } }
}
```

And for `MDX` you can modify it, especially if you work with some components using fixed or sticky positions, as an attribute on the `Story` element:

```md
<Story name='basic' height='400px'>{...}</Story>
```

## More resources

Want to learn more? Here are some more articles on Storybook Docs:

- References: [DocsPage](../docs/docspage.md) / [MDX](../docs/mdx.md) / [FAQ](../docs/faq.md) / [Recipes](../docs/recipes.md) / [Theming](../docs/theming.md) / [Props](../docs/props-tables.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
